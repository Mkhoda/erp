import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalcService } from './calc.service';
import { GuardCalcService } from './guard-calc.service';
import { jalaliMonthRange, workDateOf } from './jalali.util';

// Orchestrates recomputation of AttendanceDay rows. All entry points funnel
// through recomputeDays(), which routes each user's dates to either
// CalcService.computeDay (regular single-day schedule) or GuardCalcService
// (manually-scheduled 24h guard rotations) — both idempotent, safe to re-run.
@Injectable()
export class RecomputeService {
  private readonly logger = new Logger(RecomputeService.name);

  constructor(
    private prisma: PrismaService,
    private calc: CalcService,
    private guardCalc: GuardCalcService,
  ) {}

  // Recompute a specific set of (userId, gregDate) pairs (deduplicated).
  async recomputeDays(pairs: Array<{ userId: string; gregDate: Date }>): Promise<number> {
    const seen = new Map<string, { userId: string; gregDate: Date }>();
    for (const p of pairs) {
      seen.set(`${p.userId}|${p.gregDate.toISOString()}`, p);
    }
    // Compute per-user ascending by date so the monthly overtime cap (which only
    // counts earlier days) accrues correctly regardless of the caller's order.
    const ordered = [...seen.values()].sort((a, b) =>
      a.userId === b.userId
        ? a.gregDate.getTime() - b.gregDate.getTime()
        : a.userId < b.userId ? -1 : 1,
    );

    // Group by user first to resolve each one's date range and guard status.
    const byUser = new Map<string, Date[]>();
    for (const { userId, gregDate } of ordered) {
      if (!byUser.has(userId)) byUser.set(userId, []);
      byUser.get(userId)!.push(gregDate);
    }

    // Guard users are re-grouped by shiftId: the handoff-chain algorithm needs
    // ALL guards on the same shift template computed together (one guard's
    // punch resolves another's checkout), not one user's dates in isolation.
    const byShift = new Map<string, { from: Date; to: Date }>();
    const regularUsers: Array<[string, Date[]]> = [];
    for (const [userId, dates] of byUser) {
      const from = dates[0];
      const to = dates[dates.length - 1];
      const shiftId = await this.guardCalc.findActiveGuardShiftId(userId, from, to);
      if (shiftId) {
        const existing = byShift.get(shiftId);
        byShift.set(shiftId, existing
          ? { from: existing.from < from ? existing.from : from, to: existing.to > to ? existing.to : to }
          : { from, to });
      } else {
        regularUsers.push([userId, dates]);
      }
    }

    let n = 0;
    for (const [shiftId, { from, to }] of byShift) {
      try {
        n += await this.guardCalc.computeShiftRange(shiftId, from, to);
      } catch (e: any) {
        this.logger.error(`computeShiftRange failed for shift ${shiftId} ${from.toISOString()}-${to.toISOString()}: ${e.message}`);
      }
    }
    for (const [userId, dates] of regularUsers) {
      for (const gregDate of dates) {
        try {
          await this.calc.computeDay(userId, gregDate);
          n++;
        } catch (e: any) {
          this.logger.error(`computeDay failed for ${userId} ${gregDate.toISOString()}: ${e.message}`);
        }
      }
    }
    return n;
  }

  // Derive affected work-days from a batch of imported raw rows and recompute.
  async recomputeForRawRows(rows: Array<{ userId: string | null; punchAt: Date }>): Promise<number> {
    const pairs = rows
      .filter((r) => r.userId)
      .map((r) => ({ userId: r.userId as string, gregDate: workDateOf(r.punchAt) }));
    return this.recomputeDays(pairs);
  }

  // Recompute one user's whole Jalali month (used after manual edits / re-seed).
  async recomputeUserMonth(userId: string, jYear: number, jMonth: number): Promise<number> {
    const { start, endExcl } = jalaliMonthRange(jYear, jMonth);
    const pairs: Array<{ userId: string; gregDate: Date }> = [];
    for (let d = new Date(start); d < endExcl; d = new Date(d.getTime() + 86400000)) {
      pairs.push({ userId, gregDate: new Date(d) });
    }
    return this.recomputeDays(pairs);
  }

