import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

const AUTO_COMPACT_THRESHOLD = 30;  // compact when messages exceed this
const AUTO_EXTRACT_THRESHOLD = 12;  // extract memories when messages reach this

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

  async sendMessage(userId: string, conversationId: string, userContent: string, safeMode = false) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException();
    if (conv.userId !== userId) throw new ForbiddenException();

    // Store user message
    await this.prisma.conversationMessage.create({
      data: { conversationId, role: 'user', content: userContent },
    });

    // Build history and call AI
    const history = await this.buildHistory(userId, conv, userContent);
    const result = await this.ai.chat(userId, conv.provider, history, safeMode);

    // Store assistant response
    const assistantMsg = await this.prisma.conversationMessage.create({
      data: { conversationId, role: 'assistant', content: result.content, latencyMs: result.latencyMs },
    });

    // Auto-generate title from first user message
    const isFirstMsg = conv.messages.length === 0;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: isFirstMsg ? userContent.substring(0, 60).trim() : undefined,
        updatedAt: new Date(),
      },
    });

    const totalMessages = conv.messages.length + 2; // +user +assistant

    // Background tasks (fire and forget)
    this.updateRollingContext(userId, conversationId, conv, userContent, result.content).catch(() => {});

    if (totalMessages >= AUTO_EXTRACT_THRESHOLD && totalMessages % 10 === 0) {
      this.autoExtractMemories(userId, conversationId).catch(() => {});
    }
    if (totalMessages >= AUTO_COMPACT_THRESHOLD && totalMessages % 5 === 0) {
      this.compactConversation(userId, conversationId).catch(() => {});
    }

    return { ...result, messageId: assistantMsg.id };
  }

  // ── Rolling context update (background) ──────────────────────

  private async updateRollingContext(
    userId: string,
    conversationId: string,
    conv: any,
    userMsg: string,
    aiResponse: string,
  ) {
    const prevContext = conv.rollingContext || '';
    const prompt = [
      {
        role: 'user' as const,
        content: `You are a context tracker. Update the conversation context summary based on the latest exchange.

Previous context:
${prevContext || '(none yet)'}

Latest exchange:
User: ${userMsg.substring(0, 500)}
Assistant: ${aiResponse.substring(0, 500)}

Write an updated context in 2-3 sentences that captures:
1. What the user is trying to accomplish
2. Key facts or decisions established
3. Current state of the conversation

Write ONLY the context text, nothing else. Match the user's language.`,
      },
    ];
    try {
      const result = await this.ai.chat(userId, conv.provider, prompt, false);
      if (result.success && result.content) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { rollingContext: result.content.substring(0, 1000) },
        });
      }
    } catch { /* silent */ }
  }

  // ── Compact ──────────────────────────────────────────────────

  async compactConversation(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv || conv.userId !== userId) throw new ForbiddenException();

    const msgs = conv.messages;
    if (msgs.length < 10) return { ok: true, summary: null, compacted: 0 };

    const toCompact = msgs.slice(0, msgs.length - 8);
    const text = toCompact.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const summaryRequest = [
      { role: 'user' as const, content: `Summarize this conversation concisely, preserving key facts, decisions, and important details. Match the user's language:\n\n${text}` },
    ];

    try {
      const summaryResult = await this.ai.chat(userId, conv.provider, summaryRequest, false);
      const summary = (conv.summary ? conv.summary + '\n\n---\n\n' : '') + summaryResult.content;
      await this.prisma.conversationMessage.deleteMany({ where: { id: { in: toCompact.map(m => m.id) } } });
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { summary } });
      return { ok: true, summary, compacted: toCompact.length, remaining: msgs.length - toCompact.length };
    } catch {
      return { ok: false, summary: null, compacted: 0 };
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
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 30 } },
    });
    if (!conv || conv.userId !== userId) return;

    const text = conv.messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
    const prompt = [
      {
        role: 'user' as const,
        content: `Extract up to 3 important facts about the USER (not the topic) from this conversation that are worth remembering for future conversations. Return ONLY a JSON array of strings. If nothing personal/important about the user, return [].

Examples: ["کاربر ترجیح می‌دهد پاسخ‌ها فارسی باشند", "کاربر در حوزه مالی کار می‌کند"]

Conversation:
${text.substring(0, 3000)}`,
      },
    ];

    try {
      const result = await this.ai.chat(userId, conv.provider, prompt, false);
      const facts = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]') as string[];
      for (const f of facts.filter((f: string) => f?.length > 5).slice(0, 3)) {
        await this.prisma.userMemory.create({ data: { userId, content: f } });
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

  private async buildHistory(userId: string, conv: any, newUserMessage: string) {
    const memories = await this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      take: 15,
    });

    const history: Array<{ role: string; content: string }> = [];

    // Inject pinned + user memories as system context
    if (memories.length > 0) {
      const memText = memories.map(m => `- ${m.content}`).join('\n');
      history.push({
        role: 'user',
        content: `[اطلاعات مهم درباره من که باید در تمام پاسخ‌ها در نظر بگیری:\n${memText}]`,
      });
      history.push({
        role: 'assistant',
        content: 'متوجه شدم. این اطلاعات را در تمام پاسخ‌هایم لحاظ می‌کنم.',
      });
    }

    // Inject rolling context
    if (conv.rollingContext) {
      history.push({
        role: 'user',
        content: `[خلاصه زمینه این مکالمه:\n${conv.rollingContext}]`,
      });
      history.push({
        role: 'assistant',
        content: 'متوجه شدم.',
      });
    }

    // Inject compact summary if exists
    if (conv.summary) {
      history.push({
        role: 'user',
        content: `[خلاصه پیام‌های قدیمی‌تر این مکالمه:\n${conv.summary}]`,
      });
      history.push({ role: 'assistant', content: 'متوجه شدم، ادامه می‌دهیم.' });
    }

    // Add existing messages (all already stored in DB)
    for (const m of conv.messages) {
      history.push({ role: m.role, content: m.content });
    }

    // New user message
    history.push({ role: 'user', content: newUserMessage });
    return history;
  }
}
