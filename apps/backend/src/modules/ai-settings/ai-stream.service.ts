import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { StringDecoder } from 'string_decoder';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../quota/quota.service';

export const DEFAULT_URLS: Record<string, string> = {
  agnes: 'https://apihub.agnes-ai.com/v1', openai: 'https://api.openai.com/v1', anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta', deepseek: 'https://api.deepseek.com/v1', groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1', ollama: 'http://192.168.30.13:11434/v1', whisper: 'http://192.168.30.13:8001', custom: '',
};
const SAFE_MODE_PROMPT = 'You are a helpful, safe, and professional assistant. Respond in the same language as the user. Avoid harmful content.';
// Providers whose chat endpoint speaks the OpenAI streaming (SSE) dialect
const STREAMING_TYPES = new Set(['openrouter', 'openai', 'groq', 'deepseek', 'custom', 'ollama']);
const MODELS_TTL_MS = 6 * 3600_000;
const FIRST_TOKEN_TIMEOUT_MS = 90_000;
const IDLE_TIMEOUT_MS = 120_000;

export type Part = { type: string; [k: string]: any };
export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string | Part[] };
export type Caps = { image: boolean; file: boolean; audio: boolean; video: boolean; reasoning: boolean; stream: boolean; contextLength: number | null; source: 'openrouter' | 'config' | 'heuristic' };
export type StreamResult = { content: string; reasoning: string; promptTokens: number; completionTokens: number; totalTokens: number; finishReason: string | null; aborted: boolean };

@Injectable()
export class AiStreamService {
  private readonly log = new Logger('AiStream');
  private models: { at: number; map: Map<string, any> } | null = null;

  constructor(private readonly prisma: PrismaService, private readonly http: HttpService, private readonly quota: QuotaService) {}

  // ── capabilities ────────────────────────────────────────────────────────
  private async openRouterModels(): Promise<Map<string, any>> {
    if (this.models && Date.now() - this.models.at < MODELS_TTL_MS) return this.models.map;
    try {
      const res = await this.http.axiosRef.get(`${DEFAULT_URLS.openrouter}/models`, { timeout: 8000 });
      const map = new Map<string, any>();
      for (const m of res.data?.data || []) map.set(m.id, m);
      if (map.size) { this.models = { at: Date.now(), map }; return map; }
    } catch (e: any) { this.log.warn(`OpenRouter model list unavailable: ${e?.message}`); }
    // retry soon, but keep serving whatever we had
    this.models = { at: Date.now() - MODELS_TTL_MS + 5 * 60_000, map: this.models?.map ?? new Map() };
    return this.models.map;
  }

  async capabilities(p: { type: string; model: string | null; config?: any }): Promise<Caps> {
    const stream = STREAMING_TYPES.has(p.type);
    const heur = /(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|\bo[134]\b|claude|gemini|llava|vision|[-_]vl\b|pixtral|llama-?3\.2|grok|mistral-(small|medium|large)-3)/i.test(p.model || '');
    let caps: Caps = { image: heur, file: false, audio: false, video: false, reasoning: false, stream, contextLength: null, source: 'heuristic' };
    if (p.type === 'openrouter' && p.model) {
      const m = (await this.openRouterModels()).get(p.model);
      if (m) {
        const inp: string[] = m.architecture?.input_modalities || [];
        caps = {
          image: inp.includes('image'), file: true, // OpenRouter parses PDFs itself for any model
          audio: inp.includes('audio'), video: inp.includes('video'),
          reasoning: (m.supported_parameters || []).includes('reasoning'), stream, contextLength: m.context_length ?? null, source: 'openrouter',
        };
      } else caps.file = true;
    }
    const o = p.config?.capabilities;
    if (o && typeof o === 'object') {
      for (const k of ['image', 'file', 'audio', 'video', 'reasoning'] as const) if (typeof o[k] === 'boolean') caps[k] = o[k];
      caps.source = 'config';
    }
    return caps;
  }

  // ── bookkeeping ─────────────────────────────────────────────────────────
  /** The provider, after the activity and quota checks every chat call has to pass. */
  async prepare(userId: string, providerId: string) {
    const provider = await this.prisma.aiProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException('مدل هوش مصنوعی یافت نشد');
    if (!provider.isActive) throw new BadRequestException('این مدل هوش مصنوعی غیرفعال است');
    await this.quota.check(userId, provider.id);
    return provider;
  }

  async record(userId: string, provider: any, prompt: string, r: { promptTokens: number; completionTokens: number; totalTokens: number }, latencyMs: number, success: boolean, errorMsg?: string) {
    const total = r.totalTokens || r.promptTokens + r.completionTokens;
    if (total > 0) this.quota.increment(userId, provider.id, total).catch(() => {});
    await this.prisma.aiUsage.create({
      data: { userId, providerType: provider.type, providerName: provider.name, model: provider.model || undefined, prompt: prompt.substring(0, 1000), promptTokens: r.promptTokens, completionTokens: r.completionTokens, totalTokens: total, latencyMs, success, errorMsg },
    }).catch((e) => this.log.warn(`usage not recorded: ${e?.message}`));
  }

