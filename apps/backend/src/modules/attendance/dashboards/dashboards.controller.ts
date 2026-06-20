import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { DashboardsService } from './dashboards.service';
import { resolveDeptScope } from '../scope.util';
import { toJalaliParts, workDateOf } from '../engine/jalali.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Page('/dashboard/attendance')
@Controller('attendance/dashboard')
export class DashboardsController {
  constructor(
    private readonly dashboards: DashboardsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async monthly(@Req() req: any, @Query() q: any) {
    const now = toJalaliParts(workDateOf(new Date()));
    const jYear = q.jYear ? +q.jYear : now.jYear;
    const jMonth = q.jMonth ? +q.jMonth : now.jMonth;
    const scope = await resolveDeptScope(this.prisma, req.user);
    return this.dashboards.monthly(jYear, jMonth, scope, q.departmentId || undefined);
  }
}
