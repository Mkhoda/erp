import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLogService } from '../work-log/work-log.service';
import { jalaliMonthRange, toJalaliParts, workDateOf } from '../attendance/engine/jalali.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const NON_WORKING = new Set(['WEEKEND', 'HOLIDAY', 'COMPANY_HOLIDAY', 'OFF_DUTY']);
const PRESENT = new Set(['PRESENT', 'LATE', 'EARLY_LEAVE', 'INCOMPLETE']);
const OPEN_TICKET = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_USER', 'USER_REPLIED']);

export const COMPONENTS = ['report', 'punctuality', 'attendance', 'tickets', 'coverage'] as const;
export type ComponentKey = (typeof COMPONENTS)[number];
const DEFAULT_WEIGHTS: Record<ComponentKey, number> = { report: 25, punctuality: 25, attendance: 20, tickets: 20, coverage: 10 };

type Actor = { userId?: string; id?: string; role?: string };

/**
 * Performance score (امتیاز عملکرد) per person for one Jalali month. Each component is 0..100,
 * or null when the person has no data for it (skipped; the other weights are rescaled):
 *   report      — daily work report: (on time + ½ late) / days a report was required
 *   punctuality — present days without lateness or early leave / present days (not for HOURLY staff)
 *   attendance  — working days not absent / working days
 *   tickets     — tickets of the person's departments handled within SLA. A late first response or
 *                 an SLA breach counts against EVERYONE with access to that department's queue
 *                 (members, queue managers, default assignees), not just the assignee.
 *   coverage    — logged work time / attendance worked time (capped at 100)
 */
@Injectable()
export class PerformanceService {
  constructor(private prisma: PrismaService, private workLog: WorkLogService) {}

  async getSettings() {
    const row = await this.prisma.performanceSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
    return { weights: this.weights(row.weights) };
  }

  async updateSettings(dto: any) {
    const w = dto?.weights ?? {};
    const weights: Record<string, number> = {};
    for (const k of COMPONENTS) weights[k] = Math.min(100, Math.max(0, Math.round(+w[k] || 0)));
    if (!Object.values(weights).some((v) => v > 0)) throw new BadRequestException('حداقل یک شاخص باید وزن داشته باشد');
    await this.prisma.performanceSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', weights }, update: { weights } });
    return this.getSettings();
  }

  private weights(raw: any): Record<ComponentKey, number> {
    const out = { ...DEFAULT_WEIGHTS };
    if (raw && typeof raw === 'object') for (const k of COMPONENTS) if (raw[k] != null) out[k] = Math.max(0, +raw[k] || 0);
    return out;
  }

