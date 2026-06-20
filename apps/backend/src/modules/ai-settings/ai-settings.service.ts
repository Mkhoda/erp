import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';
import { QuotaService } from '../quota/quota.service';

/** Well-known default base URLs for each provider type. */
const DEFAULT_URLS: Record<string, string> = {
  agnes: 'https://apihub.agnes-ai.com/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
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
    private readonly quota: QuotaService,
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
    const validTypes = ['agnes', 'openai', 'anthropic', 'gemini', 'deepseek', 'groq', 'openrouter', 'custom'];
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

  /** Return only active providers (safe for all authenticated users — no API keys). */
  async getActiveProviders() {
    return this.prisma.aiProvider.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, model: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Toggle isActive for a provider (admin only). */
  async toggleProvider(type: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { type } });
    if (!provider) throw new NotFoundException('Provider not found');
    return this.prisma.aiProvider.update({
      where: { type },
      data: { isActive: !provider.isActive },
      select: { id: true, type: true, isActive: true },
    });
  }

  /** Send a chat message to the selected provider and log usage. */
  async chat(
    userId: string,
    providerType: string,
    messages: Array<{ role: string; content: string }>,
    safeMode = false,
  ) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { type: providerType } });
    if (!provider) throw new NotFoundException('Provider not found');
    if (!provider.isActive) throw new BadRequestException('این مدل هوش مصنوعی غیرفعال است');

    // Quota enforcement
    await this.quota.check(userId, providerType);

    const startTime = Date.now();
    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let success = true;
    let errorMsg: string | undefined;
    let rawResponse: string | undefined;

    try {
      const result = await this.callChat(provider, messages, safeMode);
      content = result.content;
      promptTokens = result.promptTokens;
      completionTokens = result.completionTokens;
      totalTokens = result.totalTokens || (promptTokens + completionTokens);
      if ((result as any).rawResponse) rawResponse = (result as any).rawResponse;
    } catch (err: any) {
      success = false;
      errorMsg = err?.response?.data?.error?.message || err?.message || 'خطای ناشناخته';
      rawResponse = JSON.stringify(err?.response?.data || err?.message || '').substring(0, 1000);
      console.error(`[AI Chat ERROR] provider=${providerType} model=${provider.model} status=${err?.response?.status} msg=${errorMsg} raw=${rawResponse}`);
      content = `⚠️ خطا در دریافت پاسخ از ${provider.name}: ${errorMsg}`;
    }

    const latencyMs = Date.now() - startTime;
    const lastPrompt = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')?.content || '';

    // Increment quota usage (fire and forget — don't block response)
    if (totalTokens > 0) {
      this.quota.increment(userId, providerType, totalTokens).catch(() => {});
    }

    await this.prisma.aiUsage.create({
      data: {
        userId,
        providerType,
        model: provider.model || undefined,
        prompt: lastPrompt.substring(0, 1000),
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        success,
        errorMsg,
        rawResponse,
      },
    });

    return { content, providerType, model: provider.model, latencyMs, success, errorMsg };
  }

  // ── Chat adapters ────────────────────────────────────────────────────────────

  private async callChat(provider: any, messages: Array<{ role: string; content: string }>, safeMode: boolean) {
    const baseUrl = provider.apiUrl || DEFAULT_URLS[provider.type] || '';
    switch (provider.type) {
      case 'anthropic':
        return this.chatAnthropic(baseUrl, provider.apiKey, provider.model, messages, safeMode);
      case 'gemini':
        return this.chatGemini(baseUrl, provider.apiKey, provider.model, messages, safeMode);
      case 'agnes':
        return this.chatOpenAI(baseUrl, provider.apiKey, provider.model, messages, safeMode, true);
      case 'openrouter':
        return this.chatOpenRouter(baseUrl, provider.apiKey, provider.model, messages, safeMode);
      default:
        return this.chatOpenAI(baseUrl, provider.apiKey, provider.model, messages, safeMode);
    }
  }

  private async chatOpenAI(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean, isAgnes = false) {
    // Agnes AI doesn't support role:'system' — prepend safe prompt as a user/assistant pair instead
    let finalMessages: any[];
    if (safeMode && isAgnes) {
      finalMessages = [
        { role: 'user', content: 'You are a helpful, safe, and professional assistant. Respond in the same language as the user.' },
        { role: 'assistant', content: 'Understood. I will be helpful and respond in the same language.' },
        ...messages,
      ];
    } else if (safeMode) {
      finalMessages = [
        { role: 'system', content: 'You are a helpful, safe, and professional assistant. Respond in the same language as the user. Avoid harmful content.' },
        ...messages,
      ];
    } else {
      finalMessages = messages;
    }
    const { data } = await firstValueFrom(
      this.http.post(
        `${baseUrl}/chat/completions`,
        { model: model || 'gpt-4o-mini', messages: finalMessages, temperature: safeMode ? 0.3 : 0.7, max_tokens: 2048, stream: false },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 },
      ),
    );
    // Handle both string content and array content (some providers return [{type:'text',text:'...'}])
    const rawContent = data.choices?.[0]?.message?.content;
    let content = '';
    if (typeof rawContent === 'string') {
      content = rawContent;
    } else if (Array.isArray(rawContent)) {
      content = rawContent
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text || '')
        .join('');
    } else if (data.choices?.[0]?.text) {
      content = data.choices[0].text;
    }
    // Log raw response for debugging when content extraction fails
    const rawResponse = content ? null : JSON.stringify(data).substring(0, 1000);
    if (!content) {
      console.warn('[AI Chat] Empty content from OpenAI-compatible provider. Raw response:', JSON.stringify(data).substring(0, 500));
    }
    return {
      content,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
      rawResponse,
    };
  }

  private async chatAnthropic(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean) {
    const sysPrompt = safeMode ? 'You are a helpful, safe, and professional assistant. Respond in the same language as the user. Avoid harmful content.' : '';
    const { data } = await firstValueFrom(
      this.http.post(
        `${baseUrl}/messages`,
        {
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          ...(sysPrompt ? { system: sysPrompt } : {}),
          messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        },
        { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } },
      ),
    );
    return {
      content: data.content?.[0]?.text || '',
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  private async chatGemini(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean) {
    const m = model || 'gemini-pro';
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
    const safetySetting = safeMode
      ? ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT'].map(c => ({
          category: c, threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        }))
      : [];
    const { data } = await firstValueFrom(
      this.http.post(
        `${baseUrl}/models/${m}:generateContent?key=${apiKey}`,
        { contents, generationConfig: { temperature: safeMode ? 0.3 : 0.7, maxOutputTokens: 2048 }, safetySettings: safetySetting },
      ),
    );
    const usage = data.usageMetadata;
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
    };
  }

  /** Raw usage logs with optional filters. */
  async getUsage(userId?: string, providerType?: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.aiUsage.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(providerType ? { providerType } : {}),
        createdAt: { gte: since },
      },
      include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  /** Aggregated per-user token usage breakdown. */
  async getUserUsageBreakdown(days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.aiUsage.findMany({
      where: { createdAt: { gte: since } },
      include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } },
    });

    const map = new Map<string, {
      userId: string;
      user: any;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalRequests: number;
      successCount: number;
      providers: Set<string>;
    }>();

    for (const r of rows) {
      if (!map.has(r.userId)) {
        map.set(r.userId, {
          userId: r.userId,
          user: r.user,
          totalTokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalRequests: 0,
          successCount: 0,
          providers: new Set(),
        });
      }
      const entry = map.get(r.userId)!;
      entry.totalTokens += r.totalTokens;
      entry.promptTokens += r.promptTokens;
      entry.completionTokens += r.completionTokens;
      entry.totalRequests += 1;
      if (r.success) entry.successCount += 1;
      entry.providers.add(r.providerType);
    }

    return Array.from(map.values())
      .map(e => ({ ...e, providers: Array.from(e.providers) }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }

  private async chatOpenRouter(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean) {
    const sys = safeMode
      ? [{ role: 'system', content: 'You are a helpful, safe, and professional assistant. Respond in the same language as the user.' }]
      : [];
    const { data } = await firstValueFrom(
      this.http.post(
        `${baseUrl}/chat/completions`,
        { model: model || 'openai/gpt-4o-mini', messages: [...sys, ...messages], max_tokens: 2048, stream: false },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://erp.arzesh.net',
            'X-Title': 'Arzesh ERP',
          },
          timeout: 30000,
        },
      ),
    );
    const rawContent = data.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : '';
    return {
      content,
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    };
  }

  private maskKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }
}
