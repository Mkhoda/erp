import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, TicketPriority, TicketStatus } from '@prisma/client';
import { resolveReportRange } from '../attendance/engine/range.util';
import { tehranMidnightInstant, workDateOf } from '../attendance/engine/jalali.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_USER, TicketStatus.USER_REPLIED, TicketStatus.REOPENED];
type Filter = { departmentId?: string; assigneeId?: string; priority?: string; status?: string; from?: string; to?: string };

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private where(f: Filter): Prisma.TicketWhereInput {
    const priority = Object.values(TicketPriority).find((x) => x === f.priority);
    const status = Object.values(TicketStatus).find((x) => x === f.status);
    const range = f.from || f.to ? resolveReportRange(f) : null;
    return {
      ...(f.departmentId ? { departmentId: String(f.departmentId) } : {}),
      ...(f.assigneeId ? { assigneeId: String(f.assigneeId) } : {}),
      ...(priority ? { priority } : {}), ...(status ? { status } : {}),
      ...(range ? { createdAt: { gte: tehranMidnightInstant(range.start), lt: tehranMidnightInstant(range.endExcl) } } : {}),
    };
  }

  async getDashboardStats(f: Filter) {
    const where = this.where(f);
    const [byStatus, overSla, byDept, byDeptOpen, byPriority, dailyTrend] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.ticket.count({ where: { ...where, isOverSla: true } }),
      this.prisma.ticket.groupBy({ by: ['departmentId'], where, _count: true }),
      this.prisma.ticket.groupBy({ by: ['departmentId'], where: { AND: [where, { status: { in: OPEN } }] }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['priority'], where, _count: true }),
      this.dailyTrend(f, where),
    ]);
    const statusMap: Record<string, number> = {};
    for (const r of byStatus) statusMap[r.status] = r._count;
    const depts = await this.prisma.department.findMany({ where: { id: { in: byDept.map((r) => r.departmentId) } }, select: { id: true, name: true } });
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const openOf = new Map(byDeptOpen.map((r) => [r.departmentId, r._count]));
    return {
      total: byStatus.reduce((s, r) => s + r._count, 0),
      open: OPEN.reduce((s, st) => s + (statusMap[st] ?? 0), 0),
      overSla,
      byStatus: statusMap,
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count])),
      byDepartment: byDept.map((r) => ({ id: r.departmentId, name: deptName.get(r.departmentId) ?? '—', total: r._count, open: openOf.get(r.departmentId) ?? 0 })).sort((a, b) => b.total - a.total).slice(0, 10),
      dailyTrend,
    };
  }

  // Tickets created per Tehran day over the chosen range (last 30 days without one).
  private async dailyTrend(f: Filter, where: Prisma.TicketWhereInput) {
    const today = workDateOf(new Date()).getTime();
    const r = f.from || f.to ? resolveReportRange(f) : { start: new Date(today - 29 * DAY_MS), endExcl: new Date(today + DAY_MS) };
    const rows = await this.prisma.ticket.findMany({
      where: { ...where, createdAt: { gte: tehranMidnightInstant(r.start), lt: tehranMidnightInstant(r.endExcl) } }, select: { createdAt: true },
    });
    const days = new Map<string, number>();
    for (let t = r.start.getTime(); t < r.endExcl.getTime() && t <= today; t += DAY_MS) days.set(new Date(t).toISOString().slice(0, 10), 0);
    for (const x of rows) { const k = workDateOf(x.createdAt).toISOString().slice(0, 10); if (days.has(k)) days.set(k, days.get(k)! + 1); }
    return [...days].map(([date, count]) => ({ date, count }));
  }

  async getWorkloadReport(f: Filter) {
    const where: Prisma.TicketWhereInput = { AND: [this.where(f), { assigneeId: { not: null } }] };
    const [rows, over] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['assigneeId', 'status'], where, _count: true }),
      this.prisma.ticket.groupBy({ by: ['assigneeId'], where: { AND: [where, { isOverSla: true }] }, _count: true }),
    ]);
    const map = new Map<string, { total: number; open: number; resolved: number }>();
    for (const r of rows) {
      const x = map.get(r.assigneeId!) ?? { total: 0, open: 0, resolved: 0 };
      x.total += r._count;
      if (OPEN.includes(r.status)) x.open += r._count;
      if (r.status === TicketStatus.RESOLVED || r.status === TicketStatus.CLOSED) x.resolved += r._count;
      map.set(r.assigneeId!, x);
    }
    const users = await this.prisma.user.findMany({ where: { id: { in: [...map.keys()] } }, select: { id: true, firstName: true, lastName: true } });
    const name = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const overOf = new Map(over.map((r) => [r.assigneeId!, r._count]));
    return [...map].map(([assigneeId, x]) => ({ assigneeId, assigneeName: name.get(assigneeId) ?? '—', ...x, overSla: overOf.get(assigneeId) ?? 0 })).sort((a, b) => b.total - a.total);
  }

  async getSlaReport(f: Filter) {
    const where = this.where(f);
    const [metrics, oldestOpen] = await Promise.all([
      this.prisma.ticketSlaMetric.findMany({ where: { ticket: where }, select: { resolutionBreached: true, minutesToFirstResponse: true, minutesToResolution: true } }),
      this.prisma.ticket.findFirst({ where: { AND: [where, { status: { in: OPEN } }] }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);
    const breached = metrics.filter((m) => m.resolutionBreached).length;
    return {
      total: metrics.length, breached, met: metrics.length - breached,
      breachRate: metrics.length ? Math.round((breached / metrics.length) * 1000) / 10 : 0, // percent
      avgFirstResponse: this.avg(metrics.map((m) => m.minutesToFirstResponse)),
      avgResolution: this.avg(metrics.map((m) => m.minutesToResolution)),
      longestOpenDays: oldestOpen ? Math.floor((Date.now() - oldestOpen.createdAt.getTime()) / DAY_MS) : 0,
    };
  }

  private avg(nums: (number | null)[]) {
    const valid = nums.filter((n): n is number => n !== null);
    return valid.length ? Math.round(valid.reduce((s, n) => s + n, 0) / valid.length) : 0;
  }
}
