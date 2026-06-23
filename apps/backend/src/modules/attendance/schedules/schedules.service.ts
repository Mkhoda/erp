import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecomputeService } from '../engine/recompute.service';

// Manages work schedules (the org default + named groups like "امریه") and
// per-user overrides. Any change triggers a recompute of affected users.
@Injectable()
export class SchedulesService {
  constructor(
    private prisma: PrismaService,
    private recompute: RecomputeService,
  ) {}

  private readonly STR = ['startTime', 'endTime', 'flexInStart', 'flexInEnd', 'checkInStart', 'checkInEnd', 'checkOutStart', 'checkOutEnd'];
  private readonly INT = [
    'dailyMinutes', 'weeklyMinutes', 'lunchMinutes', 'graceMinutes',
    'otMinThreshold', 'otMaxDaily', 'otMaxMonthly', 'otRounding', 'annualLeaveDays',
  ];

  private mapFields(dto: any) {
    const data: any = {};
    for (const k of this.STR) if (k in dto) data[k] = dto[k] || null;
    for (const k of this.INT) if (k in dto && dto[k] != null && dto[k] !== '') data[k] = Math.round(+dto[k]);
    if ('flexEnabled' in dto) data.flexEnabled = !!dto.flexEnabled;
    if (Array.isArray(dto.workDays)) data.workDays = dto.workDays.map((d: any) => +d).filter((d: number) => d >= 0 && d <= 6);
    return data;
  }

  // The single default schedule — created on first access from schema defaults.
  async getDefault() {
    let s = await this.prisma.workSchedule.findFirst({
      where: { OR: [{ isDefault: true }, { name: 'default' }] },
      orderBy: { isDefault: 'desc' },
    });
    if (!s) s = await this.prisma.workSchedule.create({ data: { name: 'default', isDefault: true } });
    return s;
  }

  // All schedules (groups), default first, each with its assigned-user count.
  async list() {
    await this.getDefault(); // ensure default exists
    const rows = await this.prisma.workSchedule.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { userRules: true } } },
    });
    return rows.map((r) => ({ ...r, userCount: r._count.userRules }));
  }

  async create(dto: any) {
    if (!dto.name || !String(dto.name).trim()) throw new BadRequestException('نام گروه الزامی است');
    return this.prisma.workSchedule.create({
      data: { name: String(dto.name).trim(), isDefault: false, ...this.mapFields(dto) },
    });
  }

  async update(id: string, dto: any) {
    const existing = await this.prisma.workSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('برنامه کاری یافت نشد');
    const data = this.mapFields(dto);
    // Allow renaming non-default schedules.
    if (!existing.isDefault && dto.name && String(dto.name).trim()) data.name = String(dto.name).trim();
    const updated = await this.prisma.workSchedule.update({ where: { id }, data });
    // Recompute only the users on this schedule (background).
    this.recompute.recomputeScheduleUsers(id, existing.isDefault).catch(() => undefined);
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.workSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('برنامه کاری یافت نشد');
    if (existing.isDefault) throw new BadRequestException('برنامه پیش‌فرض قابل حذف نیست');
    // Detach users (they fall back to the default), then delete.
    await this.prisma.userAttendanceRule.updateMany({ where: { scheduleId: id }, data: { scheduleId: null } });
    await this.prisma.workSchedule.delete({ where: { id } });
    this.recompute.recomputeScheduleUsers(id, false).catch(() => undefined);
    return { ok: true };
  }

  // Back-compat single-default endpoints.
  updateDefault(dto: any) {
    return this.getDefault().then((s) => this.update(s.id, dto));
  }

  // ── Per-user rule ──────────────────────────────────────────────────────
  async getUserRule(userId: string) {
    return this.prisma.userAttendanceRule.findUnique({ where: { userId } });
  }

  async upsertUserRule(userId: string, dto: any) {
    const num = (v: any) => (v == null || v === '' ? null : Math.round(+v));
    const str = (v: any) => (v == null || v === '' ? null : String(v));
    const data = {
      employeeType: dto.employeeType === 'HOURLY' ? 'HOURLY' : 'FULL_TIME',
      scheduleId: dto.scheduleId || null, // assign to a group (or default when null)
      startTime: str(dto.startTime),
      endTime: str(dto.endTime),
      checkInStart: str(dto.checkInStart),
      checkInEnd: str(dto.checkInEnd),
      checkOutStart: str(dto.checkOutStart),
      checkOutEnd: str(dto.checkOutEnd),
      dailyMinutes: num(dto.dailyMinutes),
      graceMinutes: num(dto.graceMinutes),
      flexEnabled: dto.flexEnabled == null ? null : !!dto.flexEnabled,
      otAllowed: dto.otAllowed == null ? true : !!dto.otAllowed,
      otMaxDaily: num(dto.otMaxDaily),
      otMaxMonthly: num(dto.otMaxMonthly),
    } as const;

    const rule = await this.prisma.userAttendanceRule.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    this.recompute.relinkUser(userId).catch(() => undefined);
    return rule;
  }
}
