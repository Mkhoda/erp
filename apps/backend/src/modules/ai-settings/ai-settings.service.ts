import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuotaService } from '../quota/quota.service';

const DEFAULT_URLS: Record<string, string> = {
  agnes:      'https://apihub.agnes-ai.com/v1',
  openai:     'https://api.openai.com/v1',
  anthropic:  'https://api.anthropic.com/v1',
  gemini:     'https://generativelanguage.googleapis.com/v1beta',
  deepseek:   'https://api.deepseek.com/v1',
  groq:       'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  custom:     '',
};

export const VALID_PROVIDER_TYPES = ['agnes', 'openai', 'anthropic', 'gemini', 'deepseek', 'groq', 'openrouter', 'custom'] as const;
export type ProviderType = typeof VALID_PROVIDER_TYPES[number];

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

  async listAll() {
    const providers = await this.prisma.aiProvider.findMany({ orderBy: { createdAt: 'asc' } });
    return providers.map(p => ({ ...p, apiKey: this.maskKey(p.apiKey) }));
  }

  async getById(id: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    return { ...provider, apiKey: this.maskKey(provider.apiKey) };
  }

  async create(dto: AiProviderDto) {
    this.validateType(dto.type);
    const provider = await this.prisma.aiProvider.create({
      data: {
        name:     dto.name,
        type:     dto.type,
        apiKey:   dto.apiKey,
        apiUrl:   dto.apiUrl || DEFAULT_URLS[dto.type] || null,
        model:    dto.model || null,
        isActive: dto.isActive ?? true,
        config:   dto.config ?? undefined,
      },
    });
    return { ...provider, apiKey: this.maskKey(provider.apiKey) };
  }

  async update(id: string, dto: Partial<AiProviderDto> & { apiKey?: string }) {
    const existing = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Provider not found');

    const provider = await this.prisma.aiProvider.update({
      where: { id },
      data: {
        ...(dto.name     !== undefined ? { name:     dto.name }     : {}),
        ...(dto.type     !== undefined ? { type:     dto.type }     : {}),
        ...(dto.apiUrl   !== undefined ? { apiUrl:   dto.apiUrl }   : {}),
        ...(dto.model    !== undefined ? { model:    dto.model }    : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.config   !== undefined ? { config:   dto.config }   : {}),
        // Only update apiKey if a real key is provided (not a masked placeholder)
        ...(dto.apiKey && !dto.apiKey.includes('****') ? { apiKey: dto.apiKey } : {}),
      },
    });
    return { ...provider, apiKey: this.maskKey(provider.apiKey) };
  }

  async remove(id: string) {
    const existing = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Provider not found');
    await this.prisma.aiProvider.delete({ where: { id } });
    return { ok: true };
  }

  async toggleProvider(id: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    return this.prisma.aiProvider.update({
      where: { id },
      data: { isActive: !provider.isActive },
      select: { id: true, type: true, isActive: true },
    });
  }

  async testConnection(id: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    if (!provider.apiKey) throw new BadRequestException('API key not configured');

    const startTime = Date.now();
    try {
      const result = await this.callProviderApi(provider);
      return { success: true, latencyMs: Date.now() - startTime, model: provider.model, provider: provider.name, details: result };
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

  async getActiveProviders() {
    return this.prisma.aiProvider.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, model: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Send a chat message — providerId selects the exact configured provider. */
  async chat(
    userId: string,
    providerId: string,
    messages: Array<{ role: string; content: string }>,
    safeMode = false,
  ) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException('Provider not found');
    if (!provider.isActive) throw new BadRequestException('این مدل هوش مصنوعی غیرفعال است');

    await this.quota.check(userId, provider.id);

    const startTime = Date.now();
    let content = '';
    let promptTokens = 0, completionTokens = 0, totalTokens = 0;
    let success = true, errorMsg: string | undefined, rawResponse: string | undefined;

    try {
      const result = await this.callChat(provider, messages, safeMode);
      content          = result.content;
      promptTokens     = result.promptTokens;
      completionTokens = result.completionTokens;
      totalTokens      = result.totalTokens || (promptTokens + completionTokens);
      if ((result as any).rawResponse) rawResponse = (result as any).rawResponse;
    } catch (err: any) {
      success   = false;
      errorMsg  = err?.response?.data?.error?.message || err?.message || 'خطای ناشناخته';
      rawResponse = JSON.stringify(err?.response?.data || err?.message || '').substring(0, 1000);
      console.error(`[AI Chat ERROR] provider=${provider.name} type=${provider.type} model=${provider.model} status=${err?.response?.status} msg=${errorMsg}`);
      content = `⚠️ خطا در دریافت پاسخ از ${provider.name}: ${errorMsg}`;
    }

    const latencyMs = Date.now() - startTime;
    const lastPrompt = [...messages].reverse().find(m => m.role === 'user')?.content || '';

    if (totalTokens > 0) this.quota.increment(userId, provider.id, totalTokens).catch(() => {});

    await this.prisma.aiUsage.create({
      data: {
        userId,
        providerType: provider.type,
        providerName: provider.name,
        model:        provider.model || undefined,
        prompt:       lastPrompt.substring(0, 1000),
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        success,
        errorMsg,
        rawResponse,
      },
    });

    return { content, providerId: provider.id, providerType: provider.type, providerName: provider.name, model: provider.model, latencyMs, success, errorMsg };
  }

  async getUsage(userId?: string, providerType?: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.aiUsage.findMany({
      where: {
        ...(userId       ? { userId }       : {}),
        ...(providerType ? { providerType } : {}),
        createdAt: { gte: since },
      },
      include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async getUserUsageBreakdown(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.aiUsage.findMany({
      where: { createdAt: { gte: since } },
      include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } },
    });

    const map = new Map<string, {
      userId: string; user: any;
      totalTokens: number; promptTokens: number; completionTokens: number;
      totalRequests: number; successCount: number;
      providers: Set<string>;
    }>();

    for (const r of rows) {
      if (!map.has(r.userId)) {
        map.set(r.userId, { userId: r.userId, user: r.user, totalTokens: 0, promptTokens: 0, completionTokens: 0, totalRequests: 0, successCount: 0, providers: new Set() });
      }
      const e = map.get(r.userId)!;
      e.totalTokens      += r.totalTokens;
      e.promptTokens     += r.promptTokens;
      e.completionTokens += r.completionTokens;
      e.totalRequests    += 1;
      if (r.success) e.successCount += 1;
      e.providers.add(r.providerName || r.providerType);
    }

    return Array.from(map.values())
      .map(e => ({ ...e, providers: Array.from(e.providers) }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private validateType(type: string) {
    if (!(VALID_PROVIDER_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(`نوع نامعتبر. باید یکی از: ${VALID_PROVIDER_TYPES.join(', ')} باشد`);
    }
  }

  private async callProviderApi(provider: any): Promise<any> {
    const baseUrl = provider.apiUrl || DEFAULT_URLS[provider.type] || '';
    switch (provider.type) {
      case 'agnes':     return this.testAgnes(baseUrl, provider.apiKey, provider.model);
      case 'openai':    return this.testOpenAI(baseUrl, provider.apiKey, provider.model);
      case 'anthropic': return this.testAnthropic(baseUrl, provider.apiKey, provider.model);
      case 'gemini':    return this.testGemini(baseUrl, provider.apiKey, provider.model);
      case 'deepseek':  return this.testDeepSeek(baseUrl, provider.apiKey, provider.model);
      default:          return this.testCustom(baseUrl, provider.apiKey);
    }
  }

  private async testAgnes(baseUrl: string, apiKey: string, model?: string) {
    const { data } = await firstValueFrom(this.http.get(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } }));
    const models = data?.data?.map((m: any) => m.id) || [];
    return { message: 'Connected successfully to Agnes AI', modelsAvailable: models.length, currentModel: model || 'agnes-2.0-flash', models: models.slice(0, 10) };
  }

  private async testOpenAI(baseUrl: string, apiKey: string, model?: string) {
    const { data } = await firstValueFrom(this.http.get(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } }));
    const models = data?.data?.map((m: any) => m.id) || [];
    return { message: 'Connected successfully', modelsAvailable: models.length, currentModel: model || 'not set' };
  }

  private async testAnthropic(baseUrl: string, apiKey: string, model?: string) {
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/messages`,
      { model: model || 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } },
    ));
    return { message: 'Connected successfully', currentModel: model || 'claude-sonnet-4-20250514', response: data?.content?.[0]?.text?.substring(0, 50) || '' };
  }

  private async testGemini(baseUrl: string, apiKey: string, model?: string) {
    const { data } = await firstValueFrom(this.http.get(`${baseUrl}/models?key=${apiKey}`));
    return { message: 'Connected successfully', modelsAvailable: (data?.models || []).length, currentModel: model || 'gemini-pro' };
  }

  private async testDeepSeek(baseUrl: string, apiKey: string, model?: string) {
    const { data } = await firstValueFrom(this.http.get(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } }));
    const models = data?.data?.map((m: any) => m.id) || [];
    return { message: 'Connected successfully', modelsAvailable: models.length, currentModel: model || 'not set' };
  }

  private async testCustom(baseUrl: string, apiKey: string) {
    if (!baseUrl) throw new BadRequestException('Custom API URL is required');
    const { data } = await firstValueFrom(this.http.get(baseUrl, { headers: { Authorization: `Bearer ${apiKey}` } }));
    return { message: 'Connected successfully', response: JSON.stringify(data).substring(0, 200) };
  }

  private async callChat(provider: any, messages: Array<{ role: string; content: string }>, safeMode: boolean) {
    const baseUrl = provider.apiUrl || DEFAULT_URLS[provider.type] || '';
    switch (provider.type) {
      case 'anthropic':  return this.chatAnthropic(baseUrl, provider.apiKey, provider.model, messages, safeMode);
      case 'gemini':     return this.chatGemini(baseUrl, provider.apiKey, provider.model, messages, safeMode);
      case 'agnes':      return this.chatOpenAI(baseUrl, provider.apiKey, provider.model, messages, safeMode, true);
      case 'openrouter': return this.chatOpenRouter(baseUrl, provider.apiKey, provider.model, messages, safeMode);
      default:           return this.chatOpenAI(baseUrl, provider.apiKey, provider.model, messages, safeMode);
    }
  }

  private async chatOpenAI(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean, isAgnes = false) {
    let finalMessages: any[];
    if (safeMode && isAgnes) {
      finalMessages = [
        { role: 'user',      content: 'You are a helpful, safe, and professional assistant. Respond in the same language as the user.' },
        { role: 'assistant', content: 'Understood. I will be helpful and respond in the same language.' },
        ...messages,
      ];
    } else if (safeMode) {
      finalMessages = [{ role: 'system', content: 'You are a helpful, safe, and professional assistant. Respond in the same language as the user. Avoid harmful content.' }, ...messages];
    } else {
      finalMessages = messages;
    }
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/chat/completions`,
      { model: model || 'gpt-4o-mini', messages: finalMessages, temperature: safeMode ? 0.3 : 0.7, max_tokens: 2048, stream: false },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 },
    ));
    const rawContent = data.choices?.[0]?.message?.content;
    let content = '';
    if (typeof rawContent === 'string')       content = rawContent;
    else if (Array.isArray(rawContent))        content = rawContent.filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('');
    else if (data.choices?.[0]?.text)          content = data.choices[0].text;

    const rawResponse = content ? null : JSON.stringify(data).substring(0, 1000);
    if (!content) console.warn('[AI Chat] Empty content from provider. Raw:', JSON.stringify(data).substring(0, 500));
    return { content, promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0, rawResponse };
  }

  private async chatAnthropic(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean) {
    const sysPrompt = safeMode ? 'You are a helpful, safe, and professional assistant. Respond in the same language as the user. Avoid harmful content.' : '';
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/messages`,
      {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        ...(sysPrompt ? { system: sysPrompt } : {}),
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } },
    ));
    return { content: data.content?.[0]?.text || '', promptTokens: data.usage?.input_tokens || 0, completionTokens: data.usage?.output_tokens || 0, totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) };
  }

  private async chatGemini(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean) {
    const m = model || 'gemini-pro';
    const contents = messages.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }));
    const safetySetting = safeMode
      ? ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT'].map(c => ({ category: c, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }))
      : [];
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/models/${m}:generateContent?key=${apiKey}`,
      { contents, generationConfig: { temperature: safeMode ? 0.3 : 0.7, maxOutputTokens: 2048 }, safetySettings: safetySetting },
    ));
    const usage = data.usageMetadata;
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', promptTokens: usage?.promptTokenCount || 0, completionTokens: usage?.candidatesTokenCount || 0, totalTokens: usage?.totalTokenCount || 0 };
  }

  private async chatOpenRouter(baseUrl: string, apiKey: string, model: string | null, messages: any[], safeMode: boolean) {
    const sys = safeMode ? [{ role: 'system', content: 'You are a helpful, safe, and professional assistant. Respond in the same language as the user.' }] : [];
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/chat/completions`,
      { model: model || 'openai/gpt-4o-mini', messages: [...sys, ...messages], max_tokens: 2048, stream: false },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://erp.arzesh.net', 'X-Title': 'Arzesh ERP' }, timeout: 30000 },
    ));
    const rawContent = data.choices?.[0]?.message?.content;
    return { content: typeof rawContent === 'string' ? rawContent : '', promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 };
  }

  private maskKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }
}
