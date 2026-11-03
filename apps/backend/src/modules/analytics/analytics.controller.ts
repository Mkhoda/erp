import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { AnalyticsService } from './analytics.service';

// Organisation-wide metrics. ADMIN always; anyone else only with view permission on
// /dashboard/analytics (granted per department/role or per person in /dashboard/access).
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/analytics'], action: 'read' })
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  overview() { return this.service.overview(); }

  @Get('attendance')
  attendance(@Query() q: any) { return this.service.attendance(q); }

  @Get('assets')
  assets() { return this.service.assets(); }

  @Get('work-log')
  workLog(@Query() q: any) { return this.service.workLog(q); }

  @Get('tickets')
  tickets() { return this.service.tickets(); }

  @Get('system')
  system() { return this.service.system(); }
}
