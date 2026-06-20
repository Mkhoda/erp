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
