import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestsService } from './requests.service';
import { resolveDeptScope } from '../scope.util';

// Approval queue + direct admin edits — admin/manager only.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('attendance')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('requests')
  @Page('/dashboard/attendance/approvals')
  async queue(@Req() req: any, @Query('status') status?: string) {
    return this.requests.queue(await resolveDeptScope(this.prisma, req.user), status);
  }

  @Get('requests/pending-count')
  async pendingCount(@Req() req: any) {
    return this.requests.pendingCount(await resolveDeptScope(this.prisma, req.user));
  }

  @Patch('requests/:id/decision')
  @Page('/dashboard/attendance/approvals')
  decide(@Req() req: any, @Param('id') id: string, @Body() body: { decision: 'APPROVE' | 'REJECT'; note?: string }) {
    return this.requests.decide(id, body.decision, req.user.userId, body.note);
  }

  // Direct admin edit of a user's check-in/out (used from the records page).
  @Post('overrides')
  @Page('/dashboard/attendance/records')
  override(@Req() req: any, @Body() body: any) {
    return this.requests.adminOverride(req.user.userId, body);
  }
}
