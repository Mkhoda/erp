import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLogService } from '../work-log/work-log.service';
import { tehranMidnightInstant, workDateOf } from '../attendance/engine/jalali.util';
import { MAX_REPORT_DAYS, resolveReportRange } from '../attendance/engine/range.util';
import { INDICATORS, normalizeConfig, ScoreConfig } from './indicators';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const NON_WORKING = new Set(['WEEKEND', 'HOLIDAY', 'COMPANY_HOLIDAY', 'OFF_DUTY']);
const PRESENT = new Set(['PRESENT', 'LATE', 'EARLY_LEAVE', 'INCOMPLETE']);
const OPEN_TICKET = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_USER', 'USER_REPLIED', 'REOPENED']);
const RESOLVED = new Set(['RESOLVED', 'CLOSED']);

type Actor = { userId?: string; id?: string; role?: string };
type Item = { value: number | null; points: number; text: string };

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const r1 = (n: number) => Math.round(n * 10) / 10;
const fa = (n: number) => n.toLocaleString('fa-IR', { maximumFractionDigits: 1 });
const hm = (min: number) => `${fa(Math.round(min / 6) / 10)} ساعت`;

/**
 * Performance score (امتیاز عملکرد) per person for a period, 0..100:
 *   base (weighted average of the enabled `score` indicators that have data)
 *   + bonuses (capped) − penalties (capped).
 * What exists is in indicators.ts; which are on, their weights, points, caps and thresholds
 * come from PerformanceSettings.config (admin panel).
 */
@Injectable()
export class PerformanceService {
  constructor(private prisma: PrismaService, private workLog: WorkLogService) {}

  async getSettings() {
    const row = await this.prisma.performanceSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
    return { catalog: INDICATORS, config: normalizeConfig(row.config, row.weights), defaults: normalizeConfig(null), updatedAt: row.updatedAt };
  }

  async updateSettings(dto: any) {
    const config = this.checked(dto?.config);
    await this.prisma.performanceSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', config: config as any }, update: { config: config as any } });
    return this.getSettings();
  }

  private checked(raw: any): ScoreConfig {
    if (!raw || typeof raw !== 'object') throw new BadRequestException('تنظیمات نامعتبر است');
    const config = normalizeConfig(raw);
    if (!INDICATORS.some((d) => d.kind === 'score' && config.indicators[d.key].enabled && config.indicators[d.key].weight > 0)) {
      throw new BadRequestException('حداقل یک شاخص اصلی باید روشن باشد و وزن داشته باشد');
    }
    return config;
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
    return this.evaluate(actor, q, (await this.getSettings()).config);
  }

  /** What the scores would be with an unsaved config, next to the current ones. */
  async preview(actor: Actor, dto: any) {
    const next = this.checked(dto?.config);
    const [cur, res] = await Promise.all([this.evaluate(actor, dto, (await this.getSettings()).config), this.evaluate(actor, dto, next)]);
    const now = new Map(cur.rows.map((r) => [r.userId, r]));
    return { from: res.from, to: res.to, rows: res.rows.map((r) => ({ userId: r.userId, name: r.name, department: r.department, score: r.score, grade: r.grade, rank: r.rank, currentScore: now.get(r.userId)?.score ?? null, currentRank: now.get(r.userId)?.rank ?? null })) };
  }

