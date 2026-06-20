import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MssqlProvider } from './integration/mssql.provider';
import { SourcesService } from './integration/sources.service';
import { SourcesController } from './integration/sources.controller';
import { SyncService } from './sync/sync.service';
import { SyncScheduler } from './sync/sync.scheduler';
import { SyncController } from './sync/sync.controller';

// Attendance & Workforce Management.
// Slice 1: schema + permissions (done).  Slice 2: integration + sync engine.
// Later slices (calc engine, records/calendar, workflows, dashboards, reports)
// register their controllers/services here.
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SourcesController, SyncController],
  providers: [
    PrismaService,
    MssqlProvider,
    SourcesService,
    SyncService,
    SyncScheduler,
  ],
  exports: [SourcesService, SyncService],
})
export class AttendanceModule {}
