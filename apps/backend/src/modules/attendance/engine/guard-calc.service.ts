import { Injectable } from '@nestjs/common';
import { AttendanceStatus, ShiftType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tehranMidnightInstant, toJalaliParts, workDateOf } from './jalali.util';

// Guard-duty shift lengths this service knows how to resolve — kept separate
// from ShiftType.ROTATING/NIGHT/etc, which have no engine support.
const GUARD_SHIFT_TYPES: ShiftType[] = [ShiftType.TWENTY_FOUR_TWENTY_FOUR, ShiftType.TWENTY_FOUR_FORTY_EIGHT];

// At a real handoff, BOTH guards tend to scan within a short window of each
// other — the arriving guard's own scan and the outgoing guard's departure
// confirmation — in no fixed order. Events within this window of each other
// are treated as one "handoff cluster"; tiny next to dutyMinutes (24h), so it
// can never merge two genuinely separate shifts.
const CLUSTER_WINDOW_MS = 3 * 60 * 60_000;

export interface GuardShiftConfig {
  id: string;
  dutyMinutes: number;
  fullCreditMinutes: number;
  absentBelowMinutes: number;
}

interface ShiftInstance {
  userId: string;
  start: Date;
  end: Date | null; // null = still open (no handoff/auto-close resolved yet)
}

/**
 * Computes AttendanceDay rows for a guard-duty rotation (24/24, 24/48, ...)
 * DIRECTLY from the punch clock — no manual calendar entry required.
 *
 * The device never logs a distinct "check-out": each guard on a shift template
 * scans exactly once, at handoff time. So a shift's end isn't found on that
 * guard's own timeline — it's the moment the NEXT guard on the same shift
 * template scans in (whoever that is). This service merges every assigned
 * guard's punches into one chronological relay chain per Shift template and
 * walks it: each punch closes the previous guard's shift and opens the next.
 *
 * If nobody relieves a guard within dutyMinutes, that shift auto-closes at
 * start+dutyMinutes (full credit, benefit of the doubt — nothing proves they
 * left early). If NO ONE assigned to the shift punches for a stretch of one or
 * more full calendar days afterward, those days are treated as "post wasn't
 * needed" and every currently-assigned guard is granted LEAVE for them rather
 * than flagged ABSENT.
 *
 * A manual ShiftCalendarDay entry (supervisor override) is injected as a
 * synthetic punch for a user/day that has no real punch, so it participates in
 * the same relay-chain logic as real scans.
 *
 * Deliberately does NOT run guard days through the FULL_TIME pipeline
 * (delay/early-leave windows, overtime pay formula, monthly OT cap, or
 * deficit→annual-leave auto-conversion) — guards have separate, not-yet-
 * automated compensation rules; this only surfaces worked/deficit minutes for
 * an admin to handle manually (via the existing AttendanceOverride mechanism).
 */
@Injectable()
export class GuardCalcService {
  constructor(private prisma: PrismaService) {}

  async getActiveGuardShift(userId: string, gregDate: Date): Promise<GuardShiftConfig | null> {
    const a = await this.prisma.shiftAssignment.findFirst({
      where: {
        userId,
        startDate: { lte: gregDate },
        OR: [{ endDate: null }, { endDate: { gte: gregDate } }],
        shift: { isActive: true, type: { in: GUARD_SHIFT_TYPES } },
      },
      include: { shift: true },
      orderBy: { startDate: 'desc' },
    });
    if (!a) return null;
    return this.configOf(a.shift);
  }

  private configOf(s: { id: string; dutyMinutes: number | null; fullCreditMinutes: number | null; absentBelowMinutes: number | null }): GuardShiftConfig {
    return {
      id: s.id,
      dutyMinutes: s.dutyMinutes ?? 1440,
      fullCreditMinutes: s.fullCreditMinutes ?? s.dutyMinutes ?? 1440,
      absentBelowMinutes: s.absentBelowMinutes ?? 0,
    };
  }