  private async scopeOf(actor: Actor): Promise<string[] | undefined> {
    if (actor.role === 'ADMIN') return undefined;
    const uid = actor.userId ?? actor.id;
    const [u, m] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
      this.prisma.userDepartment.findMany({ where: { userId: uid }, select: { departmentId: true } }),
    ]);
    const ids = new Set(m.map((x) => x.departmentId));
    if (u?.departmentId) ids.add(u.departmentId);
    return [...ids];
  }

  async scores(actor: Actor, q: any) {
    const t = toJalaliParts(workDateOf(new Date()));
    const jYear = +q.jYear || t.jYear;
    const jMonth = +q.jMonth || t.jMonth;
    const { start, endExcl } = jalaliMonthRange(jYear, jMonth);
    const today = workDateOf(new Date());
    const to = new Date(Math.min(endExcl.getTime() - DAY_MS, today.getTime()));
    const { weights } = await this.getSettings();
    if (to < start) return { jYear, jMonth, weights, rows: [] };

    // ── who ──
    const scope = await this.scopeOf(actor);
    const deptWhere = (ids: string[]) => ({ OR: [{ departmentId: { in: ids } }, { userDepartments: { some: { departmentId: { in: ids } } } }] });
    const and: any[] = [{ disabled: false }];
    if (scope) and.push(deptWhere(scope));
    if (q.departmentId) and.push(deptWhere([q.departmentId]));
    if (q.scheduleId) {
      // Work-rule group: users pinned to it, or (for the default group) users with no group.
      const sched = await this.prisma.workSchedule.findUnique({ where: { id: q.scheduleId }, select: { isDefault: true } });
      and.push(sched?.isDefault
        ? { OR: [{ attendanceRule: null }, { attendanceRule: { scheduleId: null } }, { attendanceRule: { scheduleId: q.scheduleId } }] }
        : { attendanceRule: { scheduleId: q.scheduleId } });
    }
    const users = await this.prisma.user.findMany({
      where: { AND: and },
      select: {
        id: true, firstName: true, lastName: true, departmentId: true, attendanceCardNo: true,
        department: { select: { name: true } }, attendanceRule: { select: { employeeType: true } },
        userDepartments: { select: { departmentId: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    if (!users.length) return { jYear, jMonth, weights, rows: [] };
    const ids = users.map((u) => u.id);
    const range = { gte: start, lte: to };

    // ── data ──
    const [wl, days, logged, tickets, managers, assignees] = await Promise.all([
      this.workLog.adminDays({ role: 'ADMIN' }, { from: isoDate(start), to: isoDate(to) }),
      this.prisma.attendanceDay.findMany({ where: { userId: { in: ids }, gregDate: range }, select: { userId: true, status: true, delayMinutes: true, earlyLeaveMinutes: true, workedMinutes: true } }),
      this.prisma.workTaskEntry.groupBy({ by: ['userId'], where: { userId: { in: ids }, gregDate: range }, _sum: { minutes: true } }),
      this.prisma.ticket.findMany({
        where: { createdAt: { gte: new Date(start.getTime() - 210 * 60000), lt: new Date(to.getTime() + DAY_MS - 210 * 60000) } },
        select: { id: true, departmentId: true, status: true, createdAt: true, firstResponseAt: true, isOverSla: true, dueAt: true, resolvedAt: true, department: { select: { ticketConfig: { select: { slaFirstResponseHours: true } } } } },
      }),
      this.prisma.ticketDeptManager.findMany({ select: { userId: true, config: { select: { departmentId: true } } } }),
      this.prisma.ticketDeptAssignee.findMany({ select: { userId: true, config: { select: { departmentId: true } } } }),
    ]);

    const report = new Map<string, { required: number; submitted: number; late: number }>();
    for (const r of wl.rows) {
      if (!r.required) continue;
      const x = report.get(r.userId) ?? { required: 0, submitted: 0, late: 0 };
      x.required++;
      if (r.state === 'SUBMITTED') x.submitted++;
      else if (r.state === 'LATE') x.late++;
      report.set(r.userId, x);
    }

    const att = new Map<string, { workingDays: number; absent: number; present: number; punctual: number; worked: number }>();
    for (const d of days) {
      const x = att.get(d.userId) ?? { workingDays: 0, absent: 0, present: 0, punctual: 0, worked: 0 };
      x.worked += d.workedMinutes;
      if (!NON_WORKING.has(d.status)) x.workingDays++;
      if (d.status === 'ABSENT') x.absent++;
      if (PRESENT.has(d.status)) {
        x.present++;
        if (!(d.delayMinutes > 0) && !(d.earlyLeaveMinutes > 0)) x.punctual++;
      }
      att.set(d.userId, x);
    }
    const loggedMap = new Map(logged.map((l) => [l.userId, l._sum.minutes ?? 0]));

    // Tickets per department: total and those handled late.
    const now = Date.now();
    const deptTickets = new Map<string, { total: number; late: number }>();
    for (const tk of tickets) {
      const sla = (tk.department?.ticketConfig?.slaFirstResponseHours ?? 4) * 3_600_000;
      const firstBy = tk.createdAt.getTime() + sla;
      const frLate = tk.firstResponseAt ? tk.firstResponseAt.getTime() > firstBy : now > firstBy;
      const overdue = !!tk.dueAt && OPEN_TICKET.has(tk.status) && tk.dueAt.getTime() < now;
      const x = deptTickets.get(tk.departmentId) ?? { total: 0, late: 0 };
      x.total++;
      if (tk.isOverSla || frLate || overdue) x.late++;
      deptTickets.set(tk.departmentId, x);
    }
    // Queue access beyond membership: department queue managers and default assignees.
    const extraQueues = new Map<string, Set<string>>();
    for (const r of [...managers, ...assignees]) {
      const s = extraQueues.get(r.userId) ?? new Set<string>();
      s.add(r.config.departmentId);
      extraQueues.set(r.userId, s);
    }

    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
    const rows = users.map((u) => {
      const rep = report.get(u.id);
      const a = att.get(u.id);
      const hourly = u.attendanceRule?.employeeType === 'HOURLY';
      const queues = new Set<string>([...u.userDepartments.map((m) => m.departmentId), ...(u.departmentId ? [u.departmentId] : []), ...(extraQueues.get(u.id) ?? [])]);
      let tTotal = 0, tLate = 0;
      for (const d of queues) { const x = deptTickets.get(d); if (x) { tTotal += x.total; tLate += x.late; } }
      const loggedMin = loggedMap.get(u.id) ?? 0;

      const components: Record<ComponentKey, number | null> = {
        report: rep ? pct(rep.submitted + rep.late * 0.5, rep.required) : null,
        punctuality: !hourly && a && a.present ? pct(a.punctual, a.present) : null,
        attendance: u.attendanceCardNo && a && a.workingDays ? pct(a.workingDays - a.absent, a.workingDays) : null,
        tickets: tTotal ? pct(tTotal - tLate, tTotal) : null,
        coverage: a && a.worked > 0 ? Math.min(100, pct(loggedMin, a.worked) ?? 0) : null,
      };
      let wSum = 0, sum = 0;
      for (const k of COMPONENTS) {
        const v = components[k];
        if (v == null || !weights[k]) continue;
        wSum += weights[k]; sum += v * weights[k];
      }
      const score = wSum ? Math.round((sum / wSum) * 10) / 10 : null;
      return {
        userId: u.id, name: `${u.firstName} ${u.lastName}`, department: u.department?.name ?? null, employeeType: hourly ? 'HOURLY' : 'FULL_TIME',
        score, grade: score == null ? null : score >= 90 ? 'EXCELLENT' : score >= 75 ? 'GOOD' : score >= 60 ? 'FAIR' : 'POOR',
        components,
        details: {
          report: rep ?? { required: 0, submitted: 0, late: 0 },
          attendance: a ? { workingDays: a.workingDays, absent: a.absent, present: a.present, punctual: a.punctual } : null,
          tickets: { total: tTotal, late: tLate, departments: queues.size },
          coverage: { loggedMinutes: loggedMin, workedMinutes: a?.worked ?? 0 },
        },
      };
    });
    // Rank by score (people without any score at the end).
    rows.sort((x, y) => (y.score ?? -1) - (x.score ?? -1) || x.name.localeCompare(y.name, 'fa'));
    let rank = 0;
    return { jYear, jMonth, weights, rows: rows.map((r) => ({ ...r, rank: r.score == null ? null : ++rank })) };
  }
}
