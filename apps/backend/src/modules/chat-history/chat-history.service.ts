import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiStreamService, Caps, ChatMsg, Part } from '../ai-settings/ai-stream.service';
import { ChatFilesService } from './files/files.service';

const AUTO_EXTRACT_THRESHOLD = 12;  // extract memories when messages reach this
const RECENT_WINDOW = 30;           // most recent messages sent verbatim with every request
const HISTORY_CHAR_BUDGET = 24000;  // …but never more than this many characters of them
const SUMMARY_EVERY = 10;           // refresh the summary of older turns every N new messages
const ERROR_PREFIX = '⚠️ خطا در دریافت پاسخ'; // failed replies are stored for display but never fed back to the model
const MEDIA_TURNS = 2;                        // media (images, PDFs, audio, video) of the last N user turns go to the model; older ones become a note
const MEDIA_BYTES_BUDGET = 40 * 1024 * 1024;  // …and never more than this many bytes of it per request
const FILE_TEXT_BUDGET = 150_000;             // characters of extracted file text per request
const catFa: Record<string, string> = { image: 'تصویر', document: 'سند', text: 'فایل متنی', audio: 'صدا', video: 'ویدیو' };

@Injectable()
export class ChatHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiSettingsService,
    private readonly streamSvc: AiStreamService,
    private readonly files: ChatFilesService,
  ) {}

  // ── Conversations ────────────────────────────────────────────

  async listConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true, title: true, provider: true, model: true,
        createdAt: true, updatedAt: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, role: true } },
      },
    });
  }

  async getConversation(userId: string, id: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' }, include: { attachments: { orderBy: { createdAt: 'asc' } } } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId !== userId) throw new ForbiddenException();
    return { ...conv, messages: conv.messages.map(({ attachments, ...m }) => ({ ...m, attachments: attachments.map((a) => this.files.view(a)) })) };
  }

  async createConversation(userId: string, provider: string, model?: string) {
    if (!provider) throw new BadRequestException('مدل هوش مصنوعی را انتخاب کنید');
    // Ensure pinned memories exist for this user
    await this.ensurePinnedMemories(userId);
    return this.prisma.conversation.create({
      data: { userId, provider, model, title: null },
    });
  }

  async deleteConversation(userId: string, id: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conv) throw new NotFoundException();
    if (conv.userId !== userId) throw new ForbiddenException();
    await this.files.unlinkForConversation(id);
    await this.prisma.conversation.delete({ where: { id } });
    return { ok: true };
  }

  async archiveConversation(userId: string, id: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conv || conv.userId !== userId) throw new ForbiddenException();
    return this.prisma.conversation.update({ where: { id }, data: { isArchived: true } });
  }

  async renameConversation(userId: string, id: string, title: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conv || conv.userId !== userId) throw new ForbiddenException();
    return this.prisma.conversation.update({ where: { id }, data: { title } });
  }

  // ── Send message ─────────────────────────────────────────────

  /**
   * Stores the user's message, sends the conversation (system prompt with the
   * user's memories + summary of older turns + recent turns verbatim) to the
   * model, and stores the reply. `providerId` switches the conversation's model.
   */
  async sendMessage(userId: string, conversationId: string, userContent: string, safeMode = false, providerId?: string) {
    const content = (userContent || '').trim();
    if (!content) throw new BadRequestException('متن پیام خالی است');

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException();
    if (conv.userId !== userId) throw new ForbiddenException();

    let provider = conv.provider;
    if (providerId && providerId !== conv.provider) {
      const p = await this.prisma.aiProvider.findUnique({ where: { id: providerId }, select: { id: true, model: true } });
      if (p) {
        provider = p.id;
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { provider: p.id, model: p.model } });
      }
    }

    // Build the prompt from the history *before* this message, then store it
    const history = await this.buildHistory(userId, conv, content);
    await this.prisma.conversationMessage.create({
      data: { conversationId, role: 'user', content },
    });

    const result = await this.ai.chat(userId, provider, history, safeMode);

    const assistantMsg = await this.prisma.conversationMessage.create({
      data: { conversationId, role: 'assistant', content: result.content || 'پاسخی دریافت نشد.', latencyMs: result.latencyMs },
    });

    // Auto-generate title from first user message
    const isFirstMsg = conv.messages.length === 0;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: isFirstMsg ? content.substring(0, 60).trim() : undefined,
        updatedAt: new Date(),
      },
    });

    const totalMessages = conv.messages.length + 2; // +user +assistant

    // Background tasks (fire and forget)
    if (result.success && totalMessages >= AUTO_EXTRACT_THRESHOLD && totalMessages % 10 === 0) {
      this.autoExtractMemories(userId, conversationId).catch(() => {});
    }
    if (result.success && totalMessages > RECENT_WINDOW && totalMessages % SUMMARY_EVERY === 0) {
      this.compactConversation(userId, conversationId).catch(() => {});
    }

    return { ...result, messageId: assistantMsg.id, conversationId };
  }

  // ── Summary of older turns ───────────────────────────────────

  /**
   * Summarizes the turns that no longer fit in the verbatim window into
   * `conversation.summary`. Messages are NOT deleted — the full thread stays
   * visible in the chat page; only the prompt uses the summary for old turns.
   */
  async compactConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv || conv.userId !== userId) throw new ForbiddenException();

    const usable = conv.messages.filter((m) => !this.isErrorReply(m));
    const older = usable.slice(0, Math.max(0, usable.length - RECENT_WINDOW));
    if (older.length === 0) return { ok: true, summary: conv.summary, compacted: 0 };

    // Previous summary + the most recent of the older turns keeps the input bounded
    const slice = older.slice(-40);
    const text = slice.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 1500)}`).join('\n');
    const request = [{
      role: 'user' as const,
      content: `Update the running summary of this conversation. Keep every fact, name, number, decision and open question the user may refer back to. Write it in the conversation's language, as compact bullet points, max ~400 words.

