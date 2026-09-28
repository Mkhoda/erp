import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

const AUTO_EXTRACT_THRESHOLD = 12;  // extract memories when messages reach this
const RECENT_WINDOW = 30;           // most recent messages sent verbatim with every request
const HISTORY_CHAR_BUDGET = 24000;  // …but never more than this many characters of them
const SUMMARY_EVERY = 10;           // refresh the summary of older turns every N new messages
const ERROR_PREFIX = '⚠️ خطا در دریافت پاسخ'; // failed replies are stored for display but never fed back to the model

@Injectable()
export class ChatHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiSettingsService,
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
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId !== userId) throw new ForbiddenException();
    return conv;
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
   * [system prompt, …recent turns verbatim, new user message]. Older turns that
   * don't fit the window are represented by `conv.summary`.
   */
  private async buildHistory(userId: string, conv: any, newUserMessage: string) {
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
      'به زبان خود کاربر پاسخ بده (پیش‌فرض فارسی).',
      `تاریخ امروز: ${today}`,
    ];
    if (memories.length > 0) {
      system.push(`اطلاعاتی که درباره کاربر می‌دانی:\n${memories.map(m => `- ${m.content}`).join('\n')}`);
    }
    if (conv.summary) {
      system.push(`خلاصه بخش‌های قدیمی‌تر همین گفتگو (پیام‌هایی که در ادامه نیامده‌اند):\n${conv.summary}`);
    }

    // Most recent turns verbatim, newest first until the window/character budget is used
    const usable = (conv.messages as Array<{ role: string; content: string }>).filter(m => !this.isErrorReply(m));
    const recent: Array<{ role: string; content: string }> = [];
    let budget = HISTORY_CHAR_BUDGET;
    for (let i = usable.length - 1; i >= 0 && recent.length < RECENT_WINDOW; i--) {
      const len = usable[i].content.length;
      if (len > budget && recent.length > 0) break;
      recent.unshift({ role: usable[i].role, content: usable[i].content.substring(0, Math.max(budget, 2000)) });
      budget -= len;
    }

    return [
      { role: 'system', content: system.join('\n\n') },
      ...recent,
      { role: 'user', content: newUserMessage },
    ];
  }
}
