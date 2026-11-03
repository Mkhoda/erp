import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { PagePermissionGuard } from '../../permissions/page.guard';
import { PageAccess, PageAccessGuard } from '../../permissions/page-access.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestsService } from './requests.service';
import { resolveDeptScope } from '../scope.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'EXPERT', 'USER')
@Controller('attendance')
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('requests')
  @Page('/dashboard/attendance/approvals')
  @UseGuards(PagePermissionGuard)
  async queue(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('sick') sick?: string,             // '1' → sick-leave requests only
    @Query('attachment') attachment?: string, // 'with' | 'without'
  ) {
    return this.requests.queue(await resolveDeptScope(this.prisma, req.user), status, { sick: sick === '1' || sick === 'true', attachment });
  }

  @Get('requests/pending-count')
  async pendingCount(@Req() req: any) {
    return this.requests.pendingCount(await resolveDeptScope(this.prisma, req.user));
  }

  @Patch('requests/:id/decision')
  @Page('/dashboard/attendance/approvals')
  @UseGuards(PagePermissionGuard)
  @Roles('ADMIN', 'MANAGER')
  decide(@Req() req: any, @Param('id') id: string, @Body() body: { decision: 'APPROVE' | 'REJECT'; note?: string }) {
    return this.requests.decide(id, body.decision, req.user.userId, body.note);
  }

  // Editing a day from the records page's detail modal — needs the page's "ویرایش" flag.
  @Post('overrides')
  @PageAccess({ pages: ['/dashboard/attendance/records'], action: 'write' })
  @UseGuards(PageAccessGuard)
  override(@Req() req: any, @Body() body: any) {
    return this.requests.adminOverride(req.user.userId, body);
  }

  // Manual check-in/out entry (records/new page) — needs the page's separate "ثبت" flag.
  // Same override mechanics as editing; only the permission differs.
  @Post('manual-entry')
  @PageAccess({ pages: ['/dashboard/attendance/records'], action: 'create' })
  @UseGuards(PageAccessGuard)
  manualEntry(@Req() req: any, @Body() body: any) {
    return this.requests.adminOverride(req.user.userId, { ...body, reason: body?.reason || 'ثبت دستی توسط مدیر' });
  }
}
