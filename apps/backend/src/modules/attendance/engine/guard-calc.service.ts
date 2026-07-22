import { Injectable } from '@nestjs/common';
import { AttendanceStatus, ShiftType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tehranMidnightInstant, toJalaliParts, workDateOf } from './jalali.util';

// Guard-duty shift lengths this service knows how to resolve — kept separate
// from ShiftType.ROTATING/NIGHT/etc, which have no engine support.
const GUARD_SHIFT_TYPES: ShiftType[] = [ShiftType.TWENTY_FOUR_TWENTY_FOUR, ShiftType.TWENTY_FOUR_FORTY_EIGHT];

export interface GuardShiftConfig {
  id: string;
  dutyMinutes: number;
  fullCreditMinutes: number;
  absentBelowMinutes: number;
}

/**
 * Computes AttendanceDay rows for guards on a manually-scheduled 24h-on-duty
 * rotation (24/24, 24/48, ...). Unlike CalcService.computeDay (one Gregorian
 * day = one independent shift), a guard's shift is anchored to the day a
 * supervisor marks as "on duty" (ShiftCalendarDay) and may run past midnight
 * into the next calendar day(s) before the matching check-out punch appears —
 * so punches are resolved over a multi-day window, not the single [00:00,24:00)
 * slice CalcService uses.
 *
 * Deliberately does NOT run guard days through the FULL_TIME pipeline
 * (delay/early-leave windows, overtime pay formula, monthly OT cap, or
 * deficit→annual-leave auto-conversion) — guards have separate, not-yet-
 * automated compensation rules; this only surfaces worked/deficit minutes for
 * an admin to handle manually.
 */
@Injectable()
export class GuardCalcService {
  constructor(private prisma: PrismaService) {}

