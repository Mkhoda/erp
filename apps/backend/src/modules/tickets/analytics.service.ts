import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(filter: { departmentId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {};
    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = new Date(filter.dateFrom);
      if (filter.dateTo) where.createdAt.lte = new Date(filter.dateTo);
    }

    const openStatuses = [TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_USER, TicketStatus.USER_REPLIED, TicketStatus.REOPENED];

    const [total, byStatus, overSla, avgMetrics, byDept, byCategory, byPriority, recentTrend] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.ticket.count({ where: { ...where, isOverSla: true } }),
      this.prisma.ticketSlaMetric.aggregate({
        where: { ticket: where },
        _avg: { minutesToFirstResponse: true, minutesToResolution: true, businessMinutesTotal: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['departmentId'],
        where,
        _count: true,
        orderBy: { _count: { departmentId: 'desc' } },
        take: 10,
      }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where,
        _count: true,
        orderBy: { _count: { categoryId: 'desc' } },
        take: 10,
      }),
      this.prisma.ticket.groupBy({ by: ['priority'], where, _count: true }),
      this.getDailyTrend(where, 30),
    ]);

    const statusMap: Record<string, number> = {};
    for (const r of byStatus) statusMap[r.status] = r._count;

    const open = openStatuses.reduce((s, st) => s + (statusMap[st] ?? 0), 0);

    // Enrich dept + category names
    const deptIds = byDept.map(r => r.departmentId);
    const catIds = byCategory.map(r => r.categoryId);
    const [depts, cats] = await Promise.all([
      this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } }),
      this.prisma.ticketCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } }),
    ]);
    const deptName = Object.fromEntries(depts.map(d => [d.id, d.name]));
    const catName = Object.fromEntries(cats.map(c => [c.id, c.name]));

    return {
      total,
      open,
      overSla,
      resolved: statusMap[TicketStatus.RESOLVED] ?? 0,
      closed: statusMap[TicketStatus.CLOSED] ?? 0,
      byStatus: statusMap,
      byPriority: Object.fromEntries(byPriority.map(r => [r.priority, r._count])),
      avgFirstResponseMin: Math.round(avgMetrics._avg.minutesToFirstResponse ?? 0),
      avgResolutionMin: Math.round(avgMetrics._avg.minutesToResolution ?? 0),
      byDepartment: byDept.map(r => ({ id: r.departmentId, name: deptName[r.departmentId] ?? r.departmentId, count: r._count })),
      byCategory: byCategory.map(r => ({ id: r.categoryId, name: catName[r.categoryId] ?? r.categoryId, count: r._count })),
      dailyTrend: recentTrend,
    };
  }

  private async getDailyTrend(baseWhere: any, days: number) {
    const rows = await this.prisma.$queryRawUnsafe<{ day: Date; count: bigint }[]>(`
      SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
      FROM "Ticket"
      WHERE "createdAt" >= NOW() - INTERVAL '${days} days'
      ${baseWhere.departmentId ? `AND "departmentId" = '${baseWhere.departmentId}'` : ''}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map(r => ({ day: r.day, count: Number(r.count) }));
  }

  async getWorkloadReport(filter: { departmentId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {};
    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = new Date(filter.dateFrom);
      if (filter.dateTo) where.createdAt.lte = new Date(filter.dateTo);
    }

    const byAssignee = await this.prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { ...where, assigneeId: { not: null } },
      _count: true,
    });

    const assigneeIds = byAssignee.map(r => r.assigneeId!).filter(Boolean);
    const users = await this.prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userName = Object.fromEntries(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    return byAssignee.map(r => ({
      assigneeId: r.assigneeId,
      name: r.assigneeId ? (userName[r.assigneeId] ?? r.assigneeId) : 'نامشخص',
      count: r._count,
    }));
  }

  async getSlaReport(filter: { departmentId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {};
    if (filter.departmentId) where.ticket = { departmentId: filter.departmentId };

    const metrics = await this.prisma.ticketSlaMetric.findMany({
      where,
      include: {
        ticket: {
          select: {
            id: true, number: true, status: true, priority: true,
            department: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            createdAt: true,
          },
        },
      },
      orderBy: { ticket: { createdAt: 'desc' } },
      take: 500,
    });

    const breached = metrics.filter(m => m.resolutionBreached);
    const met = metrics.filter(m => !m.resolutionBreached);

    return {
      total: metrics.length,
      breached: breached.length,
      met: met.length,
      breachRate: metrics.length ? Math.round((breached.length / metrics.length) * 100) : 0,
      avgFirstResponse: this.avg(metrics.map(m => m.minutesToFirstResponse)),
      avgResolution: this.avg(metrics.map(m => m.minutesToResolution)),
      longestOpen: metrics
        .filter(m => !m.minutesToResolution)
        .sort((a, b) => a.ticket.createdAt.getTime() - b.ticket.createdAt.getTime())
        .slice(0, 10),
    };
  }

  private avg(nums: (number | null)[]) {
    const valid = nums.filter((n): n is number => n !== null);
    return valid.length ? Math.round(valid.reduce((s, n) => s + n, 0) / valid.length) : 0;
  }
}
