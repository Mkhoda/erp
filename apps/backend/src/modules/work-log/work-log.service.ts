import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalcService } from '../attendance/engine/calc.service';
import { NotificationsService } from '../notifications/notifications.service';
import { parseWorkDate } from '../attendance/scope.util';
import { dayOfWeek, jalaliMonthRange, tehranMidnightInstant, toJalaliParts, workDateOf } from '../attendance/engine/jalali.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 62;
const USER_BRIEF = { id: true, firstName: true, lastName: true, attendanceCardNo: true, department: { select: { id: true, name: true } } } as const;
// Statuses that mean "not a working day" — no report is required unless the person actually worked.
const NON_WORKING = new Set(['WEEKEND', 'HOLIDAY', 'COMPANY_HOLIDAY', 'OFF_DUTY']);

export type ReportState = 'SUBMITTED' | 'LATE' | 'MISSING' | 'PENDING' | 'NOT_REQUIRED';
type Actor = { userId?: string; id?: string; role?: string };

const uidOf = (u: Actor) => (u.userId ?? u.id) as string;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Personal work log (ثبت عملکرد). Rules, all enforced here (never trusted from the client):
//   • only days of the CURRENT Jalali month, up to today, can be written to;
//   • an entry/report first saved after the day's midnight (+ WorkLogSettings.lateGraceMinutes)
//     is flagged late, with how many days late — later edits never clear that flag;
//   • total logged time for a day can't exceed what attendance shows for it (capByAttendance);
//   • users manage only their own personal categories/tasks; admin/global ones are read-only to them.
@Injectable()
export class WorkLogService {
  constructor(
    private prisma: PrismaService,
    private calc: CalcService,
    private notifications: NotificationsService,
  ) {}

  // ── Settings ────────────────────────────────────────────────────────────

  async getSettings() {
    return this.prisma.workLogSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
  }

  async updateSettings(dto: any) {
    const data: any = {};
    if (dto.lateGraceMinutes != null && dto.lateGraceMinutes !== '') data.lateGraceMinutes = Math.min(7 * 24 * 60, Math.max(0, Math.round(+dto.lateGraceMinutes || 0)));
    if ('capByAttendance' in dto) data.capByAttendance = !!dto.capByAttendance;
    if ('requireOnNonWorkingDays' in dto) data.requireOnNonWorkingDays = !!dto.requireOnNonWorkingDays;
    return this.prisma.workLogSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', ...data }, update: data });
  }

  // ── Date rules ──────────────────────────────────────────────────────────

  private parseDate(s?: string): Date {
    const d = s ? parseWorkDate(s) : workDateOf(new Date());
    if (isNaN(d.getTime())) throw new BadRequestException('تاریخ نامعتبر است');
    return d;
  }

  // Writable = not in the future, and in the same Jalali month as today.
  private isEditable(date: Date): boolean {
    const today = workDateOf(new Date());
    if (date.getTime() > today.getTime()) return false;
    const a = toJalaliParts(date), b = toJalaliParts(today);
    return a.jYear === b.jYear && a.jMonth === b.jMonth;
  }

  private assertEditable(date: Date) {
    if (date.getTime() > workDateOf(new Date()).getTime()) throw new BadRequestException('ثبت برای روزهای آینده امکان‌پذیر نیست');
    if (!this.isEditable(date)) throw new BadRequestException('فقط روزهای ماه جاری قابل ثبت یا ویرایش هستند');
  }

  // The instant after which writing for `date` counts as late.
  private deadlineOf(date: Date, graceMinutes: number): Date {
    return new Date(tehranMidnightInstant(date).getTime() + DAY_MS + graceMinutes * 60_000);
  }

  private lateInfo(date: Date, graceMinutes: number, now = new Date()) {
    if (now.getTime() <= this.deadlineOf(date, graceMinutes).getTime()) return { isLate: false, lateDays: 0 };
    const days = Math.round((workDateOf(now).getTime() - date.getTime()) / DAY_MS);
    return { isLate: true, lateDays: Math.max(1, days) };
  }

  // ── Attendance-based cap ────────────────────────────────────────────────

