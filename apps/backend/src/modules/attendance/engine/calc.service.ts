import { Injectable } from '@nestjs/common';
import { AttendanceStatus, HolidayType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  dayOfWeek,
  minutesOfDay,
  parseHHmm,
  toJalaliParts,
  workDateOf,
} from './jalali.util';

// Effective rules for a user on a given day (global default + user override).
export interface EffectiveSchedule {
  employeeType: 'FULL_TIME' | 'HOURLY';
  startMin: number;
  endMin: number;
  dailyMinutes: number;
  lunchMinutes: number;
  // Window-based: arrival window [checkInStart, checkInEnd], departure window
  // [checkOutStart, checkOutEnd]. Late = arrive after checkInEnd; early-leave =
  // depart before checkOutStart.
  checkInEnd: number;
  checkOutStart: number;
  workDays: number[];
  otMinThreshold: number;
  otMaxDaily: number;
  otMaxMonthly: number;
  otRounding: number;
  otAllowed: boolean;
}

// Hardcoded fallback matching the WorkSchedule schema defaults — used when no
// default WorkSchedule row exists yet, so calculations never depend on seeding.
const DEFAULTS: EffectiveSchedule = {
  employeeType: 'FULL_TIME',
  startMin: 6 * 60 + 30,
  endMin: 17 * 60 + 20,
  dailyMinutes: 500,            // 8:20 required
  lunchMinutes: 0,
  checkInEnd: 9 * 60,           // 09:00
  checkOutStart: 14 * 60 + 50,  // 14:50
  workDays: [6, 0, 1, 2, 3],    // Sat..Wed (Thu/Fri weekend)
  otMinThreshold: 30,
  otMaxDaily: 240,
  otMaxMonthly: 3600,
  otRounding: 15,
  otAllowed: true,
};

@Injectable()
export class CalcService {
  constructor(private prisma: PrismaService) {}

  async getEffectiveSchedule(userId: string): Promise<EffectiveSchedule> {
    const rule = await this.prisma.userAttendanceRule.findUnique({ where: { userId } });
    // Base schedule = the user's assigned group (rule.scheduleId), else the org default.
    let base = rule?.scheduleId
      ? await this.prisma.workSchedule.findUnique({ where: { id: rule.scheduleId } })
      : null;
    if (!base) {
      base = await this.prisma.workSchedule.findFirst({
        where: { OR: [{ isDefault: true }, { name: 'default' }] },
        orderBy: { isDefault: 'desc' },
      });
    }

    const s: EffectiveSchedule = { ...DEFAULTS };
    if (base) {
      s.startMin = parseHHmm(base.checkInStart) ?? s.startMin;
      s.endMin = parseHHmm(base.checkOutEnd) ?? s.endMin;
      s.dailyMinutes = base.dailyMinutes;
      s.lunchMinutes = base.lunchMinutes;
      s.checkInEnd = parseHHmm((base as any).checkInEnd) ?? s.checkInEnd;
      s.checkOutStart = parseHHmm((base as any).checkOutStart) ?? s.checkOutStart;
      s.workDays = base.workDays?.length ? base.workDays : s.workDays;
      s.otMinThreshold = base.otMinThreshold;
      s.otMaxDaily = base.otMaxDaily;
      s.otMaxMonthly = base.otMaxMonthly;
      s.otRounding = base.otRounding;
    }
    if (rule) {
      s.employeeType = rule.employeeType as 'FULL_TIME' | 'HOURLY';
      if (rule.dailyMinutes != null) s.dailyMinutes = rule.dailyMinutes;
      if ((rule as any).checkInEnd) s.checkInEnd = parseHHmm((rule as any).checkInEnd) ?? s.checkInEnd;
      if ((rule as any).checkOutStart) s.checkOutStart = parseHHmm((rule as any).checkOutStart) ?? s.checkOutStart;
      if (rule.otMaxDaily != null) s.otMaxDaily = rule.otMaxDaily;
      if (rule.otMaxMonthly != null) s.otMaxMonthly = rule.otMaxMonthly;
      s.otAllowed = rule.otAllowed;
    }
    // Hourly staff: presence only — never accrue overtime or lateness penalties.
    if (s.employeeType === 'HOURLY') s.otAllowed = false;
    return s;
  }

  // Holiday lookup for a Gregorian work date (covers ranges + yearly recurring).
  private async holidayFor(gregDate: Date): Promise<HolidayType | null> {
    const fixed = await this.prisma.holiday.findFirst({
      where: { startDate: { lte: gregDate }, endDate: { gte: gregDate }, recurring: false },
    });
    if (fixed) return fixed.type;
    const { jMonth, jDay } = toJalaliParts(gregDate);
    const rec = await this.prisma.holiday.findFirst({
      where: { recurring: true, jMonth, jDay },
    });
    return rec ? rec.type : null;
  }