  // Any active guard assignment overlapping [from, to]? Used by RecomputeService
  // to decide whether a user's batch routes through this engine, and to resolve
  // which shiftId(s) to recompute as a group.
  async findActiveGuardShiftId(userId: string, from: Date, to: Date): Promise<string | null> {
    const a = await this.prisma.shiftAssignment.findFirst({
      where: {
        userId,
        startDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
        shift: { isActive: true, type: { in: GUARD_SHIFT_TYPES } },
      },
      select: { shiftId: true },
    });
    return a?.shiftId ?? null;
  }

  private resolveInstance(inst: ShiftInstance, cfg: GuardShiftConfig, override: {
    clearCheckIn: boolean; clearCheckOut: boolean; newCheckIn: Date | null; newCheckOut: Date | null;
    forceStatus: AttendanceStatus | null; leaveMinutes: number | null;
  } | undefined) {
    let firstIn: Date | null = inst.start;
    let lastOut: Date | null = inst.end;
    if (override?.clearCheckIn) firstIn = null;
    else if (override?.newCheckIn) firstIn = override.newCheckIn;
    if (override?.clearCheckOut) lastOut = null;
    else if (override?.newCheckOut) lastOut = override.newCheckOut;

    const hasPunch = firstIn != null;
    const bothPunches = firstIn != null && lastOut != null;
    const workedMinutes = bothPunches
      ? Math.max(0, Math.round((lastOut!.getTime() - firstIn!.getTime()) / 60_000))
      : 0;

    let status: AttendanceStatus;
    let deficitMinutes = 0;
    const leaveMinutes = override?.leaveMinutes ?? 0;

    if (override?.forceStatus) {
      status = override.forceStatus;
    } else if (!hasPunch) {
      status = AttendanceStatus.ABSENT;
      deficitMinutes = Math.max(0, cfg.fullCreditMinutes - leaveMinutes);
    } else if (!bothPunches) {
      status = AttendanceStatus.INCOMPLETE; // still open — don't finalize a deficit yet
    } else if (workedMinutes < cfg.absentBelowMinutes) {
      status = AttendanceStatus.ABSENT;
      deficitMinutes = Math.max(0, cfg.fullCreditMinutes - leaveMinutes);
    } else if (workedMinutes < cfg.fullCreditMinutes) {
      status = AttendanceStatus.PRESENT;
      deficitMinutes = Math.max(0, cfg.fullCreditMinutes - workedMinutes - leaveMinutes);
    } else {
      status = AttendanceStatus.PRESENT;
    }

    return { firstIn, lastOut, workedMinutes, status, deficitMinutes, leaveMinutes };
  }

  private async upsertDay(userId: string, gregDate: Date, shiftId: string, fields: {
    firstCheckIn: Date | null; lastCheckOut: Date | null; workedMinutes: number;
    deficitMinutes: number; leaveMinutes: number; status: AttendanceStatus; autoConvertedLeave: boolean; hasOverride: boolean;
  }) {
    const { jYear, jMonth, jDay } = toJalaliParts(gregDate);
    await this.prisma.attendanceDay.upsert({
      where: { userId_gregDate: { userId, gregDate } },
      create: { userId, gregDate, jYear, jMonth, jDay, shiftId, ...fields },
      update: { jYear, jMonth, jDay, shiftId, ...fields, computedAt: new Date() },
    });
  }

  // Main entry point: recompute every guard assigned to `shiftId` together, for
  // calendar days in [from, to]. Reads a wider punch/context window so the
  // chain is resolved correctly at the range's edges, but only writes rows
  // whose date falls in [from, to].
  async computeShiftRange(shiftId: string, from: Date, to: Date): Promise<number> {
    const shiftRow = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shiftRow) return 0;
    const cfg = this.configOf(shiftRow);
    const dutyMs = cfg.dutyMinutes * 60_000;

    const assignments = await this.prisma.shiftAssignment.findMany({ where: { shiftId } });
    const userIds = [...new Set(assignments.map((a) => a.userId))];
    if (!userIds.length) return 0;

