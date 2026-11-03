import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLogModule } from '../work-log/work-log.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [WorkLogModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PrismaService],
})
export class AnalyticsModule {}
