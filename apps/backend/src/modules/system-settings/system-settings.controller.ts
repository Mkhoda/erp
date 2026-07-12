import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
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
    @Body() dto: { baleSafirApiKey?: string; baleBotId?: string; baleMock?: boolean },
    @Req() req: any,
  ) {
    return this.svc.update(dto, req.user.userId);
  }
}
