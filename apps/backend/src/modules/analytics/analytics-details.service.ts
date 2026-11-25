import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetAvailability, AssetCondition, AttendanceStatus, Prisma, Role, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLogService } from '../work-log/work-log.service';
import { parseWorkDate } from '../attendance/scope.util';
import { tehranMidnightInstant, workDateOf } from '../attendance/engine/jalali.util';
import { MAX_REPORT_DAYS, resolveReportRange } from '../attendance/engine/range.util';
import { AnalyticsService, OPEN_TICKET } from './analytics.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const USER = { id: true, firstName: true, lastName: true, department: { select: { name: true } } } as const;
const nameOf = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}` : null);
const csv = <T extends string>(v: any, e: Record<string, T>): T[] => String(v || '').split(',').filter((x): x is T => Object.values(e).includes(x as T));
const METRICS = ['workedMinutes', 'overtimeMinutes', 'holidayOvertimeMinutes', 'delayMinutes', 'earlyLeaveMinutes', 'deficitMinutes', 'nightMinutes', 'leaveMinutes', 'remoteMinutes'] as const;
type Metric = (typeof METRICS)[number];
type Viewer = { role?: string };

// Row-level drill-down behind every section of /dashboard/analytics. View only: nothing here
// writes. The text of work reports, ticket descriptions and internal notes stay ADMIN-only —
// holders of a grant on the dashboard get the figures and the timeline.
@Injectable()
export class AnalyticsDetailsService {
  constructor(private prisma: PrismaService, private workLogs: WorkLogService, private analytics: AnalyticsService) {}

  private paging(q: any) {
    const page = Math.max(1, Math.floor(+q.page) || 1);
    const pageSize = Math.min(200, Math.max(10, Math.floor(+q.pageSize) || 50));
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, dir: (q.dir === 'asc' ? 'asc' : 'desc') as Prisma.SortOrder };
  }

  /** Sorts and pages rows that were built in memory. */
  private slice<T extends Record<string, any>>(rows: T[], q: any, allowed: string[], fallback: string) {
    const pg = this.paging(q);
    const key = allowed.includes(q.sort) ? q.sort : fallback;
    const sign = pg.dir === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      const x = a[key] ?? '', y = b[key] ?? '';
      return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fa'));
    });
    return { total: rows.length, page: pg.page, pageSize: pg.pageSize, rows: sorted.slice(pg.skip, pg.skip + pg.take) };
  }

  private text(q: any) { return String(q.search || '').trim().slice(0, 100); }

  private async range(q: any) {
    const { start, endExcl } = resolveReportRange(q);
    return { start, endExcl, last: new Date(endExcl.getTime() - DAY_MS), instants: { gte: tehranMidnightInstant(start), lt: tehranMidnightInstant(endExcl) } };
  }

  // ── attendance ──────────────────────────────────────────────────────────
  // view=days: one row per person-day · view=people: totals per person.
  async attendance(q: any) {
    const p = await this.range(q);
    const only = await this.analytics.filteredUserIds(q);
    const statuses = csv(q.status, AttendanceStatus);
    const metric = METRICS.find((m) => m === q.metric);
    const min = Math.max(1, Math.round(+q.min) || 1);
    const search = this.text(q);
    const where: Prisma.AttendanceDayWhereInput = {
      gregDate: { gte: p.start, lt: p.endExcl },
      ...(only ? { userId: { in: [...only] } } : {}),
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(metric ? { [metric]: { gte: min } } : {}),
      ...(q.override === '1' ? { hasOverride: true } : q.override === '0' ? { hasOverride: false } : {}),
      ...(search ? { user: this.userSearch(search) } : {}),
    };
    const agg = await this.prisma.attendanceDay.aggregate({ where, _sum: Object.fromEntries(METRICS.map((m) => [m, true])) as Record<Metric, true>, _count: { _all: true } });
    const totals = { records: agg._count._all, ...Object.fromEntries(METRICS.map((m) => [m, (agg._sum as any)?.[m] ?? 0])) };

    if (q.view === 'people') {
      const [sums, counts] = await Promise.all([
        this.prisma.attendanceDay.groupBy({ by: ['userId'], where, _sum: Object.fromEntries(METRICS.map((m) => [m, true])) as Record<Metric, true>, _count: { _all: true } }),
        this.prisma.attendanceDay.groupBy({ by: ['userId', 'status'], where, _count: { _all: true } }),
      ]);
      const users = await this.prisma.user.findMany({ where: { id: { in: sums.map((s) => s.userId) } }, select: USER });
      const uMap = new Map(users.map((u) => [u.id, u]));
      const rows = sums.map((s) => {
        const of = (...st: AttendanceStatus[]) => counts.filter((c) => c.userId === s.userId && st.includes(c.status)).reduce((a, c) => a + c._count._all, 0);
        return {
          userId: s.userId, name: nameOf(uMap.get(s.userId)) ?? '—', department: uMap.get(s.userId)?.department?.name ?? null, days: s._count._all,
          present: of('PRESENT', 'LATE', 'EARLY_LEAVE', 'INCOMPLETE'), late: of('LATE'), absent: of('ABSENT'), leave: of('LEAVE', 'SICK_LEAVE'), remote: of('REMOTE_WORK'), mission: of('MISSION'), incomplete: of('INCOMPLETE'),
          ...Object.fromEntries(METRICS.map((m) => [m, (s._sum as any)[m] ?? 0])),
        };
      });
      return { totals, ...this.slice(rows, q, ['name', 'department', 'days', 'present', 'late', 'absent', 'leave', 'remote', 'mission', 'incomplete', ...METRICS], 'workedMinutes') };
    }

    const pg = this.paging(q);
    const sort = ['gregDate', 'status', 'firstCheckIn', 'lastCheckOut', ...METRICS].find((k) => k === q.sort);
    const orderBy: Prisma.AttendanceDayOrderByWithRelationInput[] = q.sort === 'name' ? [{ user: { firstName: pg.dir } }, { user: { lastName: pg.dir } }, { gregDate: 'desc' }]
      : q.sort === 'department' ? [{ user: { department: { name: pg.dir } } }, { gregDate: 'desc' }]
      : sort ? [{ [sort]: pg.dir }, { gregDate: 'desc' }, { id: 'asc' }] : [{ gregDate: 'desc' }, { id: 'asc' }];
    const rows = await this.prisma.attendanceDay.findMany({ where, include: { user: { select: USER } }, orderBy, skip: pg.skip, take: pg.take });
    return {
      totals, total: agg._count._all, page: pg.page, pageSize: pg.pageSize,
      rows: rows.map(({ user, ...r }) => ({ ...r, date: isoDate(r.gregDate), name: nameOf(user), department: user.department?.name ?? null })),
    };
  }

  private userSearch(s: string): Prisma.UserWhereInput {
    const contains = { contains: s, mode: 'insensitive' as const };
    const words = s.split(/\s+/);
    return { OR: [{ AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }] })) }, { attendanceCardNo: contains }] };
  }

  // ── work log ────────────────────────────────────────────────────────────
  // view=days: report state per person-day · view=entries: logged time · view=people: totals.
  async workLog(q: any, viewer: Viewer) {
    const p = await this.range(q);
    const only = await this.analytics.filteredUserIds(q);
    const search = this.text(q).toLowerCase();
    const admin = viewer.role === 'ADMIN';
    if (q.view === 'entries') {
      const start = await this.workLogs.startDate();
      const pg = this.paging(q);
      const where: Prisma.WorkTaskEntryWhereInput = {
        gregDate: { gte: start && start > p.start ? start : p.start, lt: p.endExcl },
        ...(only ? { userId: { in: [...only] } } : {}),
        ...(q.categoryId ? { task: { categoryId: String(q.categoryId) } } : {}),
        ...(q.late === '1' ? { isLate: true } : q.late === '0' ? { isLate: false } : {}),
        ...(q.byAdmin === '1' ? { enteredById: { not: null } } : {}),
        ...(search ? { AND: [{ OR: [{ task: { title: { contains: search, mode: 'insensitive' } } }, { note: { contains: search, mode: 'insensitive' } }, { user: this.userSearch(search) }] }] } : {}),
      };
      const orderBy: Prisma.WorkTaskEntryOrderByWithRelationInput[] = q.sort === 'name' ? [{ user: { firstName: pg.dir } }, { gregDate: 'desc' }]
        : q.sort === 'task' ? [{ task: { title: pg.dir } }, { gregDate: 'desc' }]
        : q.sort === 'minutes' || q.sort === 'lateDays' ? [{ [q.sort]: pg.dir }, { gregDate: 'desc' }, { id: 'asc' }]
        : [{ gregDate: pg.dir }, { id: 'asc' }];
      const [agg, rows] = await Promise.all([
        this.prisma.workTaskEntry.aggregate({ where, _sum: { minutes: true }, _count: { _all: true } }),
        this.prisma.workTaskEntry.findMany({ where, orderBy, skip: pg.skip, take: pg.take, include: { user: { select: USER }, task: { select: { title: true, category: { select: { name: true, color: true } } } } } }),
      ]);
      return {
        totals: { records: agg._count._all, loggedMinutes: agg._sum.minutes ?? 0 }, total: agg._count._all, page: pg.page, pageSize: pg.pageSize,
        rows: rows.map((r) => ({ id: r.id, userId: r.userId, name: nameOf(r.user), department: r.user.department?.name ?? null, date: isoDate(r.gregDate), task: r.task.title, category: r.task.category?.name ?? null, color: r.task.category?.color ?? null, minutes: r.minutes, note: r.note, isLate: r.isLate, lateDays: r.lateDays, byAdmin: !!r.enteredById })),
      };
    }

    const all = (await this.workLogs.adminDays({ role: 'ADMIN' }, { from: isoDate(p.start), to: isoDate(p.last), ...(q.userId ? { userId: String(q.userId) } : {}) }, MAX_REPORT_DAYS)).rows as any[];
    const states = String(q.state || '').split(',').filter(Boolean);
    const att = csv(q.attStatus, AttendanceStatus);
    const below = q.below ? Math.min(100, Math.max(1, +q.below || 0)) : 0;
    const rows = all.filter((r) => (!only || only.has(r.userId))
      && (!states.length || states.includes(r.state)) && (!att.length || att.includes(r.attendance?.status))
      && (!below || ((r.attendance?.workedMinutes ?? 0) > 0 && r.loggedMinutes < (r.attendance.workedMinutes * below) / 100))
      && (!search || `${r.user.firstName} ${r.user.lastName}`.toLowerCase().includes(search)))
      .map((r) => ({
        id: r.id, userId: r.userId, name: nameOf(r.user), department: r.user.department?.name ?? null, date: r.date, status: r.attendance?.status ?? null,
        workedMinutes: r.attendance?.workedMinutes ?? 0, loggedMinutes: r.loggedMinutes, coverage: r.attendance?.workedMinutes ? Math.round((r.loggedMinutes / r.attendance.workedMinutes) * 100) : null,
        taskCount: r.taskCount, required: r.required, state: r.state, lateDays: r.report?.lateDays ?? 0, submittedAt: r.report?.submittedAt ?? null, lateWaived: r.lateWaived, length: r.report?.length ?? 0,
        preview: admin ? r.report?.preview ?? null : null,
      }));
    const count = (s: string) => rows.filter((r) => r.state === s).length;
    const totals = { records: rows.length, required: rows.filter((r) => r.required).length, submitted: count('SUBMITTED'), late: count('LATE'), missing: count('MISSING'), loggedMinutes: rows.reduce((s, r) => s + r.loggedMinutes, 0), workedMinutes: rows.reduce((s, r) => s + r.workedMinutes, 0) };
    if (q.view === 'people') {
      const by = new Map<string, any>();
      for (const r of rows) {
        const x = by.get(r.userId) ?? { userId: r.userId, name: r.name, department: r.department, required: 0, submitted: 0, late: 0, missing: 0, loggedMinutes: 0, workedMinutes: 0 };
        if (r.required) x.required++;
        if (r.state === 'SUBMITTED') x.submitted++; else if (r.state === 'LATE') x.late++; else if (r.state === 'MISSING') x.missing++;
        x.loggedMinutes += r.loggedMinutes; x.workedMinutes += r.workedMinutes;
        by.set(r.userId, x);
      }
      const people = [...by.values()].map((x) => ({ ...x, rate: x.required ? Math.round(((x.submitted + x.late) / x.required) * 100) : null, coverage: x.workedMinutes ? Math.round((x.loggedMinutes / x.workedMinutes) * 100) : null }));
      return { totals, ...this.slice(people, q, ['name', 'department', 'required', 'submitted', 'late', 'missing', 'rate', 'loggedMinutes', 'workedMinutes', 'coverage'], 'loggedMinutes') };
    }
    return { totals, ...this.slice(rows, q, ['date', 'name', 'department', 'status', 'workedMinutes', 'loggedMinutes', 'coverage', 'taskCount', 'state', 'lateDays', 'submittedAt', 'length'], 'date') };
  }

  // ── tickets ─────────────────────────────────────────────────────────────
  async tickets(q: any) {
    const p = await this.range(q);
    const pg = this.paging(q);
    const search = this.text(q);
    const n = parseInt(search.replace(/\D/g, ''), 10);
    const status = csv(q.status, TicketStatus), priority = csv(q.priority, TicketPriority);
    const contains = { contains: search, mode: 'insensitive' as const };
    const field = q.dateField === 'resolved' ? 'resolvedAt' : 'createdAt';
    const and: Prisma.TicketWhereInput[] = [
      // "now": the whole open backlog, whatever its age.
      q.dateField === 'now' ? { status: { in: [...OPEN_TICKET] } } : { [field]: p.instants },
      ...(q.departmentId ? [{ departmentId: String(q.departmentId) }] : []),
      ...(q.assigneeId ? [q.assigneeId === 'none' ? { assigneeId: null } : { assigneeId: String(q.assigneeId) }] : []),
      ...(q.requesterId ? [{ requesterId: String(q.requesterId) }] : []),
      ...(status.length ? [{ status: { in: status } }] : []), ...(priority.length ? [{ priority: { in: priority } }] : []),
      ...(q.overSla === '1' ? [{ isOverSla: true }] : []),
      ...(q.overdue === '1' ? [{ status: { in: [...OPEN_TICKET] }, dueAt: { lt: new Date() } }] : []),
      ...(search ? [{ OR: [{ title: contains }, { category: { name: contains } }, { requester: this.userSearch(search) }, ...(Number.isFinite(n) && n < 2 ** 31 ? [{ number: n }] : [])] }] : []),
    ];
    const where: Prisma.TicketWhereInput = { AND: and };
    const sort = ['number', 'status', 'priority', 'createdAt', 'dueAt', 'resolvedAt', 'updatedAt'].find((k) => k === q.sort) ?? 'createdAt';
    const [total, over, open, rows] = await Promise.all([
      this.prisma.ticket.count({ where }), this.prisma.ticket.count({ where: { AND: [...and, { isOverSla: true }] } }), this.prisma.ticket.count({ where: { AND: [...and, { status: { in: [...OPEN_TICKET] } }] } }),
      this.prisma.ticket.findMany({
        where, orderBy: [{ [sort]: pg.dir }, { id: 'asc' }], skip: pg.skip, take: pg.take,
        select: { id: true, number: true, title: true, status: true, priority: true, createdAt: true, dueAt: true, firstResponseAt: true, resolvedAt: true, isOverSla: true, assigneeId: true, requesterId: true, department: { select: { name: true } }, category: { select: { name: true } }, requester: { select: USER }, assignee: { select: USER }, _count: { select: { comments: true } } },
      }),
    ]);
    return {
      totals: { records: total, open, overSla: over }, total, page: pg.page, pageSize: pg.pageSize,
      rows: rows.map((t) => ({
        id: t.id, number: t.number, title: t.title || t.category.name, category: t.category.name, department: t.department.name, status: t.status, priority: t.priority,
        requesterId: t.requesterId, requester: nameOf(t.requester), assigneeId: t.assigneeId, assignee: nameOf(t.assignee), createdAt: t.createdAt, dueAt: t.dueAt, resolvedAt: t.resolvedAt,
        firstResponseMin: t.firstResponseAt ? Math.round((t.firstResponseAt.getTime() - t.createdAt.getTime()) / 60_000) : null,
        resolveMin: t.resolvedAt ? Math.round((t.resolvedAt.getTime() - t.createdAt.getTime()) / 60_000) : null,
        isOverSla: t.isOverSla, comments: t._count.comments,
      })),
    };
  }

  async ticket(id: string, viewer: Viewer) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        department: { select: { name: true } }, category: { select: { name: true } }, requester: { select: USER }, assignee: { select: USER }, slaMetric: true,
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: USER } } },
      },
    });
    if (!t) throw new NotFoundException('تیکت یافت نشد');
    return {
      id: t.id, number: t.number, title: t.title || t.category.name, category: t.category.name, department: t.department.name, status: t.status, priority: t.priority,
      requester: nameOf(t.requester), requesterId: t.requesterId, assignee: nameOf(t.assignee), assigneeId: t.assigneeId,
      createdAt: t.createdAt, dueAt: t.dueAt, firstResponseAt: t.firstResponseAt, resolvedAt: t.resolvedAt, closedAt: t.closedAt, isOverSla: t.isOverSla,
      sla: t.slaMetric && { firstResponseBreached: t.slaMetric.firstResponseBreached, resolutionBreached: t.slaMetric.resolutionBreached, waitingUserMinutes: t.slaMetric.waitingUserMinutes, waitingDeptMinutes: t.slaMetric.waitingDeptMinutes },
      description: viewer.role === 'ADMIN' ? t.description : null,
      events: t.events.filter((e) => viewer.role === 'ADMIN' || e.type !== 'INTERNAL_NOTE').map((e) => ({ id: e.id, type: e.type, actor: nameOf(e.actor), createdAt: e.createdAt, from: (e.meta as any)?.from ?? (e.meta as any)?.oldStatus ?? null, to: (e.meta as any)?.to ?? (e.meta as any)?.newStatus ?? (e.meta as any)?.status ?? null })),
    };
  }

  // ── assets ──────────────────────────────────────────────────────────────
  async assets(q: any) {
    const pg = this.paging(q);
    const search = this.text(q);
    const contains = { contains: search, mode: 'insensitive' as const };
    const availability = csv(q.availability, AssetAvailability), condition = csv(q.condition, AssetCondition);
    const current: Prisma.AssetAssignmentWhereInput = { returnedAt: null, ...(q.departmentId ? { departmentId: String(q.departmentId) } : {}), ...(q.userId ? { userId: String(q.userId) } : {}) };
    const where: Prisma.AssetWhereInput = {
      ...(q.from || q.to ? { createdAt: (await this.range(q)).instants } : {}),
      ...(q.typeId ? { typeId: String(q.typeId) } : {}), ...(q.categoryId ? { categoryId: String(q.categoryId) } : {}), ...(q.ownerId ? { ownerId: String(q.ownerId) } : {}),
      ...(availability.length ? { availability: { in: availability } } : {}), ...(condition.length ? { condition: { in: condition } } : {}),
      ...(q.departmentId || q.userId || q.assigned === '1' ? { assignments: { some: current } } : q.assigned === '0' ? { assignments: { none: { returnedAt: null } } } : {}),
      ...(search ? { OR: [{ name: contains }, { barcode: contains }, { oldBarcode: contains }, { serialNumber: contains }] } : {}),
    };
    const sort = ['name', 'barcode', 'availability', 'condition', 'cost', 'purchaseDate', 'createdAt', 'updatedAt'].find((k) => k === q.sort) ?? 'createdAt';
    const [agg, rows] = await Promise.all([
      this.prisma.asset.aggregate({ where, _sum: { cost: true }, _count: { _all: true } }),
      this.prisma.asset.findMany({
        where, orderBy: [{ [sort]: pg.dir }, { id: 'asc' }], skip: pg.skip, take: pg.take,
        include: { type: { select: { name: true } }, category: { select: { name: true } }, owner: { select: { name: true } }, assignments: { where: { returnedAt: null }, take: 1, orderBy: { assignedAt: 'desc' }, include: { user: { select: USER }, department: { select: { name: true } } } }, _count: { select: { assignments: true, maintenances: true } } },
      }),
    ]);
    return {
      totals: { records: agg._count._all, cost: agg._sum.cost ?? 0 }, total: agg._count._all, page: pg.page, pageSize: pg.pageSize,
      rows: rows.map((a) => ({
        id: a.id, name: a.name, barcode: a.barcode, serialNumber: a.serialNumber, type: a.type.name, category: a.category.name, owner: a.owner?.name ?? null, availability: a.availability, condition: a.condition, cost: a.cost, purchaseDate: a.purchaseDate, createdAt: a.createdAt, updatedAt: a.updatedAt,
        holderId: a.assignments[0]?.userId ?? null, holder: nameOf(a.assignments[0]?.user), department: a.assignments[0]?.department?.name ?? null, assignedAt: a.assignments[0]?.assignedAt ?? null, assignmentCount: a._count.assignments, maintenanceCount: a._count.maintenances,
      })),
    };
  }

  async asset(id: string) {
    const a = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        type: { select: { name: true } }, category: { select: { name: true } }, owner: { select: { name: true } },
        assignments: { orderBy: { assignedAt: 'desc' }, include: { user: { select: USER }, department: { select: { name: true } }, building: { select: { name: true } }, floor: { select: { name: true } }, room: { select: { name: true } }, assignedBy: { select: USER } } },
        maintenances: { orderBy: { startDate: 'desc' } },
      },
    });
    if (!a) throw new NotFoundException('دارایی یافت نشد');
    return {
      id: a.id, name: a.name, barcode: a.barcode, serialNumber: a.serialNumber, description: a.description, type: a.type.name, category: a.category.name, owner: a.owner?.name ?? null, availability: a.availability, condition: a.condition, cost: a.cost, purchaseDate: a.purchaseDate, createdAt: a.createdAt, updatedAt: a.updatedAt,
      assignments: a.assignments.map((x) => ({ id: x.id, userId: x.userId, user: nameOf(x.user), department: x.department?.name ?? null, place: [x.building?.name, x.floor?.name, x.room?.name].filter(Boolean).join(' / ') || null, assignedAt: x.assignedAt, returnedAt: x.returnedAt, by: nameOf(x.assignedBy), note: x.note })),
      maintenances: a.maintenances.map((m) => ({ id: m.id, startDate: m.startDate, endDate: m.endDate, cost: m.cost, description: m.description })),
    };
  }

  // ── users ───────────────────────────────────────────────────────────────
  async users(q: any) {
    const search = this.text(q);
    const roles = csv(q.role, Role);
    const online = new Date(Date.now() - 15 * 60_000);
    const only = await this.analytics.filteredUserIds(q);
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          ...(only ? [{ id: { in: [...only] } }] : []), ...(roles.length ? [{ role: { in: roles } }] : []),
          ...(q.disabled === '1' ? [{ disabled: true }] : q.disabled === 'all' ? [] : [{ disabled: false }]),
          ...(q.card === '1' ? [{ attendanceCardNo: { not: null } }] : q.card === '0' ? [{ attendanceCardNo: null }] : []),
          ...(search ? [this.userSearch(search)] : []),
        ],
      },
      select: { ...USER, role: true, disabled: true, attendanceCardNo: true, createdAt: true, attendanceRule: { select: { employeeType: true, schedule: { select: { name: true, isDefault: true } } } } },
    });
    const ids = users.map((u) => u.id);
    const [seen, live, assets, tickets] = await Promise.all([
      this.prisma.session.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _max: { lastSeenAt: true } }),
      this.prisma.session.groupBy({ by: ['userId'], where: { userId: { in: ids }, isRevoked: false, lastSeenAt: { gte: online } }, _count: { _all: true } }),
      this.prisma.assetAssignment.groupBy({ by: ['userId'], where: { userId: { in: ids }, returnedAt: null }, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['assigneeId'], where: { assigneeId: { in: ids }, status: { in: [...OPEN_TICKET] } }, _count: { _all: true } }),
    ]);
    const seenOf = new Map(seen.map((s) => [s.userId, s._max.lastSeenAt])), liveOf = new Set(live.map((l) => l.userId));
    const assetOf = new Map(assets.map((a) => [a.userId, a._count._all])), ticketOf = new Map(tickets.map((t) => [t.assigneeId, t._count._all]));
    const rows = users.map((u) => ({
      userId: u.id, name: nameOf(u), department: u.department?.name ?? null, role: u.role, disabled: u.disabled, cardNo: u.attendanceCardNo, employeeType: u.attendanceRule?.employeeType ?? null,
      schedule: u.attendanceRule?.schedule ? (u.attendanceRule.schedule.isDefault ? 'پیش‌فرض سازمان' : u.attendanceRule.schedule.name) : 'پیش‌فرض سازمان',
      lastSeenAt: seenOf.get(u.id)?.toISOString() ?? null, online: liveOf.has(u.id), assets: assetOf.get(u.id) ?? 0, openTickets: ticketOf.get(u.id) ?? 0, createdAt: u.createdAt.toISOString(),
    })).filter((r) => q.online !== '1' || r.online);
    return { totals: { records: rows.length, online: rows.filter((r) => r.online).length, withoutCard: rows.filter((r) => !r.cardNo).length }, ...this.slice(rows, q, ['name', 'department', 'role', 'schedule', 'lastSeenAt', 'assets', 'openTickets', 'createdAt'], 'lastSeenAt') };
  }

  // ── one person / one day ────────────────────────────────────────────────
  async person(q: any, viewer: Viewer) {
    if (!q.userId) throw new BadRequestException('کاربر را انتخاب کنید');
    const userId = String(q.userId);
    const p = await this.range(q);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { ...USER, role: true, attendanceCardNo: true, disabled: true, attendanceRule: { select: { employeeType: true, schedule: { select: { name: true } } } } } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    const open = { in: [...OPEN_TICKET] };
    const days = { userId, gregDate: { gte: p.start, lt: p.endExcl } };
    const [sums, byStatus, wl, created, assigned, assignedOpen, resolved, overdue, assets, seen, requests] = await Promise.all([
      this.prisma.attendanceDay.aggregate({ where: days, _sum: Object.fromEntries(METRICS.map((m) => [m, true])) as Record<Metric, true> }),
      this.prisma.attendanceDay.groupBy({ by: ['status'], where: days, _count: { _all: true } }),
      this.workLog({ ...q, userId, view: 'days', state: '', attStatus: '', below: '', search: '', departmentId: '', scheduleIds: '', page: 1, pageSize: 10 }, viewer),
      this.prisma.ticket.count({ where: { requesterId: userId, createdAt: p.instants } }),
      this.prisma.ticket.count({ where: { assigneeId: userId, createdAt: p.instants } }),
      this.prisma.ticket.count({ where: { assigneeId: userId, status: open } }),
      this.prisma.ticket.count({ where: { assigneeId: userId, resolvedAt: p.instants } }),
      this.prisma.ticket.count({ where: { assigneeId: userId, status: open, dueAt: { lt: new Date() } } }),
      this.prisma.assetAssignment.findMany({ where: { userId, returnedAt: null }, orderBy: { assignedAt: 'desc' }, take: 50, include: { asset: { select: { id: true, name: true, barcode: true } } } }),
      this.prisma.session.aggregate({ where: { userId }, _max: { lastSeenAt: true } }),
      this.prisma.attendanceRequest.groupBy({ by: ['status'], where: { userId, gregDate: { gte: p.start, lt: p.endExcl } }, _count: { _all: true } }),
    ]);
    return {
      from: isoDate(p.start), to: isoDate(p.last),
      user: { id: user.id, name: nameOf(user), department: user.department?.name ?? null, role: user.role, cardNo: user.attendanceCardNo, disabled: user.disabled, employeeType: user.attendanceRule?.employeeType ?? null, schedule: user.attendanceRule?.schedule?.name ?? null, lastSeenAt: seen._max.lastSeenAt },
      attendance: { ...Object.fromEntries(METRICS.map((m) => [m, (sums._sum as any)?.[m] ?? 0])), statuses: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) },
      workLog: wl.totals,
      tickets: { created, assigned, assignedOpen, resolved, overdue },
      requests: Object.fromEntries(requests.map((r) => [r.status, r._count._all])),
      assets: assets.map((a) => ({ id: a.asset.id, name: a.asset.name, barcode: a.asset.barcode, assignedAt: a.assignedAt })),
    };
  }

  async day(q: any, viewer: Viewer) {
    const date = parseWorkDate(String(q.date || ''));
    if (!q.userId || isNaN(date.getTime())) throw new BadRequestException('کاربر و تاریخ را مشخص کنید');
    const userId = String(q.userId);
    const start = tehranMidnightInstant(date);
    const [wl, overrides, requests] = await Promise.all([
      this.workLogs.adminDay({ role: 'ADMIN' }, userId, isoDate(date)),
      this.prisma.attendanceOverride.findMany({ where: { userId, gregDate: date }, orderBy: { createdAt: 'desc' }, include: { createdBy: { select: USER } } }),
      this.prisma.attendanceRequest.findMany({ where: { userId, gregDate: date }, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, status: true, targetStatus: true, leaveMinutes: true, createdAt: true, decidedAt: true } }),
    ]);
    const tickets = await this.prisma.ticketEvent.findMany({
      where: { actorId: userId, createdAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) }, ...(viewer.role === 'ADMIN' ? {} : { type: { not: 'INTERNAL_NOTE' } }) },
      orderBy: { createdAt: 'asc' }, select: { id: true, type: true, createdAt: true, ticket: { select: { id: true, number: true } } },
    });
    const a = wl.attendance;
    return {
      userId, name: nameOf(wl.user), department: wl.user?.department?.name ?? null, date: wl.date, today: isoDate(workDateOf(new Date())), attendance: a, punches: wl.punches, loggedMinutes: wl.loggedMinutes, state: wl.state, required: wl.required, lateWaived: wl.lateWaived, beforeStart: wl.beforeStart,
      entries: wl.entries.map((e) => ({ id: e.id, task: e.task.title, category: e.task.category?.name ?? null, color: e.task.category?.color ?? null, minutes: e.minutes, note: e.note, isLate: e.isLate, lateDays: e.lateDays })),
      report: wl.report && { submittedAt: wl.report.submittedAt, editedAt: wl.report.editedAt, isLate: wl.report.isLate, lateDays: wl.report.lateDays, content: viewer.role === 'ADMIN' ? wl.report.content : null },
      overrides: overrides.map((o) => ({ id: o.id, newCheckIn: o.newCheckIn, newCheckOut: o.newCheckOut, clearCheckIn: o.clearCheckIn, clearCheckOut: o.clearCheckOut, forceStatus: o.forceStatus, leaveMinutes: o.leaveMinutes, reason: o.reason, by: nameOf(o.createdBy), createdAt: o.createdAt })),
      requests, ticketEvents: tickets,
    };
  }
}
