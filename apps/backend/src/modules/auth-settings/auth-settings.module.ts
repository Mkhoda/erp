import { Module } from '@nestjs/common';
import { AuthSettingsService } from './auth-settings.service';
import { AuthSettingsController } from './auth-settings.controller';

@Module({
  controllers: [AuthSettingsController],
  providers: [AuthSettingsService],
  exports: [AuthSettingsService],
})
export class AuthSettingsModule {}
