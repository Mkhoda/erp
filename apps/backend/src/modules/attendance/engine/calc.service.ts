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
  scheduleId: string | null;   // resolved work-schedule (group) id, for holiday scoping
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
  annualLeaveDays: number;
  deficitToLeaveEnabled: boolean;
  hourlyLeaveCapMinutes: number;
  absentToLeaveEnabled: boolean;
}

// Hardcoded fallback matching the WorkSchedule schema defaults — used when no
// default WorkSchedule row exists yet, so calculations never depend on seeding.
const DEFAULTS: EffectiveSchedule = {
  scheduleId: null,
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
  annualLeaveDays: 26,
  deficitToLeaveEnabled: true,
  hourlyLeaveCapMinutes: 480,
  absentToLeaveEnabled: true,
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
      s.scheduleId = base.id;
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
      s.annualLeaveDays = base.annualLeaveDays;
      s.deficitToLeaveEnabled = base.deficitToLeaveEnabled;
      s.hourlyLeaveCapMinutes = base.hourlyLeaveCapMinutes;
      s.absentToLeaveEnabled = base.absentToLeaveEnabled;
    }
    if (rule) {
      s.employeeType = rule.employeeType as 'FULL_TIME' | 'HOURLY';
      if (rule.dailyMinutes != null) s.dailyMinutes = rule.dailyMinutes;
      if ((rule as any).checkInEnd) s.checkInEnd = parseHHmm((rule as any).checkInEnd) ?? s.checkInEnd;
      if ((rule as any).checkOutStart) s.checkOutStart = parseHHmm((rule as any).checkOutStart) ?? s.checkOutStart;
      if ((rule as any).checkOutEnd) s.endMin = parseHHmm((rule as any).checkOutEnd) ?? s.endMin;
      if (rule.otMaxDaily != null) s.otMaxDaily = rule.otMaxDaily;
      if (rule.otMaxMonthly != null) s.otMaxMonthly = rule.otMaxMonthly;
      s.otAllowed = rule.otAllowed;
    }
    // Hourly staff: presence only — never accrue overtime or lateness penalties.
    if (s.employeeType === 'HOURLY') s.otAllowed = false;
    return s;
  }

  // Effective rules for a user (or the org default, when no userId matches any
  // real user) in one place — used by the "قوانین کارکرد" info panel so it's
  // always generated from live settings, never hardcoded.
  async getRulesSummary(userId?: string) {
    const sched = await this.getEffectiveSchedule(userId || '');
    let scheduleName = 'پیش‌فرض سازمان';
    if (sched.scheduleId) {
      const row = await this.prisma.workSchedule.findUnique({ where: { id: sched.scheduleId } });
      if (row && !row.isDefault) scheduleName = row.name;
    }
    return { scheduleName, ...sched };
  }

  // Holiday lookup for a Gregorian work date (covers ranges + yearly recurring).
  // A holiday applies when it has no group scope (empty scheduleIds = all groups)
  // or its scope includes the user's resolved schedule.
  private async holidayFor(gregDate: Date, scheduleId: string | null): Promise<HolidayType | null> {
    const scope = scheduleId
      ? [{ scheduleIds: { isEmpty: true } }, { scheduleIds: { has: scheduleId } }]
      : [{ scheduleIds: { isEmpty: true } }];
    const fixed = await this.prisma.holiday.findFirst({
      where: { startDate: { lte: gregDate }, endDate: { gte: gregDate }, recurring: false, OR: scope },
    });
    if (fixed) return fixed.type;
    const { jMonth, jDay } = toJalaliParts(gregDate);
    const rec = await this.prisma.holiday.findFirst({
      where: { recurring: true, jMonth, jDay, OR: scope },
    });
    return rec ? rec.type : null;
  }

  // Apply a matching ScheduleOverride to the effective schedule for this day.
  // Matches on date range, weekday scope, and group scope. Returns true if the
  // override marks the day as non-working. null fields inherit the base schedule.
  private async applyDayOverride(s: EffectiveSchedule, gregDate: Date, dow: number): Promise<boolean> {
    const groupScope = s.scheduleId
      ? [{ scheduleIds: { isEmpty: true } }, { scheduleIds: { has: s.scheduleId } }]
      : [{ scheduleIds: { isEmpty: true } }];
    const ov = await this.prisma.scheduleOverride.findFirst({
      where: {
        startDate: { lte: gregDate },
        endDate: { gte: gregDate },
        AND: [
          { OR: groupScope },
          { OR: [{ weekdays: { isEmpty: true } }, { weekdays: { has: dow } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!ov) return false;
    if (ov.checkInStart)  s.startMin       = parseHHmm(ov.checkInStart)  ?? s.startMin;
    if (ov.checkInEnd)    s.checkInEnd      = parseHHmm(ov.checkInEnd)    ?? s.checkInEnd;
    if (ov.checkOutStart) s.checkOutStart   = parseHHmm(ov.checkOutStart) ?? s.checkOutStart;
    if (ov.checkOutEnd)   s.endMin          = parseHHmm(ov.checkOutEnd)   ?? s.endMin;
    if (ov.dailyMinutes != null) s.dailyMinutes = ov.dailyMinutes;
    if (ov.lunchMinutes != null) s.lunchMinutes = ov.lunchMinutes;
    return ov.isOff;
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

    // Resolve the schedule first — holiday scoping + day-overrides depend on group.
    const sched = await this.getEffectiveSchedule(userId);
    const dow = dayOfWeek(gregDate);
    const forcedOff = await this.applyDayOverride(sched, gregDate, dow);
    const [punches, override, holiday] = await Promise.all([
      this.prisma.rawAttendanceRecord.findMany({
        where: { userId, punchAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { punchAt: 'asc' },
      }),
      this.prisma.attendanceOverride.findFirst({
        where: { userId, gregDate },
        orderBy: { createdAt: 'desc' },
      }),
      this.holidayFor(gregDate, sched.scheduleId),
    ]);

    const { jYear, jMonth, jDay } = toJalaliParts(gregDate);
    const isWeekend = forcedOff || !sched.workDays.includes(dow);

    // Resolve check-in / check-out, letting an override replace either side.
    let firstIn: Date | null = punches.length ? punches[0].punchAt : null;
    let lastOut: Date | null = punches.length > 1 ? punches[punches.length - 1].punchAt : null;
    if (override?.clearCheckIn) firstIn = null;
    else if (override?.newCheckIn) firstIn = override.newCheckIn;
    if (override?.clearCheckOut) lastOut = null;
    else if (override?.newCheckOut) lastOut = override.newCheckOut;

    let workedMinutes = 0;
    let overtimeMinutes = 0;
    let holidayOvertimeMinutes = 0;
    let delayMinutes = 0;
    let earlyLeaveMinutes = 0;
    let nightMinutes = 0;
    let leaveMinutes = 0;
    let forceLeaveFull = false;
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

      // Overtime is the GREATER of two measures, so it works whether a schedule is
      // configured around a fixed end-time or a required duration:
      //   (a) time worked past the defined end-of-shift (checkOutEnd). Leaving late
      //       earns overtime regardless of arrival time — e.g. checkOutEnd 17:50,
      //       leaving 18:32 ⇒ 42m, even if the person clocked in late.
      //   (b) net minutes beyond the required daily total. A late arrival is covered
      //       separately by leave, so it is added back and never reduces overtime —
      //       e.g. required 420, present 563 ⇒ 143m.
      const otPastEnd = outMin - sched.endMin;
      const otBeyondRequired = workedMinutes + delayMinutes - sched.dailyMinutes;
      const extra = Math.max(otPastEnd, otBeyondRequired);
      if (sched.otAllowed && extra >= sched.otMinThreshold) {
        const rounded = sched.otRounding > 0
          ? Math.floor(extra / sched.otRounding) * sched.otRounding : extra;
        // otMaxDaily === 0 means "no daily cap" (unlimited), matching otMaxMonthly.
        overtimeMinutes = sched.otMaxDaily > 0 ? Math.min(rounded, sched.otMaxDaily) : rounded;
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

    // ── Approved hourly leave ──────────────────────────────────────────
    // > 3h of leave in a day ⇒ the whole day is leave and any present time
    // becomes overtime. ≤ 3h ⇒ partial leave that counts toward the required
    // hours (so it can produce overtime and excuses the shortfall).
    const grantedLeave = override?.leaveMinutes ?? 0;
    if (grantedLeave > 0) {
      if (grantedLeave > 180) {
        forceLeaveFull = true;
        leaveMinutes = sched.dailyMinutes;
        delayMinutes = 0;
        earlyLeaveMinutes = 0;
        overtimeMinutes = workedMinutes; // present hours → overtime
      } else {
        leaveMinutes = grantedLeave;
        const extra = workedMinutes + delayMinutes + leaveMinutes - sched.dailyMinutes;
        if (sched.otAllowed && extra >= sched.otMinThreshold) {
          const rounded = sched.otRounding > 0 ? Math.floor(extra / sched.otRounding) * sched.otRounding : extra;
          overtimeMinutes = Math.max(overtimeMinutes, sched.otMaxDaily > 0 ? Math.min(rounded, sched.otMaxDaily) : rounded);
        }
      }
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
    } else if (forceLeaveFull) {
      status = AttendanceStatus.LEAVE;
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

    // On a holiday/weekend, punches count as holiday work.
    // All worked time goes to holidayOvertimeMinutes (separate from regular OT
    // because payment multipliers differ: e.g. regular OT × 1.4, holiday × 2.0).
    const isHolidayWork = holidayWork && bothPunches;
    if (holidayWork) {
      delayMinutes = 0;
      earlyLeaveMinutes = 0;
      if (isHolidayWork) {
        holidayOvertimeMinutes = workedMinutes;
        overtimeMinutes = 0; // reset — regular OT doesn't apply on holidays
      }
    }

    // Net deficit: hours short of required. Zero for HOURLY staff, holidays, weekends,
    // and days still in progress (punched in but not yet out — workedMinutes is not
    // final, so nothing must be finalized as deficit until check-out is recorded).
    // Formula: max(0, required - worked - approved_leave). Handles late, early, short, absent.
    let deficitMinutes = (!holidayWork && sched.employeeType === 'FULL_TIME' && (bothPunches || !hasPunch))
      ? Math.max(0, sched.dailyMinutes - workedMinutes - leaveMinutes)
      : 0;

    // ── Automatic leave conversion ───────────────────────────────────────
    // Runs only for FULL_TIME staff on working days, and only when no human
    // has already decided the day's outcome (forceStatus / granted leave >3h).
    // Two rules, both gated by WorkSchedule toggles and the user's remaining
    // annual balance (computed from PRIOR days only, same ascending-stability
    // rule as the monthly OT cap above — a later day must never change an
    // earlier day's numbers on recompute):
    //   1) ABSENT → LEAVE, if a full day's balance remains.
    //   2) Deficit → hourly leave, capped at a monthly minutes budget; once
    //      that budget can't absorb the day's whole shortfall, the day rolls
    //      over into a full LEAVE day instead of a partial hourly credit.
    let autoConvertedLeave = false;
    if (sched.employeeType === 'FULL_TIME' && !holidayWork && !override?.forceStatus && !forceLeaveFull) {
      if (status === AttendanceStatus.ABSENT && sched.absentToLeaveEnabled) {
        const remaining = await this.remainingLeaveMinutesBefore(userId, jYear, gregDate, sched);
        if (remaining >= sched.dailyMinutes) {
          status = AttendanceStatus.LEAVE;
          leaveMinutes = sched.dailyMinutes;
          deficitMinutes = 0;
          autoConvertedLeave = true;
        }
      } else if (deficitMinutes > 0 && sched.deficitToLeaveEnabled) {
        const remaining = await this.remainingLeaveMinutesBefore(userId, jYear, gregDate, sched);
        if (remaining > 0) {
          const usedHourlyThisMonth = await this.hourlyLeaveUsedThisMonth(userId, jYear, jMonth, gregDate);
          const capRoom = Math.max(0, sched.hourlyLeaveCapMinutes - usedHourlyThisMonth);
          const overflow = deficitMinutes - capRoom;
          if (overflow > 0 && remaining >= sched.dailyMinutes) {
            // Monthly hourly budget can't cover today's shortfall — roll the
            // whole day into a full daily-leave conversion instead.
            status = AttendanceStatus.LEAVE;
            leaveMinutes = sched.dailyMinutes;
            deficitMinutes = 0;
            autoConvertedLeave = true;
          } else {
            const hourlyConvert = Math.min(deficitMinutes, capRoom, remaining);
            if (hourlyConvert > 0) {
              leaveMinutes += hourlyConvert;
              deficitMinutes -= hourlyConvert;
              autoConvertedLeave = true;
            }
          }
        }
      }
    }

    await this.prisma.attendanceDay.upsert({
      where: { userId_gregDate: { userId, gregDate } },
      create: {
        userId, gregDate, jYear, jMonth, jDay,
        firstCheckIn: firstIn, lastCheckOut: lastOut,
        workedMinutes, overtimeMinutes, holidayOvertimeMinutes,
        delayMinutes, earlyLeaveMinutes, deficitMinutes, nightMinutes, leaveMinutes,
        autoConvertedLeave, status, isHolidayWork, hasOverride: !!override,
      },
      update: {
        jYear, jMonth, jDay,
        firstCheckIn: firstIn, lastCheckOut: lastOut,
        workedMinutes, overtimeMinutes, holidayOvertimeMinutes,
        delayMinutes, earlyLeaveMinutes, deficitMinutes, nightMinutes, leaveMinutes,
        autoConvertedLeave, status, isHolidayWork, hasOverride: !!override, computedAt: new Date(),
      },
    });
  }

  // Remaining annual leave balance in minutes, counting only days strictly
  // before `gregDate` — mirrors RecordsService.leaveBalance()'s formula
  // exactly so the two never disagree, and keeps a full-year recompute stable
  // in ascending date order (a later day can never retroactively change an
  // earlier day's conversion decision).
  private async remainingLeaveMinutesBefore(
    userId: string,
    jYear: number,
    gregDate: Date,
    sched: EffectiveSchedule,
  ): Promise<number> {
    const dailyReq = sched.dailyMinutes;
    const entitlementMin = sched.annualLeaveDays * dailyReq;
    const [fullDays, absentDays, tardyAgg, hourlyAgg] = await Promise.all([
      this.prisma.attendanceDay.count({
        where: { userId, jYear, gregDate: { lt: gregDate }, status: AttendanceStatus.LEAVE },
      }),
      this.prisma.attendanceDay.count({
        where: { userId, jYear, gregDate: { lt: gregDate }, status: AttendanceStatus.ABSENT },
      }),
      this.prisma.attendanceDay.aggregate({
        where: { userId, jYear, gregDate: { lt: gregDate }, autoConvertedLeave: false },
        _sum: { delayMinutes: true, earlyLeaveMinutes: true },
      }),
      this.prisma.attendanceDay.aggregate({
        where: { userId, jYear, gregDate: { lt: gregDate }, status: { not: AttendanceStatus.LEAVE } },
        _sum: { leaveMinutes: true },
      }),
    ]);
    const tardyMinutes = (tardyAgg._sum.delayMinutes ?? 0) + (tardyAgg._sum.earlyLeaveMinutes ?? 0);
    const hourlyLeaveMinutes = hourlyAgg._sum.leaveMinutes ?? 0;
    const usedMin = fullDays * dailyReq + absentDays * dailyReq + hourlyLeaveMinutes + tardyMinutes;
    return Math.max(0, entitlementMin - usedMin);
  }

  // Sum of auto-converted (deficit→hourly) leave minutes so far this Jalali
  // month, counting only days strictly before `gregDate` — the running budget
  // that hourlyLeaveCapMinutes is checked against.
  private async hourlyLeaveUsedThisMonth(userId: string, jYear: number, jMonth: number, gregDate: Date): Promise<number> {
    const agg = await this.prisma.attendanceDay.aggregate({
      where: {
        userId, jYear, jMonth,
        gregDate: { lt: gregDate },
        autoConvertedLeave: true,
        status: { not: AttendanceStatus.LEAVE },
      },
      _sum: { leaveMinutes: true },
    });
    return agg._sum.leaveMinutes ?? 0;
  }
}

// Re-export so the sync service can group raw punches into work dates.
export { workDateOf };