  // ── streaming ───────────────────────────────────────────────────────────
  private async errorText(data: any): Promise<string> {
    let raw = '';
    try { for await (const c of data) raw += c.toString('utf8'); } catch { /* ignore */ }
    try { const j = JSON.parse(raw); return j?.error?.message || j?.message || raw.slice(0, 300); } catch { return raw.slice(0, 300); }
  }

  /**
   * Streams a chat completion (OpenAI-compatible SSE). `onDelta` / `onReasoning` receive text as it
   * arrives. Resolves with the totals; if `signal` aborts, resolves with what had arrived (aborted: true).
   */
  async stream(provider: any, messages: ChatMsg[], o: { safeMode?: boolean; reasoning?: boolean; signal?: AbortSignal; onDelta: (t: string) => void; onReasoning: (t: string) => void }): Promise<StreamResult> {
    const baseUrl = provider.apiUrl || DEFAULT_URLS[provider.type] || '';
    if (!baseUrl) throw new BadRequestException('آدرس API این مدل تنظیم نشده است');
    const sysText = [...messages.filter((m) => m.role === 'system').map((m) => (typeof m.content === 'string' ? m.content : '')), ...(o.safeMode ? [SAFE_MODE_PROMPT] : [])].filter(Boolean).join('\n\n');
    const dialogue = messages.filter((m) => m.role !== 'system');
    while (dialogue.length && dialogue[0].role !== 'user') dialogue.shift();
    const body: any = {
      model: provider.model || (provider.type === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
      messages: [...(sysText ? [{ role: 'system', content: sysText }] : []), ...dialogue],
      stream: true, temperature: o.safeMode ? 0.3 : 0.7, max_tokens: 4096,
    };
    if (provider.type !== 'ollama') body.stream_options = { include_usage: true };
    if (provider.type === 'openrouter' && o.reasoning) body.reasoning = { effort: 'medium' };
    const headers: Record<string, string> = { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' };
    if (provider.type === 'openrouter') { headers['HTTP-Referer'] = 'https://erp.arzesh.net'; headers['X-Title'] = 'Arzesh ERP'; }

    const ctl = new AbortController();
    const onAbort = () => ctl.abort();
    o.signal?.addEventListener('abort', onAbort);
    let timer: NodeJS.Timeout | undefined;
    let timedOut = false;
    const arm = (ms: number) => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; ctl.abort(); }, ms); };
    const result: StreamResult = { content: '', reasoning: '', promptTokens: 0, completionTokens: 0, totalTokens: 0, finishReason: null, aborted: false };

    try {
      arm(FIRST_TOKEN_TIMEOUT_MS);
      const res = await this.http.axiosRef.post(`${baseUrl}/chat/completions`, body, { headers, responseType: 'stream', signal: ctl.signal, timeout: 0, validateStatus: () => true, maxBodyLength: Infinity, maxContentLength: Infinity });
      if (res.status >= 400) throw new Error(await this.errorText(res.data) || `HTTP ${res.status}`);
      const dec = new StringDecoder('utf8');
      let buf = '';
      const handle = (line: string) => {
        if (!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        let j: any;
        try { j = JSON.parse(payload); } catch { return; }
        if (j.error) throw new Error(j.error.message || JSON.stringify(j.error).slice(0, 300));
        if (j.usage) { result.promptTokens = j.usage.prompt_tokens || 0; result.completionTokens = j.usage.completion_tokens || 0; result.totalTokens = j.usage.total_tokens || 0; }
        const ch = j.choices?.[0];
        if (!ch) return;
        if (ch.finish_reason) result.finishReason = ch.finish_reason;
        const d = ch.delta || {};
        const reasoning = typeof d.reasoning === 'string' ? d.reasoning : typeof d.reasoning_content === 'string' ? d.reasoning_content : '';
        if (reasoning) { result.reasoning += reasoning; o.onReasoning(reasoning); }
        const text = typeof d.content === 'string' ? d.content : Array.isArray(d.content) ? d.content.filter((x: any) => x.type === 'text').map((x: any) => x.text || '').join('') : '';
        if (text) { result.content += text; o.onDelta(text); }
      };
      for await (const chunk of res.data) {
        arm(IDLE_TIMEOUT_MS);
        buf += dec.write(chunk as Buffer);
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, nl).replace(/\r$/, '')); buf = buf.slice(nl + 1); }
      }
      if (timedOut) throw new Error('پاسخی از مدل دریافت نشد (زمان انتظار تمام شد)');
      if (o.signal?.aborted) { result.aborted = true; return result; }
      handle((buf + dec.end()).trim());
      return result;
    } catch (e: any) {
      if (timedOut) throw new Error('پاسخی از مدل دریافت نشد (زمان انتظار تمام شد)');
      if (o.signal?.aborted || e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') { result.aborted = true; return result; }
      throw e;
    } finally {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', onAbort);
    }
  }
}
