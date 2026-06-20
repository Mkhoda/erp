import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { SyncService } from './sync.service';

// Ticks once a minute and runs any enabled source whose configured interval has
// elapsed since its last sync. One-minute granularity is plenty for attendance
// and keeps the scheduling logic per-source without N timers.
@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    private prisma: PrismaService,
    private sync: SyncService,
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
}