  // How many minutes may be logged for (user, date). null = no limit (cap disabled,
  // or the user has no attendance card, i.e. no attendance data to compare against).
  private async capacity(userId: string, date: Date, capByAttendance: boolean): Promise<{ allowed: number | null; source: string }> {
    if (!capByAttendance) return { allowed: null, source: 'disabled' };
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { attendanceCardNo: true } });
    if (!user?.attendanceCardNo) return { allowed: null, source: 'no-card' };
    const day = await this.prisma.attendanceDay.findUnique({ where: { userId_gregDate: { userId, gregDate: date } } });
    let allowed = day?.workedMinutes ?? 0;
    if (day?.status === 'REMOTE_WORK' || day?.status === 'MISSION') {
      const sched = await this.calc.getEffectiveSchedule(userId);
      allowed = Math.max(allowed, day.remoteMinutes || sched.dailyMinutes);
    }
    // Today, still checked in: worked time isn't final yet — allow up to "now − first punch".
    if (date.getTime() === workDateOf(new Date()).getTime() && !day?.lastCheckOut) {
      const start = tehranMidnightInstant(date);
      const first = await this.prisma.rawAttendanceRecord.findFirst({
        where: { userId, punchAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) } },
        orderBy: { punchAt: 'asc' },
      });
      if (first) allowed = Math.max(allowed, Math.floor((Date.now() - first.punchAt.getTime()) / 60_000));
    }
    return { allowed, source: 'attendance' };
  }

  private async usedMinutes(userId: string, date: Date, excludeEntryId?: string) {
    const agg = await this.prisma.workTaskEntry.aggregate({
      where: { userId, gregDate: date, ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}) },
      _sum: { minutes: true },
    });
    return agg._sum.minutes ?? 0;
  }

  private async assertWithinCap(userId: string, date: Date, minutes: number, excludeEntryId?: string) {
    const s = await this.getSettings();
    const cap = await this.capacity(userId, date, s.capByAttendance);
    if (cap.allowed == null) return;
    const used = await this.usedMinutes(userId, date, excludeEntryId);
    if (used + minutes > cap.allowed) {
      const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
      throw new BadRequestException(
        `مجموع زمان ثبت‌شده (${fmt(used + minutes)}) از کارکرد حضور این روز (${fmt(cap.allowed)}) بیشتر می‌شود — حداکثر ${fmt(Math.max(0, cap.allowed - used))} دیگر قابل ثبت است`,
      );
    }
  }

  // ── Report-required rule ────────────────────────────────────────────────

  private isRequired(att: { status: string; workedMinutes: number } | null | undefined, date: Date, workDays: number[], requireOnNonWorkingDays: boolean) {
    if (requireOnNonWorkingDays) return true;
    if (att) return !(NON_WORKING.has(att.status) && !(att.workedMinutes > 0));
    return workDays.includes(dayOfWeek(date));
  }

  private stateOf(report: { isLate: boolean } | null | undefined, required: boolean, date: Date, graceMinutes: number): ReportState {
    if (report) return report.isLate ? 'LATE' : 'SUBMITTED';
    if (!required) return 'NOT_REQUIRED';
    return Date.now() <= this.deadlineOf(date, graceMinutes).getTime() ? 'PENDING' : 'MISSING';
  }

  // ── Visibility helpers ──────────────────────────────────────────────────

  private visibleTo(userId: string) {
    return { OR: [{ userId }, { userId: null }] };
  }

  private async visibleTask(userId: string, taskId: string) {
    const t = await this.prisma.workTask.findFirst({ where: { id: taskId, ...this.visibleTo(userId) } });
    if (!t) throw new NotFoundException('وظیفه یافت نشد');
    return t;
  }

  // Personal = created by the user for themselves; only these are editable by the user.
  private assertPersonal(row: { userId: string | null; isAdminDefined: boolean }, userId: string) {
    if (row.userId !== userId || row.isAdminDefined) throw new ForbiddenException('این مورد توسط مدیر تعریف شده و قابل ویرایش نیست');
  }

  // ════════════════════════════════════════════════════════════════════════
  // Employee self-service
  // ════════════════════════════════════════════════════════════════════════

  async board(userId: string, dateStr?: string) {
    const date = this.parseDate(dateStr);
    const today = workDateOf(new Date());
    const settings = await this.getSettings();
    const sched = await this.calc.getEffectiveSchedule(userId);
    const j = toJalaliParts(date);
    const { start: monthStart, endExcl: monthEnd } = jalaliMonthRange(j.jYear, j.jMonth);

    const [attendance, categories, tasks, totals, onDate, entries, report, completions, monthAtt, monthReports, monthLogged, cap, used, catalog] = await Promise.all([
      this.prisma.attendanceDay.findUnique({ where: { userId_gregDate: { userId, gregDate: date } } }),
      this.prisma.workLogCategory.findMany({
        where: { archived: false, ...this.visibleTo(userId) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.workTask.findMany({
        // The user's own list: their personal + admin-assigned tasks, global tasks with a deadline
        // (meant for everyone), and global catalog tasks they adopted — plus any task (even
        // archived or not adopted) that still carries their time on this date, so history stays readable.
        where: {
          OR: [
            { archived: false, OR: [{ userId }, { userId: null, deadline: { not: null } }, { userId: null, adoptions: { some: { userId } } }] },
            { entries: { some: { userId, gregDate: date } } },
          ],
        },
        include: { category: { select: { id: true, name: true, color: true } }, createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.workTaskEntry.groupBy({ by: ['taskId'], where: { userId }, _sum: { minutes: true } }),
      this.prisma.workTaskEntry.groupBy({ by: ['taskId'], where: { userId, gregDate: date }, _sum: { minutes: true } }),
      this.prisma.workTaskEntry.findMany({
        where: { userId, gregDate: date },
        include: { task: { select: { id: true, title: true, category: { select: { name: true, color: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dailyWorkReport.findUnique({ where: { userId_gregDate: { userId, gregDate: date } } }),
      this.prisma.workTaskCompletion.findMany({ where: { userId } }),
      this.prisma.attendanceDay.findMany({ where: { userId, gregDate: { gte: monthStart, lt: monthEnd } }, select: { gregDate: true, status: true, workedMinutes: true } }),
      this.prisma.dailyWorkReport.findMany({ where: { userId, gregDate: { gte: monthStart, lt: monthEnd } }, select: { gregDate: true, isLate: true } }),
      this.prisma.workTaskEntry.groupBy({ by: ['gregDate'], where: { userId, gregDate: { gte: monthStart, lt: monthEnd } }, _sum: { minutes: true } }),
      this.capacity(userId, date, settings.capByAttendance),
      this.usedMinutes(userId, date),
      // Global catalog the user can add to their list (edit mode).
      this.prisma.workTask.findMany({
        where: { userId: null, deadline: null, archived: false },
        include: { category: { select: { id: true, name: true, color: true } }, adoptions: { where: { userId }, select: { id: true } } },
        orderBy: [{ category: { sortOrder: 'asc' } }, { title: 'asc' }],
      }),
    ]);

    const totalMap = new Map(totals.map((t) => [t.taskId, t._sum.minutes ?? 0]));
    const dateMap = new Map(onDate.map((t) => [t.taskId, t._sum.minutes ?? 0]));
    const doneMap = new Map(completions.map((c) => [c.taskId, c.doneAt]));
    const taskRows = tasks.map((t) => ({
        ...t,
        scope: t.userId == null ? 'GLOBAL' : t.isAdminDefined ? 'ASSIGNED' : 'PERSONAL',
        editable: t.userId === userId && !t.isAdminDefined,
        totalMinutes: totalMap.get(t.id) ?? 0,
        minutesOnDate: dateMap.get(t.id) ?? 0,
        done: doneMap.has(t.id),
        doneAt: doneMap.get(t.id) ?? null,
        overdue: !!t.deadline && !doneMap.has(t.id) && !t.recurring && t.deadline.getTime() < today.getTime(),
      }));
    const inList = new Set(taskRows.filter((t) => !t.done).map((t) => t.id));
    const globalCatalog = catalog.map((t) => ({
      id: t.id, title: t.title, description: t.description, recurring: t.recurring, category: t.category,
      // in-list: already on the board · finished: adopted then ended (re-adding reopens it) · available
      state: inList.has(t.id) ? 'IN_LIST' : t.adoptions.length && doneMap.has(t.id) ? 'FINISHED' : 'AVAILABLE',
    }));

    const attMap = new Map(monthAtt.map((a) => [a.gregDate.getTime(), a]));
    const repMap = new Map(monthReports.map((r) => [r.gregDate.getTime(), r]));
    const logMap = new Map(monthLogged.map((l) => [l.gregDate.getTime(), l._sum.minutes ?? 0]));
    const days: any[] = [];
    for (let t = monthStart.getTime(); t < monthEnd.getTime() && t <= today.getTime(); t += DAY_MS) {
      const d = new Date(t);
      const att = attMap.get(t);
      const required = this.isRequired(att, d, sched.workDays, settings.requireOnNonWorkingDays);
      days.push({
        date: isoDate(d), jDay: toJalaliParts(d).jDay,
        status: att?.status ?? null,
        loggedMinutes: logMap.get(t) ?? 0,
        required,
        state: this.stateOf(repMap.get(t), required, d, settings.lateGraceMinutes),
      });
    }

    const required = this.isRequired(attendance, date, sched.workDays, settings.requireOnNonWorkingDays);
    return {
      date: isoDate(date), ...j,
      today: isoDate(today),
      editable: this.isEditable(date),
      deadline: this.deadlineOf(date, settings.lateGraceMinutes),
      isLateNow: this.lateInfo(date, settings.lateGraceMinutes).isLate,
      required,
      state: this.stateOf(report, required, date, settings.lateGraceMinutes),
      capacity: { allowed: cap.allowed, used, source: cap.source },
      attendance: attendance && {
        status: attendance.status, firstCheckIn: attendance.firstCheckIn, lastCheckOut: attendance.lastCheckOut,
        workedMinutes: attendance.workedMinutes, remoteMinutes: attendance.remoteMinutes,
      },
      categories: categories.map((c) => ({ ...c, scope: c.userId == null ? 'GLOBAL' : c.isAdminDefined ? 'ASSIGNED' : 'PERSONAL', editable: c.userId === userId && !c.isAdminDefined })),
      tasks: taskRows,
      globalCatalog,
      entries,
      report,
      days,
    };
  }

  // Categories (personal)
  async createCategory(userId: string, dto: any) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('نام دسته را وارد کنید');
    return this.prisma.workLogCategory.create({ data: { name, color: dto.color || null, userId, createdById: userId, isAdminDefined: false } });
  }

  async updateCategory(userId: string, id: string, dto: any) {
    const c = await this.prisma.workLogCategory.findUnique({ where: { id } });
    if (!c || c.archived) throw new NotFoundException('دسته یافت نشد');
    this.assertPersonal(c, userId);
    const data: any = {};
    if (dto.name != null) { const n = String(dto.name).trim(); if (!n) throw new BadRequestException('نام دسته را وارد کنید'); data.name = n; }
    if ('color' in dto) data.color = dto.color || null;
    return this.prisma.workLogCategory.update({ where: { id }, data });
  }

  async removeCategory(userId: string, id: string) {
    const c = await this.prisma.workLogCategory.findUnique({ where: { id } });
    if (!c || c.archived) throw new NotFoundException('دسته یافت نشد');
    this.assertPersonal(c, userId);
    await this.prisma.workLogCategory.update({ where: { id }, data: { archived: true } });
    return { ok: true };
  }

  private async assertUsableCategory(userId: string | null, categoryId?: string | null) {
    if (!categoryId) return null;
    const c = await this.prisma.workLogCategory.findFirst({
      where: { id: categoryId, archived: false, ...(userId ? this.visibleTo(userId) : { userId: null }) },
    });
    if (!c) throw new BadRequestException('دسته‌بندی نامعتبر است');
    return c.id;
  }

  // Tasks (personal)
  async createTask(userId: string, dto: any) {
    const title = String(dto.title || '').trim();
    if (!title) throw new BadRequestException('عنوان وظیفه را وارد کنید');
    const categoryId = await this.assertUsableCategory(userId, dto.categoryId);
    return this.prisma.workTask.create({
      data: {
        title, description: dto.description?.trim() || null, categoryId,
        userId, createdById: userId, isAdminDefined: false,
        recurring: !!dto.recurring,
        startDate: workDateOf(new Date()),
        estimatedMinutes: dto.estimatedMinutes ? Math.max(1, Math.round(+dto.estimatedMinutes)) : null,
      },
    });
  }

  async updateTask(userId: string, id: string, dto: any) {
    const t = await this.prisma.workTask.findUnique({ where: { id } });
    if (!t || t.archived) throw new NotFoundException('وظیفه یافت نشد');
    this.assertPersonal(t, userId);
    const data: any = {};
    if (dto.title != null) { const v = String(dto.title).trim(); if (!v) throw new BadRequestException('عنوان وظیفه را وارد کنید'); data.title = v; }
    if ('description' in dto) data.description = dto.description?.trim() || null;
    if ('categoryId' in dto) data.categoryId = await this.assertUsableCategory(userId, dto.categoryId);
    if ('recurring' in dto) data.recurring = !!dto.recurring;
    if ('estimatedMinutes' in dto) data.estimatedMinutes = dto.estimatedMinutes ? Math.max(1, Math.round(+dto.estimatedMinutes)) : null;
    return this.prisma.workTask.update({ where: { id }, data });
  }

  async removeTask(userId: string, id: string) {
    const t = await this.prisma.workTask.findUnique({ where: { id } });
    if (!t || t.archived) throw new NotFoundException('وظیفه یافت نشد');
    this.assertPersonal(t, userId);
    await this.prisma.workTask.update({ where: { id }, data: { archived: true } });
    return { ok: true };
  }

  // done=true: a one-off task is completed, a recurring one is "تموم شد" (the user no longer has
  // it — it leaves the daily list, its logged time stays). done=false reopens it.
  async setDone(userId: string, taskId: string, done: boolean) {
    await this.visibleTask(userId, taskId);
    if (done) {
      await this.prisma.workTaskCompletion.upsert({ where: { taskId_userId: { taskId, userId } }, create: { taskId, userId }, update: {} });
    } else {
      await this.prisma.workTaskCompletion.deleteMany({ where: { taskId, userId } });
    }
    return { ok: true };
  }

  // Add a global catalog task to the user's own daily list (also reopens it if it was finished).
  async adoptTask(userId: string, taskId: string) {
    const t = await this.prisma.workTask.findFirst({ where: { id: taskId, userId: null, archived: false } });
    if (!t) throw new NotFoundException('وظیفه‌ی عمومی یافت نشد');
    await this.prisma.$transaction([
      this.prisma.workTaskAdoption.upsert({ where: { taskId_userId: { taskId, userId } }, create: { taskId, userId }, update: {} }),
      this.prisma.workTaskCompletion.deleteMany({ where: { taskId, userId } }),
    ]);
    return { ok: true };
  }

  // Time entries
  private parseMinutes(v: any) {
    const m = Math.round(+v);
    if (!Number.isFinite(m) || m < 1 || m > 24 * 60) throw new BadRequestException('مدت زمان نامعتبر است');
    return m;
  }

  async createEntry(userId: string, dto: any) {
    const date = this.parseDate(dto.date);
    this.assertEditable(date);
    const task = await this.visibleTask(userId, dto.taskId);
    if (task.archived) throw new BadRequestException('این وظیفه حذف شده است');
    const minutes = this.parseMinutes(dto.minutes);
    await this.assertWithinCap(userId, date, minutes);
    const s = await this.getSettings();
    return this.prisma.workTaskEntry.create({
      data: { taskId: task.id, userId, gregDate: date, ...toJalaliParts(date), minutes, note: dto.note?.trim() || null, ...this.lateInfo(date, s.lateGraceMinutes) },
    });
  }

  async updateEntry(userId: string, id: string, dto: any) {
    const e = await this.prisma.workTaskEntry.findUnique({ where: { id } });
    if (!e || e.userId !== userId) throw new NotFoundException('رکورد یافت نشد');
    this.assertEditable(e.gregDate);
    const data: any = {};
    if (dto.minutes != null) {
      data.minutes = this.parseMinutes(dto.minutes);
      await this.assertWithinCap(userId, e.gregDate, data.minutes, e.id);
    }
    if ('note' in dto) data.note = dto.note?.trim() || null;
    return this.prisma.workTaskEntry.update({ where: { id }, data });
  }

  async removeEntry(userId: string, id: string) {
    const e = await this.prisma.workTaskEntry.findUnique({ where: { id } });
    if (!e || e.userId !== userId) throw new NotFoundException('رکورد یافت نشد');
    this.assertEditable(e.gregDate);
    await this.prisma.workTaskEntry.delete({ where: { id } });
    return { ok: true };
  }

  // Daily report — lateness is fixed at first submission; edits only stamp editedAt.
  async saveReport(userId: string, dto: any) {
    const date = this.parseDate(dto.date);
    this.assertEditable(date);
    const content = String(dto.content || '').trim();
    if (!content) throw new BadRequestException('متن گزارش را وارد کنید');
    if (content.length > 10000) throw new BadRequestException('متن گزارش بیش از حد طولانی است');
    const existing = await this.prisma.dailyWorkReport.findUnique({ where: { userId_gregDate: { userId, gregDate: date } } });
    if (existing) {
      return this.prisma.dailyWorkReport.update({ where: { id: existing.id }, data: { content, editedAt: new Date() } });
    }
    const s = await this.getSettings();
    return this.prisma.dailyWorkReport.create({
      data: { userId, gregDate: date, ...toJalaliParts(date), content, ...this.lateInfo(date, s.lateGraceMinutes) },
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // Admin / manager
  // ════════════════════════════════════════════════════════════════════════

  // Department ids a manager may see; undefined = everything (ADMIN).
  private async scopeOf(actor: Actor): Promise<string[] | undefined> {
    if (actor.role === 'ADMIN') return undefined;
    const uid = uidOf(actor);
    const [u, memberships] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
      this.prisma.userDepartment.findMany({ where: { userId: uid }, select: { departmentId: true } }),
    ]);
    const ids = new Set<string>(memberships.map((m) => m.departmentId));
    if (u?.departmentId) ids.add(u.departmentId);
    return [...ids];
  }

  private deptWhere(deptIds: string[]) {
    return { OR: [{ departmentId: { in: deptIds } }, { userDepartments: { some: { departmentId: { in: deptIds } } } }] };
  }

  private async assertUserInScope(actor: Actor, targetUserId: string) {
    const scope = await this.scopeOf(actor);
    const u = await this.prisma.user.findFirst({ where: { id: targetUserId, ...(scope ? this.deptWhere(scope) : {}) }, select: { id: true } });
    if (!u) throw new ForbiddenException('دسترسی به این کاربر ندارید');
  }

  // Rows = one per (user, day) in range that needs a report or has any logged data.
  async adminDays(actor: Actor, q: any) {
    const today = workDateOf(new Date());
    const tj = toJalaliParts(today);
    let from = q.from ? this.parseDate(q.from) : jalaliMonthRange(tj.jYear, tj.jMonth).start;
    let to = q.to ? this.parseDate(q.to) : today;
    if (to.getTime() > today.getTime()) to = today;
    if (from.getTime() > to.getTime()) [from, to] = [to, from];
    if ((to.getTime() - from.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) throw new BadRequestException(`بازه‌ی تاریخ حداکثر ${MAX_RANGE_DAYS} روز است`);

    const scope = await this.scopeOf(actor);
    const and: any[] = [{ disabled: false }];
    if (scope) and.push(this.deptWhere(scope));
    if (q.departmentId) and.push(this.deptWhere([q.departmentId]));
    if (q.userId) and.push({ id: q.userId });
    const users = await this.prisma.user.findMany({ where: { AND: and }, select: USER_BRIEF, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] });
    const ids = users.map((u) => u.id);
    const settings = await this.getSettings();
    const range = { gte: from, lte: to };
    const [atts, reports, logged] = ids.length ? await Promise.all([
      this.prisma.attendanceDay.findMany({ where: { userId: { in: ids }, gregDate: range }, select: { userId: true, gregDate: true, status: true, workedMinutes: true, firstCheckIn: true, lastCheckOut: true } }),
      this.prisma.dailyWorkReport.findMany({ where: { userId: { in: ids }, gregDate: range }, select: { userId: true, gregDate: true, isLate: true, lateDays: true, submittedAt: true, editedAt: true, content: true } }),
      this.prisma.workTaskEntry.groupBy({ by: ['userId', 'gregDate'], where: { userId: { in: ids }, gregDate: range }, _sum: { minutes: true }, _count: { _all: true } }),
    ]) : [[], [], []] as any;
    const taskCounts = ids.length ? await this.prisma.workTaskEntry.findMany({
      where: { userId: { in: ids }, gregDate: range }, distinct: ['userId', 'gregDate', 'taskId'], select: { userId: true, gregDate: true },
    }) : [];

    const k = (u: string, d: Date) => `${u}_${d.getTime()}`;
    const attMap = new Map<string, any>(atts.map((a: any) => [k(a.userId, a.gregDate), a]));
    const repMap = new Map<string, any>(reports.map((r: any) => [k(r.userId, r.gregDate), r]));
    const logMap = new Map<string, any>(logged.map((l: any) => [k(l.userId, l.gregDate), l]));
    const tcMap = new Map<string, number>();
    for (const t of taskCounts) tcMap.set(k(t.userId, t.gregDate), (tcMap.get(k(t.userId, t.gregDate)) ?? 0) + 1);

    const workDaysCache = new Map<string, number[]>();
    const rows: any[] = [];
    const summary = { required: 0, submitted: 0, late: 0, missing: 0, pending: 0, loggedMinutes: 0 };
    for (const u of users) {
      let workDays = workDaysCache.get(u.id);
      if (!workDays) { workDays = (await this.calc.getEffectiveSchedule(u.id)).workDays; workDaysCache.set(u.id, workDays); }
      for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
        const d = new Date(t);
        const key = k(u.id, d);
        const att = attMap.get(key), rep = repMap.get(key), log = logMap.get(key);
        const required = this.isRequired(att, d, workDays, settings.requireOnNonWorkingDays);
        if (!required && !rep && !log) continue;
        const state = this.stateOf(rep, required, d, settings.lateGraceMinutes);
        if (required) summary.required++;
        if (state === 'SUBMITTED') summary.submitted++;
        else if (state === 'LATE') summary.late++;
        else if (state === 'MISSING') summary.missing++;
        else if (state === 'PENDING') summary.pending++;
        summary.loggedMinutes += log?._sum.minutes ?? 0;
        rows.push({
          id: key, userId: u.id, user: u, date: isoDate(d), ...toJalaliParts(d), dow: dayOfWeek(d),
          attendance: att ? { status: att.status, workedMinutes: att.workedMinutes, firstCheckIn: att.firstCheckIn, lastCheckOut: att.lastCheckOut } : null,
          loggedMinutes: log?._sum.minutes ?? 0,
          entryCount: log?._count._all ?? 0,
          taskCount: tcMap.get(key) ?? 0,
          report: rep ? { isLate: rep.isLate, lateDays: rep.lateDays, submittedAt: rep.submittedAt, editedAt: rep.editedAt, preview: rep.content.slice(0, 140) } : null,
          required, state,
        });
      }
    }
    return { from: isoDate(from), to: isoDate(to), rows, summary };
  }

  async adminDay(actor: Actor, userId: string, dateStr: string) {
    await this.assertUserInScope(actor, userId);
    const date = this.parseDate(dateStr);
    const start = tehranMidnightInstant(date);
    const settings = await this.getSettings();
    const [user, attendance, punches, entries, report, completions, cap] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: USER_BRIEF }),
      this.prisma.attendanceDay.findUnique({ where: { userId_gregDate: { userId, gregDate: date } } }),
      this.prisma.rawAttendanceRecord.findMany({ where: { userId, punchAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) } }, orderBy: { punchAt: 'asc' }, select: { id: true, punchAt: true } }),
      this.prisma.workTaskEntry.findMany({
        where: { userId, gregDate: date },
        include: { task: { select: { id: true, title: true, recurring: true, deadline: true, isAdminDefined: true, userId: true, category: { select: { name: true, color: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dailyWorkReport.findUnique({ where: { userId_gregDate: { userId, gregDate: date } } }),
      this.prisma.workTaskCompletion.findMany({
        where: { userId, doneAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) } },
        include: { task: { select: { id: true, title: true } } },
      }),
      this.capacity(userId, date, settings.capByAttendance),
    ]);
    const sched = await this.calc.getEffectiveSchedule(userId);
    const required = this.isRequired(attendance, date, sched.workDays, settings.requireOnNonWorkingDays);
    return {
      user, date: isoDate(date), ...toJalaliParts(date),
      attendance, punches, entries, report, completedTasks: completions.map((c) => ({ ...c.task, doneAt: c.doneAt })),
      loggedMinutes: entries.reduce((s, e) => s + e.minutes, 0),
      capacity: cap.allowed,
      required, state: this.stateOf(report, required, date, settings.lateGraceMinutes),
    };
  }

  // Catalog management: global items (ADMIN only) and items assigned to one user.
  async adminCatalog(actor: Actor, q: any) {
    const scope = await this.scopeOf(actor);
    if (q.userId) await this.assertUserInScope(actor, q.userId);
    // Managers see global items + items of users in their departments.
    const userFilter: any = q.userId
      ? { OR: [{ userId: null }, { userId: q.userId }] }
      : scope ? { OR: [{ userId: null }, { user: this.deptWhere(scope) }] } : {};
    const onlyAdmin = q.includePersonal === '1' ? {} : { isAdminDefined: true };
    const [categories, tasks] = await Promise.all([
      this.prisma.workLogCategory.findMany({
        where: { archived: false, ...onlyAdmin, ...userFilter },
        include: { user: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { tasks: { where: { archived: false } } } } },
        orderBy: [{ userId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.workTask.findMany({
        where: { archived: false, ...onlyAdmin, ...userFilter },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          category: { select: { id: true, name: true, color: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          completions: { select: { userId: true, doneAt: true } },
          _count: { select: { entries: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const totals = tasks.length ? await this.prisma.workTaskEntry.groupBy({ by: ['taskId'], where: { taskId: { in: tasks.map((t) => t.id) } }, _sum: { minutes: true } }) : [];
    const totalMap = new Map(totals.map((t) => [t.taskId, t._sum.minutes ?? 0]));
    return {
      categories,
      tasks: tasks.map(({ completions, ...t }) => ({
        ...t,
        totalMinutes: totalMap.get(t.id) ?? 0,
        doneCount: completions.length,
        done: t.userId ? completions.some((c) => c.userId === t.userId) : null,
        doneAt: t.userId ? completions.find((c) => c.userId === t.userId)?.doneAt ?? null : null,
      })),
    };
  }

  private async assertCanManage(actor: Actor, row: { userId: string | null }) {
    if (row.userId == null) {
      if (actor.role !== 'ADMIN') throw new ForbiddenException('فقط مدیر سیستم می‌تواند موارد عمومی را مدیریت کند');
    } else {
      await this.assertUserInScope(actor, row.userId);
    }
  }

  async adminCreateCategory(actor: Actor, dto: any) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('نام دسته را وارد کنید');
    const userId = dto.userId || null;
    await this.assertCanManage(actor, { userId });
    return this.prisma.workLogCategory.create({
      data: { name, color: dto.color || null, userId, createdById: uidOf(actor), isAdminDefined: true, sortOrder: Math.round(+dto.sortOrder || 0) },
    });
  }

  async adminUpdateCategory(actor: Actor, id: string, dto: any) {
    const c = await this.prisma.workLogCategory.findUnique({ where: { id } });
    if (!c || c.archived) throw new NotFoundException('دسته یافت نشد');
    await this.assertCanManage(actor, c);
    const data: any = {};
    if (dto.name != null) { const n = String(dto.name).trim(); if (!n) throw new BadRequestException('نام دسته را وارد کنید'); data.name = n; }
    if ('color' in dto) data.color = dto.color || null;
    if (dto.sortOrder != null) data.sortOrder = Math.round(+dto.sortOrder || 0);
    return this.prisma.workLogCategory.update({ where: { id }, data });
  }

  async adminRemoveCategory(actor: Actor, id: string) {
    const c = await this.prisma.workLogCategory.findUnique({ where: { id } });
    if (!c || c.archived) throw new NotFoundException('دسته یافت نشد');
    await this.assertCanManage(actor, c);
    await this.prisma.workLogCategory.update({ where: { id }, data: { archived: true } });
    return { ok: true };
  }

  async adminCreateTask(actor: Actor, dto: any) {
    const title = String(dto.title || '').trim();
    if (!title) throw new BadRequestException('عنوان وظیفه را وارد کنید');
    const userId = dto.userId || null;
    await this.assertCanManage(actor, { userId });
    const categoryId = await this.assertUsableCategory(userId, dto.categoryId);
    const deadline = dto.deadline ? this.parseDate(dto.deadline) : null;
    const task = await this.prisma.workTask.create({
      data: {
        title, description: dto.description?.trim() || null, categoryId,
        userId, createdById: uidOf(actor), isAdminDefined: true,
        recurring: !!dto.recurring && !deadline,
        startDate: workDateOf(new Date()), deadline,
        estimatedMinutes: dto.estimatedMinutes ? Math.max(1, Math.round(+dto.estimatedMinutes)) : null,
      },
    });
    if (userId) {
      await this.notifications.publish({
        userIds: [userId], category: NotificationCategory.WORKFLOW,
        title: 'وظیفه‌ی جدید برای شما تعریف شد',
        body: deadline ? `${title} — مهلت: ${this.jalaliLabel(deadline)}` : title,
        link: '/dashboard/work-log/my', sourceModule: 'work-log', sourceId: task.id,
      }).catch(() => undefined);
    }
    return task;
  }

  async adminUpdateTask(actor: Actor, id: string, dto: any) {
    const t = await this.prisma.workTask.findUnique({ where: { id } });
    if (!t || t.archived) throw new NotFoundException('وظیفه یافت نشد');
    await this.assertCanManage(actor, t);
    const data: any = {};
    if (dto.title != null) { const v = String(dto.title).trim(); if (!v) throw new BadRequestException('عنوان وظیفه را وارد کنید'); data.title = v; }
    if ('description' in dto) data.description = dto.description?.trim() || null;
    if ('categoryId' in dto) data.categoryId = await this.assertUsableCategory(t.userId, dto.categoryId);
    if ('deadline' in dto) data.deadline = dto.deadline ? this.parseDate(dto.deadline) : null;
    if ('recurring' in dto) data.recurring = !!dto.recurring && !(data.deadline ?? t.deadline);
    if ('estimatedMinutes' in dto) data.estimatedMinutes = dto.estimatedMinutes ? Math.max(1, Math.round(+dto.estimatedMinutes)) : null;
    return this.prisma.workTask.update({ where: { id }, data });
  }

  async adminRemoveTask(actor: Actor, id: string) {
    const t = await this.prisma.workTask.findUnique({ where: { id } });
    if (!t || t.archived) throw new NotFoundException('وظیفه یافت نشد');
    await this.assertCanManage(actor, t);
    await this.prisma.workTask.update({ where: { id }, data: { archived: true } });
    return { ok: true };
  }

  private jalaliLabel(d: Date) {
    const j = toJalaliParts(d);
    return `${j.jYear}/${String(j.jMonth).padStart(2, '0')}/${String(j.jDay).padStart(2, '0')}`;
  }
}