  private overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  }

  /**
   * Recompute the AttendanceDay for one user on one Gregorian work date from the
   * raw punches, schedule, holidays, and any manual override. Idempotent: always
   * derives the row fresh and upserts it. Never reads/writes RawAttendanceRecord.
   */
  async computeDay(userId: string, gregDate: Date): Promise<void> {
    const dayStart = gregDate; // UTC midnight of the Tehran calendar day
    const dayEnd = new Date(gregDate.getTime() + 24 * 60 * 60 * 1000);

    const [punches, override, sched, holiday] = await Promise.all([
      this.prisma.rawAttendanceRecord.findMany({
        where: { userId, punchAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { punchAt: 'asc' },
      }),
      this.prisma.attendanceOverride.findFirst({
        where: { userId, gregDate },
        orderBy: { createdAt: 'desc' },
      }),
      this.getEffectiveSchedule(userId),
      this.holidayFor(gregDate),
    ]);

    const { jYear, jMonth, jDay } = toJalaliParts(gregDate);
    const isWeekend = !sched.workDays.includes(dayOfWeek(gregDate));

    // Resolve check-in / check-out, letting an override replace either side.
    let firstIn: Date | null = punches.length ? punches[0].punchAt : null;
    let lastOut: Date | null = punches.length > 1 ? punches[punches.length - 1].punchAt : null;
    if (override?.newCheckIn) firstIn = override.newCheckIn;
    if (override?.newCheckOut) lastOut = override.newCheckOut;

    let workedMinutes = 0;
    let overtimeMinutes = 0;
    let delayMinutes = 0;
    let earlyLeaveMinutes = 0;
    let nightMinutes = 0;
    let status: AttendanceStatus;

    const hasPunch = firstIn != null;
    const bothPunches = firstIn != null && lastOut != null;

    if (bothPunches) {
      const inMin = minutesOfDay(firstIn!);
      let outMin = minutesOfDay(lastOut!);
      if (outMin < inMin) outMin += 24 * 60; // crossed midnight (night shift)

      workedMinutes = Math.max(0, outMin - inMin - sched.lunchMinutes);

      // Window-based: late if arriving after the check-in window ends; early
      // leave if departing before the check-out window starts.
      delayMinutes = Math.max(0, inMin - sched.checkInEnd);
      earlyLeaveMinutes = Math.max(0, sched.checkOutStart - outMin);

      // Overtime is measured from the END of the required shift: a late arrival is
      // covered separately by leave, so it must NOT eat into overtime. We add the
      // leave-covered late minutes back before comparing against the required daily
      // total — staying past the required end is overtime regardless of a late start.
      // (e.g. start 08:30, required 560 → ends 17:50; leaving 18:32 ⇒ 42m OT even
      //  if the person arrived 23m late, since that 23m is booked as leave.)
      const extra = workedMinutes + delayMinutes - sched.dailyMinutes;
      if (sched.otAllowed && extra >= sched.otMinThreshold) {
        const rounded = sched.otRounding > 0
          ? Math.floor(extra / sched.otRounding) * sched.otRounding : extra;
        overtimeMinutes = Math.min(rounded, sched.otMaxDaily);
      }

      // Night minutes = overlap with 22:00–06:00 (next day window 22:00–30:00)
      nightMinutes =
        this.overlapMinutes(inMin, outMin, 22 * 60, 30 * 60) +
        this.overlapMinutes(inMin, outMin, 0, 6 * 60);
    }

    // Hourly staff: only presence matters — drop lateness/early-leave.
    if (sched.employeeType === 'HOURLY') {
      delayMinutes = 0;
      earlyLeaveMinutes = 0;
    }

    // Monthly overtime cap: clamp so the month's running OT total does not exceed
    // otMaxMonthly. Only EARLIER days in the month count toward "used" so the cap
    // accrues ascending and a single-day recompute stays stable (a later day's OT
    // must never retroactively zero out an earlier day).
    if (overtimeMinutes > 0 && sched.otMaxMonthly > 0) {
      const prior = await this.prisma.attendanceDay.aggregate({
        where: { userId, jYear, jMonth, gregDate: { lt: gregDate } },
        _sum: { overtimeMinutes: true },
      });
      const used = prior._sum.overtimeMinutes ?? 0;
      overtimeMinutes = Math.max(0, Math.min(overtimeMinutes, sched.otMaxMonthly - used));
    }

    // ── Status precedence ──────────────────────────────────────────────
    const holidayWork = !!holiday || isWeekend;
    if (override?.forceStatus) {
      status = override.forceStatus;
    } else if (holiday) {
      status = holiday === HolidayType.COMPANY ? AttendanceStatus.COMPANY_HOLIDAY : AttendanceStatus.HOLIDAY;
    } else if (isWeekend) {
      status = AttendanceStatus.WEEKEND;
    } else if (!hasPunch) {
      status = AttendanceStatus.ABSENT;
    } else if (!bothPunches) {
      status = AttendanceStatus.INCOMPLETE;
    } else if (delayMinutes > 0) {
      status = AttendanceStatus.LATE;
    } else if (earlyLeaveMinutes > 0) {
      status = AttendanceStatus.EARLY_LEAVE;
    } else {
      status = AttendanceStatus.PRESENT;
    }

    // On a holiday/weekend, punches count as holiday work (overtime preserved,
    // delay/early-leave not meaningful).
    const isHolidayWork = holidayWork && bothPunches;
    if (holidayWork) {
      delayMinutes = 0;
      earlyLeaveMinutes = 0;
      if (isHolidayWork) overtimeMinutes = workedMinutes; // whole shift is OT
    }

    await this.prisma.attendanceDay.upsert({
      where: { userId_gregDate: { userId, gregDate } },
      create: {
        userId, gregDate, jYear, jMonth, jDay,
        firstCheckIn: firstIn, lastCheckOut: lastOut,
        workedMinutes, overtimeMinutes, delayMinutes, earlyLeaveMinutes, nightMinutes,
        status, isHolidayWork, hasOverride: !!override,
      },
      update: {
        jYear, jMonth, jDay,
        firstCheckIn: firstIn, lastCheckOut: lastOut,
        workedMinutes, overtimeMinutes, delayMinutes, earlyLeaveMinutes, nightMinutes,
        status, isHolidayWork, hasOverride: !!override, computedAt: new Date(),
      },
    });
  }
}

// Re-export so the sync service can group raw punches into work dates.
export { workDateOf };
