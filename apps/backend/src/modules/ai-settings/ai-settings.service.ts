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
  ollama:     'http://192.168.30.13:11434/v1',
  whisper:    'http://192.168.30.13:8001',
  custom:     '',
};

const SAFE_MODE_PROMPT = 'You are a helpful, safe, and professional assistant. Respond in the same language as the user. Avoid harmful content.';

export const VALID_PROVIDER_TYPES = ['agnes', 'openai', 'anthropic', 'gemini', 'deepseek', 'groq', 'openrouter', 'ollama', 'whisper', 'custom'] as const;
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

  /** Transcribe audio using the configured Whisper provider. */
  async transcribe(
    userId: string,
    audioFile: { buffer: Buffer; originalname: string; mimetype: string },
    language = 'fa',
  ) {
    const provider = await this.prisma.aiProvider.findFirst({
      where: { type: 'whisper', isActive: true },
    });
    if (!provider) throw new NotFoundException('سرویس تبدیل صدا به متن (Whisper) تنظیم یا فعال نشده');

    const whisperUrl = provider.apiUrl || DEFAULT_URLS['whisper'];
    const startTime = Date.now();

    try {
      // Use Node 18+ built-in FormData (no extra package needed)
      const form = new globalThis.FormData();
      const blob = new Blob([audioFile.buffer as unknown as ArrayBuffer], { type: audioFile.mimetype || 'audio/wav' });
      form.append('audio_file', blob, audioFile.originalname || 'audio.wav');

      const { data } = await firstValueFrom(
        this.http.post(`${whisperUrl}/asr`, form, {
          params: { language, output: 'json', vad_filter: 'true' },
          timeout: 120000,
          maxContentLength: 50 * 1024 * 1024,
          maxBodyLength: 50 * 1024 * 1024,
        }),
      );

      const text: string = data?.text || '';
      const latencyMs = Date.now() - startTime;

      await this.prisma.aiUsage.create({
        data: {
          userId,
          providerType: 'whisper',
          providerName: provider.name,
          model: 'whisper',
          prompt: `[audio:${audioFile.originalname}]`,
          promptTokens: 0,
          completionTokens: text.length,
          totalTokens: 0,
          latencyMs,
          success: true,
        },
      });

      return { text, language, latencyMs };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err?.response?.data?.detail || err?.message || 'Whisper transcription failed';

      await this.prisma.aiUsage.create({
        data: {
          userId,
          providerType: 'whisper',
          providerName: provider.name,
          model: 'whisper',
          prompt: `[audio:${audioFile.originalname}]`,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs,
          success: false,
          errorMsg,
        },
      });

      throw new BadRequestException(`خطا در تبدیل صدا به متن: ${errorMsg}`);
    }
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
      case 'ollama':    return this.testOllama(baseUrl, provider.model);
      case 'whisper':   return this.testWhisper(baseUrl);
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

  /**
   * Splits system instructions from the dialogue and cleans the dialogue so every
   * provider accepts it: drops empty turns, merges consecutive same-role turns
   * (e.g. a user message whose reply failed), and makes sure it starts with a user turn.
   */
  private prepareMessages(messages: Array<{ role: string; content: string }>, safeMode: boolean) {
    const systemParts: string[] = [];
    if (safeMode) systemParts.push(SAFE_MODE_PROMPT);
    const dialogue: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const m of messages || []) {
      const content = typeof m?.content === 'string' ? m.content.trim() : '';
      if (!content) continue;
      if (m.role === 'system') { systemParts.push(content); continue; }
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const last = dialogue[dialogue.length - 1];
      if (last && last.role === role) last.content += `\n\n${content}`;
      else dialogue.push({ role, content });
    }
    while (dialogue.length && dialogue[0].role !== 'user') dialogue.shift();
    return { system: systemParts.join('\n\n'), dialogue };
  }

  private async callChat(provider: any, messages: Array<{ role: string; content: string }>, safeMode: boolean) {
    const baseUrl = provider.apiUrl || DEFAULT_URLS[provider.type] || '';
    const { system, dialogue } = this.prepareMessages(messages, safeMode);
    switch (provider.type) {
      case 'anthropic':  return this.chatAnthropic(baseUrl, provider.apiKey, provider.model, system, dialogue);
      case 'gemini':     return this.chatGemini(baseUrl, provider.apiKey, provider.model, system, dialogue, safeMode);
      case 'agnes':      return this.chatOpenAI(baseUrl, provider.apiKey, provider.model, system, dialogue, safeMode, true);
      case 'openrouter': return this.chatOpenRouter(baseUrl, provider.apiKey, provider.model, system, dialogue);
      case 'ollama':     return this.chatOllama(baseUrl, provider.model, system, dialogue, safeMode, provider.config);
      default:           return this.chatOpenAI(baseUrl, provider.apiKey, provider.model, system, dialogue, safeMode);
    }
  }

  private async chatOpenAI(baseUrl: string, apiKey: string, model: string | null, system: string, messages: any[], safeMode: boolean, isAgnes = false) {
    let finalMessages: any[];
    if (!system) {
      finalMessages = messages;
    } else if (isAgnes) {
      // Agnes rejects the system role — pass instructions as an opening exchange instead
      finalMessages = [
        { role: 'user',      content: system },
        { role: 'assistant', content: 'متوجه شدم. طبق همین دستورالعمل‌ها و با در نظر گرفتن کل گفتگو پاسخ می‌دهم.' },
        ...messages,
      ];
    } else {
      finalMessages = [{ role: 'system', content: system }, ...messages];
    }
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/chat/completions`,
      { model: model || 'gpt-4o-mini', messages: finalMessages, temperature: safeMode ? 0.3 : 0.7, max_tokens: 2048, stream: false },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 90000 },
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

  /**
   * Ollama via its native /api/chat so we can raise num_ctx: the OpenAI-compatible
   * endpoint silently uses the model's small default window (2–4k tokens) and
   * drops the oldest turns — which made the assistant "forget" the conversation.
   * Override the window per provider with config `{ "numCtx": 16384 }`.
   */
  private async chatOllama(baseUrl: string, model: string | null, system: string, messages: any[], safeMode: boolean, config?: any) {
    const root = baseUrl.replace(/\/v1\/?$/, '');
    const numCtx = Number(config?.numCtx) > 0 ? Number(config.numCtx) : 8192;
    const { data } = await firstValueFrom(this.http.post(
      `${root}/api/chat`,
      {
        model: model || 'llama3',
        messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        stream: false,
        options: { num_ctx: numCtx, temperature: safeMode ? 0.3 : 0.7 },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 180000 },
    ));
    const content: string = data?.message?.content || '';
    const promptTokens = data?.prompt_eval_count || 0;
    const completionTokens = data?.eval_count || 0;
    if (!content) console.warn('[AI Chat] Empty content from Ollama. Raw:', JSON.stringify(data).substring(0, 500));
    return { content, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, rawResponse: content ? null : JSON.stringify(data).substring(0, 1000) };
  }

  private async chatAnthropic(baseUrl: string, apiKey: string, model: string | null, system: string, messages: any[]) {
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/messages`,
      {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        ...(system ? { system } : {}),
        messages,
      },
      { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 90000 },
    ));
    const content = (data.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('');
    return { content, promptTokens: data.usage?.input_tokens || 0, completionTokens: data.usage?.output_tokens || 0, totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) };
  }

  private async chatGemini(baseUrl: string, apiKey: string, model: string | null, system: string, messages: any[], safeMode: boolean) {
    const m = model || 'gemini-pro';
    const contents = messages.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }));
    const safetySetting = safeMode
      ? ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT'].map(c => ({ category: c, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }))
      : [];
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/models/${m}:generateContent?key=${apiKey}`,
      {
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: { temperature: safeMode ? 0.3 : 0.7, maxOutputTokens: 2048 },
        safetySettings: safetySetting,
      },
      { timeout: 90000 },
    ));
    const usage = data.usageMetadata;
    const content = (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
    return { content, promptTokens: usage?.promptTokenCount || 0, completionTokens: usage?.candidatesTokenCount || 0, totalTokens: usage?.totalTokenCount || 0 };
  }

  private async chatOpenRouter(baseUrl: string, apiKey: string, model: string | null, system: string, messages: any[]) {
    const sys = system ? [{ role: 'system', content: system }] : [];
    const { data } = await firstValueFrom(this.http.post(
      `${baseUrl}/chat/completions`,
      { model: model || 'openai/gpt-4o-mini', messages: [...sys, ...messages], max_tokens: 2048, stream: false },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://erp.arzesh.net', 'X-Title': 'Arzesh ERP' }, timeout: 90000 },
    ));
    const rawContent = data.choices?.[0]?.message?.content;
    return { content: typeof rawContent === 'string' ? rawContent : '', promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, totalTokens: data.usage?.total_tokens || 0 };
  }

  private async testOllama(baseUrl: string, model?: string) {
    // baseUrl is .../v1; tags endpoint is at the root port
    const ollamaRoot = baseUrl.replace(/\/v1\/?$/, '');
    const { data } = await firstValueFrom(this.http.get(`${ollamaRoot}/api/tags`, { timeout: 10000 }));
    const models = (data?.models || []).map((m: any) => m.name);
    return { message: 'Connected successfully to Ollama', modelsAvailable: models.length, currentModel: model || 'not set', models: models.slice(0, 10) };
  }

  private async testWhisper(baseUrl: string) {
    try {
      await firstValueFrom(this.http.get(`${baseUrl}/`, { timeout: 5000 }));
    } catch (err: any) {
      if (!err?.response?.status) throw err;
      // any HTTP response (even 404/405) means the service is reachable
    }
    return { message: 'Whisper service is reachable' };
  }

  private maskKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }
}
