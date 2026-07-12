import { Global, Module } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { SystemSettingsController } from './system-settings.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Global() // available to every module without explicit import
@Module({
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService, PrismaService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
