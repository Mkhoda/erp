import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { SystemSettingsService } from '../system-settings/system-settings.service';

/**
 * Bale Safir v3 API service for sending OTP messages.
 *
 * Reads BALE_SAFIR_API_KEY and BALE_BOT_ID from SystemSettings (DB) first,
 * falling back to environment variables for initial bootstrap.
 */
@Injectable()
export class BaleService {
  private readonly logger = new Logger(BaleService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  // ─── Config helpers ────────────────────────────────────────────────

  private get verbose(): boolean {
    const v = this.config.get<string>('LOG_BALE_VERBOSE') || '';
    return v === 'true' || v === '1';
  }

  /** Resolve settings: DB values take priority, env vars are the fallback. */
  private async resolveSettings(): Promise<{ isMock: boolean; apiKey: string; botId: number }> {
    const db = await this.systemSettings.get();

    const isMock =
      db.baleMock ||
      (this.config.get<string>('BALE_MOCK') || '') === 'true' ||
      (this.config.get<string>('BALE_MOCK') || '') === '1';

    if (isMock) return { isMock: true, apiKey: 'mock', botId: 0 };

    // API key: DB → env
    const apiKey =
      db.baleSafirApiKey ||
      this.config.get<string>('BALE_SAFIR_API_KEY') ||
      this.config.get<string>('BALE_API_KEY') ||
      this.config.get<string>('BALE_CLIENT_ID') ||
      '';
    if (!apiKey) throw new InternalServerErrorException('BALE_SAFIR_API_KEY is not configured (set it in DB settings or .env)');

    // Bot ID: DB → env → extract from BALE_API_KEY
    let botId = 0;
    if (db.baleBotId) {
      botId = Number(db.baleBotId);
    } else {
      const envBotId = this.config.get<string>('BALE_BOT_ID');
      if (envBotId) {
        botId = Number(envBotId);
      } else {
        const apiKeyEnv = this.config.get<string>('BALE_API_KEY') || '';
        if (apiKeyEnv.includes(':')) {
          botId = Number(apiKeyEnv.split(':')[0]);
        }
      }
    }
    if (!botId) throw new InternalServerErrorException('BALE_BOT_ID is not configured (set it in DB settings or .env)');

    return { isMock: false, apiKey, botId };
  }

  private maskPhone(p: string): string {
    if (!p) return p;
    return p.replace(/(\d{4})(\d+)(\d{2})/, (_, a: string, mid: string, c: string) =>
      a + '*'.repeat(mid.length) + c,
    );
  }

  private generateRequestId(): string {
    return crypto.randomUUID();
  }

  // ─── Send OTP ──────────────────────────────────────────────────────

  /**
   * Send a one-time password via Bale Safir v3 OTP message.
   *
   * Phone number MUST be in `98XXXXXXXXXX` format (the auth.service already
   * normalizes it this way).
   *
   * @see https://docs.bale.ai/safir#ارسال-پیام-رمز-یکبار-مصرف
   */
  async sendOtp(phone: string, otp: string): Promise<void> {
    const { isMock, apiKey, botId } = await this.resolveSettings();

    if (isMock) {
      this.logger.log(`[MOCK] Would send OTP ${otp} to ${this.maskPhone(phone)}`);
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('98') || normalizedPhone.length !== 12) {
      this.logger.warn(`[BALE] Phone ${this.maskPhone(phone)} may not be in 98XXXXXXXXXX format`);
    }

    const requestId = this.generateRequestId();
    const payload = {
      request_id: requestId,
      bot_id: botId,
      phone_number: normalizedPhone,
      message_data: { otp_message: { otp } },
    };

    if (this.verbose) {
      this.logger.log(`[BALE] Sending OTP → ${SafirBase}/send_message  bot_id=${botId} phone=${this.maskPhone(normalizedPhone)}`);
    }

    try {
      const res = await firstValueFrom(
        this.http.post(`${SafirBase}/send_message`, payload, {
          headers: { 'api-access-key': apiKey, 'Content-Type': 'application/json' },
        }),
      );
      this.logger.log(`[BALE] OTP sent to ${this.maskPhone(normalizedPhone)} (HTTP ${res.status})`);
      if (this.verbose) this.logger.log(`[BALE] Response: ${JSON.stringify(res.data)}`);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      this.logger.error(`[BALE] send_message failed (HTTP ${status}): ${JSON.stringify(data || err?.message)}`);
      if (data?.error_data?.length) {
        const e = data.error_data[0];
        this.logger.error(`[BALE] code=${e.code}: ${e.description}`);
      }
      const hint =
        status === 403 ? ' — api-access-key نادرست است. از پنل بیل → تنظیمات Safir دریافت کنید.' :
        status === 401 ? ' — احراز هویت ناموفق بود.' : '';
      throw new InternalServerErrorException(
        `خطا در ارسال OTP از طریق بیل: ${data?.error_data?.[0]?.description || err?.message || 'خطای ناشناخته'}${hint}`,
      );
    }
  }
}

// Avoid referencing static property in decorator context
const SafirBase = 'https://safir.bale.ai/api/v3';
