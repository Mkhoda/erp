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
  graceMinutes: number;
  flexEnabled: boolean;
  flexInStart: number | null;
  flexInEnd: number | null;
  workDays: number[];
  otMinThreshold: number;
  otMaxDaily: number;
  otRounding: number;
  otAllowed: boolean;
}

// Hardcoded fallback matching the WorkSchedule schema defaults — used when no
// default WorkSchedule row exists yet, so calculations never depend on seeding.
const DEFAULTS: EffectiveSchedule = {
  employeeType: 'FULL_TIME',
  startMin: 8 * 60,
  endMin: 17 * 60,
  dailyMinutes: 480,
  lunchMinutes: 60,
  graceMinutes: 30,
  flexEnabled: false,
  flexInStart: 7 * 60 + 30,
  flexInEnd: 9 * 60,
  workDays: [6, 0, 1, 2, 3], // Sat..Wed (Thu/Fri weekend)
  otMinThreshold: 30,
  otMaxDaily: 240,
  otRounding: 15,
  otAllowed: true,
};

@Injectable()
export class CalcService {
  constructor(private prisma: PrismaService) {}

  async getEffectiveSchedule(userId: string): Promise<EffectiveSchedule> {
    const [base, rule] = await Promise.all([
      this.prisma.workSchedule.findFirst({
        where: { OR: [{ isDefault: true }, { name: 'default' }] },
        orderBy: { isDefault: 'desc' },
      }),
      this.prisma.userAttendanceRule.findUnique({ where: { userId } }),
    ]);

    const s: EffectiveSchedule = { ...DEFAULTS };
    if (base) {
      s.startMin = parseHHmm(base.startTime) ?? s.startMin;
      s.endMin = parseHHmm(base.endTime) ?? s.endMin;
      s.dailyMinutes = base.dailyMinutes;
      s.lunchMinutes = base.lunchMinutes;
      s.graceMinutes = base.graceMinutes;
      s.flexEnabled = base.flexEnabled;
      s.flexInStart = parseHHmm(base.flexInStart) ?? s.flexInStart;
      s.flexInEnd = parseHHmm(base.flexInEnd) ?? s.flexInEnd;
      s.workDays = base.workDays?.length ? base.workDays : s.workDays;
      s.otMinThreshold = base.otMinThreshold;
      s.otMaxDaily = base.otMaxDaily;
      s.otRounding = base.otRounding;
    }
    if (rule) {
      s.employeeType = rule.employeeType as 'FULL_TIME' | 'HOURLY';
      if (rule.startTime) s.startMin = parseHHmm(rule.startTime) ?? s.startMin;
      if (rule.endTime) s.endMin = parseHHmm(rule.endTime) ?? s.endMin;
      if (rule.dailyMinutes != null) s.dailyMinutes = rule.dailyMinutes;
      if (rule.graceMinutes != null) s.graceMinutes = rule.graceMinutes;
      if (rule.flexEnabled != null) s.flexEnabled = rule.flexEnabled;
      if (rule.otMaxDaily != null) s.otMaxDaily = rule.otMaxDaily;
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

      // Delay (respecting flex window)
      if (sched.flexEnabled && sched.flexInStart != null && sched.flexInEnd != null) {
        delayMinutes = Math.max(0, inMin - sched.flexInEnd);
      } else {
        delayMinutes = Math.max(0, inMin - (sched.startMin + sched.graceMinutes));
      }
      // Early leave
      earlyLeaveMinutes = Math.max(0, sched.endMin - outMin);

      // Overtime (only beyond required, above threshold, rounded, capped)
      const extra = workedMinutes - sched.dailyMinutes;
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
