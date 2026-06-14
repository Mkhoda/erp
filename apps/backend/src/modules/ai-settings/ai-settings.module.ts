import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { AiSettingsController } from './ai-settings.controller';

@Module({
  imports: [HttpModule],
  providers: [PrismaService, AiSettingsService],
  controllers: [AiSettingsController],
})
export class AiSettingsModule {}
