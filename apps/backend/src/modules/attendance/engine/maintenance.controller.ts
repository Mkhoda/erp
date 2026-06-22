import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecomputeService } from './recompute.service';
import { formatJalali, minutesOfDay, minutesToHHMM, workDateOf } from './jalali.util';

// Attendance maintenance operations — admin only.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('attendance/maintenance')
export class MaintenanceController {
  constructor(
    private readonly recompute: RecomputeService,
    private readonly prisma: PrismaService,
  ) {}

  // Data health snapshot — reveals card mapping + date-parse problems so the
  // admin can see exactly why records may be empty.
  @Get('diagnostics')
  async diagnostics() {
    const [rawTotal, rawMapped, dayTotal, usersWithCard, cardGroups, sample] = await Promise.all([
      this.prisma.rawAttendanceRecord.count(),
      this.prisma.rawAttendanceRecord.count({ where: { userId: { not: null } } }),
      this.prisma.attendanceDay.count(),
      this.prisma.user.findMany({ where: { attendanceCardNo: { not: null } }, select: { attendanceCardNo: true } }),
      this.prisma.rawAttendanceRecord.groupBy({
        by: ['cardNo'],
        _count: true,
        orderBy: { _count: { cardNo: 'desc' } },
        take: 60,
      }),
      this.prisma.rawAttendanceRecord.findMany({
        orderBy: { recordId: 'desc' },
        take: 12,
        select: { cardNo: true, mDate: true, sDate: true, rTime: true, rType: true, deviceCode: true, punchAt: true, userId: true },
      }),
    ]);
    const mappedSet = new Set(usersWithCard.map((u) => u.attendanceCardNo));
    return {
      rawTotal,
      rawMapped,
      rawUnmapped: rawTotal - rawMapped,
      dayTotal,
      usersWithCard: usersWithCard.length,
      cards: cardGroups.map((g) => ({ cardNo: g.cardNo, count: g._count, mapped: mappedSet.has(g.cardNo) })),
      sample: sample.map((s) => ({
        cardNo: s.cardNo,
        mDate: s.mDate,
        sDate: s.sDate,
        rTime: s.rTime,
        rType: s.rType,
        deviceCode: s.deviceCode,
        punchAtIso: s.punchAt,
        parsedJalali: formatJalali(workDateOf(s.punchAt)),
        parsedTime: minutesToHHMM(minutesOfDay(s.punchAt)),
        mapped: !!s.userId,
      })),
    };
  }

  // Back-link raw punches to newly-mapped users and rebuild their days.
  // Run this after assigning card numbers to users.
  @Post('relink')
  relink() {
    return this.recompute.relinkAndRecomputeAll();
  }

  // Auto-create a placeholder user for every unknown CardNo, then link +
  // recompute so all attendance becomes visible immediately.
  @Post('provision-cards')
  provisionCards() {
    return this.recompute.provisionCardsAndRecompute();
  }

  // Rebuild a Jalali month (all mapped users, or one user) — e.g. after editing
  // the work schedule or holidays.
  @Post('recompute-month')
  recomputeMonth(@Body() body: { jYear: number; jMonth: number; userId?: string }) {
    if (body.userId) return this.recompute.recomputeUserMonth(body.userId, +body.jYear, +body.jMonth);
    return this.recompute.recomputeAllForMonth(+body.jYear, +body.jMonth);
  }
}
