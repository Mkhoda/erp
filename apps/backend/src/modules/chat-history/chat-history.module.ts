import { Module } from '@nestjs/common';
import { ChatHistoryController } from './chat-history.controller';
import { ChatHistoryService } from './chat-history.service';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { ChatFilesController } from './files/files.controller';
import { ChatFilesService } from './files/files.service';

@Module({
  imports: [AiSettingsModule],
  controllers: [ChatHistoryController, ChatFilesController],
  providers: [ChatHistoryService, ChatFilesService],
})
export class ChatHistoryModule {}
