import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryService } from './chat-history.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

@Module({
  imports: [HttpModule],
  controllers: [ChatHistoryController],
  providers: [ChatHistoryService, AiSettingsService, PrismaService],
})
export class ChatHistoryModule {}
