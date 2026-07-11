import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthSettingsService, UpdateAuthSettingsInput } from './auth-settings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('auth-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuthSettingsController {
  constructor(private readonly authSettings: AuthSettingsService) {}

  @Get()
  get() {
    return this.authSettings.getRaw();
  }

  @Patch()
  update(@Body() dto: UpdateAuthSettingsInput, @Req() req: any) {
    return this.authSettings.update(dto, req.user.userId);
  }

  @Post('force-logout')
  forceGlobalLogout(@Req() req: any) {
    return this.authSettings.forceGlobalLogout(req.user.userId);
  }
}
