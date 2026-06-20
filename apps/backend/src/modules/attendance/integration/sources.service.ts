import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../crypto.util';
import { MssqlProvider } from './mssql.provider';
import {
  AttendanceSourceProvider,
  SourceConnectionConfig,
  TestConnectionResult,
} from './source-provider.interface';
import { UpsertDeviceDto, UpsertSourceDto } from '../dto/source.dto';

@Injectable()
export class SourcesService {
  constructor(
    private prisma: PrismaService,
    private readonly mssql: MssqlProvider,
  ) {}

  // Provider registry — keyed by driver. Add new drivers here.
  private providerFor(driver: string): AttendanceSourceProvider {
    switch (driver) {
      case 'mssql':
      default:
        return this.mssql;
    }
  }

  // Strip/replace the password before returning a source to the API.
  private mask<T extends { password?: string }>(src: T): T {
    return { ...src, password: src.password ? '********' : '' };
  }

  async findAll() {
    const rows = await this.prisma.attendanceSource.findMany({
      orderBy: { createdAt: 'asc' },
      include: { devices: { orderBy: { deviceCode: 'asc' } } },
    });
    return rows.map((r) => this.mask(r));
  }

  async findOne(id: string) {
    const src = await this.prisma.attendanceSource.findUnique({
      where: { id },
      include: { devices: { orderBy: { deviceCode: 'asc' } } },
    });
    if (!src) throw new NotFoundException('منبع حضور یافت نشد');
    return this.mask(src);
  }

  // Internal: full config with the password decrypted (never exposed via API).
  async getConnectionConfig(id: string): Promise<SourceConnectionConfig> {
    const src = await this.prisma.attendanceSource.findUnique({ where: { id } });
    if (!src) throw new NotFoundException('منبع حضور یافت نشد');
    return {
      driver: src.driver,
      host: src.host,
      port: src.port,
      database: src.database,
      username: src.username,
      password: decryptSecret(src.password),
      tableName: src.tableName,
      timeZone: src.timeZone,
    };
  }

  async create(dto: UpsertSourceDto) {
    const src = await this.prisma.attendanceSource.create({
      data: {
        name: dto.name,
        driver: dto.driver ?? 'mssql',
        host: dto.host,
        port: dto.port ?? 1433,
        database: dto.database,
        username: dto.username,
        password: encryptSecret(dto.password ?? ''),
        tableName: dto.tableName ?? 'dbo.TimeRecords',
        timeZone: dto.timeZone ?? 'Asia/Tehran',
        syncEnabled: dto.syncEnabled ?? false,
        syncIntervalSec: dto.syncIntervalSec ?? 300,
        batchSize: dto.batchSize ?? 1000,
        initialSyncDate: dto.initialSyncDate ? new Date(dto.initialSyncDate) : null,
        initialRecordId: dto.initialRecordId ?? 0,
        lastRecordId: dto.initialRecordId ?? 0, // start the cursor at the seed point
        autoRetry: dto.autoRetry ?? true,
        retryCount: dto.retryCount ?? 3,
      },
    });
    return this.mask(src);
  }

  async update(id: string, dto: UpsertSourceDto) {
    const existing = await this.prisma.attendanceSource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('منبع حضور یافت نشد');

    const data: any = {
      name: dto.name,
      driver: dto.driver ?? existing.driver,
      host: dto.host,
      port: dto.port ?? existing.port,
      database: dto.database,
      username: dto.username,
      tableName: dto.tableName ?? existing.tableName,
      timeZone: dto.timeZone ?? existing.timeZone,
      syncEnabled: dto.syncEnabled ?? existing.syncEnabled,
      syncIntervalSec: dto.syncIntervalSec ?? existing.syncIntervalSec,
      batchSize: dto.batchSize ?? existing.batchSize,
      autoRetry: dto.autoRetry ?? existing.autoRetry,
      retryCount: dto.retryCount ?? existing.retryCount,
    };
    // Only overwrite the password when a non-empty value is supplied.
    if (dto.password && dto.password !== '********') {
      data.password = encryptSecret(dto.password);
    }
    if (dto.initialSyncDate !== undefined) {
      data.initialSyncDate = dto.initialSyncDate ? new Date(dto.initialSyncDate) : null;
    }
    // Changing the seed RecordID also resets the cursor (admin re-seed).
    if (dto.initialRecordId !== undefined && dto.initialRecordId !== existing.initialRecordId) {
      data.initialRecordId = dto.initialRecordId;
      data.lastRecordId = dto.initialRecordId;
    }

    const src = await this.prisma.attendanceSource.update({ where: { id }, data });
    return this.mask(src);
  }

  async remove(id: string) {
    await this.prisma.attendanceSource.delete({ where: { id } });
    return { ok: true };
  }

  // Test a *saved* source (uses stored, decrypted password).
  async test(id: string): Promise<TestConnectionResult> {
    const cfg = await this.getConnectionConfig(id);
    return this.providerFor(cfg.driver).testConnection(cfg);
  }

  // Validate + test an *unsaved* dto (used by the settings form before saving).
  async validateAndTest(dto: UpsertSourceDto): Promise<TestConnectionResult> {
    if (!dto.host || !dto.database || !dto.username) {
      return { ok: false, message: 'هاست، نام پایگاه‌داده و نام کاربری الزامی است' };
    }
    const cfg: SourceConnectionConfig = {
      driver: dto.driver ?? 'mssql',
      host: dto.host,
      port: dto.port ?? 1433,
      database: dto.database,
      username: dto.username,
      password: dto.password ?? '',
      tableName: dto.tableName ?? 'dbo.TimeRecords',
      timeZone: dto.timeZone ?? 'Asia/Tehran',
    };
    return this.providerFor(cfg.driver).testConnection(cfg);
  }

  // ── Device mapping CRUD ──
  async listDevices(sourceId: string) {
    return this.prisma.attendanceDevice.findMany({
      where: { sourceId },
      orderBy: { deviceCode: 'asc' },
    });
  }

  async upsertDevice(sourceId: string, dto: UpsertDeviceDto) {
    return this.prisma.attendanceDevice.upsert({
      where: { sourceId_deviceCode: { sourceId, deviceCode: dto.deviceCode } },
      create: {
        sourceId,
        deviceCode: dto.deviceCode,
        name: dto.name,
        direction: (dto.direction as any) ?? 'UNKNOWN',
        isActive: dto.isActive ?? true,
      },
      update: {
        name: dto.name,
        direction: (dto.direction as any) ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async removeDevice(deviceId: string) {
    await this.prisma.attendanceDevice.delete({ where: { id: deviceId } });
    return { ok: true };
  }
}
