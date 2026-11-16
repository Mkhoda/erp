import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkLogModule } from '../work-log/work-log.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  imports: [WorkLogModule],
  controllers: [PerformanceController],
  providers: [PerformanceService, PrismaService],
})
export class PerformanceModule {}
