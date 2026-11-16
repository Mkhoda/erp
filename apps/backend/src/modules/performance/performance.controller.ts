import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { PerformanceService } from './performance.service';

// امتیاز عملکرد — ADMIN, or anyone granted /dashboard/performance (non-admins see their own departments).
@UseGuards(JwtAuthGuard, RolesGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/performance'], action: 'read' })
@Controller('performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('scores')
  scores(@Req() req: any, @Query() q: any) { return this.service.scores(req.user, q); }

  @Get('settings')
  settings() { return this.service.getSettings(); }

  @Patch('settings')
  @Roles('ADMIN')
  updateSettings(@Body() body: any) { return this.service.updateSettings(body); }
}
