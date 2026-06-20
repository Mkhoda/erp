import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { RecomputeService } from './recompute.service';

// Attendance maintenance operations — admin only.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('attendance/maintenance')
export class MaintenanceController {
  constructor(private readonly recompute: RecomputeService) {}

  // Back-link raw punches to newly-mapped users and rebuild their days.
  // Run this after assigning card numbers to users.
  @Post('relink')
  relink() {
    return this.recompute.relinkAndRecomputeAll();
  }

  // Rebuild a Jalali month (all mapped users, or one user) — e.g. after editing
  // the work schedule or holidays.
  @Post('recompute-month')
  recomputeMonth(@Body() body: { jYear: number; jMonth: number; userId?: string }) {
    if (body.userId) return this.recompute.recomputeUserMonth(body.userId, +body.jYear, +body.jMonth);
    return this.recompute.recomputeAllForMonth(+body.jYear, +body.jMonth);
  }
}