  /**
   * Release a card number from any other user that currently holds it, so it
   * can be assigned to a new owner without violating the unique constraint.
   * Detaches their raw punches (set userId=null → re-linked to the new owner)
   * and removes their computed days. Disabled placeholder users (created by
   * provision-cards) are deleted; real users just have the card cleared.
   */
  async freeCard(cardNo: string, exceptUserId?: string): Promise<void> {
    if (!cardNo) return;
    const holders = await this.prisma.user.findMany({
      where: { attendanceCardNo: cardNo, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
      select: { id: true, disabled: true },
    });
    for (const b of holders) {
      await this.prisma.attendanceDay.deleteMany({ where: { userId: b.id } });
      await this.prisma.rawAttendanceRecord.updateMany({ where: { userId: b.id }, data: { userId: null } });
      if (b.disabled) {
        await this.prisma.user
          .delete({ where: { id: b.id } })
          .catch(() => this.prisma.user.update({ where: { id: b.id }, data: { attendanceCardNo: null } }));
      } else {
        await this.prisma.user.update({ where: { id: b.id }, data: { attendanceCardNo: null } });
      }
    }
  }

  /**
   * Link + recompute a single user. Called automatically when a card number is
   * assigned/changed in the users panel so attendance appears without a manual
   * "relink" step. Best-effort and idempotent.
   */
  async relinkUser(userId: string): Promise<{ linked: number; recomputed: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, attendanceCardNo: true },
    });
    if (!user?.attendanceCardNo) return { linked: 0, recomputed: 0 };

    const r = await this.prisma.rawAttendanceRecord.updateMany({
      where: { cardNo: user.attendanceCardNo, userId: null },
      data: { userId },
    });
    // Recompute EVERY day from the user's first punch to today — this also
    // materializes absent days (workdays with no punch → status ABSENT) so they
    // become visible and resolvable.
    const first = await this.prisma.rawAttendanceRecord.findFirst({
      where: { userId },
      orderBy: { punchAt: 'asc' },
      select: { punchAt: true },
    });
    if (!first) return { linked: r.count, recomputed: 0 };
    const recomputed = await this.recomputeUserRange(userId, workDateOf(first.punchAt), workDateOf(new Date()));
    return { linked: r.count, recomputed };
  }

  // Recompute every calendar day in [from, to] for one user (fills gaps/absences).
  async recomputeUserRange(userId: string, from: Date, to: Date): Promise<number> {
    const pairs: Array<{ userId: string; gregDate: Date }> = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
      pairs.push({ userId, gregDate: new Date(d) });
    }
    return this.recomputeDays(pairs);
  }

  /**
   * Back-link raw punches imported BEFORE a card number was assigned, then
   * recompute. RawAttendanceRecord rows captured while a card was unmapped have
   * userId=null; once an admin sets User.attendanceCardNo this attaches them and
   * builds the AttendanceDay history. Idempotent and safe to re-run.
   */
  async relinkAndRecomputeAll(): Promise<{ linked: number; recomputed: number; users: number }> {
    const users = await this.prisma.user.findMany({
      where: { attendanceCardNo: { not: null } },
      select: { id: true },
    });
    let linked = 0;
    let recomputed = 0;
    // Per-user relink fills EVERY day from the first punch to today (materializing
    // absent days), so the grid stays current up to today — not just punch-days.
    for (const u of users) {
      const r = await this.relinkUser(u.id);
      linked += r.linked;
      recomputed += r.recomputed;
    }
    return { linked, recomputed, users: users.length };
  }

  /**
   * Auto-provision a placeholder user for every device CardNo that has no
   * matching user yet, then link + recompute. Lets attendance for unknown
   * cards appear immediately; the admin renames the users later (the card
   * link, and thus history, is preserved). Placeholder users are disabled
   * (cannot log in) and named "کارت <cardNo>".
   */
  async provisionCardsAndRecompute(): Promise<{
    rawTotal: number; createdUsers: number; linked: number; recomputed: number; users: number;
  }> {
    const rawTotal = await this.prisma.rawAttendanceRecord.count();

    // Distinct card numbers seen in raw data.
    const distinct = await this.prisma.rawAttendanceRecord.findMany({
      distinct: ['cardNo'],
      select: { cardNo: true },
      where: { cardNo: { not: '' } },
    });
    const cardNos = distinct.map((d) => d.cardNo).filter(Boolean);

    // Which already map to a user?
    const existing = await this.prisma.user.findMany({
      where: { attendanceCardNo: { in: cardNos } },
      select: { attendanceCardNo: true },
    });
    const have = new Set(existing.map((u) => u.attendanceCardNo));

    let createdUsers = 0;
    for (const card of cardNos) {
      if (have.has(card)) continue;
      try {
        await this.prisma.user.create({
          data: {
            firstName: 'کارت',
            lastName: card,
            attendanceCardNo: card,
            role: 'USER',
            disabled: true, // attendance-only identity; cannot sign in
          },
        });
        createdUsers++;
      } catch {
        // unique race / bad value — skip, never abort the batch
      }
    }

    const relink = await this.relinkAndRecomputeAll();
    return { rawTotal, createdUsers, ...relink };
  }

  // Recompute the users affected by a work-schedule change: those explicitly
  // assigned to it, plus (if it's the default) everyone without a group.
  async recomputeScheduleUsers(scheduleId: string, isDefault: boolean): Promise<number> {
    const assigned = await this.prisma.userAttendanceRule.findMany({
      where: { scheduleId },
      select: { userId: true },
    });
    const ids = new Set(assigned.map((r) => r.userId));
    if (isDefault) {
      // Mapped users with no rule, or a rule that doesn't pin a schedule.
      const defaults = await this.prisma.user.findMany({
        where: {
          attendanceCardNo: { not: null },
          OR: [{ attendanceRule: null }, { attendanceRule: { scheduleId: null } }],
        },
        select: { id: true },
      });
      defaults.forEach((u) => ids.add(u.id));
    }
    let total = 0;
    for (const userId of ids) total += (await this.relinkUser(userId)).recomputed;
    return total;
  }

  // Recompute a set of days for all mapped users (e.g. after a holiday change).
  async recomputeAllUsersForDays(dates: Date[]): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { attendanceCardNo: { not: null } },
      select: { id: true },
    });
    const pairs: Array<{ userId: string; gregDate: Date }> = [];
    for (const u of users) for (const d of dates) pairs.push({ userId: u.id, gregDate: d });
    return this.recomputeDays(pairs);
  }

  // Recompute every mapped user for a Jalali month (e.g. after editing the
  // global schedule or adding a holiday). Bounded by mapped-user count.
  async recomputeAllForMonth(jYear: number, jMonth: number): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { attendanceCardNo: { not: null } },
      select: { id: true },
    });
    let total = 0;
    for (const u of users) {
      total += await this.recomputeUserMonth(u.id, jYear, jMonth);
    }
    return total;
  }
}
