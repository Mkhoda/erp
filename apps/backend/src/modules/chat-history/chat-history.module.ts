import { Module } from '@nestjs/common';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryService } from './chat-history.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';

@Module({
  imports: [AiSettingsModule],
  controllers: [ChatHistoryController],
  providers: [ChatHistoryService, PrismaService],
})
export class ChatHistoryModule {}
