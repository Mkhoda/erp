import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

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
        createdAt: true, updatedAt: true, isArchived: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, role: true, createdAt: true } },
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

  async sendMessage(
    userId: string,
    conversationId: string,
    userContent: string,
    safeMode = false,
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException();
    if (conv.userId !== userId) throw new ForbiddenException();

    // Store user message immediately
    await this.prisma.conversationMessage.create({
      data: { conversationId, role: 'user', content: userContent },
    });

    // Build message history for AI
    const history = await this.buildHistory(userId, conv, userContent);

    // Call AI
    const result = await this.ai.chat(userId, conv.provider, history, safeMode);

    // Store assistant response
    const assistantMsg = await this.prisma.conversationMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.content,
        latencyMs: result.latencyMs,
      },
    });

    // Auto-generate title from first user message
    if (!conv.title && conv.messages.length === 0) {
      const shortTitle = userContent.substring(0, 60).trim();
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { title: shortTitle, updatedAt: new Date() },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return { ...result, messageId: assistantMsg.id };
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

    // Keep last 6 messages fresh; compact the rest
    const toCompact = msgs.slice(0, msgs.length - 6);
    const toKeep = msgs.slice(msgs.length - 6);

    const text = toCompact.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const summaryRequest = [
      { role: 'user' as const, content: `Summarize the following conversation concisely in the same language as the user. Capture key facts, decisions, and context:\n\n${text}` },
    ];

    const summaryResult = await this.ai.chat(userId, conv.provider, summaryRequest, false);
    const summary = (conv.summary ? conv.summary + '\n\n---\n\n' : '') + summaryResult.content;

    // Delete compacted messages
    await this.prisma.conversationMessage.deleteMany({
      where: { id: { in: toCompact.map(m => m.id) } },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { summary, updatedAt: new Date() },
    });

    return { ok: true, summary, compacted: toCompact.length, remaining: toKeep.length };
  }

  // ── Memory ───────────────────────────────────────────────────

  async getMemories(userId: string) {
    return this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async addMemory(userId: string, content: string) {
    return this.prisma.userMemory.create({ data: { userId, content } });
  }

  async updateMemory(userId: string, id: string, content: string) {
    const mem = await this.prisma.userMemory.findUnique({ where: { id } });
    if (!mem || mem.userId !== userId) throw new ForbiddenException();
    return this.prisma.userMemory.update({ where: { id }, data: { content } });
  }

  async deleteMemory(userId: string, id: string) {
    const mem = await this.prisma.userMemory.findUnique({ where: { id } });
    if (!mem || mem.userId !== userId) throw new ForbiddenException();
    await this.prisma.userMemory.delete({ where: { id } });
    return { ok: true };
  }

  async extractMemories(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 30 } },
    });
    if (!conv || conv.userId !== userId) throw new ForbiddenException();

    const text = conv.messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const prompt = [
      {
        role: 'user' as const,
        content: `Extract up to 5 important facts about the user from this conversation that are worth remembering for future conversations. Return ONLY a JSON array of strings. Example: ["User's name is Mahdi", "User prefers concise answers"]. If nothing worth remembering, return [].

Conversation:
${text}`,
      },
    ];

    const result = await this.ai.chat(userId, conv.provider, prompt, false);
    try {
      const facts = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]') as string[];
      const created = await Promise.all(
        facts.filter((f: string) => f && f.length > 5).map((f: string) =>
          this.prisma.userMemory.create({ data: { userId, content: f } })
        )
      );
      return { extracted: created.length, memories: created };
    } catch {
      return { extracted: 0, memories: [] };
    }
  }

  // ── Recent for dashboard ──────────────────────────────────────

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

  // ── Private ───────────────────────────────────────────────────

  private async buildHistory(userId: string, conv: any, newUserMessage: string) {
    const memories = await this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const history: Array<{ role: string; content: string }> = [];

    // Inject memory as system context
    if (memories.length > 0) {
      const memText = memories.map(m => `- ${m.content}`).join('\n');
      history.push({
        role: 'user',
        content: `[Context about me that you should remember:\n${memText}]\n\nPlease acknowledge this context briefly.`,
      });
      history.push({
        role: 'assistant',
        content: 'Understood. I will keep this context in mind throughout our conversation.',
      });
    }

    // Inject compact summary if exists
    if (conv.summary) {
      history.push({
        role: 'user',
        content: `[Summary of our earlier conversation:\n${conv.summary}]`,
      });
      history.push({
        role: 'assistant',
        content: 'I have reviewed the conversation summary and will continue from there.',
      });
    }

    // Add existing messages (already saved, excluding the new one we just added)
    const existingMessages = conv.messages.slice(0, -0).filter((m: any) => true);
    for (const m of existingMessages) {
      history.push({ role: m.role, content: m.content });
    }

    // Add the new user message
    history.push({ role: 'user', content: newUserMessage });

    return history;
  }
}
