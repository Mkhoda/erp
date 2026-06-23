import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { QuotaService } from './quota.service';

@UseGuards(JwtAuthGuard)
@Controller('quota')
export class QuotaController {
  constructor(private service: QuotaService) {}

  // ── User: own quotas ──────────────────────────────────────────

  @Get('me')
  myQuotas(@Req() req: any) {
    return this.service.listForUser(req.user.userId ?? req.user.id);
  }

  @Get('me/:providerId')
  myQuota(@Req() req: any, @Param('providerId') providerId: string) {
    return this.service.getOrCreate(req.user.userId ?? req.user.id, providerId);
  }

  // ── Admin: all quotas ─────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listAll(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.service.listAll(+page, +limit);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  globalStats() {
    return this.service.globalStats();
  }

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  forUser(@Param('userId') userId: string) {
    return this.service.listForAdmin(userId);
  }

  @Put('user/:userId/:providerId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsert(
    @Param('userId') userId: string,
    @Param('providerId') providerId: string,
    @Body() body: { monthlyLimit: number },
  ) {
    return this.service.upsert(userId, providerId, body.monthlyLimit);
  }

  @Post('user/:userId/:providerId/reset')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  reset(@Param('userId') userId: string, @Param('providerId') providerId: string) {
    return this.service.reset(userId, providerId);
  }

  // ── Default quotas ────────────────────────────────────────────

  @Get('defaults')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listDefaults() {
    return this.service.listDefaults();
  }

  @Put('defaults/:providerId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsertDefault(
    @Param('providerId') providerId: string,
    @Body() body: { monthlyLimit: number },
  ) {
    return this.service.upsertDefault(providerId, body.monthlyLimit);
  }

  @Delete('defaults/:providerId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteDefault(@Param('providerId') providerId: string) {
    return this.service.deleteDefault(providerId);
  }
}