Previous summary:
${conv.summary || '(none)'}

Earlier turns to fold in:
${text}`,
    }];

    try {
      const res = await this.ai.chat(userId, conv.provider, request, false);
      if (!res.success || !res.content) return { ok: false, summary: conv.summary, compacted: 0 };
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { summary: res.content.substring(0, 6000) } });
      return { ok: true, summary: res.content, compacted: older.length, remaining: usable.length - older.length };
    } catch {
      return { ok: false, summary: conv.summary, compacted: 0 };
    }
  }

  // ── Memory ───────────────────────────────────────────────────

  async getMemories(userId: string) {
    return this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async addMemory(userId: string, content: string) {
    return this.prisma.userMemory.create({ data: { userId, content } });
  }

  async updateMemory(userId: string, id: string, content: string) {
    const mem = await this.prisma.userMemory.findUnique({ where: { id } });
    if (!mem || mem.userId !== userId) throw new ForbiddenException();
    if (mem.isPinned) throw new ForbiddenException('Pinned memories cannot be modified');
    return this.prisma.userMemory.update({ where: { id }, data: { content } });
  }

  async deleteMemory(userId: string, id: string) {
    const mem = await this.prisma.userMemory.findUnique({ where: { id } });
    if (!mem || mem.userId !== userId) throw new ForbiddenException();
    if (mem.isPinned) throw new ForbiddenException('Pinned memories cannot be deleted');
    await this.prisma.userMemory.delete({ where: { id } });
    return { ok: true };
  }

  async extractMemories(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || conv.userId !== userId) throw new ForbiddenException();
    await this.autoExtractMemories(userId, conversationId);
    return { ok: true };
  }

  private async autoExtractMemories(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 30 } },
    });
    if (!conv || conv.userId !== userId) return;

    const existing = await this.prisma.userMemory.findMany({ where: { userId }, select: { content: true } });
    const text = conv.messages.reverse().filter((m) => !this.isErrorReply(m))
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
    const prompt = [
      {
        role: 'user' as const,
        content: `Extract up to 3 important facts about the USER (not the topic) from this conversation that are worth remembering for future conversations. Skip anything already known. Return ONLY a JSON array of strings. If nothing personal/important about the user, return [].

Already known:
${existing.map(m => `- ${m.content}`).join('\n') || '(nothing)'}

Examples: ["کاربر ترجیح می‌دهد پاسخ‌ها فارسی باشند", "کاربر در حوزه مالی کار می‌کند"]

