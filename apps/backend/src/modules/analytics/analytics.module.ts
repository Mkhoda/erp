import { Module } from '@nestjs/common';
import { WorkLogModule } from '../work-log/work-log.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsDetailsService } from './analytics-details.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [WorkLogModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsDetailsService],
})
export class AnalyticsModule {}
