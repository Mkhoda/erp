import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { toJalaliParts, workDateOf } from '../engine/jalali.util';

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService) {}

  private deptWhere(scopeDeptIds?: string[], departmentId?: string): Prisma.AttendanceDayWhereInput {
    const conds: Prisma.UserWhereInput[] = [];
    if (departmentId) {
      conds.push({ OR: [{ departmentId }, { userDepartments: { some: { departmentId } } }] });
    }
    if (scopeDeptIds && scopeDeptIds.length) {
      conds.push({
        OR: [
          { departmentId: { in: scopeDeptIds } },
          { userDepartments: { some: { departmentId: { in: scopeDeptIds } } } },
        ],
      });
    }
    return conds.length ? { user: { AND: conds } } : {};
  }

  // Full admin/HR dashboard payload for a Jalali month (+ optional dept filter).
  async monthly(jYear: number, jMonth: number, scopeDeptIds?: string[], departmentId?: string) {
    const base = this.deptWhere(scopeDeptIds, departmentId);
    const where: Prisma.AttendanceDayWhereInput = { ...base, jYear, jMonth };

    const today = toJalaliParts(workDateOf(new Date()));
    const todayWhere: Prisma.AttendanceDayWhereInput = {
      ...base,
      jYear: today.jYear,
      jMonth: today.jMonth,
      jDay: today.jDay,
    };

    const [byStatus, totals, byDay, byUserOt, byUserDelay, todayStatus, mappedUsers] =
      await Promise.all([
        this.prisma.attendanceDay.groupBy({ by: ['status'], where, _count: true }),
        this.prisma.attendanceDay.aggregate({
          where,
          _sum: { workedMinutes: true, overtimeMinutes: true, delayMinutes: true, earlyLeaveMinutes: true, nightMinutes: true },
          _count: true,
        }),
        this.prisma.attendanceDay.groupBy({
          by: ['jDay'],
          where,
          _sum: { workedMinutes: true, overtimeMinutes: true, delayMinutes: true },
          _count: true,
        }),
        this.prisma.attendanceDay.groupBy({
          by: ['userId'],
          where: { ...where, overtimeMinutes: { gt: 0 } },
          _sum: { overtimeMinutes: true },
        }),
        this.prisma.attendanceDay.groupBy({
          by: ['userId'],
          where: { ...where, delayMinutes: { gt: 0 } },
          _sum: { delayMinutes: true },
          _count: true,
        }),
        this.prisma.attendanceDay.groupBy({ by: ['status'], where: todayWhere, _count: true }),
        this.prisma.user.count({ where: { attendanceCardNo: { not: null } } }),
      ]);

    const statusCounts: Record<string, number> = {};
    for (const r of byStatus) statusCounts[r.status] = r._count;
    const todayCounts: Record<string, number> = {};
    for (const r of todayStatus) todayCounts[r.status] = r._count;

    const trend = byDay
      .map((d) => ({
        jDay: d.jDay,
        present: d._count,
        workedMinutes: d._sum.workedMinutes ?? 0,
        overtimeMinutes: d._sum.overtimeMinutes ?? 0,
        delayMinutes: d._sum.delayMinutes ?? 0,
      }))
      .sort((a, b) => a.jDay - b.jDay);

    const topOt = await this.attachNames(
      byUserOt
        .map((r) => ({ userId: r.userId, value: r._sum.overtimeMinutes ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    );
    const topDelay = await this.attachNames(
      byUserDelay
        .map((r) => ({ userId: r.userId, value: r._sum.delayMinutes ?? 0, days: r._count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    );

    return {
      jYear,
      jMonth,
      mappedUsers,
      statusCounts,
      todayCounts,
      totals: {
        days: totals._count,
        workedMinutes: totals._sum.workedMinutes ?? 0,
        overtimeMinutes: totals._sum.overtimeMinutes ?? 0,
        delayMinutes: totals._sum.delayMinutes ?? 0,
        earlyLeaveMinutes: totals._sum.earlyLeaveMinutes ?? 0,
        nightMinutes: totals._sum.nightMinutes ?? 0,
      },
      trend,
      topOvertime: topOt,
      topDelay,
    };
  }

  private async attachNames<T extends { userId: string }>(rows: T[]): Promise<Array<T & { name: string }>> {
    if (!rows.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const map = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return rows.map((r) => ({ ...r, name: map.get(r.userId) ?? '—' }));
  }
}
