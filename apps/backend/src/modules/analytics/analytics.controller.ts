import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { AnalyticsDetailsService } from './analytics-details.service';
import { AnalyticsService } from './analytics.service';

// Organisation-wide metrics. ADMIN always; anyone else only with view permission on
// /dashboard/analytics (granted per department/role or per person in /dashboard/access).
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/analytics'], action: 'read' })
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService, private readonly details: AnalyticsDetailsService) {}

  // ── Drill-down rows (view only) ──
  @Get('details/attendance')
  dAttendance(@Query() q: any) { return this.details.attendance(q); }
  @Get('details/work-log')
  dWorkLog(@Req() req: any, @Query() q: any) { return this.details.workLog(q, req.user); }
  @Get('details/tickets')
  dTickets(@Query() q: any) { return this.details.tickets(q); }
  @Get('details/tickets/:id')
  dTicket(@Req() req: any, @Param('id') id: string) { return this.details.ticket(id, req.user); }
  @Get('details/assets')
  dAssets(@Query() q: any) { return this.details.assets(q); }
  @Get('details/assets/:id')
  dAsset(@Param('id') id: string) { return this.details.asset(id); }
  @Get('details/users')
  dUsers(@Query() q: any) { return this.details.users(q); }
  @Get('details/person')
  dPerson(@Req() req: any, @Query() q: any) { return this.details.person(q, req.user); }
  @Get('details/day')
  dDay(@Req() req: any, @Query() q: any) { return this.details.day(q, req.user); }

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
