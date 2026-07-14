import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const SAFIR_URL = 'https://safir.bale.ai/api/v3/send_message';

export interface SystemSettingsData {
  orgName: string | null;
  baleSafirApiKey: string | null;
  baleBotId: string | null;
  baleMock: boolean;
}

export const DEFAULT_ORG_NAME = 'سامانه جامع ارزش';

@Injectable()
export class SystemSettingsService {
  private cache: SystemSettingsData | null = null;
  private cacheAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async get(): Promise<SystemSettingsData> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < this.CACHE_TTL_MS) return this.cache;

    const row = await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });

    this.cache = {
      orgName: row.orgName,
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

  /** Public, unauthenticated read of just the display name — safe to expose broadly. */
  async getOrgName(): Promise<string> {
    const { orgName } = await this.get();
    return orgName?.trim() || DEFAULT_ORG_NAME;
  }

  async update(
    data: Partial<{ orgName: string; baleSafirApiKey: string; baleBotId: string; baleMock: boolean }>,
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

  /** Send a test OTP via Bale Safir using current DB/env settings. */
  async testBale(phone: string, otp: string): Promise<{ ok: boolean; status?: number; data?: any }> {
    const settings = await this.get();

    const apiKey =
      settings.baleSafirApiKey ||
      this.config.get<string>('BALE_SAFIR_API_KEY') ||
      this.config.get<string>('BALE_API_KEY') || '';
    const botId = settings.baleBotId
      ? Number(settings.baleBotId)
      : Number(this.config.get<string>('BALE_BOT_ID') || '0');

    if (!apiKey || !botId) throw new InternalServerErrorException('BALE_SAFIR_API_KEY یا BALE_BOT_ID تنظیم نشده است');

    const normalizedPhone = phone.replace(/\D/g, '');

    try {
      const res = await firstValueFrom(
        this.http.post(SAFIR_URL, {
          bot_id: botId,
          phone_number: normalizedPhone,
          message_data: { otp_message: { otp } },
        }, {
          headers: { 'api-access-key': apiKey, 'Content-Type': 'application/json' },
        }),
      );
      return { ok: true, status: res.status, data: res.data };
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      return { ok: false, status, data };
    }
  }
}
