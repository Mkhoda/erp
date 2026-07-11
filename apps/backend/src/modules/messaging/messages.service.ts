import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MSG_INCLUDE = {
  sender: { select: { id: true, firstName: true, lastName: true } },
  attachments: true,
  reactions: {
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  },
  readBy: { select: { userId: true, readAt: true } },
  replyTo: {
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      attachments: true,
    },
  },
};

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    type?: string;
    replyToId?: string;
    metadata?: Record<string, unknown>;
    attachmentData?: {
      url: string;
      name: string;
      size: number;
      mimeType: string;
      type: string;
    };
  }) {
    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        content: data.content,
        type: (data.type as any) ?? 'TEXT',
        replyToId: data.replyToId,
        metadata: data.metadata as any,
        attachments: data.attachmentData
          ? {
              create: [{
                type: (data.attachmentData.type as any) ?? 'DOCUMENT',
                url: data.attachmentData.url,
                name: data.attachmentData.name,
                size: data.attachmentData.size,
                mimeType: data.attachmentData.mimeType,
              }],
            }
          : undefined,
      },
      include: MSG_INCLUDE,
    });

    await this.prisma.chatConversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  }

  async list(conversationId: string, cursor?: string, limit = 30) {
    return this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        isDeleted: false,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: MSG_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getById(messageId: string) {
    return this.prisma.chatMessage.findUnique({ where: { id: messageId } });
  }

  async edit(messageId: string, userId: string, content: string) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException();
    if (msg.senderId !== userId) throw new ForbiddenException();
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { content, isEdited: true, editedAt: new Date() },
      include: MSG_INCLUDE,
    });
  }

  async softDelete(messageId: string, userId: string, forAll = false) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException();
    if (msg.senderId !== userId) throw new ForbiddenException();
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { isDeleted: true, deletedForAll: forAll },
    });
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const key = { messageId, userId, emoji };
    const existing = await this.prisma.chatReaction.findUnique({ where: { messageId_userId_emoji: key } });
    if (existing) {
      await this.prisma.chatReaction.delete({ where: { messageId_userId_emoji: key } });
      return { added: false };
    }
    await this.prisma.chatReaction.create({ data: key });
    return { added: true };
  }

  async markRead(conversationId: string, userId: string) {
    const unread = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isDeleted: false,
        readBy: { none: { userId } },
      },
      select: { id: true },
    });

    if (unread.length === 0) return;

    await this.prisma.chatRead.createMany({
      data: unread.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });

    await this.prisma.chatMember.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.chatMessage.count({
      where: {
        conversation: { members: { some: { userId } } },
        senderId: { not: userId },
        isDeleted: false,
        readBy: { none: { userId } },
      },
    });
  }
}
