import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiSettingsService } from './ai-settings.service';
import { AiStreamService } from './ai-stream.service';
import { AiSettingsController } from './ai-settings.controller';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [HttpModule, QuotaModule],
  providers: [AiSettingsService, AiStreamService],
  controllers: [AiSettingsController],
  exports: [AiSettingsService, AiStreamService],
})
export class AiSettingsModule {}