Conversation:
${text.substring(0, 3000)}`,
      },
    ];

    try {
      const result = await this.ai.chat(userId, conv.provider, prompt, false);
      const facts = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]') as string[];
      const known = new Set(existing.map(m => m.content.trim()));
      for (const f of facts.filter((f: string) => typeof f === 'string' && f.length > 5 && !known.has(f.trim())).slice(0, 3)) {
        await this.prisma.userMemory.create({ data: { userId, content: f.trim() } });
      }
    } catch { /* silent */ }
  }

  async getRecentConversations(userId: string, limit = 5) {
    return this.prisma.conversation.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true, title: true, provider: true, model: true, updatedAt: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, role: true } },
      },
    });
  }

  // ── Pinned memories (auto-create) ────────────────────────────

  private async ensurePinnedMemories(userId: string) {
    const existing = await this.prisma.userMemory.findFirst({ where: { userId, isPinned: true } });
    if (existing) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    if (!user) return;

    await this.prisma.userMemory.create({
      data: { userId, content: `نام کاربر: ${user.firstName}`, isPinned: true },
    });
  }

  // ── History builder ───────────────────────────────────────────

  private isErrorReply(m: { role: string; content: string }) {
    return m.role === 'assistant' && m.content.startsWith(ERROR_PREFIX);
  }

  /**
   * The system prompt (memories, summary of old turns) and the most recent turns verbatim, newest-first
   * within the window / character budget. Older turns that don't fit are represented by `conv.summary`.
   */
  private async historyParts(userId: string, conv: any, messages: any[]) {
    const [memories, user, settings] = await Promise.all([
      this.prisma.userMemory.findMany({
        where: { userId },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        take: 20,
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
      this.prisma.systemSettings.findUnique({ where: { id: 'singleton' }, select: { orgName: true } }).catch(() => null),
    ]);

    const today = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'full', timeZone: 'Asia/Tehran' }).format(new Date());
    const org = settings?.orgName?.trim();

    const system: string[] = [
      `تو دستیار هوشمند سامانه ${org ? `«${org}»` : 'سازمان'} هستی و با ${user ? `${user.firstName} ${user.lastName}`.trim() : 'کاربر'} گفتگو می‌کنی.`,
      'این یک گفتگوی پیوسته است: پیام‌های قبلی همین گفتگو را به خاطر داشته باش و در پاسخ‌ها از آن‌ها استفاده کن. اگر کاربر به چیزی که قبلاً گفته اشاره کرد، از تاریخچه گفتگو استفاده کن.',
      'اگر کاربر تصویر، سند یا فایلی فرستاد، آن را با دقت بررسی کن و بر اساس محتوای واقعی آن پاسخ بده؛ اگر چیزی در فایل نامشخص یا ناخوانا بود، همین را صادقانه بگو.',
      'به زبان خود کاربر پاسخ بده (پیش‌فرض فارسی). پاسخ‌ها را با Markdown خوانا و مرتب بنویس (عنوان، فهرست، جدول و بلوک کد در صورت نیاز).',
      `تاریخ امروز: ${today}`,
    ];
    if (memories.length > 0) {
      system.push(`اطلاعاتی که درباره کاربر می‌دانی:\n${memories.map(m => `- ${m.content}`).join('\n')}`);
    }
    if (conv.summary) {
      system.push(`خلاصه بخش‌های قدیمی‌تر همین گفتگو (پیام‌هایی که در ادامه نیامده‌اند):\n${conv.summary}`);
    }

    const usable = messages.filter(m => !this.isErrorReply(m));
    const recent: any[] = [];
    let budget = HISTORY_CHAR_BUDGET;
    for (let i = usable.length - 1; i >= 0 && recent.length < RECENT_WINDOW; i--) {
      const len = usable[i].content.length;
      if (len > budget && recent.length > 0) break;
      recent.unshift(usable[i]);
      budget -= len;
    }
    return { system: system.join('\n\n'), recent, budget };
  }

  /** [system prompt, …recent turns verbatim, new user message] — plain text (the non-streaming path). */
  private async buildHistory(userId: string, conv: any, newUserMessage: string) {
    const h = await this.historyParts(userId, conv, conv.messages);
    return [
      { role: 'system', content: h.system },
      ...h.recent.map((m) => ({ role: m.role, content: String(m.content).substring(0, Math.max(h.budget, 2000)) })),
      { role: 'user', content: newUserMessage },
    ];
  }

  // ── Streaming + attachments ───────────────────────────────────

  /** A model-ready user turn: its text, the text of attached documents, and (when allowed) the media itself. */
  private async userTurn(content: string, atts: any[], caps: Caps, media: boolean, state: { bytes: number; chars: number }): Promise<string | Part[]> {
    const blocks: string[] = [];
    const parts: Part[] = [];
    const notes: string[] = [];
    for (const a of atts) {
      if (a.extractedText) {
        const room = Math.max(0, FILE_TEXT_BUDGET - state.chars);
        const text = String(a.extractedText).slice(0, room);
        state.chars += text.length;
        blocks.push(`[محتوای فایل «${a.name}»${text.length < a.extractedText.length ? ' — بریده‌شده' : ''}]\n${text}\n[پایان فایل]`);
        continue;
      }
      const ok = media && state.bytes + a.sizeBytes <= MEDIA_BYTES_BUDGET
        && ((a.category === 'image' && caps.image) || (a.category === 'audio' && caps.audio) || (a.category === 'video' && caps.video) || (a.category === 'document' && caps.file));
      if (!ok) { notes.push(`[پیوست قبلی: ${catFa[a.category] || 'فایل'} «${a.name}»]`); continue; }
      const b64 = await this.files.base64(a);
      state.bytes += a.sizeBytes;
      const ext = a.storageKey.split('.').pop() || '';
      if (a.category === 'image') parts.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${b64}` } });
      else if (a.category === 'audio') parts.push({ type: 'input_audio', input_audio: { data: b64, format: ext } });
      else if (a.category === 'video') parts.push({ type: 'video_url', video_url: { url: `data:${a.mime};base64,${b64}` } });
      else parts.push({ type: 'file', file: { filename: a.name, file_data: `data:${a.mime};base64,${b64}` } });
    }
    const text = [content, ...blocks, ...notes].filter(Boolean).join('\n\n') || 'این فایل‌ها را بررسی کن.';
    return parts.length ? [{ type: 'text', text }, ...parts] : text;
  }

  private checkAttachments(atts: any[], caps: Caps, providerName: string) {
    for (const a of atts) {
      if (a.extractedText) continue; // text-like files are plain text to every model
      const need = a.category === 'image' ? caps.image : a.category === 'audio' ? caps.audio : a.category === 'video' ? caps.video : caps.file;
      if (!need) throw new BadRequestException(`مدل «${providerName}» از ${catFa[a.category] || 'این نوع فایل'} پشتیبانی نمی‌کند. مدل دیگری انتخاب کنید یا فایل را بردارید.`);
    }
  }

  /**
   * Validates a streaming request and stores the user's message — everything that can fail with a
   * normal HTTP error happens here, before the event stream opens.
   */
  async beginStream(userId: string, conversationId: string, body: { content?: string; attachmentIds?: string[]; safeMode?: boolean; providerId?: string; regenerate?: boolean; reasoning?: boolean }) {
    const conv: any = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' }, include: { attachments: true } } },
    });
    if (!conv) throw new NotFoundException();
    if (conv.userId !== userId) throw new ForbiddenException();

    if (body.providerId && body.providerId !== conv.provider) {
      const p = await this.prisma.aiProvider.findUnique({ where: { id: body.providerId }, select: { id: true, model: true } });
      if (p) { conv.provider = p.id; await this.prisma.conversation.update({ where: { id: conversationId }, data: { provider: p.id, model: p.model } }); }
    }
    const provider = await this.streamSvc.prepare(userId, conv.provider);
    const caps = await this.streamSvc.capabilities(provider);
    const policy = await this.files.policy();

    let userMsg: any, history: any[];
    if (body.regenerate) {
      const msgs = [...conv.messages];
      if (msgs.length && msgs[msgs.length - 1].role === 'assistant') {
        await this.prisma.conversationMessage.delete({ where: { id: msgs.pop().id } });
      }
      userMsg = msgs[msgs.length - 1];
      if (!userMsg || userMsg.role !== 'user') throw new BadRequestException('پیامی برای تولید دوباره وجود ندارد');
      history = msgs.slice(0, -1);
    } else {
      const content = (body.content || '').trim();
      const ids = Array.from(new Set(body.attachmentIds || []));
      if (ids.length > policy.maxFilesPerMessage) throw new BadRequestException(`حداکثر ${policy.maxFilesPerMessage} فایل در هر پیام مجاز است`);
      if (!content && !ids.length) throw new BadRequestException('متن پیام خالی است');
      const atts = ids.length ? await this.prisma.conversationAttachment.findMany({ where: { id: { in: ids }, userId, messageId: null } }) : [];
      if (atts.length !== ids.length) throw new BadRequestException('یکی از فایل‌ها یافت نشد یا قبلاً استفاده شده است');
      this.checkAttachments(atts, caps, provider.name);
      userMsg = await this.prisma.conversationMessage.create({ data: { conversationId, role: 'user', content } });
      if (atts.length) await this.prisma.conversationAttachment.updateMany({ where: { id: { in: ids } }, data: { messageId: userMsg.id } });
      userMsg.attachments = atts;
      history = conv.messages;
    }

    // Build the model messages: system + recent turns (media only for the last few user turns) + this turn.
    const h = await this.historyParts(userId, conv, history);
    const userTurns = h.recent.filter((m: any) => m.role === 'user' && m.attachments?.length).slice(-(MEDIA_TURNS - 1)).map((m: any) => m.id);
    const state = { bytes: 0, chars: 0 };
    const current = await this.userTurn(userMsg.content, userMsg.attachments || [], caps, true, state);
    const recent: ChatMsg[] = [];
    for (const m of h.recent as any[]) {
      recent.push({ role: m.role, content: m.role === 'user' && m.attachments?.length ? await this.userTurn(m.content, m.attachments, caps, userTurns.includes(m.id), state) : String(m.content).substring(0, Math.max(h.budget, 2000)) });
    }
    const messages: ChatMsg[] = [{ role: 'system', content: h.system }, ...recent, { role: 'user', content: current }];

    return {
      conv, provider, caps, messages, safeMode: body.safeMode ?? false, reasoning: !!body.reasoning && caps.reasoning,
      userMsg: body.regenerate ? null : { id: userMsg.id, role: 'user', content: userMsg.content, createdAt: userMsg.createdAt, attachments: (userMsg.attachments || []).map((a: any) => this.files.view(a)) },
      prompt: userMsg.content || (userMsg.attachments?.[0]?.name ?? ''), isFirst: conv.messages.length === 0, total: conv.messages.length + 2,
    };
  }

  /** Runs the model, forwarding text and thinking through `emit`, then stores the reply. Never throws. */
  async runStream(ctx: Awaited<ReturnType<ChatHistoryService['beginStream']>>, userId: string, emit: (event: string, data: any) => void, signal: AbortSignal) {
    const { conv, provider, messages } = ctx;
    const started = Date.now();
    let content = '', reasoning = '', usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, stopped = false, errorMsg: string | undefined;
    try {
      if (ctx.caps.stream) {
        const r = await this.streamSvc.stream(provider, messages, {
          safeMode: ctx.safeMode, reasoning: ctx.reasoning, signal,
          onDelta: (t) => emit('delta', { t }), onReasoning: (t) => emit('reasoning', { t }),
        });
        content = r.content; reasoning = r.reasoning; stopped = r.aborted;
        usage = { promptTokens: r.promptTokens, completionTokens: r.completionTokens, totalTokens: r.totalTokens };
      } else {
        // Provider without a streaming dialect (Gemini / Anthropic / Agnes): one round trip, shown as a single chunk.
        const flat = messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : (m.content.find((p: any) => p.type === 'text') as any)?.text || '' }));
        const r = await this.ai.chat(userId, provider.id, flat, ctx.safeMode);
        if (!r.success) throw new Error(r.errorMsg || 'خطای ناشناخته');
        content = r.content; emit('delta', { t: content });
      }
      if (!content.trim() && !stopped) throw new Error('پاسخی از مدل دریافت نشد');
    } catch (e: any) {
      errorMsg = e?.message || 'خطای ناشناخته';
      this.logStreamError(provider, e);
    }
    const latencyMs = Date.now() - started;
    if (ctx.caps.stream) await this.streamSvc.record(userId, provider, ctx.prompt, usage, latencyMs, !errorMsg, errorMsg);

    const failed = !!errorMsg;
    const reply = failed ? `${ERROR_PREFIX} از ${provider.name}: ${errorMsg}` : content;
    const saved = await this.prisma.conversationMessage.create({
      data: { conversationId: conv.id, role: 'assistant', content: reply, latencyMs, reasoning: failed ? null : reasoning || null, promptTokens: usage.promptTokens || null, completionTokens: usage.completionTokens || null, stopped },
    });
    const title = ctx.isFirst ? (ctx.prompt || 'گفتگوی جدید').substring(0, 60).trim() : undefined;
    await this.prisma.conversation.update({ where: { id: conv.id }, data: { title, updatedAt: new Date() } });
    if (!failed && !stopped && ctx.total >= AUTO_EXTRACT_THRESHOLD && ctx.total % 10 === 0) this.autoExtractMemories(userId, conv.id).catch(() => {});
    if (!failed && !stopped && ctx.total > RECENT_WINDOW && ctx.total % SUMMARY_EVERY === 0) this.compactConversation(userId, conv.id).catch(() => {});
    emit(failed ? 'error' : 'done', { messageId: saved.id, latencyMs, stopped, usage, title: title ?? conv.title, message: failed ? errorMsg : undefined, content: reply });
    return saved;
  }

  private logStreamError(provider: any, e: any) {
    console.error(`[AI Stream ERROR] provider=${provider.name} type=${provider.type} model=${provider.model} msg=${e?.message}`);
  }

}
