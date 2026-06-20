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

  @Get('me/:providerType')
  myQuota(@Req() req: any, @Param('providerType') providerType: string) {
    return this.service.getOrCreate(req.user.userId ?? req.user.id, providerType);
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

  @Put('user/:userId/:providerType')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsert(
    @Param('userId') userId: string,
    @Param('providerType') providerType: string,
    @Body() body: { monthlyLimit: number },
  ) {
    return this.service.upsert(userId, providerType, body.monthlyLimit);
  }

  @Post('user/:userId/:providerType/reset')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  reset(@Param('userId') userId: string, @Param('providerType') providerType: string) {
    return this.service.reset(userId, providerType);
  }

  // ── Default quotas ────────────────────────────────────────────

  @Get('defaults')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listDefaults() {
    return this.service.listDefaults();
  }

  @Put('defaults/:providerType')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsertDefault(
    @Param('providerType') providerType: string,
    @Body() body: { monthlyLimit: number },
  ) {
    return this.service.upsertDefault(providerType, body.monthlyLimit);
  }

  @Delete('defaults/:providerType')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteDefault(@Param('providerType') providerType: string) {
    return this.service.deleteDefault(providerType);
  }
}
