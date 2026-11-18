import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController, BrandingController } from './system-settings.controller';

@Global()
@Module({
  imports: [HttpModule],
  controllers: [SystemSettingsController, BrandingController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