    const contextMs = 2 * dutyMs + 24 * 60 * 60_000; // generous lookback/lookahead for chain context
    const queryStart = new Date(tehranMidnightInstant(from).getTime() - contextMs);
    const queryEnd = new Date(tehranMidnightInstant(new Date(to.getTime() + 24 * 60 * 60 * 1000)).getTime() + contextMs);

    const [punches, overrides, manualDays] = await Promise.all([
      this.prisma.rawAttendanceRecord.findMany({
        where: { userId: { in: userIds }, punchAt: { gte: queryStart, lt: queryEnd } },
        orderBy: { punchAt: 'asc' },
      }),
      this.prisma.attendanceOverride.findMany({
        where: { userId: { in: userIds }, gregDate: { gte: from, lte: to } },
        orderBy: { createdAt: 'asc' }, // ascending so the map below keeps the LATEST per (user,date)
      }),
      this.prisma.shiftCalendarDay.findMany({
        where: { shiftId, gregDate: { gte: queryStart, lt: queryEnd } },
      }),
    ]);

    const overrideMap = new Map<string, (typeof overrides)[number]>();
    for (const o of overrides) overrideMap.set(`${o.userId}|${o.gregDate.toISOString()}`, o);

    // Merge real punches + synthetic manual marks (only where no real punch
    // exists that day for that user) into one chronological event stream.
    type Ev = { userId: string; time: Date };
    const events: Ev[] = punches
      .filter((p) => p.userId)
      .map((p) => ({ userId: p.userId as string, time: p.punchAt }));
    const realDayKeys = new Set(events.map((e) => `${e.userId}|${workDateOf(e.time).toISOString()}`));
    for (const m of manualDays) {
      const key = `${m.userId}|${m.gregDate.toISOString()}`;
      if (!realDayKeys.has(key)) events.push({ userId: m.userId, time: tehranMidnightInstant(m.gregDate) });
    }
    events.sort((a, b) => a.time.getTime() - b.time.getTime());
    if (!events.length) return 0;

    // ── Group into handoff clusters ──
    // At a real handoff BOTH guards tend to scan close together — the arriving
    // guard's own scan and the outgoing guard's departure confirmation — and
    // NOT in a fixed order (sometimes the arrival is logged first, sometimes
    // the departure is). So a plain "next event closes the shift" walk breaks:
    // whichever of the two scans comes second gets misread as yet another
    // handoff. Instead, group nearby events into clusters and, when resolving
    // one, look for whichever event in it differs from who's currently on
    // duty — that is the real incoming guard, regardless of scan order.
    const clusters: Ev[][] = [];
    for (const ev of events) {
      const last = clusters[clusters.length - 1];
      if (last && ev.time.getTime() - last[last.length - 1].time.getTime() <= CLUSTER_WINDOW_MS) last.push(ev);
      else clusters.push([ev]);
    }

    const instances: ShiftInstance[] = [];
    let cur: ShiftInstance | null = null;
    for (const cluster of clusters) {
      if (!cur) {
        // Bootstrap: no prior context, so just start from this cluster's last
        // event (only matters for the lookback window, not the written range).
        const last = cluster[cluster.length - 1];
        cur = { userId: last.userId, start: last.time, end: null };
        continue;
      }
      const differing = cluster.find((e) => e.userId !== cur!.userId);
      if (!differing) {
        // Whole cluster is the same guard already on duty — noise, UNLESS a
        // full duty cycle has elapsed with nobody relieving them (self-relief).
        const last = cluster[cluster.length - 1];
        const elapsed = last.time.getTime() - cur.start.getTime();
        if (elapsed >= dutyMs) {
          instances.push({ userId: cur.userId, start: cur.start, end: new Date(cur.start.getTime() + dutyMs) });
          cur = { userId: last.userId, start: last.time, end: null };
        }
        continue;
      }
      const elapsed = differing.time.getTime() - cur.start.getTime();
      if (elapsed >= dutyMs) {
        // No timely relief arrived — auto-close at the nominal duty length.
        // The stretch between that and `differing.time` is an unstaffed gap,
        // handled separately below (not attributed as worked time to anyone).
        instances.push({ userId: cur.userId, start: cur.start, end: new Date(cur.start.getTime() + dutyMs) });
      } else {
        instances.push({ userId: cur.userId, start: cur.start, end: differing.time });
      }
      cur = { userId: differing.userId, start: differing.time, end: null };
    }
    // Trailing (most recent) instance: auto-close only once real wall-clock
    // time has actually passed dutyMinutes with nobody relieving them.
    if (cur) {
      if (Date.now() - cur.start.getTime() >= dutyMs) cur = { ...cur, end: new Date(cur.start.getTime() + dutyMs) };
      instances.push(cur);
    }