  private async evaluate(actor: Actor, q: any, config: ScoreConfig) {
    const { start, endExcl } = resolveReportRange(q);
    const today = workDateOf(new Date());
    const to = new Date(Math.min(endExcl.getTime() - DAY_MS, today.getTime()));
    const on = INDICATORS.filter((d) => config.indicators[d.key].enabled && (d.kind !== 'score' || config.indicators[d.key].weight > 0));
    const head = {
      from: isoDate(start), to: isoDate(to), general: config.general,
      indicators: on.map((d) => ({ key: d.key, kind: d.kind, group: d.group, label: d.label, description: d.description, unit: d.unit ?? null, weight: config.indicators[d.key].weight, points: config.indicators[d.key].points, cap: config.indicators[d.key].cap })),
    };
    if (to < start) return { ...head, rows: [] };

    // ── who ──
    const scope = await this.scopeOf(actor);
    const deptWhere = (ids: string[]) => ({ OR: [{ departmentId: { in: ids } }, { userDepartments: { some: { departmentId: { in: ids } } } }] });
    const and: any[] = [{ disabled: false }];
    if (scope) and.push(deptWhere(scope));
    if (q.userId) and.push({ id: String(q.userId) });
    if (q.departmentId) and.push(deptWhere([String(q.departmentId)]));
    if (q.scheduleId) {
      // Work-rule group: users pinned to it, or (for the default group) users with no group.
      const sched = await this.prisma.workSchedule.findUnique({ where: { id: String(q.scheduleId) }, select: { isDefault: true } });
      and.push(sched?.isDefault
        ? { OR: [{ attendanceRule: null }, { attendanceRule: { scheduleId: null } }, { attendanceRule: { scheduleId: String(q.scheduleId) } }] }
        : { attendanceRule: { scheduleId: String(q.scheduleId) } });
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
    if (!users.length) return { ...head, rows: [] };
    const ids = users.map((u) => u.id);
    const range = { gte: start, lte: to };
    const instants = { gte: tehranMidnightInstant(start), lt: tehranMidnightInstant(new Date(to.getTime() + DAY_MS)) };
    // Work-log figures only count from the day the work log started.
    const wlStart = await this.workLog.startDate();
    const wlFrom = wlStart && wlStart > start ? wlStart : start;

    // ── data ──
    const [wl, days, logged, tickets, managers, assignees, tasks, requests, reopened] = await Promise.all([
      this.workLog.adminDays({ role: 'ADMIN' }, { from: isoDate(start), to: isoDate(to) }, MAX_REPORT_DAYS),
      this.prisma.attendanceDay.findMany({
        where: { userId: { in: ids }, gregDate: range },
        select: { userId: true, gregDate: true, status: true, delayMinutes: true, earlyLeaveMinutes: true, workedMinutes: true, overtimeMinutes: true, holidayOvertimeMinutes: true, deficitMinutes: true },
      }),
      this.prisma.workTaskEntry.groupBy({ by: ['userId'], where: { userId: { in: ids }, gregDate: { gte: wlFrom, lte: to } }, _sum: { minutes: true } }),
      this.prisma.ticket.findMany({
        where: { OR: [{ createdAt: instants }, { resolvedAt: instants }, { assigneeId: { in: ids }, dueAt: { lt: new Date() }, status: { in: [...OPEN_TICKET] as any } }] },
        select: { id: true, departmentId: true, assigneeId: true, status: true, createdAt: true, firstResponseAt: true, isOverSla: true, dueAt: true, resolvedAt: true, department: { select: { ticketConfig: { select: { slaFirstResponseHours: true } } } } },
      }),
      this.prisma.ticketDeptManager.findMany({ select: { userId: true, config: { select: { departmentId: true } } } }),
      this.prisma.ticketDeptAssignee.findMany({ select: { userId: true, config: { select: { departmentId: true } } } }),
      // Deadline tasks of these people; a global one (userId null) is due for everyone.
      this.prisma.workTask.findMany({
        where: { archived: false, recurring: false, deadline: { gte: wlFrom, lte: to }, OR: [{ userId: null }, { userId: { in: ids } }] },
        select: { userId: true, deadline: true, createdAt: true, completions: { where: { userId: { in: ids } }, select: { userId: true, doneAt: true } } },
      }),
      this.prisma.attendanceRequest.groupBy({ by: ['userId'], where: { userId: { in: ids }, gregDate: range, targetStatus: null, leaveMinutes: null }, _count: true }),
      this.prisma.ticketEvent.findMany({ where: { type: 'REOPENED', createdAt: instants, ticket: { assigneeId: { in: ids } } }, select: { ticket: { select: { assigneeId: true } } } }),
    ]);

    const group = <T>(rows: T[], key: (r: T) => string | null) => {
      const m = new Map<string, T[]>();
      for (const r of rows) { const k = key(r); if (!k) continue; const a = m.get(k); if (a) a.push(r); else m.set(k, [r]); }
      return m;
    };
    const wlOf = group(wl.rows as any[], (r) => r.userId);
    const daysOf = group(days, (d) => d.userId);
    const loggedOf = new Map(logged.map((l) => [l.userId, l._sum.minutes ?? 0]));
    const reqOf = new Map(requests.map((r) => [r.userId, r._count]));
    const reopenOf = group(reopened, (r) => r.ticket.assigneeId);
    const myTickets = group(tickets, (t) => t.assigneeId);

    const now = Date.now();
    const inRange = (d: Date | null) => !!d && d >= instants.gte && d < instants.lt;
    const firstBy = (t: (typeof tickets)[number]) => t.createdAt.getTime() + (t.department?.ticketConfig?.slaFirstResponseHours ?? 4) * 3_600_000;
    const firstLate = (t: (typeof tickets)[number]) => (t.firstResponseAt ? t.firstResponseAt.getTime() > firstBy(t) : now > firstBy(t));
    const overdue = (t: (typeof tickets)[number]) => !!t.dueAt && OPEN_TICKET.has(t.status) && t.dueAt.getTime() < now;
    // Tickets per department: total and those handled late.
    const deptTickets = new Map<string, { total: number; late: number }>();
    for (const t of tickets) {
      if (!inRange(t.createdAt)) continue;
      const x = deptTickets.get(t.departmentId) ?? { total: 0, late: 0 };
      x.total++;
      if (t.isOverSla || firstLate(t) || overdue(t)) x.late++;
      deptTickets.set(t.departmentId, x);
    }
    // Queue access beyond membership: department queue managers and default assignees.
    const extraQueues = new Map<string, Set<string>>();
    for (const r of [...managers, ...assignees]) {
      const s = extraQueues.get(r.userId) ?? new Set<string>();
      s.add(r.config.departmentId);
      extraQueues.set(r.userId, s);
    }

    const rows = users.map((u) => {
      const hourly = u.attendanceRule?.employeeType === 'HOURLY';
      const P = (k: string) => config.indicators[k].params;
      // ── facts ──
      const ds = daysOf.get(u.id) ?? [];
      const past = ds.filter((d) => d.gregDate < today);
      const present = ds.filter((d) => PRESENT.has(d.status));
      const workingDays = ds.filter((d) => !NON_WORKING.has(d.status)).length;
      const absent = ds.filter((d) => d.status === 'ABSENT').length;
      const sum = (f: (d: (typeof ds)[number]) => number) => ds.reduce((s, d) => s + f(d), 0);
      const delay = sum((d) => d.delayMinutes), early = sum((d) => d.earlyLeaveMinutes), deficit = sum((d) => d.deficitMinutes);
      const overtime = sum((d) => d.overtimeMinutes), holiday = sum((d) => d.holidayOvertimeMinutes);
      const regular = sum((d) => Math.max(0, d.workedMinutes - d.overtimeMinutes - d.holidayOvertimeMinutes));
      const wlWorked = ds.filter((d) => d.gregDate >= wlFrom).reduce((s, d) => s + d.workedMinutes, 0);
      const loggedMin = loggedOf.get(u.id) ?? 0;
      const w = wlOf.get(u.id) ?? [];
      const req = w.filter((r) => r.required);
      const submitted = req.filter((r) => r.state === 'SUBMITTED').length, lateRep = req.filter((r) => r.state === 'LATE').length, missing = req.filter((r) => r.state === 'MISSING').length;

      let due = 0, onTime = 0, lateDone = 0, openTasks = 0, earlyTasks = 0;
      for (const t of tasks) {
        if (t.userId && t.userId !== u.id) continue;
        const doneAt = t.completions.find((c) => c.userId === u.id)?.doneAt ?? null;
        const doneDay = doneAt ? workDateOf(doneAt) : null;
        if (!doneDay && t.deadline! >= today) continue; // not due yet
        due++;
        if (!doneDay) { openTasks++; continue; }
        if (doneDay <= t.deadline!) onTime++; else lateDone++;
        if ((t.deadline!.getTime() - doneDay.getTime()) / DAY_MS >= (P('earlyTask').days ?? 1)) earlyTasks++;
      }

      const queues = new Set<string>([...u.userDepartments.map((m) => m.departmentId), ...(u.departmentId ? [u.departmentId] : []), ...(extraQueues.get(u.id) ?? [])]);
      let tTotal = 0, tLate = 0;
      for (const d of queues) { const x = deptTickets.get(d); if (x) { tTotal += x.total; tLate += x.late; } }
      const mine = myTickets.get(u.id) ?? [];
      const resolvedMine = mine.filter((t) => inRange(t.resolvedAt) && RESOLVED.has(t.status));
      const resolvedOk = resolvedMine.filter((t) => !t.dueAt || t.resolvedAt! <= t.dueAt).length;
      const overdueMine = mine.filter(overdue).length;
      const respondable = mine.filter((t) => inRange(t.createdAt) && (t.firstResponseAt || now > firstBy(t)));

      // ── indicators ──
      const unit = (key: string, n: number, text: string): Item => {
        const c = config.indicators[key];
        return { value: r1(n), points: Math.min(c.cap, Math.round(Math.max(0, n) * c.points * 100) / 100), text };
      };
      const score = (value: number | null, text: string): Item => ({ value: value == null ? null : Math.max(0, Math.min(100, value)), points: 0, text });
      const tol = P('punctuality').tolerance ?? 0;
      const punctual = present.filter((d) => d.delayMinutes <= tol && d.earlyLeaveMinutes <= tol).length;
      const target = P('coverage').target || 100;
      const short = w.filter((r) => r.report && r.report.length < (P('shortReport').minChars ?? 0)).length;
      const lowCov = w.filter((r) => r.date < isoDate(today) && (r.attendance?.workedMinutes ?? 0) > 0 && r.loggedMinutes < (r.attendance.workedMinutes * (P('lowCoverage').threshold ?? 0)) / 100).length;
      const free = (key: string, total: number) => Math.max(0, total - (P(key).free ?? 0));
      const incomplete = past.filter((d) => d.status === 'INCOMPLETE').length;
      const perfectRep = req.length >= (P('perfectReport').minDays ?? 1) && submitted === req.length;
      const perfectPunc = !hourly && present.length >= (P('perfectPunctual').minDays ?? 1) && !delay && !early && !absent;
      const reqCount = reqOf.get(u.id) ?? 0, reopen = reopenOf.get(u.id)?.length ?? 0;

      const calc: Record<string, () => Item> = {
        report: () => score(pct(submitted + (lateRep * (P('report').lateCredit ?? 50)) / 100, req.length), `${fa(submitted)} به‌موقع و ${fa(lateRep)} با تأخیر از ${fa(req.length)} روز الزامی`),
        coverage: () => { const v = pct(loggedMin, wlWorked); return score(v == null ? null : Math.min(100, (v / target) * 100), `${hm(loggedMin)} ثبت‌شده از ${hm(wlWorked)} کارکرد`); },
        taskDeadline: () => score(pct(onTime + (lateDone * (P('taskDeadline').lateCredit ?? 50)) / 100, due), due ? `${fa(onTime)} به‌موقع، ${fa(lateDone)} با تأخیر و ${fa(openTasks)} انجام‌نشده از ${fa(due)} وظیفه` : 'وظیفه‌ی سررسیدشده ندارد'),
        punctuality: () => (hourly ? score(null, 'کارمند ساعتی: محاسبه نمی‌شود') : score(pct(punctual, present.length), `${fa(punctual)} روز وقت‌شناس از ${fa(present.length)} روز حضور`)),
        attendance: () => score(u.attendanceCardNo ? pct(workingDays - absent, workingDays) : null, u.attendanceCardNo ? `${fa(absent)} روز غیبت از ${fa(workingDays)} روز کاری` : 'کارت حضور ندارد'),
        workHours: () => (hourly ? score(null, 'کارمند ساعتی: محاسبه نمی‌شود') : score(pct(regular, regular + deficit), `${hm(deficit)} کسری از ${hm(regular + deficit)} ساعت موظفی`)),
        tickets: () => score(pct(tTotal - tLate, tTotal), tTotal ? `${fa(tLate)} تیکت با تأخیر از ${fa(tTotal)} تیکت در ${fa(queues.size)} کارتابل` : 'تیکتی در کارتابل‌های فرد ثبت نشده'),
        ticketResolve: () => score(pct(resolvedOk, resolvedMine.length + overdueMine), resolvedMine.length + overdueMine ? `${fa(resolvedOk)} حل به‌موقع از ${fa(resolvedMine.length + overdueMine)} تیکت` : 'تیکت شخصی ندارد'),
        ticketFirstResponse: () => { const ok = respondable.filter((t) => !firstLate(t)).length; return score(pct(ok, respondable.length), respondable.length ? `${fa(ok)} پاسخ به‌موقع از ${fa(respondable.length)} تیکت` : 'تیکت شخصی ندارد'); },
        perfectReport: () => unit('perfectReport', perfectRep ? 1 : 0, perfectRep ? 'همه‌ی گزارش‌ها به‌موقع' : 'شرط برقرار نیست'),
        perfectPunctual: () => unit('perfectPunctual', perfectPunc ? 1 : 0, perfectPunc ? 'بدون تاخیر، تعجیل و غیبت' : 'شرط برقرار نیست'),
        earlyTask: () => unit('earlyTask', earlyTasks, `${fa(earlyTasks)} وظیفه زودتر از مهلت`),
        resolvedTicket: () => unit('resolvedTicket', resolvedMine.length, `${fa(resolvedMine.length)} تیکت حل‌شده`),
        overtime: () => unit('overtime', hourly ? 0 : overtime / 60, hm(hourly ? 0 : overtime)),
        holidayWork: () => unit('holidayWork', holiday / 60, hm(holiday)),
        missingReport: () => unit('missingReport', missing, `${fa(missing)} روز`),
        lateReport: () => unit('lateReport', lateRep, `${fa(lateRep)} روز`),
        shortReport: () => unit('shortReport', short, `${fa(short)} گزارش کوتاه`),
        lowCoverage: () => unit('lowCoverage', lowCov, `${fa(lowCov)} روز`),
        overdueTask: () => unit('overdueTask', openTasks, `${fa(openTasks)} وظیفه‌ی معوق`),
        absence: () => unit('absence', absent, `${fa(absent)} روز`),
        delayHours: () => unit('delayHours', hourly ? 0 : free('delayHours', delay) / 60, hourly ? 'کارمند ساعتی: محاسبه نمی‌شود' : `${hm(delay)} تاخیر (سهمیه‌ی مجاز ${fa(P('delayHours').free ?? 0)} دقیقه)`),
        earlyLeaveHours: () => unit('earlyLeaveHours', hourly ? 0 : free('earlyLeaveHours', early) / 60, hourly ? 'کارمند ساعتی: محاسبه نمی‌شود' : `${hm(early)} تعجیل (سهمیه‌ی مجاز ${fa(P('earlyLeaveHours').free ?? 0)} دقیقه)`),
        deficitHours: () => unit('deficitHours', hourly ? 0 : deficit / 60, hm(hourly ? 0 : deficit)),
        incomplete: () => unit('incomplete', incomplete, `${fa(incomplete)} روز`),
        corrections: () => unit('corrections', free('corrections', reqCount), `${fa(reqCount)} درخواست (مجاز ${fa(P('corrections').free ?? 0)})`),
        overdueTicket: () => unit('overdueTicket', overdueMine, `${fa(overdueMine)} تیکت معوق`),
        reopenedTicket: () => unit('reopenedTicket', reopen, `${fa(reopen)} بار بازگشایی`),
      };

      const items: Record<string, Item> = {};
      let wSum = 0, sumW = 0, bonus = 0, penalty = 0;
      for (const d of on) {
        const it = calc[d.key]();
        items[d.key] = it;
        if (d.kind === 'score') { if (it.value != null) { wSum += config.indicators[d.key].weight; sumW += it.value * config.indicators[d.key].weight; } }
        else if (d.kind === 'bonus') bonus += it.points;
        else penalty += it.points;
      }
      const g = config.general;
      bonus = Math.min(g.maxBonus, r1(bonus)); penalty = Math.min(g.maxPenalty, r1(penalty));
      const base = wSum ? r1(sumW / wSum) : null;
      const tooFew = g.minWorkingDays > 0 && workingDays < g.minWorkingDays;
      const total = base == null || tooFew ? null : r1(Math.max(0, Math.min(100, base + bonus - penalty)));
      return {
        userId: u.id, name: `${u.firstName} ${u.lastName}`, department: u.department?.name ?? null, employeeType: hourly ? 'HOURLY' : 'FULL_TIME',
        score: total, base, bonus, penalty,
        note: base == null ? 'داده‌ای برای امتیازدهی ندارد' : tooFew ? `کمتر از ${fa(g.minWorkingDays)} روز کاری` : null,
        grade: total == null ? null : total >= g.excellent ? 'EXCELLENT' : total >= g.good ? 'GOOD' : total >= g.fair ? 'FAIR' : 'POOR',
        items,
      };
    });
    // Rank by score (people without any score at the end).
    rows.sort((x, y) => (y.score ?? -1) - (x.score ?? -1) || x.name.localeCompare(y.name, 'fa'));
    let rank = 0;
    return { ...head, rows: rows.map((r) => ({ ...r, rank: r.score == null ? null : ++rank })) };
  }
}
