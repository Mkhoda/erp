import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { SyncService } from './sync.service';
import { RecomputeService } from '../engine/recompute.service';
import { workDateOf } from '../engine/jalali.util';

// Ticks once a minute and runs any enabled source whose configured interval has
// elapsed since its last sync. One-minute granularity is plenty for attendance
// and keeps the scheduling logic per-source without N timers.
@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private prisma: PrismaService,
    private sync: SyncService,
    private recompute: RecomputeService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const sources = await this.prisma.attendanceSource.findMany({
      where: { syncEnabled: true },
    });
    const now = Date.now();
    for (const s of sources) {
      if (this.sync.isRunning(s.id)) continue;
      const due =
        !s.lastSyncAt || now - new Date(s.lastSyncAt).getTime() >= s.syncIntervalSec * 1000;
      if (!due) continue;
      this.sync
        .runSource(s.id, 'scheduled')
        .catch((e) => this.logger.error(`Scheduled sync ${s.id} failed: ${e.message}`));
    }
  }

  // computeDay only ever runs reactively — for the specific (user, day) pairs
  // that just received a new raw punch. A user who hasn't punched at all today
  // (late arrival still to come, or genuinely absent) never gets an
  // AttendanceDay row from that path, so they're invisible on the "today"
  // dashboard/status tabs until someone manually hits "recompute". This job
  // materializes today's row for every mapped user (idempotent upsert), so
  // absences show up and in-progress days stay current without manual action.
  @Cron('*/15 * * * *')
  async materializeToday() {
    try {
      const today = workDateOf(new Date());
      const n = await this.recompute.recomputeAllUsersForDays([today]);
      this.logger.log(`Materialized today's attendance for ${n} user-day row(s)`);
    } catch (e: any) {
      this.logger.error(`Materialize-today failed: ${e.message}`);
    }
  }
}