  // How far past a shift's start to search for the matching check-out punch.
  // Generous enough to catch a very late check-out without reaching into the
  // NEXT scheduled on-duty day (which is always dutyMinutes + rest apart).
  private searchWindowMinutes(dutyMinutes: number): number {
    return dutyMinutes + 24 * 60;
  }

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
    const s = a.shift;
    return {
      id: s.id,
      dutyMinutes: s.dutyMinutes ?? 1440,
      fullCreditMinutes: s.fullCreditMinutes ?? s.dutyMinutes ?? 1440,
      absentBelowMinutes: s.absentBelowMinutes ?? 0,
    };
  }

  // Any active guard assignment overlapping [from, to]? Cheap existence check
  // used by RecomputeService to decide whether a user's batch routes here.
  async hasActiveGuardAssignment(userId: string, from: Date, to: Date): Promise<boolean> {
    const a = await this.prisma.shiftAssignment.findFirst({
      where: {
        userId,
        startDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
        shift: { isActive: true, type: { in: GUARD_SHIFT_TYPES } },
      },
      select: { id: true },
    });
    return !!a;
  }

  // Compute one on-duty shift, anchored at shiftStartDate (a ShiftCalendarDay
  // entry). Returns the real checkout instant when resolved, so the caller can
  // mark the calendar days the shift spans through as "covered" (not OFF_DUTY).
  async computeGuardDay(userId: string, shiftStartDate: Date): Promise<{ lastCheckOut: Date | null }> {
    const shift = await this.getActiveGuardShift(userId, shiftStartDate);
    if (!shift) return { lastCheckOut: null };

    const dayStart = tehranMidnightInstant(shiftStartDate);
    const windowEnd = new Date(dayStart.getTime() + this.searchWindowMinutes(shift.dutyMinutes) * 60_000);

    const [punches, override] = await Promise.all([
      this.prisma.rawAttendanceRecord.findMany({
        where: { userId, punchAt: { gte: dayStart, lt: windowEnd } },
        orderBy: { punchAt: 'asc' },
      }),
      this.prisma.attendanceOverride.findFirst({
        where: { userId, gregDate: shiftStartDate },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    let firstIn: Date | null = punches.length ? punches[0].punchAt : null;
    let lastOut: Date | null = punches.length > 1 ? punches[punches.length - 1].punchAt : null;
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
    let leaveMinutes = override?.leaveMinutes ?? 0;

    if (override?.forceStatus) {
      status = override.forceStatus;
    } else if (!hasPunch) {
      status = AttendanceStatus.ABSENT;
      deficitMinutes = Math.max(0, shift.fullCreditMinutes - leaveMinutes);
    } else if (!bothPunches) {
      // Still open (no check-out yet) — mirror CalcService's convention of not
      // finalizing a deficit for a shift that's still in progress.
      status = AttendanceStatus.INCOMPLETE;
    } else if (workedMinutes < shift.absentBelowMinutes) {
      status = AttendanceStatus.ABSENT;
      deficitMinutes = Math.max(0, shift.fullCreditMinutes - leaveMinutes);
    } else if (workedMinutes < shift.fullCreditMinutes) {
      status = AttendanceStatus.PRESENT;
      deficitMinutes = Math.max(0, shift.fullCreditMinutes - workedMinutes - leaveMinutes);
    } else {
      status = AttendanceStatus.PRESENT;
    }

    const { jYear, jMonth, jDay } = toJalaliParts(shiftStartDate);
    await this.prisma.attendanceDay.upsert({
      where: { userId_gregDate: { userId, gregDate: shiftStartDate } },
      create: {
        userId, gregDate: shiftStartDate, jYear, jMonth, jDay,
        firstCheckIn: firstIn, lastCheckOut: lastOut,
        workedMinutes, deficitMinutes, leaveMinutes,
        status, shiftId: shift.id, hasOverride: !!override,
      },
      update: {
        jYear, jMonth, jDay,
        firstCheckIn: firstIn, lastCheckOut: lastOut,
        workedMinutes, deficitMinutes, leaveMinutes,
        status, shiftId: shift.id, hasOverride: !!override, computedAt: new Date(),
      },
    });

    return { lastCheckOut: bothPunches ? lastOut : null };
  }

  // A day with no on-duty calendar entry — a scheduled rest day for a guard.
  async computeOffDuty(userId: string, gregDate: Date, shiftId: string): Promise<void> {
    const { jYear, jMonth, jDay } = toJalaliParts(gregDate);
    await this.prisma.attendanceDay.upsert({
      where: { userId_gregDate: { userId, gregDate } },
      create: {
        userId, gregDate, jYear, jMonth, jDay,
        status: AttendanceStatus.OFF_DUTY, shiftId,
      },
      update: {
        jYear, jMonth, jDay,
        firstCheckIn: null, lastCheckOut: null,
        workedMinutes: 0, overtimeMinutes: 0, holidayOvertimeMinutes: 0,
        delayMinutes: 0, earlyLeaveMinutes: 0, deficitMinutes: 0, nightMinutes: 0, leaveMinutes: 0,
        autoConvertedLeave: false, status: AttendanceStatus.OFF_DUTY, isHolidayWork: false,
        shiftId, hasOverride: false, computedAt: new Date(),
      },
    });
  }

  // Main entry point: recompute every calendar day in [from, to] for a guard-
  // assigned user. On-duty days come from ShiftCalendarDay; every other day in
  // range is OFF_DUTY, UNLESS it's covered by a prior on-duty shift that ran
  // past midnight (its check-out landed on a later calendar date).
  async computeGuardRange(userId: string, from: Date, to: Date): Promise<number> {
    const onDutyDays = await this.prisma.shiftCalendarDay.findMany({
      where: { userId, gregDate: { gte: from, lte: to } },
      orderBy: { gregDate: 'asc' },
    });

    let n = 0;
    const covered = new Set<string>(); // gregDate ISO strings "claimed" by a shift's span
    for (const d of onDutyDays) {
      covered.add(d.gregDate.toISOString());
      const { lastCheckOut } = await this.computeGuardDay(userId, d.gregDate);
      n++;
      if (lastCheckOut) {
        // Mark every calendar day the shift's actual punches spanned through
        // (start day already covered above) so the off-day pass below skips them.
        for (
          let day = workDateOf(new Date(d.gregDate.getTime() + 24 * 60 * 60 * 1000));
          day.getTime() <= workDateOf(lastCheckOut).getTime();
          day = workDateOf(new Date(day.getTime() + 24 * 60 * 60 * 1000))
        ) {
          covered.add(day.toISOString());
        }
      }
    }

    if (!onDutyDays.length) return n;
    const shiftId = onDutyDays[0].shiftId;
    for (let day = new Date(from); day <= to; day = new Date(day.getTime() + 24 * 60 * 60 * 1000)) {
      if (covered.has(day.toISOString())) continue;
      await this.computeOffDuty(userId, day, shiftId);
      n++;
    }
    return n;
  }
}
