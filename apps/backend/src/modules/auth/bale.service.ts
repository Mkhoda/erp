import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

/**
 * Bale Safir v3 API service for sending OTP messages.
 *
 * Uses the Safir bulk-messaging API (v3) with simple api-access-key auth.
 * Reference: https://docs.bale.ai/safir
 *
 * Required env vars:
 *   BALE_BOT_ID        — numeric bot ID (e.g. "1016716104")
 *   BALE_SAFIR_API_KEY — api-access-key from Bale business panel
 *
 * Optional:
 *   BALE_MOCK          — "true" to skip real SMS (dev/testing)
 *   LOG_BALE_VERBOSE   — "true" for verbose logging
 */
@Injectable()
export class BaleService {
  private readonly logger = new Logger(BaleService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  // ─── Config helpers ────────────────────────────────────────────────

  private get verbose(): boolean {
    const v = this.config.get<string>('LOG_BALE_VERBOSE') || '';
    return v === 'true' || v === '1';
  }

  private get isMock(): boolean {
    const v = this.config.get<string>('BALE_MOCK') || '';
    return v === 'true' || v === '1';
  }

  /**
   * Numeric bot ID required by Safir v3.
   * Accepts BALE_BOT_ID, or falls back to extracting from BALE_API_KEY (format "botId:token").
   */
  private get botId(): number {
    if (this.isMock) return 0;

    // 1. Explicit BALE_BOT_ID
    const explicit = this.config.get<string>('BALE_BOT_ID');
    if (explicit) return Number(explicit);

    // 2. Extract from BALE_API_KEY ("1016716104:abc123..." → 1016716104)
    const apiKey = this.config.get<string>('BALE_API_KEY') || '';
    if (apiKey.includes(':')) {
      const id = Number(apiKey.split(':')[0]);
      if (id > 0) return id;
    }

    throw new InternalServerErrorException(
      'BALE_BOT_ID is not set and could not be extracted from BALE_API_KEY',
    );
  }

  /**
   * Safir v3 api-access-key.
   * Accepts BALE_SAFIR_API_KEY or falls back to BALE_CLIENT_ID (may be the same value).
   */
  private get apiKey(): string {
    if (this.isMock) return 'mock';

    const v =
      this.config.get<string>('BALE_SAFIR_API_KEY') ||
      this.config.get<string>('BALE_API_KEY') ||       // full bot token as last resort
      this.config.get<string>('BALE_CLIENT_ID') || '';
    if (!v) throw new InternalServerErrorException('BALE_SAFIR_API_KEY is not set');
    return v;
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
    if (this.isMock) {
      this.logger.log(
        `[MOCK] Would send OTP ${otp} to ${this.maskPhone(phone)}`,
      );
      return;
    }

    // Ensure phone is in correct Safir format (98XXXXXXXXXX)
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('98') || normalizedPhone.length !== 12) {
      this.logger.warn(
        `[BALE] Phone ${this.maskPhone(phone)} may not be in Safir format (expected 98XXXXXXXXXX)`,
      );
    }

    const requestId = this.generateRequestId();

    const payload = {
      request_id: requestId,
      bot_id: this.botId,
      phone_number: normalizedPhone,
      message_data: {
        otp_message: {
          otp: otp,
        },
      },
    };

    if (this.verbose) {
      this.logger.log(
        `[BALE] Sending OTP via Safir v3 → ${SafirBase}/send_message`,
      );
      this.logger.log(`[BALE] bot_id=${this.botId}, phone=${this.maskPhone(normalizedPhone)}, request_id=${requestId}`);
    }

    try {
      const res = await firstValueFrom(
        this.http.post(`${SafirBase}/send_message`, payload, {
          headers: {
            'api-access-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `[BALE] OTP sent to ${this.maskPhone(normalizedPhone)} (status ${res.status})`,
      );

      if (this.verbose) {
        this.logger.log(`[BALE] Response: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      this.logger.error(
        `[BALE] Safir v3 send_message failed (HTTP ${status}): ${JSON.stringify(data || err?.message)}`,
      );

      // Surface meaningful error details
      if (data?.error_data?.length) {
        const firstErr = data.error_data[0];
        this.logger.error(
          `[BALE] Error code ${firstErr.code}: ${firstErr.description} (phone: ${firstErr.phone_number})`,
        );
      }

      // Provide actionable guidance for common errors
      let hint = '';
      if (status === 403) {
        hint = ' — The api-access-key may be incorrect. Get it from Bale Business Panel → Safir settings.';
      } else if (status === 401) {
        hint = ' — Authentication failed. Check BALE_SAFIR_API_KEY in .env.';
      }

      throw new InternalServerErrorException(
        `Failed to send OTP via Bale Safir: ${data?.error_data?.[0]?.description || err?.message || 'unknown error'}${hint}`,
      );
    }
  }
}

// Avoid referencing static property in decorator context
const SafirBase = 'https://safir.bale.ai/api/v3';
