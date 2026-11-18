import { Module } from '@nestjs/common';
import { WorkLogModule } from '../work-log/work-log.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  imports: [WorkLogModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}
