import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthSettingsData {
  accessTokenTtlSec: number;
  rememberMeTtlSec: number;
  idleTimeoutSec: number;
  maxSessionLifetimeSec: number;
  globalTokenVersion: number;
}

export interface UpdateAuthSettingsInput {
  accessTokenTtlSec?: number;
  rememberMeTtlSec?: number;
  idleTimeoutSec?: number;
  maxSessionLifetimeSec?: number;
}

@Injectable()
export class AuthSettingsService {
  private cache: AuthSettingsData | null = null;
  private cacheAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(private prisma: PrismaService) {}

  async get(): Promise<AuthSettingsData> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < this.CACHE_TTL_MS) return this.cache;

    const row = await this.prisma.authSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });

    this.cache = {
      accessTokenTtlSec: row.accessTokenTtlSec,
      rememberMeTtlSec: row.rememberMeTtlSec,
      idleTimeoutSec: row.idleTimeoutSec,
      maxSessionLifetimeSec: row.maxSessionLifetimeSec,
      globalTokenVersion: row.globalTokenVersion,
    };
    this.cacheAt = now;
    return this.cache;
  }

  async getRaw() {
    return this.prisma.authSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  invalidateCache() {
    this.cache = null;
  }

  // Update settings and increment global token version to force all tokens invalid.
  async update(data: UpdateAuthSettingsInput, adminId: string) {
    const updated = await this.prisma.authSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data, updatedById: adminId },
      update: { ...data, updatedById: adminId, globalTokenVersion: { increment: 1 } },
    });
    this.invalidateCache();
    return updated;
  }

  // Increment global token version without changing other settings.
  // Forces every currently valid token to be rejected immediately.
  async forceGlobalLogout(adminId: string) {
    const updated = await this.prisma.authSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', updatedById: adminId },
      update: { globalTokenVersion: { increment: 1 }, updatedById: adminId },
    });
    this.invalidateCache();
    return updated;
  }
}
