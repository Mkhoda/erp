import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminWorkLogController, MyWorkLogController } from './work-log.controller';
import { WorkLogService } from './work-log.service';

@Module({
  imports: [AttendanceModule, NotificationsModule],
  controllers: [MyWorkLogController, AdminWorkLogController],
  providers: [WorkLogService, PrismaService],
  exports: [WorkLogService],
})
export class WorkLogModule {}
