import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tehranMidnightInstant } from '../engine/jalali.util';

export interface RecordFilter {
  jYear?: number;
  jMonth?: number;
  jDay?: number;
  userId?: string;
  departmentId?: string;
  status?: string;
  // Server-enforced department scope for managers (their own department ids).
  scopeDepartmentIds?: string[];
}

export interface MonthlySummaryFilter {
  jYears?: number[];
  jMonths?: number[];
  userIds?: string[];
  departmentId?: string;
  scopeDepartmentIds?: string[];
}

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  attendanceCardNo: true,
  department: { select: { id: true, name: true } },
} as const;

@Injectable()
export class RecordsService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(f: RecordFilter): Prisma.AttendanceDayWhereInput {
    const where: Prisma.AttendanceDayWhereInput = {};
    if (f.jYear) where.jYear = f.jYear;
    if (f.jMonth) where.jMonth = f.jMonth;
    if (f.jDay) where.jDay = f.jDay;
    if (f.userId) where.userId = f.userId;
    if (f.status) where.status = f.status as any;

    // Department conditions: explicit filter AND/OR the manager's enforced scope.
    const conds: Prisma.UserWhereInput[] = [];
    if (f.departmentId) {
      conds.push({
        OR: [
          { departmentId: f.departmentId },
          { userDepartments: { some: { departmentId: f.departmentId } } },
        ],
      });
    }
    if (f.scopeDepartmentIds && f.scopeDepartmentIds.length) {
      conds.push({
        OR: [
          { departmentId: { in: f.scopeDepartmentIds } },
          { userDepartments: { some: { departmentId: { in: f.scopeDepartmentIds } } } },
        ],
      });
    }
    if (conds.length) where.user = { AND: conds };
    return where;
  }

  // Filtered list of computed attendance days (newest first).
  async list(f: RecordFilter, take = 1000) {
    return this.prisma.attendanceDay.findMany({
      where: this.buildWhere(f),
      include: { user: { select: USER_SELECT } },
      orderBy: [{ gregDate: 'desc' }, { userId: 'asc' }],
      take,
    });
  }

  // Aggregated totals for the current filter (drives the records summary bar).
  async summary(f: RecordFilter) {
    const where = this.buildWhere(f);
    const [agg, byStatus, byDate, hourlyAgg] = await Promise.all([
      this.prisma.attendanceDay.aggregate({
        where,
        _sum: { workedMinutes: true, overtimeMinutes: true, holidayOvertimeMinutes: true, delayMinutes: true, earlyLeaveMinutes: true, deficitMinutes: true, nightMinutes: true },
        _count: true,
      }),
      this.prisma.attendanceDay.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.attendanceDay.groupBy({ by: ['gregDate'], where }),
      // Hourly leave = leaveMinutes on non-full-leave days within the same filter
      // (year/month/user/dept) — full-leave days are counted separately as whole
      // days (statusCounts.LEAVE) to avoid double counting, same convention as leaveBalance().
      this.prisma.attendanceDay.aggregate({
        where: { AND: [where, { status: { not: 'LEAVE' } }] },
        _sum: { leaveMinutes: true },
      }),
    ]);
    const statusCounts: Record<string, number> = {};
    for (const r of byStatus) statusCounts[r.status] = r._count;
    return {
      records: agg._count,
      distinctDays: byDate.length,
      days: agg._count,
      workedMinutes: agg._sum.workedMinutes ?? 0,
      overtimeMinutes: agg._sum.overtimeMinutes ?? 0,
      holidayOvertimeMinutes: agg._sum.holidayOvertimeMinutes ?? 0,
      delayMinutes: agg._sum.delayMinutes ?? 0,
      earlyLeaveMinutes: agg._sum.earlyLeaveMinutes ?? 0,
      deficitMinutes: agg._sum.deficitMinutes ?? 0,
      nightMinutes: agg._sum.nightMinutes ?? 0,
      hourlyLeaveMinutes: hourlyAgg._sum.leaveMinutes ?? 0,
      leaveDays: statusCounts['LEAVE'] ?? 0,
      statusCounts,
    };
  }

  private buildMonthlyWhere(f: MonthlySummaryFilter): Prisma.AttendanceDayWhereInput {
    const where: Prisma.AttendanceDayWhereInput = {};
    if (f.jYears?.length) where.jYear = { in: f.jYears };
    if (f.jMonths?.length) where.jMonth = { in: f.jMonths };
    if (f.userIds?.length) where.userId = { in: f.userIds };

    const conds: Prisma.UserWhereInput[] = [];
    if (f.departmentId) {
      conds.push({
        OR: [
          { departmentId: f.departmentId },
          { userDepartments: { some: { departmentId: f.departmentId } } },
        ],
      });
    }
    if (f.scopeDepartmentIds && f.scopeDepartmentIds.length) {
      conds.push({
        OR: [
          { departmentId: { in: f.scopeDepartmentIds } },
          { userDepartments: { some: { departmentId: { in: f.scopeDepartmentIds } } } },
        ],
      });
    }
    if (conds.length) where.user = { AND: conds };
    return where;
  }

  // Per-user, per-month aggregated totals — one row per (user, jYear, jMonth),
  // used by the monthly report page to show each selected person's selected
  // months side by side instead of one blended total.
  async monthlySummary(f: MonthlySummaryFilter) {
    if (!f.userIds?.length) return [];
    const where = this.buildMonthlyWhere(f);
    const [agg, hourlyAgg, leaveAgg] = await Promise.all([
      this.prisma.attendanceDay.groupBy({
        by: ['userId', 'jYear', 'jMonth'],
        where,
        _sum: { workedMinutes: true, overtimeMinutes: true, holidayOvertimeMinutes: true, delayMinutes: true, earlyLeaveMinutes: true, deficitMinutes: true, nightMinutes: true },
        _count: true,
      }),
      // Hourly leave = leaveMinutes on non-full-leave days (same convention as summary()/leaveBalance()).
      this.prisma.attendanceDay.groupBy({
        by: ['userId', 'jYear', 'jMonth'],
        where: { AND: [where, { status: { not: 'LEAVE' } }] },
        _sum: { leaveMinutes: true },
      }),
      this.prisma.attendanceDay.groupBy({
        by: ['userId', 'jYear', 'jMonth'],
        where: { AND: [where, { status: 'LEAVE' }] },
        _count: true,
      }),
    ]);

    const key = (userId: string, jYear: number, jMonth: number) => `${userId}_${jYear}_${jMonth}`;
    const hourlyMap = new Map(hourlyAgg.map((r) => [key(r.userId, r.jYear, r.jMonth), r._sum.leaveMinutes ?? 0]));
    const leaveMap = new Map(leaveAgg.map((r) => [key(r.userId, r.jYear, r.jMonth), r._count]));

    const userIds = [...new Set(agg.map((r) => r.userId))];
    const usersList = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: USER_SELECT })
      : [];
    const usersMap = new Map(usersList.map((u) => [u.id, u]));

    const rows = agg.map((r) => {
      const k = key(r.userId, r.jYear, r.jMonth);
      return {
        userId: r.userId,
        user: usersMap.get(r.userId) ?? null,
        jYear: r.jYear,
        jMonth: r.jMonth,
        distinctDays: r._count,
        workedMinutes: r._sum.workedMinutes ?? 0,
        delayMinutes: r._sum.delayMinutes ?? 0,
        earlyLeaveMinutes: r._sum.earlyLeaveMinutes ?? 0,
        deficitMinutes: r._sum.deficitMinutes ?? 0,
        hourlyLeaveMinutes: hourlyMap.get(k) ?? 0,
        leaveDays: leaveMap.get(k) ?? 0,
        overtimeMinutes: r._sum.overtimeMinutes ?? 0,
        holidayOvertimeMinutes: r._sum.holidayOvertimeMinutes ?? 0,
        nightMinutes: r._sum.nightMinutes ?? 0,
      };
    });

    rows.sort((a, b) => {
      const an = a.user ? `${a.user.firstName}${a.user.lastName}` : '';
      const bn = b.user ? `${b.user.firstName}${b.user.lastName}` : '';
      return an.localeCompare(bn, 'fa') || a.jYear - b.jYear || a.jMonth - b.jMonth;
    });
    return rows;
  }

  // Distinct (jYear, jMonth) periods that actually have computed data — drives
  // the data-aware year/month filter dropdowns.
  async periods(f: RecordFilter) {
    const rows = await this.prisma.attendanceDay.groupBy({
      by: ['jYear', 'jMonth'],
      where: this.buildWhere(f),
      orderBy: [{ jYear: 'desc' }, { jMonth: 'desc' }],
    });
    return rows.map((r) => ({ jYear: r.jYear, jMonth: r.jMonth }));
  }

  // Leave balance for a user in a Jalali year: entitlement (from the user's
  // effective schedule/group) vs used (full-day LEAVE) → remaining.
  async leaveBalance(userId: string, jYear: number) {
    const rule = await this.prisma.userAttendanceRule.findUnique({ where: { userId } });
    let sched = rule?.scheduleId
      ? await this.prisma.workSchedule.findUnique({ where: { id: rule.scheduleId } })
      : null;
    if (!sched) {
      sched = await this.prisma.workSchedule.findFirst({
        where: { OR: [{ isDefault: true }, { name: 'default' }] },
        orderBy: { isDefault: 'desc' },
      });
    }
    const entitlement = sched?.annualLeaveDays ?? 26;
    const dailyReq = sched?.dailyMinutes ?? 500;
    const [fullDays, absentDays, mission, remote, tardyAgg, hourlyAgg] = await Promise.all([
      this.prisma.attendanceDay.count({ where: { userId, jYear, status: 'LEAVE' } }),
      this.prisma.attendanceDay.count({ where: { userId, jYear, status: 'ABSENT' } }),
      this.prisma.attendanceDay.count({ where: { userId, jYear, status: 'MISSION' } }),
      this.prisma.attendanceDay.count({ where: { userId, jYear, status: 'REMOTE_WORK' } }),
      // Delay + early-leave across the year are deducted from leave (hourly).
      // Excludes days where the shortfall was auto-converted into leaveMinutes
      // (hourlyAgg below) — otherwise the same lateness would be deducted twice.
      this.prisma.attendanceDay.aggregate({
        where: { userId, jYear, autoConvertedLeave: false },
        _sum: { delayMinutes: true, earlyLeaveMinutes: true },
      }),
      // Hourly leave = leaveMinutes on non-full-leave days (full-leave days are
      // counted as whole days separately to avoid double counting).
      this.prisma.attendanceDay.aggregate({
        where: { userId, jYear, status: { not: 'LEAVE' } },
        _sum: { leaveMinutes: true },
      }),
    ]);
    const tardyMinutes = (tardyAgg._sum.delayMinutes ?? 0) + (tardyAgg._sum.earlyLeaveMinutes ?? 0);
    const hourlyLeaveMinutes = hourlyAgg._sum.leaveMinutes ?? 0;

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const entitlementMin = entitlement * dailyReq;
    const usedMin = fullDays * dailyReq + absentDays * dailyReq + hourlyLeaveMinutes + tardyMinutes;
    const remainingMin = Math.max(0, entitlementMin - usedMin);
    return {
      jYear, entitlement, dailyReq, mission, remote,
      fullDays,                                   // whole-day leaves
      absentDays,                                 // unexcused absences (deducted from balance)
      hourlyLeaveMinutes,                         // partial (hourly) leave minutes
      tardyMinutes,                               // delay + early-leave minutes
      usedMinutes: usedMin,
      usedDays: r2(usedMin / dailyReq),
      remainingMinutes: remainingMin,
      remainingDays: r2(remainingMin / dailyReq),
    };
  }

  // Day detail: computed row + every raw punch + any override (audit view).
  async dayDetail(userId: string, gregDate: Date) {
    const dayStart = tehranMidnightInstant(gregDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const [day, punches, override] = await Promise.all([
      this.prisma.attendanceDay.findUnique({
        where: { userId_gregDate: { userId, gregDate } },
        include: { user: { select: USER_SELECT } },
      }),
      this.prisma.rawAttendanceRecord.findMany({
        where: { userId, punchAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { punchAt: 'asc' },
        select: { id: true, punchAt: true, deviceCode: true, rType: true, recordId: true },
      }),
      this.prisma.attendanceOverride.findFirst({
        where: { userId, gregDate },
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    return { day, punches, override };
  }
}
