import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MssqlProvider } from './integration/mssql.provider';
import { SourcesService } from './integration/sources.service';
import { SourcesController } from './integration/sources.controller';
import { SyncService } from './sync/sync.service';
import { SyncScheduler } from './sync/sync.scheduler';
import { SyncController } from './sync/sync.controller';
import { CalcService } from './engine/calc.service';
import { GuardCalcService } from './engine/guard-calc.service';
import { RecomputeService } from './engine/recompute.service';
import { MaintenanceController } from './engine/maintenance.controller';
import { RecordsService } from './records/records.service';
import { RecordsController } from './records/records.controller';
import { DashboardsService } from './dashboards/dashboards.service';
import { DashboardsController } from './dashboards/dashboards.controller';
import { ReportsService } from './reports/reports.service';
import { ReportsController } from './reports/reports.controller';
import { SchedulesService } from './schedules/schedules.service';
import { SchedulesController } from './schedules/schedules.controller';
import { RequestsService } from './requests/requests.service';
import { RequestsController } from './requests/requests.controller';
import { MyAttendanceController } from './requests/my-attendance.controller';
import { HolidaysService } from './holidays/holidays.service';
import { HolidaysController } from './holidays/holidays.controller';
import { GuardShiftsService } from './guard-shifts/guard-shifts.service';
import { GuardShiftsController } from './guard-shifts/guard-shifts.controller';

// Attendance & Workforce Management.
// Slices 1-2: schema + integration/sync.  Slice 3: calc engine + records,
// dashboard, and Excel/PDF reporting.
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    SourcesController,
    SyncController,
    MaintenanceController,
    RecordsController,
    DashboardsController,
    ReportsController,
    SchedulesController,
    RequestsController,
    MyAttendanceController,
    HolidaysController,
    GuardShiftsController,
  ],
  providers: [
    PrismaService,
    MssqlProvider,
    SourcesService,
    SyncService,
    SyncScheduler,
    CalcService,
    GuardCalcService,
    RecomputeService,
    RecordsService,
    DashboardsService,
    ReportsService,
    SchedulesService,
    RequestsService,
    HolidaysService,
    GuardShiftsService,
  ],
  exports: [SourcesService, SyncService, RecomputeService],
})
export class AttendanceModule {}
