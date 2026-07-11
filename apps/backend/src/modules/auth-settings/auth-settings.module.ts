import { Module } from '@nestjs/common';
import { AuthSettingsService } from './auth-settings.service';
import { AuthSettingsController } from './auth-settings.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [AuthSettingsController],
  providers: [AuthSettingsService, PrismaService],
  exports: [AuthSettingsService],
})
export class AuthSettingsModule {}
