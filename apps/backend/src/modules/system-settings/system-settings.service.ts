import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SystemSettingsData {
  baleSafirApiKey: string | null;
  baleBotId: string | null;
  baleMock: boolean;
}

@Injectable()
export class SystemSettingsService {
  private cache: SystemSettingsData | null = null;
  private cacheAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SystemSettingsData> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < this.CACHE_TTL_MS) return this.cache;

    const row = await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });

    this.cache = {
      baleSafirApiKey: row.baleSafirApiKey,
      baleBotId: row.baleBotId,
      baleMock: row.baleMock,
    };
    this.cacheAt = now;
    return this.cache;
  }

  invalidateCache() {
    this.cache = null;
  }

  async update(
    data: Partial<{ baleSafirApiKey: string; baleBotId: string; baleMock: boolean }>,
    adminId: string,
  ) {
    const updated = await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data, updatedById: adminId },
      update: { ...data, updatedById: adminId },
    });
    this.invalidateCache();
    return updated;
  }
}
