import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemSettingsController {
  constructor(private readonly svc: SystemSettingsService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Patch()
  update(
    @Body() dto: { orgName?: string; baleSafirApiKey?: string; baleBotId?: string; baleMock?: boolean },
    @Req() req: any,
  ) {
    return this.svc.update(dto, req.user.userId);
  }

  @Post('test-bale')
  testBale(@Body() dto: { phone: string; otp: string }) {
    return this.svc.testBale(dto.phone, dto.otp);
  }
}

// Unauthenticated — the display name is non-sensitive and needed on public
// pages (signin, landing) as well as every dashboard page, so it can't sit
// behind the admin-only guards above.
@Controller('branding')
export class BrandingController {
  constructor(private readonly svc: SystemSettingsService) {}

  @Get()
  async get() {
    return { name: await this.svc.getOrgName() };
  }
}
