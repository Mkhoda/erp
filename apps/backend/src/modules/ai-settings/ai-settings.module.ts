import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { AiSettingsController } from './ai-settings.controller';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [HttpModule, QuotaModule],
  providers: [PrismaService, AiSettingsService],
  controllers: [AiSettingsController],
  exports: [AiSettingsService],
})
export class AiSettingsModule {}
