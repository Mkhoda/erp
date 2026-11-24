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

  // Choices for the dashboard's filter bars (viewers may not have the assets/tickets pages).
  @Get('filters')
  filters() { return this.service.filters(); }

  @Get('overview')
  overview(@Query() q: any) { return this.service.overview(q); }

  @Get('attendance')
  attendance(@Query() q: any) { return this.service.attendance(q); }

  @Get('assets')
  assets(@Query() q: any) { return this.service.assets(q); }

  @Get('work-log')
  workLog(@Query() q: any) { return this.service.workLog(q); }

  @Get('tickets')
  tickets(@Query() q: any) { return this.service.tickets(q); }

  @Get('system')
  system(@Query() q: any) { return this.service.system(q); }
}
