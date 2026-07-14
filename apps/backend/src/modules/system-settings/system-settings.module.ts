import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController, BrandingController } from './system-settings.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Global()
@Module({
  imports: [HttpModule],
  controllers: [SystemSettingsController, BrandingController],
  providers: [SystemSettingsService, PrismaService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
