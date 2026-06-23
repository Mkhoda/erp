import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecomputeService } from '../engine/recompute.service';
import { parseWorkDate } from '../scope.util';
import { TEHRAN_OFFSET_MIN } from '../engine/jalali.util';

const USER_SELECT = {
  id: true, firstName: true, lastName: true, phone: true,
  attendanceCardNo: true, department: { select: { name: true } },
} as const;

// Combine a Gregorian work date (YYYY-MM-DD) + Tehran wall-clock "HH:mm" into
// the absolute UTC instant stored on punches/overrides.
function buildInstant(dateStr: string, hhmm?: string | null): Date | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const base = parseWorkDate(dateStr);
  if (isNaN(base.getTime())) return null;
  return new Date(base.getTime() + (+m[1] * 60 + +m[2] - TEHRAN_OFFSET_MIN) * 60_000);
}

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private recompute: RecomputeService,
  ) {}

  // ── Employee self-service ──────────────────────────────────────────────
  async create(userId: string, dto: any) {
    const gregDate = parseWorkDate(dto.date);
    // One open request per day.
    const existing = await this.prisma.attendanceRequest.findFirst({
      where: { userId, gregDate, status: 'PENDING' },
    });
    if (existing) throw new ConflictException('برای این روز یک درخواست در حال بررسی دارید');
    return this.prisma.attendanceRequest.create({
      data: {
        userId,
        type: (dto.type as any) || 'FULL_DAY_FIX',
        gregDate,
        requestedIn: buildInstant(dto.date, dto.inTime),
        requestedOut: buildInstant(dto.date, dto.outTime),
        targetStatus: (dto.targetStatus as any) || null,
        description: dto.description || '',
        attachment: dto.attachment || null,
      },
    });
  }

  listForUser(userId: string) {
    return this.prisma.attendanceRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ── Admin / manager queue ──────────────────────────────────────────────
  async queue(scopeDeptIds?: string[], status?: string) {
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    else where.status = 'PENDING';
    if (scopeDeptIds && scopeDeptIds.length) {
      where.user = {
        OR: [
          { departmentId: { in: scopeDeptIds } },
          { userDepartments: { some: { departmentId: { in: scopeDeptIds } } } },
        ],
      };
    }
    return this.prisma.attendanceRequest.findMany({
      where,
      include: { user: { select: USER_SELECT } },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });
  }

  // Approve → materialize an AttendanceOverride (survives every recompute) and
  // rebuild that day. Reject → just close the request.
  async decide(id: string, decision: 'APPROVE' | 'REJECT', deciderId: string, note?: string) {
    const req = await this.prisma.attendanceRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('درخواست یافت نشد');

    if (decision === 'APPROVE') {
      await this.prisma.attendanceOverride.create({
        data: {
          userId: req.userId,
          gregDate: req.gregDate,
          newCheckIn: req.requestedIn,
          newCheckOut: req.requestedOut,
          forceStatus: req.targetStatus,
          reason: req.description || 'تایید درخواست اصلاح',
          createdById: deciderId,
          requestId: req.id,
        },
      });
      await this.recompute.recomputeDays([{ userId: req.userId, gregDate: req.gregDate }]).catch(() => undefined);
    }

    return this.prisma.attendanceRequest.update({
      where: { id },
      data: {
        status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        hrById: deciderId,
        decidedAt: new Date(),
        decisionNote: note || null,
      },
    });
  }

  // Direct admin edit on the records page — creates an override immediately.
  async adminOverride(adminId: string, dto: any) {
    const gregDate = parseWorkDate(dto.date);
    await this.prisma.attendanceOverride.create({
      data: {
        userId: dto.userId,
        gregDate,
        newCheckIn: buildInstant(dto.date, dto.inTime),
        newCheckOut: buildInstant(dto.date, dto.outTime),
        forceStatus: (dto.forceStatus as any) || null,
        reason: dto.reason || 'اصلاح توسط مدیر',
        createdById: adminId,
      },
    });
    await this.recompute.recomputeDays([{ userId: dto.userId, gregDate }]).catch(() => undefined);
    return { ok: true };
  }

  async pendingCount(scopeDeptIds?: string[]) {
    const where: any = { status: 'PENDING' };
    if (scopeDeptIds && scopeDeptIds.length) {
      where.user = { OR: [
        { departmentId: { in: scopeDeptIds } },
        { userDepartments: { some: { departmentId: { in: scopeDeptIds } } } },
      ] };
    }
    return { count: await this.prisma.attendanceRequest.count({ where }) };
  }
}
