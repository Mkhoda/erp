import { Injectable } from '@nestjs/common';
import { AssetAvailability, AssetCondition, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLogService } from '../work-log/work-log.service';
import { tehranMidnightInstant, toJalaliParts, workDateOf } from '../attendance/engine/jalali.util';
import { MAX_REPORT_DAYS, resolveReportRange } from '../attendance/engine/range.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const ADMIN_ACTOR = { role: 'ADMIN' };
// Ticket statuses that still need work.
export const OPEN_TICKET = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_USER', 'USER_REPLIED', 'REOPENED'] as const;
// A query value only if it is one of the enum's members (anything else = not filtered).
const enumOf = <T extends string>(v: any, e: Record<string, T>): T | undefined => Object.values(e).find((x) => x === v);

// Read-only, organisation-wide metrics for /dashboard/analytics. Every method is a pure
// aggregate over existing tables — nothing here writes. Periods are a from/to range or
// a Jalali month (default: the current one); "today" is the Tehran calendar day.
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService, private workLogs: WorkLogService) {}

  private period(q: any) {
    const { start, endExcl } = resolveReportRange(q);
    return {
      start, endExcl,
      from: isoDate(start), to: isoDate(new Date(endExcl.getTime() - DAY_MS)),
      // The same period for real timestamps (createdAt, …): Tehran midnights.
      instants: { gte: tehranMidnightInstant(start), lt: tehranMidnightInstant(endExcl) },
    };
  }

  /** Every day of the period up to today, for per-day series. */
  private eachDay(p: { start: Date; endExcl: Date }): Date[] {
    const days: Date[] = [];
    const last = Math.min(p.endExcl.getTime() - DAY_MS, workDateOf(new Date()).getTime());
    for (let t = p.start.getTime(); t <= last; t += DAY_MS) days.push(new Date(t));
    return days;
  }

  async filters() {
    const name = { select: { id: true, name: true }, orderBy: { name: 'asc' as const } };
    const [types, categories, owners, assignees] = await Promise.all([
      this.prisma.assetType.findMany(name), this.prisma.assetCategory.findMany(name), this.prisma.assetOwner.findMany(name),
      this.prisma.user.findMany({ where: { disabled: false, ticketsAssigned: { some: {} } }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
    ]);
    return { assetTypes: types, assetCategories: categories, assetOwners: owners, ticketAssignees: assignees.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })) };
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

  /**
   * People filter for the attendance / work-log / overview tabs: work-rule groups (scheduleIds,
   * comma separated; the default group also matches people with no group), a department, one person.
   * Returns null when nothing is filtered.
   */
  async filteredUserIds(q: any): Promise<Set<string> | null> {
    const scheduleIds = String(q?.scheduleIds || '').split(',').filter(Boolean);
    const departmentId = q?.departmentId || null;
    const userId = q?.userId || null;
    if (!scheduleIds.length && !departmentId && !userId) return null;
    const and: any[] = [];
    if (scheduleIds.length) {
      const defaults = await this.prisma.workSchedule.findMany({ where: { id: { in: scheduleIds }, isDefault: true }, select: { id: true } });
      const or: any[] = [{ attendanceRule: { scheduleId: { in: scheduleIds } } }];
      if (defaults.length) or.push({ attendanceRule: null }, { attendanceRule: { scheduleId: null } });
      and.push({ OR: or });
    }
    if (departmentId) and.push({ OR: [{ departmentId }, { userDepartments: { some: { departmentId } } }] });
    if (userId) and.push({ id: String(userId) });
    const users = await this.prisma.user.findMany({ where: { AND: and }, select: { id: true } });
    return new Set(users.map((u) => u.id));
  }

  private async hourlyIds(): Promise<Set<string>> {
    const rows = await this.prisma.userAttendanceRule.findMany({ where: { employeeType: 'HOURLY' }, select: { userId: true } });
    return new Set(rows.map((r) => r.userId));
  }

  // ── نمای کلی ─────────────────────────────────────────────────────────────
  async overview(q: any = {}) {
    const only = await this.filteredUserIds(q);
    const userIn = only ? { userId: { in: [...only] } } : {};
    const today = workDateOf(new Date());
    const now = Date.now();
    const p = this.period(q);
    const periodDays = { gregDate: { gte: p.start, lt: p.endExcl }, ...userIn };
    const [periodAtt, periodStatus, ticketsCreated, ticketsResolved, periodRequests] = await Promise.all([
      this.prisma.attendanceDay.aggregate({ where: periodDays, _sum: { workedMinutes: true, overtimeMinutes: true, delayMinutes: true, deficitMinutes: true } }),
      this.prisma.attendanceDay.groupBy({ by: ['status'], where: periodDays, _count: true }),
      this.prisma.ticket.count({ where: { createdAt: p.instants } }),
      this.prisma.ticket.count({ where: { resolvedAt: p.instants } }),
      this.prisma.attendanceRequest.count({ where: { createdAt: p.instants, ...userIn } }),
    ]);
    const [usersActive, usersDisabled, todayStatus, assetsCount, assetsValue, openTickets, overdueTickets, pendingRequests, activeSessions, unread] = await Promise.all([
      this.prisma.user.count({ where: { disabled: false } }),
      this.prisma.user.count({ where: { disabled: true } }),
      this.prisma.attendanceDay.groupBy({ by: ['status'], where: { gregDate: today, ...userIn }, _count: true }),
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
    const wlAll = await this.workLogs.adminDays(ADMIN_ACTOR, { from: isoDate(today), to: isoDate(today) });
    const wl = only ? { summary: this.summarize(wlAll.rows.filter((r: any) => only.has(r.userId))) } : wlAll;
    return {
      date: isoDate(today),
      users: { active: usersActive, disabled: usersDisabled, onlineNow: activeSessions },
      attendanceToday: { present, statuses: statusToday },
      assets: { count: assetsCount, value: assetsValue._sum.cost ?? 0 },
      tickets: { open: openTickets, overdue: overdueTickets },
      attendanceRequestsPending: pendingRequests,
      workLogToday: wl.summary,
      unreadNotifications: unread,
      period: {
        from: p.from, to: p.to, ticketsCreated, ticketsResolved, requests: periodRequests,
        totals: Object.fromEntries(Object.entries(periodAtt._sum).map(([k, v]) => [k, v ?? 0])),
        statuses: Object.fromEntries(periodStatus.map((r) => [r.status, r._count])),
      },
    };
  }

  // ── حضور و غیاب ──────────────────────────────────────────────────────────
  async attendance(q: any) {
    const p = this.period(q);
    const only = await this.filteredUserIds(q);
    const where: any = { gregDate: { gte: p.start, lt: p.endExcl }, ...(only ? { userId: { in: [...only] } } : {}) };
    const today = workDateOf(new Date());
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
      this.prisma.attendanceRequest.groupBy({ by: ['type', 'status'], where: { createdAt: p.instants, ...(only ? { userId: { in: [...only] } } : {}) }, _count: true }),
    ]);
    const [todayRows, activeUsers, incompleteOpen, hourly] = await Promise.all([
      this.prisma.attendanceDay.findMany({ where: { gregDate: today, ...(only ? { userId: { in: [...only] } } : {}) }, select: { status: true, firstCheckIn: true, lastCheckOut: true } }),
      this.prisma.user.count({ where: { disabled: false, attendanceCardNo: { not: null }, ...(only ? { id: { in: [...only] } } : {}) } }),
      // Incomplete days that are over (not today) — need a manual fix.
      this.prisma.attendanceDay.findMany({
        where: { ...where, status: 'INCOMPLETE', gregDate: { gte: p.start, lt: new Date(Math.min(p.endExcl.getTime(), today.getTime())) } },
        select: { userId: true, gregDate: true, firstCheckIn: true, lastCheckOut: true },
        orderBy: { gregDate: 'desc' }, take: 50,
      }),
      this.hourlyIds(),
    ]);
    // Today, live: still at work = checked in, no check-out yet.
    const todayStatus: Record<string, number> = {};
    let working = 0;
    for (const r of todayRows) {
      if (r.status === 'INCOMPLETE' && r.firstCheckIn && !r.lastCheckOut) working++;
      else todayStatus[r.status] = (todayStatus[r.status] ?? 0) + 1;
    }
    const presentToday = working + ['PRESENT', 'LATE', 'EARLY_LEAVE', 'INCOMPLETE'].reduce((s, k) => s + (todayStatus[k] ?? 0), 0);

    const statusCounts: Record<string, number> = {};
    for (const r of byStatus) statusCounts[r.status] = r._count;

    const days = new Map<number, { date: string; jDay: number; present: number; late: number; absent: number; leave: number; remote: number }>();
    for (const d of this.eachDay(p)) {
      days.set(d.getTime(), { date: isoDate(d), jDay: toJalaliParts(d).jDay, present: 0, late: 0, absent: 0, leave: 0, remote: 0 });
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
    // Hourly staff only matter for worked time — never in overtime/lateness/deficit rankings.
    const top = (k: keyof (typeof people)[number], includeHourly = false) => [...people]
      .filter((x) => (x[k] as number) > 0 && (includeHourly || !hourly.has(x.userId)))
      .sort((a, b) => (b[k] as number) - (a[k] as number)).slice(0, 10);
    const incNames = await this.userNames([...new Set(incompleteOpen.map((r) => r.userId))]);

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
      from: p.from, to: p.to,
      records: totals._count,
      totals: Object.fromEntries(Object.entries(totals._sum).map(([k, v]) => [k, v ?? 0])),
      statusCounts,
      daily: [...days.values()],
      topOvertime: top('overtimeMinutes'), topDelay: top('delayMinutes'), topDeficit: top('deficitMinutes'), topRemote: top('remoteMinutes'),
      topWorked: top('workedMinutes', true),
      today: { date: isoDate(today), statuses: todayStatus, working, present: presentToday, activeUsers, attendancePct: activeUsers ? Math.round((presentToday / activeUsers) * 100) : null },
      incompleteOpen: incompleteOpen.map((r) => ({ userId: r.userId, ...(incNames.get(r.userId) ?? { name: '—', department: null }), date: isoDate(r.gregDate), firstCheckIn: r.firstCheckIn, lastCheckOut: r.lastCheckOut })),
      byDepartment: [...deptAgg.values()].sort((a, b) => b.workedMinutes - a.workedMinutes),
      requests: requests.map((r) => ({ type: r.type, status: r.status, count: r._count })),
    };
  }

  /** Same counters as WorkLogService.adminDays().summary, for an already-filtered set of rows. */
  private summarize(rows: any[]) {
    const s = { required: 0, submitted: 0, late: 0, missing: 0, pending: 0, loggedMinutes: 0 };
    for (const r of rows) {
      if (r.required) s.required++;
      if (r.state === 'SUBMITTED') s.submitted++; else if (r.state === 'LATE') s.late++;
      else if (r.state === 'MISSING') s.missing++; else if (r.state === 'PENDING') s.pending++;
      s.loggedMinutes += r.loggedMinutes || 0;
    }
    return s;
  }

  // ── اموال ────────────────────────────────────────────────────────────────
  // `from`/`to` (optional here) is when the asset was registered; assignments follow the same assets.
  async assets(q: any = {}) {
    const ranged = !!(q.from || q.to);
    const p = ranged ? this.period(q) : null;
    const where: any = {
      ...(q.typeId ? { typeId: String(q.typeId) } : {}), ...(q.categoryId ? { categoryId: String(q.categoryId) } : {}), ...(q.ownerId ? { ownerId: String(q.ownerId) } : {}),
      availability: enumOf(q.availability, AssetAvailability), condition: enumOf(q.condition, AssetCondition),
      ...(q.departmentId ? { assignments: { some: { returnedAt: null, departmentId: String(q.departmentId) } } } : {}),
      ...(p ? { createdAt: p.instants } : {}),
    };
    const ofAsset = { asset: where };
    const [total, value, byAvail, byCond, byCat, byType, activeAssign, byMonth, assignByDept] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.aggregate({ where, _sum: { cost: true } }),
      this.prisma.asset.groupBy({ by: ['availability'], where, _count: true, _sum: { cost: true } }),
      this.prisma.asset.groupBy({ by: ['condition'], where, _count: true }),
      this.prisma.asset.groupBy({ by: ['categoryId'], where, _count: true, _sum: { cost: true } }),
      this.prisma.asset.groupBy({ by: ['typeId'], where, _count: true }),
      this.prisma.assetAssignment.count({ where: { returnedAt: null, ...ofAsset } }),
      this.prisma.asset.findMany({ where: { AND: [where, { createdAt: { gte: new Date(Date.now() - 400 * DAY_MS) } }] }, select: { createdAt: true } }),
      this.prisma.assetAssignment.groupBy({ by: ['departmentId'], where: { returnedAt: null, ...ofAsset }, _count: true }),
    ]);
    const since = new Date(Date.now() - 400 * DAY_MS);
    const [cats, types, assignTotal, assignReturned, assignRecent, returnedRecent] = await Promise.all([
      this.prisma.assetCategory.findMany({ select: { id: true, name: true } }),
      this.prisma.assetType.findMany({ select: { id: true, name: true } }),
      this.prisma.assetAssignment.count({ where: ofAsset }),
      this.prisma.assetAssignment.count({ where: { returnedAt: { not: null }, ...ofAsset } }),
      this.prisma.assetAssignment.findMany({ where: { assignedAt: { gte: since }, ...ofAsset }, select: { assignedAt: true } }),
      this.prisma.assetAssignment.findMany({ where: { returnedAt: { gte: since }, ...ofAsset }, select: { returnedAt: true } }),
    ]);
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const typeName = new Map(types.map((c) => [c.id, c.name]));
    const depts = await this.deptNames(assignByDept.map((a) => a.departmentId));

    // Assets added per Jalali month over the last 12 months.
    const months = new Map<string, { label: string; count: number; assigned: number; returned: number }>();
    const t = toJalaliParts(workDateOf(new Date()));
    for (let i = 11; i >= 0; i--) {
      let y = t.jYear, m = t.jMonth - i;
      while (m < 1) { m += 12; y--; }
      months.set(`${y}-${m}`, { label: `${y}/${String(m).padStart(2, '0')}`, count: 0, assigned: 0, returned: 0 });
    }
    const bump = (d: Date, f: 'count' | 'assigned' | 'returned') => {
      const j = toJalaliParts(workDateOf(d));
      const k = months.get(`${j.jYear}-${j.jMonth}`);
      if (k) k[f]++;
    };
    for (const a of byMonth) bump(a.createdAt, 'count');
    for (const a of assignRecent) bump(a.assignedAt, 'assigned');
    for (const a of returnedRecent) bump(a.returnedAt!, 'returned');

    return {
      total, value: value._sum.cost ?? 0, activeAssignments: activeAssign,
      assignments: { total: assignTotal, active: activeAssign, returned: assignReturned },
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
    if (to.getTime() < p.start.getTime()) return { from: p.from, to: p.to, summary: null, daily: [], byDepartment: [], topUsers: [], byCategory: [] };
    const only = await this.filteredUserIds(q);
    const all = await this.workLogs.adminDays(ADMIN_ACTOR, { from: isoDate(p.start), to: isoDate(to), ...(q.userId ? { userId: q.userId } : {}) }, MAX_REPORT_DAYS);
    const days = only ? { rows: all.rows.filter((r: any) => only.has(r.userId)), summary: this.summarize(all.rows.filter((r: any) => only.has(r.userId))) } : all;

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

    // Logged time by category over the period (never from before the work log started).
    const wlStart = await this.workLogs.startDate();
    const since = wlStart && wlStart > p.start ? wlStart : p.start;
    const byTask = await this.prisma.workTaskEntry.groupBy({ by: ['taskId'], where: { gregDate: { gte: since, lte: to }, ...(only ? { userId: { in: [...only] } } : {}) }, _sum: { minutes: true } });
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
      from: p.from, to: p.to,
      summary: days.summary,
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byDepartment: [...dept.values()].sort((a, b) => b.required - a.required),
      topUsers: [...users.values()].sort((a, b) => b.loggedMinutes - a.loggedMinutes).slice(0, 15),
      byCategory: [...cats.values()].sort((a, b) => b.minutes - a.minutes),
    };
  }

  // ── تیکت‌ها ──────────────────────────────────────────────────────────────
  // The period covers created/resolved figures; backlog (open, overdue) is always "right now".
  async tickets(q: any = {}) {
    const p = this.period(q);
    const f: any = {
      ...(q.departmentId ? { departmentId: String(q.departmentId) } : {}), ...(q.assigneeId ? { assigneeId: String(q.assigneeId) } : {}),
      priority: enumOf(q.priority, TicketPriority), status: enumOf(q.status, TicketStatus),
    };
    const open = { AND: [f, { status: { in: [...OPEN_TICKET] as any } }] };
    const [byStatus, byPriority, byDept, recent, resolved, overdue] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where: { ...f, createdAt: p.instants }, _count: true }),
      this.prisma.ticket.groupBy({ by: ['priority'], where: open, _count: true }),
      this.prisma.ticket.groupBy({ by: ['departmentId'], where: open, _count: true }),
      this.prisma.ticket.findMany({ where: { ...f, createdAt: p.instants }, select: { createdAt: true } }),
      this.prisma.ticket.findMany({ where: { ...f, resolvedAt: p.instants }, select: { createdAt: true, resolvedAt: true } }),
      this.prisma.ticket.count({ where: { AND: [open, { dueAt: { lt: new Date() } }] } }),
    ]);
    const depts = await this.deptNames(byDept.map((d) => d.departmentId));
    const perDay = new Map<string, { date: string; created: number; resolved: number }>();
    for (const d of this.eachDay(p)) perDay.set(isoDate(d), { date: isoDate(d), created: 0, resolved: 0 });
    for (const r of recent) { const d = perDay.get(isoDate(workDateOf(r.createdAt))); if (d) d.created++; }
    for (const r of resolved) { const d = perDay.get(isoDate(workDateOf(r.resolvedAt!))); if (d) d.resolved++; }
    const hours = resolved.map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
    return {
      from: p.from, to: p.to,
      byStatus: byStatus.map((r) => ({ key: r.status, count: r._count })),
      openByPriority: byPriority.map((r) => ({ key: r.priority, count: r._count })),
      openByDepartment: byDept.map((r) => ({ name: depts.get(r.departmentId) ?? '—', count: r._count })).sort((a, b) => b.count - a.count),
      daily: [...perDay.values()],
      avgResolutionHours: hours.length ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10 : null,
      resolvedCount: resolved.length,
      createdCount: recent.length,
      openNow: byDept.reduce((s, r) => s + r._count, 0),
      overdue,
    };
  }

  // ── کاربران و سامانه ────────────────────────────────────────────────────
  async system(q: any = {}) {
    const p = this.period(q);
    const inDept = q.departmentId ? { OR: [{ departmentId: String(q.departmentId) }, { userDepartments: { some: { departmentId: String(q.departmentId) } } }] } : {};
    const [byRole, byDept, disabled, noCard, sessions24h, onlineNow, messages, notifByCat] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], where: { disabled: false, ...inDept }, _count: true }),
      this.prisma.user.groupBy({ by: ['departmentId'], where: { disabled: false, ...inDept }, _count: true }),
      this.prisma.user.count({ where: { disabled: true, ...inDept } }),
      this.prisma.user.count({ where: { disabled: false, attendanceCardNo: null, ...inDept } }),
      this.prisma.session.count({ where: { isRevoked: false, lastSeenAt: { gte: new Date(Date.now() - DAY_MS) } } }),
      this.prisma.session.count({ where: { isRevoked: false, lastSeenAt: { gte: new Date(Date.now() - 15 * 60_000) } } }),
      this.prisma.chatMessage.findMany({ where: { createdAt: p.instants }, select: { createdAt: true } }),
      this.prisma.notification.groupBy({ by: ['category'], where: { createdAt: p.instants }, _count: true }),
    ]);
    const depts = await this.deptNames(byDept.map((d) => d.departmentId));
    const perDay = new Map<string, { date: string; messages: number }>();
    for (const d of this.eachDay(p)) perDay.set(isoDate(d), { date: isoDate(d), messages: 0 });
    for (const m of messages) { const d = perDay.get(isoDate(workDateOf(m.createdAt))); if (d) d.messages++; }
    return {
      from: p.from, to: p.to,
      usersByRole: byRole.map((r) => ({ key: r.role, count: r._count })),
      usersByDepartment: byDept.map((r) => ({ name: r.departmentId ? depts.get(r.departmentId) ?? '—' : 'بدون دپارتمان', count: r._count })).sort((a, b) => b.count - a.count),
      disabledUsers: disabled, usersWithoutCard: noCard,
      activeSessions24h: sessions24h, onlineNow,
      messagesDaily: [...perDay.values()], messagesCount: messages.length,
      notificationsByCategory: notifByCat.map((r) => ({ key: r.category, count: r._count })).sort((a, b) => b.count - a.count),
    };
  }
}
