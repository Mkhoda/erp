import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/** Well-known default base URLs for each provider type. */
const DEFAULT_URLS: Record<string, string> = {
  agnes: 'https://apihub.agnes-ai.com/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  custom: '',
};

export interface AiProviderDto {
  name: string;
  type: string;
  apiKey: string;
  apiUrl?: string;
  model?: string;
  isActive?: boolean;
  config?: Record<string, any>;
}

@Injectable()
export class AiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  /** List all configured providers (masks API keys). */
  async listAll() {
    const providers = await this.prisma.aiProvider.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return providers.map(p => ({
      ...p,
      apiKey: this.maskKey(p.apiKey),
    }));
  }

  /** Get a single provider by ID. */
  async getById(id: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    return { ...provider, apiKey: this.maskKey(provider.apiKey) };
  }

  /** Create or update a provider (upsert by type). */
  async upsert(dto: AiProviderDto) {
    const validTypes = ['agnes', 'openai', 'anthropic', 'gemini', 'deepseek', 'custom'];
    if (!validTypes.includes(dto.type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const existing = await this.prisma.aiProvider.findUnique({ where: { type: dto.type } });

    const data = {
      name: dto.name,
      type: dto.type,
      apiKey: dto.apiKey,
      apiUrl: dto.apiUrl || DEFAULT_URLS[dto.type] || null,
      model: dto.model || null,
      isActive: dto.isActive ?? true,
      config: dto.config ?? undefined,
    };

    let provider;
    if (existing) {
      provider = await this.prisma.aiProvider.update({
        where: { type: dto.type },
        data,
      });
    } else {
      provider = await this.prisma.aiProvider.create({ data });
    }

    return { ...provider, apiKey: this.maskKey(provider.apiKey) };
  }

  /** Delete a provider by type. */
  async remove(type: string) {
    const existing = await this.prisma.aiProvider.findUnique({ where: { type } });
    if (!existing) throw new NotFoundException('Provider not found');
    await this.prisma.aiProvider.delete({ where: { type } });
    return { ok: true };
  }

  /** Test connection to a provider's API. */
  async testConnection(type: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { type } });
    if (!provider) throw new NotFoundException('Provider not found');
    if (!provider.apiKey) throw new BadRequestException('API key not configured');

    const startTime = Date.now();

    try {
      const result = await this.callProviderApi(provider);
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        model: provider.model,
        provider: provider.name,
        details: result,
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        model: provider.model,
        provider: provider.name,
        error: err?.response?.data?.error?.message || err?.message || 'Connection failed',
        statusCode: err?.response?.status || null,
      };
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Make a lightweight API call to verify the provider is reachable and the key is valid. */
  private async callProviderApi(provider: any): Promise<any> {
    const baseUrl = provider.apiUrl || DEFAULT_URLS[provider.type] || '';

    switch (provider.type) {
      case 'agnes':
        return this.testAgnes(baseUrl, provider.apiKey, provider.model);
      case 'openai':
        return this.testOpenAI(baseUrl, provider.apiKey, provider.model);
      case 'anthropic':
        return this.testAnthropic(baseUrl, provider.apiKey, provider.model);
      case 'gemini':
        return this.testGemini(baseUrl, provider.apiKey, provider.model);
      case 'deepseek':
        return this.testDeepSeek(baseUrl, provider.apiKey, provider.model);
      default:
        return this.testCustom(baseUrl, provider.apiKey);
    }
  }

  private async testAgnes(baseUrl: string, apiKey: string, model?: string) {
    // Agnes is OpenAI-compatible — use /models endpoint
    const { data } = await firstValueFrom(
      this.http.get(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    const models = data?.data?.map((m: any) => m.id) || [];
    return {
      message: 'Connected successfully to Agnes AI',
      modelsAvailable: models.length,
      currentModel: model || 'agnes-2.0-flash',
      models: models.slice(0, 10),
    };
  }

  private async testOpenAI(baseUrl: string, apiKey: string, model?: string) {
    // Use /models endpoint to verify key works
    const { data } = await firstValueFrom(
      this.http.get(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    const models = data?.data?.map((m: any) => m.id) || [];
    return {
      message: 'Connected successfully',
      modelsAvailable: models.length,
      currentModel: model || 'not set',
    };
  }

  private async testAnthropic(baseUrl: string, apiKey: string, model?: string) {
    // Anthropic doesn't have a simple list endpoint; send a minimal message
    const { data } = await firstValueFrom(
      this.http.post(
        `${baseUrl}/messages`,
        {
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    return {
      message: 'Connected successfully',
      currentModel: model || 'claude-sonnet-4-20250514',
      response: data?.content?.[0]?.text?.substring(0, 50) || '',
    };
  }

  private async testGemini(baseUrl: string, apiKey: string, model?: string) {
    const m = model || 'gemini-pro';
    const { data } = await firstValueFrom(
      this.http.get(`${baseUrl}/models?key=${apiKey}`),
    );
    const models = data?.models || [];
    return {
      message: 'Connected successfully',
      modelsAvailable: models.length,
      currentModel: m,
    };
  }

  private async testDeepSeek(baseUrl: string, apiKey: string, model?: string) {
    // DeepSeek is OpenAI-compatible
    const { data } = await firstValueFrom(
      this.http.get(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    const models = data?.data?.map((m: any) => m.id) || [];
    return {
      message: 'Connected successfully',
      modelsAvailable: models.length,
      currentModel: model || 'not set',
    };
  }

  private async testCustom(baseUrl: string, apiKey: string) {
    if (!baseUrl) throw new BadRequestException('Custom API URL is required');
    const { data } = await firstValueFrom(
      this.http.get(baseUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    return { message: 'Connected successfully', response: JSON.stringify(data).substring(0, 200) };
  }

  private maskKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }
}