    // ── Write a row for every instance whose start falls in [from, to] ──
    let n = 0;
    const coveredDayKeys = new Set<string>(); // `${isoDate}` — some instance is active that calendar day
    for (const inst of instances) {
      // An ongoing (unresolved) instance covers through the end of the requested
      // range — deterministic regardless of when the recompute actually runs
      // (unlike Date.now(), which breaks for historical/backfill recomputes).
      const spanEnd = inst.end ?? new Date(to.getTime() + 24 * 60 * 60_000);
      for (
        let d = workDateOf(inst.start);
        d.getTime() <= workDateOf(new Date(spanEnd.getTime() - 1)).getTime();
        d = new Date(d.getTime() + 24 * 60 * 60_000)
      ) {
        coveredDayKeys.add(d.toISOString());
      }

      const startDay = workDateOf(inst.start);
      if (startDay < from || startDay > to) continue;
      const override = overrideMap.get(`${inst.userId}|${startDay.toISOString()}`);
      const resolved = this.resolveInstance(inst, cfg, override);
      await this.upsertDay(inst.userId, startDay, shiftId, {
        firstCheckIn: resolved.firstIn, lastCheckOut: resolved.lastOut,
        workedMinutes: resolved.workedMinutes, deficitMinutes: resolved.deficitMinutes,
        leaveMinutes: resolved.leaveMinutes, status: resolved.status,
        autoConvertedLeave: false, hasOverride: !!override,
      });
      n++;
    }

    // ── Fill every other day in [from,to]: OFF_DUTY if covered by someone
    // else's instance, LEAVE (nobody available that day) otherwise. ──
    for (let day = new Date(from); day <= to; day = new Date(day.getTime() + 24 * 60 * 60_000)) {
      const activeUserIds = assignments
        .filter((a) => a.startDate <= day && (!a.endDate || a.endDate >= day))
        .map((a) => a.userId);
      const dayCovered = coveredDayKeys.has(day.toISOString());
      for (const userId of activeUserIds) {
        // Skip the guard whose own shift starts this exact day — already written above.
        if (instances.some((i) => i.userId === userId && workDateOf(i.start).getTime() === day.getTime())) continue;
        const override = overrideMap.get(`${userId}|${day.toISOString()}`);
        if (dayCovered) {
          await this.upsertDay(userId, day, shiftId, {
            firstCheckIn: null, lastCheckOut: null, workedMinutes: 0, deficitMinutes: 0, leaveMinutes: 0,
            status: override?.forceStatus ?? AttendanceStatus.OFF_DUTY, autoConvertedLeave: false, hasOverride: !!override,
          });
        } else {
          // Nobody on this shift punched at all that day — don't penalize; grant leave.
          await this.upsertDay(userId, day, shiftId, {
            firstCheckIn: null, lastCheckOut: null, workedMinutes: 0, deficitMinutes: 0,
            leaveMinutes: override?.leaveMinutes ?? cfg.fullCreditMinutes,
            status: override?.forceStatus ?? AttendanceStatus.LEAVE, autoConvertedLeave: true, hasOverride: !!override,
          });
        }
        n++;
      }
    }

    return n;
  }
}
