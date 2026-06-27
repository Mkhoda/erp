import { Injectable, NotFoundException } from '@nestjs/common';
import * as moment from 'moment-jalaali';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecomputeService } from '../engine/recompute.service';
import { parseWorkDate } from '../scope.util';
import { toJalaliParts } from '../engine/jalali.util';

// Accept either a Jalali ("1404/01/13") or Gregorian ("2025-04-02") date string
// → UTC-midnight work date.
function parseFlexDate(s: string): Date {
  if (!s) return new Date(NaN);
  const m = s.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m && +m[1] >= 1300 && +m[1] <= 1700) {
    const g = moment(`${m[1]}/${m[2]}/${m[3]}`, 'jYYYY/jM/jD');
    if (g.isValid()) return new Date(Date.UTC(g.year(), g.month(), g.date()));
  }
  return parseWorkDate(s);
}

@Injectable()
export class HolidaysService {
  constructor(
    private prisma: PrismaService,
    private recompute: RecomputeService,
  ) {}

  list() {
    return this.prisma.holiday.findMany({ orderBy: { startDate: 'desc' } });
  }

  // Every calendar day covered by a holiday range (for targeted recompute).
  private daysOf(start: Date, end: Date): Date[] {
    const out: Date[] = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) out.push(new Date(d));
    return out;
  }

  async create(dto: any) {
    const start = parseFlexDate(dto.startDate);
    const end = dto.endDate ? parseFlexDate(dto.endDate) : start;
    const recurring = !!dto.recurring;
    const jp = toJalaliParts(start);
    const holiday = await this.prisma.holiday.create({
      data: {
        title: dto.title || 'تعطیل',
        type: (dto.type as any) || 'OFFICIAL',
        startDate: start,
        endDate: end,
        recurring,
        jMonth: recurring ? jp.jMonth : null,
        jDay: recurring ? jp.jDay : null,
        note: dto.note || null,
        scheduleIds: Array.isArray(dto.scheduleIds) ? dto.scheduleIds.filter(Boolean) : [],
      },
    });
    this.recompute.recomputeAllUsersForDays(this.daysOf(start, end)).catch(() => undefined);
    return holiday;
  }

  async update(id: string, dto: any) {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('تعطیلی یافت نشد');
    const start = dto.startDate ? parseFlexDate(dto.startDate) : existing.startDate;
    const end = dto.endDate ? parseFlexDate(dto.endDate) : existing.endDate;
    const recurring = dto.recurring != null ? !!dto.recurring : existing.recurring;
    const jp = toJalaliParts(start);
    const holiday = await this.prisma.holiday.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        type: (dto.type as any) ?? existing.type,
        startDate: start,
        endDate: end,
        recurring,
        jMonth: recurring ? jp.jMonth : null,
        jDay: recurring ? jp.jDay : null,
        note: dto.note ?? existing.note,
        scheduleIds: Array.isArray(dto.scheduleIds) ? dto.scheduleIds.filter(Boolean) : existing.scheduleIds,
      },
    });
    this.recompute.recomputeAllUsersForDays(this.daysOf(start, end)).catch(() => undefined);
    return holiday;
  }

  async remove(id: string) {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('تعطیلی یافت نشد');
    await this.prisma.holiday.delete({ where: { id } });
    this.recompute.recomputeAllUsersForDays(this.daysOf(existing.startDate, existing.endDate)).catch(() => undefined);
    return { ok: true };
  }
}
