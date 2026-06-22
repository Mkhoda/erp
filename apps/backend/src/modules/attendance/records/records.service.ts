import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordFilter {
  jYear?: number;
  jMonth?: number;
  userId?: string;
  departmentId?: string;
  status?: string;
  // Server-enforced department scope for managers (their own department ids).
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
    const [agg, byStatus] = await Promise.all([
      this.prisma.attendanceDay.aggregate({
        where,
        _sum: { workedMinutes: true, overtimeMinutes: true, delayMinutes: true, earlyLeaveMinutes: true, nightMinutes: true },
        _count: true,
      }),
      this.prisma.attendanceDay.groupBy({ by: ['status'], where, _count: true }),
    ]);
    const statusCounts: Record<string, number> = {};
    for (const r of byStatus) statusCounts[r.status] = r._count;
    return {
      days: agg._count,
      workedMinutes: agg._sum.workedMinutes ?? 0,
      overtimeMinutes: agg._sum.overtimeMinutes ?? 0,
      delayMinutes: agg._sum.delayMinutes ?? 0,
      earlyLeaveMinutes: agg._sum.earlyLeaveMinutes ?? 0,
      nightMinutes: agg._sum.nightMinutes ?? 0,
      statusCounts,
    };
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

  // Day detail: computed row + every raw punch + any override (audit view).
  async dayDetail(userId: string, gregDate: Date) {
    const dayEnd = new Date(gregDate.getTime() + 24 * 60 * 60 * 1000);
    const [day, punches, override] = await Promise.all([
      this.prisma.attendanceDay.findUnique({
        where: { userId_gregDate: { userId, gregDate } },
        include: { user: { select: USER_SELECT } },
      }),
      this.prisma.rawAttendanceRecord.findMany({
        where: { userId, punchAt: { gte: gregDate, lt: dayEnd } },
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
