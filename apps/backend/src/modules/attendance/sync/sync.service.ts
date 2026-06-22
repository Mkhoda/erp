import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SourcesService } from '../integration/sources.service';
import { MssqlProvider } from '../integration/mssql.provider';
import { AttendanceSourceProvider } from '../integration/source-provider.interface';
import { inferDirection, normalizePunchAt } from '../integration/punch-time.util';
import { RecomputeService } from '../engine/recompute.service';

export interface SyncResult {
  sourceId: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  imported: number;
  skipped: number;
  fromRecordId: number;
  toRecordId: number;
  error?: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  // In-process lock: prevents overlapping runs of the same source (manual + cron).
  private readonly running = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private sources: SourcesService,
    private mssql: MssqlProvider,
    private recompute: RecomputeService,
  ) {}

  private providerFor(driver: string): AttendanceSourceProvider {
    return this.mssql; // single driver today; extend in lock-step with SourcesService
  }

  isRunning(sourceId: string): boolean {
    return this.running.has(sourceId);
  }

  /**
   * Reset the cursor to the source's initial RecordID and re-read everything.
   * Use when the cursor advanced but RawAttendanceRecord is empty/incomplete.
   * Existing rows are skipped (unique constraint), so it is safe to re-run.
   */
  async fullResync(sourceId: string): Promise<SyncResult> {
    const src = await this.prisma.attendanceSource.findUnique({ where: { id: sourceId } });
    if (!src) throw new Error('منبع حضور یافت نشد');
    await this.prisma.attendanceSource.update({
      where: { id: sourceId },
      data: { lastRecordId: src.initialRecordId ?? 0 },
    });
    return this.runSource(sourceId, 'manual');
  }

  /**
   * Incremental sync of a single source. Reads rows with RecordID greater than
   * the stored cursor in batches, imports them into RawAttendanceRecord
   * (duplicates silently skipped via the unique constraint), advances the
   * cursor only on success, and writes an audit row to AttendanceSyncLog.
   * Records are never lost: a failure mid-run leaves the cursor at the last
   * fully-committed batch so the next run resumes from there.
   */
  async runSource(sourceId: string, trigger: 'scheduled' | 'manual'): Promise<SyncResult> {
    if (this.running.has(sourceId)) {
      return {
        sourceId,
        status: 'PARTIAL',
        imported: 0,
        skipped: 0,
        fromRecordId: 0,
        toRecordId: 0,
        error: 'یک همگام‌سازی برای این منبع در حال اجراست',
      };
    }
    this.running.add(sourceId);

    const source = await this.prisma.attendanceSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      this.running.delete(sourceId);
      throw new Error('منبع حضور یافت نشد');
    }

    const startCursor = source.lastRecordId;
    const log = await this.prisma.attendanceSyncLog.create({
      data: {
        sourceId,
        status: 'RUNNING',
        trigger,
        fromRecordId: startCursor,
        toRecordId: startCursor,
      },
    });

    const cfg = await this.sources.getConnectionConfig(sourceId);
    const provider = this.providerFor(cfg.driver);
    const maxAttempts = source.autoRetry ? Math.max(1, source.retryCount + 1) : 1;

    let cursor = startCursor;
    let imported = 0;
    let skipped = 0;
    let lastError: string | undefined;
    // Mapped punches accumulated across batches → recomputed into AttendanceDay
    // after the import drains.
    const affected: Array<{ userId: string | null; punchAt: Date }> = [];

    try {
      // Drain in batches until a short read (fewer rows than batchSize).
      // Per-batch retry guards against transient SQL Server hiccups.
      while (true) {
        let rows;
        let attempt = 0;
        while (true) {
          try {
            rows = await provider.fetchSince(cfg, cursor, source.batchSize);
            break;
          } catch (e: any) {
            attempt++;
            lastError = e.message;
            if (attempt >= maxAttempts) throw e;
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }

        if (!rows.length) break;

        const cardNos = [...new Set(rows.map((r) => r.cardNo).filter(Boolean))];
        const users = await this.prisma.user.findMany({
          where: { attendanceCardNo: { in: cardNos } },
          select: { id: true, attendanceCardNo: true },
        });
        const cardToUser = new Map(users.map((u) => [u.attendanceCardNo!, u.id]));

        const data: Prisma.RawAttendanceRecordCreateManyInput[] = rows.map((r) => ({
          sourceId,
          recordId: r.recordId,
          cardNo: r.cardNo,
          mDate: r.mDate ?? null,
          sDate: r.sDate ?? null,
          rTime: r.rTime ?? null,
          rType: r.rType ?? null,
          deviceCode: r.deviceCode ?? null,
          punchAt: normalizePunchAt(r, cfg.timeZone),
          userId: cardToUser.get(r.cardNo) ?? null,
        }));

        // skipDuplicates → re-imported RecordIDs are ignored, never erroring.
        const res = await this.prisma.rawAttendanceRecord.createMany({
          data,
          skipDuplicates: true,
        });
        imported += res.count;
        skipped += rows.length - res.count;
        for (const d of data) if (d.userId) affected.push({ userId: d.userId, punchAt: d.punchAt as Date });

        // Touch device last-seen + auto-register unseen device codes.
        await this.touchDevices(sourceId, rows);

        cursor = Math.max(cursor, ...rows.map((r) => r.recordId));
        // Persist the cursor after every committed batch (resumable on crash).
        await this.prisma.attendanceSource.update({
          where: { id: sourceId },
          data: { lastRecordId: cursor, lastSyncAt: new Date() },
        });

        if (rows.length < source.batchSize) break; // drained
      }

      // Recompute the AttendanceDay rows touched by this import. Failures here
      // are logged inside the service and must not fail the sync itself.
      if (affected.length) {
        const days = await this.recompute.recomputeForRawRows(affected);
        this.logger.log(`Recomputed ${days} attendance day(s) after sync ${sourceId}`);
      }

      await this.prisma.attendanceSource.update({
        where: { id: sourceId },
        data: { lastSyncAt: new Date(), lastSuccessAt: new Date(), lastError: null },
      });
      await this.prisma.attendanceSyncLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          toRecordId: cursor,
          imported,
          skipped,
          finishedAt: new Date(),
        },
      });

      this.logger.log(`Sync ${sourceId} OK: +${imported} (skip ${skipped}) cursor=${cursor}`);
      return { sourceId, status: 'SUCCESS', imported, skipped, fromRecordId: startCursor, toRecordId: cursor };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await this.prisma.attendanceSource.update({
        where: { id: sourceId },
        data: { lastFailureAt: new Date(), lastError: msg },
      });
      await this.prisma.attendanceSyncLog.update({
        where: { id: log.id },
        data: {
          status: imported > 0 ? 'PARTIAL' : 'FAILED',
          toRecordId: cursor,
          imported,
          skipped,
          errorDetail: msg,
          finishedAt: new Date(),
        },
      });
      this.logger.error(`Sync ${sourceId} failed: ${msg}`);
      return {
        sourceId,
        status: imported > 0 ? 'PARTIAL' : 'FAILED',
        imported,
        skipped,
        fromRecordId: startCursor,
        toRecordId: cursor,
        error: msg,
      };
    } finally {
      this.running.delete(sourceId);
    }
  }

  private async touchDevices(sourceId: string, rows: { deviceCode?: string | null; rType?: string | null }[]) {
    const codes = [...new Set(rows.map((r) => r.deviceCode).filter(Boolean))] as string[];
    for (const code of codes) {
      const hint = inferDirection(rows.find((r) => r.deviceCode === code)?.rType);
      await this.prisma.attendanceDevice.upsert({
        where: { sourceId_deviceCode: { sourceId, deviceCode: code } },
        create: {
          sourceId,
          deviceCode: code,
          name: `دستگاه ${code}`,
          direction: hint,
          lastSeenAt: new Date(),
        },
        update: { lastSeenAt: new Date() },
      });
    }
  }

  async getStatus() {
    const sources = await this.prisma.attendanceSource.findMany({ orderBy: { createdAt: 'asc' } });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      syncEnabled: s.syncEnabled,
      lastRecordId: s.lastRecordId,
      lastSyncAt: s.lastSyncAt,
      lastSuccessAt: s.lastSuccessAt,
      lastFailureAt: s.lastFailureAt,
      lastError: s.lastError,
      running: this.running.has(s.id),
    }));
  }

  async getLogs(sourceId?: string, take = 50) {
    return this.prisma.attendanceSyncLog.findMany({
      where: sourceId ? { sourceId } : undefined,
      orderBy: { startedAt: 'desc' },
      take,
    });
  }
}
