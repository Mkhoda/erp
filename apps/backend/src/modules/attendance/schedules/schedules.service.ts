import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecomputeService } from '../engine/recompute.service';

// Manages the global WorkSchedule (default rules) and per-user overrides.
// Any change triggers a background recompute so existing days reflect it.
@Injectable()
export class SchedulesService {
  constructor(
    private prisma: PrismaService,
    private recompute: RecomputeService,
  ) {}

  // The single default schedule — created on first access from schema defaults.
  async getDefault() {
    let s = await this.prisma.workSchedule.findFirst({
      where: { OR: [{ isDefault: true }, { name: 'default' }] },
      orderBy: { isDefault: 'desc' },
    });
    if (!s) {
      s = await this.prisma.workSchedule.create({
        data: { name: 'default', isDefault: true },
      });
    }
    return s;
  }

  async updateDefault(dto: any) {
    const current = await this.getDefault();
    const data: any = {};
    const strFields = ['startTime', 'endTime', 'flexInStart', 'flexInEnd'];
    const intFields = [
      'dailyMinutes', 'weeklyMinutes', 'lunchMinutes', 'graceMinutes',
      'otMinThreshold', 'otMaxDaily', 'otMaxMonthly', 'otRounding',
    ];
    for (const k of strFields) if (k in dto) data[k] = dto[k] || null;
    for (const k of intFields) if (k in dto && dto[k] != null && dto[k] !== '') data[k] = Math.round(+dto[k]);
    if ('flexEnabled' in dto) data.flexEnabled = !!dto.flexEnabled;
    if (Array.isArray(dto.workDays)) data.workDays = dto.workDays.map((d: any) => +d).filter((d: number) => d >= 0 && d <= 6);

    const updated = await this.prisma.workSchedule.update({ where: { id: current.id }, data });
    // Schedule affects everyone — recompute all mapped users in the background.
    this.recompute.relinkAndRecomputeAll().catch(() => undefined);
    return updated;
  }

  async getUserRule(userId: string) {
    return this.prisma.userAttendanceRule.findUnique({ where: { userId } });
  }

  async upsertUserRule(userId: string, dto: any) {
    const num = (v: any) => (v == null || v === '' ? null : Math.round(+v));
    const str = (v: any) => (v == null || v === '' ? null : String(v));
    const data = {
      employeeType: dto.employeeType === 'HOURLY' ? 'HOURLY' : 'FULL_TIME',
      startTime: str(dto.startTime),
      endTime: str(dto.endTime),
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
    // Recompute just this user's days to reflect the new rule.
    this.recompute.relinkUser(userId).catch(() => undefined);
    return rule;
  }
}
