import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalcService } from './calc.service';
import { jalaliMonthRange, workDateOf } from './jalali.util';

// Orchestrates recomputation of AttendanceDay rows. All entry points funnel into
// CalcService.computeDay, which is idempotent — safe to call repeatedly.
@Injectable()
export class RecomputeService {
  private readonly logger = new Logger(RecomputeService.name);

  constructor(
    private prisma: PrismaService,
    private calc: CalcService,
  ) {}

  // Recompute a specific set of (userId, gregDate) pairs (deduplicated).
  async recomputeDays(pairs: Array<{ userId: string; gregDate: Date }>): Promise<number> {
    const seen = new Map<string, { userId: string; gregDate: Date }>();
    for (const p of pairs) {
      seen.set(`${p.userId}|${p.gregDate.toISOString()}`, p);
    }
    let n = 0;
    for (const { userId, gregDate } of seen.values()) {
      try {
        await this.calc.computeDay(userId, gregDate);
        n++;
      } catch (e: any) {
        this.logger.error(`computeDay failed for ${userId} ${gregDate.toISOString()}: ${e.message}`);
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
    const punches = await this.prisma.rawAttendanceRecord.findMany({
      where: { userId },
      select: { punchAt: true },
    });
    const pairs = punches.map((p) => ({ userId, gregDate: workDateOf(p.punchAt) }));
    const recomputed = await this.recomputeDays(pairs);
    return { linked: r.count, recomputed };
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
      select: { id: true, attendanceCardNo: true },
    });
    let linked = 0;
    let recomputed = 0;
    for (const u of users) {
      const r = await this.prisma.rawAttendanceRecord.updateMany({
        where: { cardNo: u.attendanceCardNo!, userId: null },
        data: { userId: u.id },
      });
      linked += r.count;
      const punches = await this.prisma.rawAttendanceRecord.findMany({
        where: { userId: u.id },
        select: { punchAt: true },
      });
      const pairs = punches.map((p) => ({ userId: u.id, gregDate: workDateOf(p.punchAt) }));
      recomputed += await this.recomputeDays(pairs);
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
