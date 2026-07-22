import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ShiftType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecomputeService } from '../engine/recompute.service';
import { parseWorkDate } from '../scope.util';
import { jalaliMonthRange } from '../engine/jalali.util';

const GUARD_TYPES: ShiftType[] = [ShiftType.TWENTY_FOUR_TWENTY_FOUR, ShiftType.TWENTY_FOUR_FORTY_EIGHT];

const USER_SELECT = {
  id: true, firstName: true, lastName: true, attendanceCardNo: true,
  department: { select: { name: true } },
} as const;

// Manages guard-duty (24h on-shift) rotations: shift templates (duty length +
// two deficit/absence thresholds), which users are assigned to them, and the
// supervisor-maintained calendar of on-duty days. Any write triggers a
// recompute of the affected user/range via RecomputeService, which routes
// guard-assigned users through GuardCalcService automatically.
@Injectable()
export class GuardShiftsService {
  constructor(
    private prisma: PrismaService,
    private recompute: RecomputeService,
  ) {}

  // ── Shift templates ──
  list() {
    return this.prisma.shift.findMany({ where: { type: { in: GUARD_TYPES } }, orderBy: { createdAt: 'desc' } });
  }

  private validateType(type: string) {
    if (!GUARD_TYPES.includes(type as ShiftType)) {
      throw new BadRequestException('نوع شیفت باید ۲۴/۲۴ یا ۲۴/۴۸ باشد');
    }
  }

  create(dto: any) {
    this.validateType(dto.type);
    return this.prisma.shift.create({
      data: {
        name: dto.name,
        type: dto.type,
        dutyMinutes: Math.round(+dto.dutyMinutes),
        fullCreditMinutes: Math.round(+dto.fullCreditMinutes),
        absentBelowMinutes: Math.round(+dto.absentBelowMinutes),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: any) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) { this.validateType(dto.type); data.type = dto.type; }
    if (dto.dutyMinutes !== undefined) data.dutyMinutes = Math.round(+dto.dutyMinutes);
    if (dto.fullCreditMinutes !== undefined) data.fullCreditMinutes = Math.round(+dto.fullCreditMinutes);
    if (dto.absentBelowMinutes !== undefined) data.absentBelowMinutes = Math.round(+dto.absentBelowMinutes);
    if (dto.isActive !== undefined) data.isActive = !!dto.isActive;
    const shift = await this.prisma.shift.update({ where: { id }, data });
    // Thresholds/duty length changed — rebuild every assigned user's history.
    const assignments = await this.prisma.shiftAssignment.findMany({ where: { shiftId: id } });
    for (const a of assignments) {
      await this.recompute.recomputeUserRange(a.userId, a.startDate, a.endDate ?? new Date()).catch(() => undefined);
    }
    return shift;
  }

  async remove(id: string) {
    const assignments = await this.prisma.shiftAssignment.findMany({ where: { shiftId: id } });
    await this.prisma.shift.delete({ where: { id } }); // cascades assignments + calendar days
    for (const a of assignments) {
      await this.recompute.recomputeUserRange(a.userId, a.startDate, a.endDate ?? new Date()).catch(() => undefined);
    }
    return { ok: true };
  }

  // ── Assignments (which user follows which guard shift, and since when) ──
  listAssignments(shiftId?: string) {
    return this.prisma.shiftAssignment.findMany({
      where: shiftId ? { shiftId } : { shift: { type: { in: GUARD_TYPES } } },
      include: { user: { select: USER_SELECT }, shift: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAssignment(dto: any) {
    const startDate = parseWorkDate(dto.startDate);
    const endDate = dto.endDate ? parseWorkDate(dto.endDate) : null;
    const a = await this.prisma.shiftAssignment.create({
      data: { shiftId: dto.shiftId, userId: dto.userId, startDate, endDate },
    });
    await this.recompute.recomputeUserRange(dto.userId, startDate, endDate ?? new Date()).catch(() => undefined);
    return a;
  }

  async removeAssignment(id: string) {
    const a = await this.prisma.shiftAssignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('انتساب یافت نشد');
    await this.prisma.shiftAssignment.delete({ where: { id } });
    // Recompute so the range reverts to the regular (non-guard) pipeline.
    await this.recompute.recomputeUserRange(a.userId, a.startDate, a.endDate ?? new Date()).catch(() => undefined);
    return { ok: true };
  }

  // ── Calendar (on-duty days, set by the supervisor) ──
  listCalendar(userId: string, jYear?: number, jMonth?: number) {
    const where: any = { userId };
    if (jYear && jMonth) {
      const { start, endExcl } = jalaliMonthRange(jYear, jMonth);
      where.gregDate = { gte: start, lt: endExcl };
    }
    return this.prisma.shiftCalendarDay.findMany({ where, orderBy: { gregDate: 'asc' } });
  }

  async markOnDuty(dto: any) {
    const gregDate = parseWorkDate(dto.date);
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: {
        userId: dto.userId,
        startDate: { lte: gregDate },
        OR: [{ endDate: null }, { endDate: { gte: gregDate } }],
        shift: { type: { in: GUARD_TYPES } },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!assignment) throw new BadRequestException('این کاربر در این تاریخ به هیچ شیفت نگهبانی متصل نیست');
    const row = await this.prisma.shiftCalendarDay.upsert({
      where: { userId_gregDate: { userId: dto.userId, gregDate } },
      create: { userId: dto.userId, gregDate, shiftId: assignment.shiftId },
      update: { shiftId: assignment.shiftId },
    });
    await this.recomputeAround(dto.userId, gregDate);
    return row;
  }

  async unmarkOnDuty(userId: string, date: string) {
    const gregDate = parseWorkDate(date);
    await this.prisma.shiftCalendarDay.deleteMany({ where: { userId, gregDate } });
    await this.recomputeAround(userId, gregDate);
    return { ok: true };
  }

  // A few days of slack on both sides so a change to one on-duty day also
  // refreshes the "covered days" calculation for a neighboring shift.
  private async recomputeAround(userId: string, gregDate: Date) {
    const from = new Date(gregDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    const to = new Date(gregDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    await this.recompute.recomputeUserRange(userId, from, to).catch(() => undefined);
  }
}
