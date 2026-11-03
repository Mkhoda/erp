import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLogService } from '../work-log/work-log.service';
import { jalaliMonthRange, toJalaliParts, workDateOf } from '../attendance/engine/jalali.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const ADMIN_ACTOR = { role: 'ADMIN' };
// Ticket statuses that still need work.
const OPEN_TICKET = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_USER', 'USER_REPLIED'] as const;

// Read-only, organisation-wide metrics for /dashboard/analytics. Every method is a pure
// aggregate over existing tables — nothing here writes. Periods are Jalali months
// (defaulting to the current one); "today" is the Tehran calendar day.
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService, private workLogs: WorkLogService) {}

  private period(q: any) {
    const t = toJalaliParts(workDateOf(new Date()));
    const jYear = +q.jYear || t.jYear;
    const jMonth = +q.jMonth || t.jMonth;
    if (jMonth < 1 || jMonth > 12) throw new BadRequestException('ماه نامعتبر است');
    const { start, endExcl } = jalaliMonthRange(jYear, jMonth);
    return { jYear, jMonth, start, endExcl };
  }

  private async deptNames(ids: (string | null)[]) {
    const clean = [...new Set(ids.filter(Boolean) as string[])];
    const rows = clean.length ? await this.prisma.department.findMany({ where: { id: { in: clean } }, select: { id: true, name: true } }) : [];
    return new Map(rows.map((d) => [d.id, d.name]));
  }

  private async userNames(ids: string[]) {
    const rows = ids.length ? await this.prisma.user.findMany({
      where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
    }) : [];
    return new Map(rows.map((u) => [u.id, { name: `${u.firstName} ${u.lastName}`, department: u.department?.name ?? null }]));
  }

  // ── نمای کلی ─────────────────────────────────────────────────────────────
  async overview() {
    const today = workDateOf(new Date());
    const now = Date.now();
    const [usersActive, usersDisabled, todayStatus, assetsCount, assetsValue, openTickets, overdueTickets, pendingRequests, activeSessions, unread] = await Promise.all([
      this.prisma.user.count({ where: { disabled: false } }),
      this.prisma.user.count({ where: { disabled: true } }),
      this.prisma.attendanceDay.groupBy({ by: ['status'], where: { gregDate: today }, _count: true }),
      this.prisma.asset.count(),
      this.prisma.asset.aggregate({ _sum: { cost: true } }),
      this.prisma.ticket.count({ where: { status: { in: [...OPEN_TICKET] as any } } }),
      this.prisma.ticket.count({ where: { status: { in: [...OPEN_TICKET] as any }, dueAt: { lt: new Date() } } }),
      this.prisma.attendanceRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.session.count({ where: { isRevoked: false, lastSeenAt: { gte: new Date(now - 15 * 60_000) } } }),
      this.prisma.notification.count({ where: { isRead: false } }),
    ]);
    const statusToday: Record<string, number> = {};
    for (const r of todayStatus) statusToday[r.status] = r._count;
    const present = ['PRESENT', 'LATE', 'EARLY_LEAVE', 'INCOMPLETE'].reduce((s, k) => s + (statusToday[k] ?? 0), 0);
    const wl = await this.workLogs.adminDays(ADMIN_ACTOR, { from: isoDate(today), to: isoDate(today) });
    return {
      date: isoDate(today),
      users: { active: usersActive, disabled: usersDisabled, onlineNow: activeSessions },
      attendanceToday: { present, statuses: statusToday },
      assets: { count: assetsCount, value: assetsValue._sum.cost ?? 0 },
      tickets: { open: openTickets, overdue: overdueTickets },
      attendanceRequestsPending: pendingRequests,
      workLogToday: wl.summary,
      unreadNotifications: unread,
    };
  }

  // ── حضور و غیاب ──────────────────────────────────────────────────────────
  async attendance(q: any) {
    const p = this.period(q);
    const where = { gregDate: { gte: p.start, lt: p.endExcl } };
    const [totals, byStatus, byDay, perUser, requests] = await Promise.all([
      this.prisma.attendanceDay.aggregate({
        where,
        _sum: { workedMinutes: true, overtimeMinutes: true, holidayOvertimeMinutes: true, delayMinutes: true, earlyLeaveMinutes: true, deficitMinutes: true, nightMinutes: true, leaveMinutes: true, sickLeaveMinutes: true, remoteMinutes: true, remoteOvertimeMinutes: true },
        _count: true,
      }),
      this.prisma.attendanceDay.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.attendanceDay.groupBy({ by: ['gregDate', 'status'], where, _count: true }),
      this.prisma.attendanceDay.groupBy({
        by: ['userId'], where,
        _sum: { workedMinutes: true, overtimeMinutes: true, delayMinutes: true, deficitMinutes: true, remoteMinutes: true },
      }),
      this.prisma.attendanceRequest.groupBy({ by: ['type', 'status'], where: { createdAt: { gte: p.start, lt: p.endExcl } }, _count: true }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const r of byStatus) statusCounts[r.status] = r._count;

    const days = new Map<number, { date: string; jDay: number; present: number; late: number; absent: number; leave: number; remote: number }>();
    for (let t = p.start.getTime(); t < p.endExcl.getTime() && t <= workDateOf(new Date()).getTime(); t += DAY_MS) {
      days.set(t, { date: isoDate(new Date(t)), jDay: toJalaliParts(new Date(t)).jDay, present: 0, late: 0, absent: 0, leave: 0, remote: 0 });
    }
    for (const r of byDay) {
      const d = days.get(r.gregDate.getTime());
      if (!d) continue;
      if (r.status === 'PRESENT' || r.status === 'EARLY_LEAVE' || r.status === 'INCOMPLETE') d.present += r._count;
      else if (r.status === 'LATE') { d.present += r._count; d.late += r._count; }
      else if (r.status === 'ABSENT') d.absent += r._count;
      else if (r.status === 'LEAVE' || r.status === 'SICK_LEAVE') d.leave += r._count;
      else if (r.status === 'REMOTE_WORK') d.remote += r._count;
    }

    const names = await this.userNames(perUser.map((u) => u.userId));
    const people = perUser.map((u) => ({
      userId: u.userId, ...(names.get(u.userId) ?? { name: '—', department: null }),
      workedMinutes: u._sum.workedMinutes ?? 0, overtimeMinutes: u._sum.overtimeMinutes ?? 0,
      delayMinutes: u._sum.delayMinutes ?? 0, deficitMinutes: u._sum.deficitMinutes ?? 0, remoteMinutes: u._sum.remoteMinutes ?? 0,
    }));
    const top = (k: keyof (typeof people)[number]) => [...people].filter((x) => (x[k] as number) > 0).sort((a, b) => (b[k] as number) - (a[k] as number)).slice(0, 10);

    // Per department (primary department of each user).
    const deptAgg = new Map<string, { department: string; people: number; workedMinutes: number; overtimeMinutes: number; delayMinutes: number; deficitMinutes: number }>();
    for (const x of people) {
      const k = x.department || 'بدون دپارتمان';
      const cur = deptAgg.get(k) ?? { department: k, people: 0, workedMinutes: 0, overtimeMinutes: 0, delayMinutes: 0, deficitMinutes: 0 };
      cur.people++; cur.workedMinutes += x.workedMinutes; cur.overtimeMinutes += x.overtimeMinutes;
      cur.delayMinutes += x.delayMinutes; cur.deficitMinutes += x.deficitMinutes;
      deptAgg.set(k, cur);
    }

    return {
      ...p, start: isoDate(p.start),
      records: totals._count,
      totals: Object.fromEntries(Object.entries(totals._sum).map(([k, v]) => [k, v ?? 0])),
      statusCounts,
      daily: [...days.values()],
      topOvertime: top('overtimeMinutes'), topDelay: top('delayMinutes'), topDeficit: top('deficitMinutes'), topRemote: top('remoteMinutes'),
      byDepartment: [...deptAgg.values()].sort((a, b) => b.workedMinutes - a.workedMinutes),
      requests: requests.map((r) => ({ type: r.type, status: r.status, count: r._count })),
    };
  }

  // ── اموال ────────────────────────────────────────────────────────────────
  async assets() {
    const [total, value, byAvail, byCond, byCat, byType, activeAssign, byMonth, assignByDept] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.aggregate({ _sum: { cost: true } }),
      this.prisma.asset.groupBy({ by: ['availability'], _count: true, _sum: { cost: true } }),
      this.prisma.asset.groupBy({ by: ['condition'], _count: true }),
      this.prisma.asset.groupBy({ by: ['categoryId'], _count: true, _sum: { cost: true } }),
      this.prisma.asset.groupBy({ by: ['typeId'], _count: true }),
      this.prisma.assetAssignment.count({ where: { returnedAt: null } }),
      this.prisma.asset.findMany({ where: { createdAt: { gte: new Date(Date.now() - 400 * DAY_MS) } }, select: { createdAt: true } }),
      this.prisma.assetAssignment.groupBy({ by: ['departmentId'], where: { returnedAt: null }, _count: true }),
    ]);
    const [cats, types] = await Promise.all([
      this.prisma.assetCategory.findMany({ select: { id: true, name: true } }),
      this.prisma.assetType.findMany({ select: { id: true, name: true } }),
    ]);
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const typeName = new Map(types.map((c) => [c.id, c.name]));
    const depts = await this.deptNames(assignByDept.map((a) => a.departmentId));

    // Assets added per Jalali month over the last 12 months.
    const months = new Map<string, { label: string; count: number }>();
    const t = toJalaliParts(workDateOf(new Date()));
    for (let i = 11; i >= 0; i--) {
      let y = t.jYear, m = t.jMonth - i;
      while (m < 1) { m += 12; y--; }
      months.set(`${y}-${m}`, { label: `${y}/${String(m).padStart(2, '0')}`, count: 0 });
    }
    for (const a of byMonth) {
      const j = toJalaliParts(workDateOf(a.createdAt));
      const k = months.get(`${j.jYear}-${j.jMonth}`);
      if (k) k.count++;
    }

    return {
      total, value: value._sum.cost ?? 0, activeAssignments: activeAssign,
      byAvailability: byAvail.map((r) => ({ key: r.availability, count: r._count, value: r._sum.cost ?? 0 })),
      byCondition: byCond.map((r) => ({ key: r.condition, count: r._count })),
      byCategory: byCat.map((r) => ({ name: catName.get(r.categoryId) ?? '—', count: r._count, value: r._sum.cost ?? 0 })).sort((a, b) => b.count - a.count),
      byType: byType.map((r) => ({ name: typeName.get(r.typeId) ?? '—', count: r._count })).sort((a, b) => b.count - a.count),
      addedPerMonth: [...months.values()],
      assignedByDepartment: assignByDept.filter((r) => r.departmentId).map((r) => ({ name: depts.get(r.departmentId!) ?? '—', count: r._count })).sort((a, b) => b.count - a.count),
    };
  }

  // ── عملکرد (ثبت عملکرد) ─────────────────────────────────────────────────
  async workLog(q: any) {
    const p = this.period(q);
    const today = workDateOf(new Date());
    const to = new Date(Math.min(p.endExcl.getTime() - DAY_MS, today.getTime()));
    if (to.getTime() < p.start.getTime()) return { ...p, start: isoDate(p.start), summary: null, daily: [], byDepartment: [], topUsers: [], byCategory: [] };
    const days = await this.workLogs.adminDays(ADMIN_ACTOR, { from: isoDate(p.start), to: isoDate(to) });

    const daily = new Map<string, { date: string; jDay: number; submitted: number; late: number; missing: number }>();
    const dept = new Map<string, { department: string; required: number; submitted: number; late: number; missing: number; loggedMinutes: number }>();
    const users = new Map<string, { name: string; department: string | null; loggedMinutes: number; reports: number; late: number; missing: number }>();
    for (const r of days.rows) {
      const d = daily.get(r.date) ?? { date: r.date, jDay: r.jDay, submitted: 0, late: 0, missing: 0 };
      if (r.state === 'SUBMITTED') d.submitted++; else if (r.state === 'LATE') d.late++; else if (r.state === 'MISSING') d.missing++;
      daily.set(r.date, d);
      const dk = r.user.department?.name || 'بدون دپارتمان';
      const dd = dept.get(dk) ?? { department: dk, required: 0, submitted: 0, late: 0, missing: 0, loggedMinutes: 0 };
      if (r.required) dd.required++;
      if (r.state === 'SUBMITTED') dd.submitted++; else if (r.state === 'LATE') dd.late++; else if (r.state === 'MISSING') dd.missing++;
      dd.loggedMinutes += r.loggedMinutes;
      dept.set(dk, dd);
      const u = users.get(r.userId) ?? { name: `${r.user.firstName} ${r.user.lastName}`, department: r.user.department?.name ?? null, loggedMinutes: 0, reports: 0, late: 0, missing: 0 };
      u.loggedMinutes += r.loggedMinutes;
      if (r.report) u.reports++;
      if (r.state === 'LATE') u.late++;
      if (r.state === 'MISSING') u.missing++;
      users.set(r.userId, u);
    }

    // Logged time by category over the period.
    const byTask = await this.prisma.workTaskEntry.groupBy({ by: ['taskId'], where: { gregDate: { gte: p.start, lte: to } }, _sum: { minutes: true } });
    const tasks = byTask.length ? await this.prisma.workTask.findMany({ where: { id: { in: byTask.map((t) => t.taskId) } }, select: { id: true, category: { select: { name: true, color: true } } } }) : [];
    const taskCat = new Map(tasks.map((t) => [t.id, t.category]));
    const cats = new Map<string, { name: string; color: string | null; minutes: number }>();
    for (const t of byTask) {
      const c = taskCat.get(t.taskId);
      const k = c?.name || 'بدون دسته';
      const cur = cats.get(k) ?? { name: k, color: c?.color ?? null, minutes: 0 };
      cur.minutes += t._sum.minutes ?? 0;
      cats.set(k, cur);
    }

    return {
      ...p, start: isoDate(p.start),
      summary: days.summary,
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byDepartment: [...dept.values()].sort((a, b) => b.required - a.required),
      topUsers: [...users.values()].sort((a, b) => b.loggedMinutes - a.loggedMinutes).slice(0, 15),
      byCategory: [...cats.values()].sort((a, b) => b.minutes - a.minutes),
    };
  }

  // ── تیکت‌ها ──────────────────────────────────────────────────────────────
  async tickets() {
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [byStatus, byPriority, byDept, recent, resolved, overdue] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], _count: true }),
      this.prisma.ticket.groupBy({ by: ['priority'], where: { status: { in: [...OPEN_TICKET] as any } }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['departmentId'], where: { status: { in: [...OPEN_TICKET] as any } }, _count: true }),
      this.prisma.ticket.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, resolvedAt: true } }),
      this.prisma.ticket.findMany({ where: { resolvedAt: { gte: since } }, select: { createdAt: true, resolvedAt: true } }),
      this.prisma.ticket.count({ where: { status: { in: [...OPEN_TICKET] as any }, dueAt: { lt: new Date() } } }),
    ]);
    const depts = await this.deptNames(byDept.map((d) => d.departmentId));
    const perDay = new Map<string, { date: string; created: number; resolved: number }>();
    for (let t = workDateOf(since).getTime(); t <= workDateOf(new Date()).getTime(); t += DAY_MS) {
      const k = isoDate(new Date(t));
      perDay.set(k, { date: k, created: 0, resolved: 0 });
    }
    for (const r of recent) { const d = perDay.get(isoDate(workDateOf(r.createdAt))); if (d) d.created++; }
    for (const r of resolved) { const d = perDay.get(isoDate(workDateOf(r.resolvedAt!))); if (d) d.resolved++; }
    const hours = resolved.map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
    return {
      byStatus: byStatus.map((r) => ({ key: r.status, count: r._count })),
      openByPriority: byPriority.map((r) => ({ key: r.priority, count: r._count })),
      openByDepartment: byDept.map((r) => ({ name: depts.get(r.departmentId) ?? '—', count: r._count })).sort((a, b) => b.count - a.count),
      daily: [...perDay.values()],
      avgResolutionHours: hours.length ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10 : null,
      resolvedLast30: resolved.length,
      createdLast30: recent.length,
      overdue,
    };
  }

  // ── کاربران و سامانه ────────────────────────────────────────────────────
  async system() {
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [byRole, byDept, disabled, noCard, sessions24h, onlineNow, messages, notifByCat] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], where: { disabled: false }, _count: true }),
      this.prisma.user.groupBy({ by: ['departmentId'], where: { disabled: false }, _count: true }),
      this.prisma.user.count({ where: { disabled: true } }),
      this.prisma.user.count({ where: { disabled: false, attendanceCardNo: null } }),
      this.prisma.session.count({ where: { isRevoked: false, lastSeenAt: { gte: new Date(Date.now() - DAY_MS) } } }),
      this.prisma.session.count({ where: { isRevoked: false, lastSeenAt: { gte: new Date(Date.now() - 15 * 60_000) } } }),
      this.prisma.chatMessage.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.notification.groupBy({ by: ['category'], where: { createdAt: { gte: since } }, _count: true }),
    ]);
    const depts = await this.deptNames(byDept.map((d) => d.departmentId));
    const perDay = new Map<string, { date: string; messages: number }>();
    for (let t = workDateOf(since).getTime(); t <= workDateOf(new Date()).getTime(); t += DAY_MS) {
      const k = isoDate(new Date(t));
      perDay.set(k, { date: k, messages: 0 });
    }
    for (const m of messages) { const d = perDay.get(isoDate(workDateOf(m.createdAt))); if (d) d.messages++; }
    return {
      usersByRole: byRole.map((r) => ({ key: r.role, count: r._count })),
      usersByDepartment: byDept.map((r) => ({ name: r.departmentId ? depts.get(r.departmentId) ?? '—' : 'بدون دپارتمان', count: r._count })).sort((a, b) => b.count - a.count),
      disabledUsers: disabled, usersWithoutCard: noCard,
      activeSessions24h: sessions24h, onlineNow,
      messagesDaily: [...perDay.values()], messagesLast30: messages.length,
      notificationsByCategory: notifByCat.map((r) => ({ key: r.category, count: r._count })).sort((a, b) => b.count - a.count),
    };
  }
}
