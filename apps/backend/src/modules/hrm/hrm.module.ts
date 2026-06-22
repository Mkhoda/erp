import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { DepartmentsController } from './departments.controller';
import { TimesheetsController } from './timesheets.controller';
import { HrmController } from './hrm.controller';
import { UsersService } from './users.service';
import { DepartmentsService } from './departments.service';
import { TimesheetsService } from './timesheets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AttendanceModule],
  controllers: [UsersController, DepartmentsController, TimesheetsController, HrmController],
  providers: [UsersService, DepartmentsService, TimesheetsService, PrismaService],
})
export class HrmModule {}
