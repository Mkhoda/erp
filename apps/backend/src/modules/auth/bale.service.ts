import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

interface BaleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

@Injectable()
export class BaleService {
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  private get verbose() {
    const v = this.config.get<string>('LOG_BALE_VERBOSE') || '';
    return v.toLowerCase() === 'true' || v === '1';
  }

  private get isMock() {
    const v = this.config.get<string>('BALE_MOCK') || '';
    return v.toLowerCase() === 'true' || v === '1';
  }

  private maskPhone(p: string) {
    if (!p) return p;
    // keep prefix and last 2
    return p.replace(/(\d{4})(\d+)(\d{2})/, (_, a: string, mid: string, c: string) => a + '*'.repeat(mid.length) + c);
  }

  private get clientId() {
    if (this.isMock) {
      // In mock mode, bypass validation
      return 'mock';
    }
    const v = this.config.get<string>('BALE_CLIENT_ID');
    if (!v) throw new InternalServerErrorException('BALE_CLIENT_ID is not set');
    return v;
  }
  private get clientSecret() {
    if (this.isMock) {
      return 'mock';
    }
    const v = this.config.get<string>('BALE_CLIENT_SECRET');
    if (!v) throw new InternalServerErrorException('BALE_CLIENT_SECRET is not set');
    return v;
  }

  private now() {
    return Math.floor(Date.now() / 1000);
  }

  async getAccessToken(): Promise<string> {
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt - 30 > this.now() &&
      this.cachedToken.token
    ) {
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log('[BALE] Using cached access token');
      }
      return this.cachedToken.token;
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.clientId || '');
      params.append('client_secret', this.clientSecret || '');
  params.append('scope', 'read');

      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log('[BALE] Requesting access token from https://safir.bale.ai/api/v2/auth/token');
      }
      const { data, status } = await firstValueFrom<AxiosResponse<BaleTokenResponse>>(
        this.http.post<BaleTokenResponse>(
          'https://safir.bale.ai/api/v2/auth/token',
          params.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        )
      );
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log(`[BALE] Token response status: ${status}, expires_in: ${data?.expires_in ?? 'n/a'}`);
      }

      // Bale tokens typically last up to ~12 hours; honor API's expires_in, fallback to 12h
      const ttl = data.expires_in ?? 12 * 60 * 60;
      this.cachedToken = {
        token: data.access_token,
        expiresAt: this.now() + ttl,
      };
      return data.access_token;
    } catch (e) {
      // Try to surface HTTP error details if available
      // eslint-disable-next-line no-console
      console.error('[BALE] Failed to get access token', (e as any)?.response?.status, (e as any)?.response?.data ?? (e as any)?.message);
      throw new InternalServerErrorException('Failed to get Bale access token');
    }
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    // In mock mode, skip external call (useful for local testing without Bale access)
    if (this.isMock) {
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log(`[BALE_MOCK] Skipping external send. Would send OTP ${otp} to ${this.maskPhone(phone)}`);
      }
      return;
    }
    let token = await this.getAccessToken();
    const doSend = async (bearer: string) =>
      firstValueFrom(
        this.http.post(
          'https://safir.bale.ai/api/v2/send_otp',
          { phone, otp: Number(otp) },
          { headers: { Authorization: `Bearer ${bearer}` } }
        )
      );

    try {
      const res = await doSend(token);
      // eslint-disable-next-line no-console
      console.log(`[BALE] OTP sent successfully to ${this.maskPhone(phone)} (status ${res.status})`);
      if (this.verbose) {
        try {
          // The Bale API returns balance on success
          const body = (res as any).data;
          // eslint-disable-next-line no-console
          console.log('[BALE] send_otp response body:', JSON.stringify(body));
        } catch {}
      }
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log('[BALE] Response headers:', JSON.stringify(res.headers || {}, null, 2));
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.error('[BALE] send_otp failed', status, err?.response?.data || err?.message);
      }
      // If token expired/invalid (401/403), refresh and retry once
      if (status === 401 || status === 403) {
        this.cachedToken = null;
        token = await this.getAccessToken();
        try {
          const res2 = await doSend(token);
          // eslint-disable-next-line no-console
          console.log(`[BALE] OTP sent successfully to ${this.maskPhone(phone)} after token refresh (status ${res2.status})`);
          return;
        } catch (e2) {
          if (this.verbose) {
            // eslint-disable-next-line no-console
            console.error('[BALE] send_otp failed after token refresh', (e2 as any)?.response?.status, (e2 as any)?.response?.data || (e2 as any)?.message);
          }
          throw new InternalServerErrorException('Failed to send OTP via Bale (after refresh)');
        }
      }
      throw new InternalServerErrorException('Failed to send OTP via Bale');
    }
  }
}
