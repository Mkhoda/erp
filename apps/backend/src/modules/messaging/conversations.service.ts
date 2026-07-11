import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PresenceService } from './presence.service';

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
  ) {}

  async findOrCreateDirect(userAId: string, userBId: string) {
    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: userAId } } },
          { members: { some: { userId: userBId } } },
        ],
      },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    });
    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [
            { userId: userAId, role: 'MEMBER' },
            { userId: userBId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
      },
    });
  }

  async listForUser(userId: string) {
    const convs = await this.prisma.chatConversation.findMany({
      where: { members: { some: { userId, isArchived: false } } },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
          },
        },
        messages: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
            attachments: { take: 1 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      convs.map(async (conv) => {
        const member = conv.members.find((m) => m.userId === userId);
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            isDeleted: false,
            senderId: { not: userId },
            readBy: { none: { userId } },
            ...(member?.lastReadAt ? { createdAt: { gt: member.lastReadAt } } : {}),
          },
        });
        const membersWithPresence = conv.members.map((m) => ({
          ...m,
          isOnline: this.presence.isOnline(m.userId),
        }));
        return { ...conv, members: membersWithPresence, unreadCount };
      }),
    );
  }

  async get(conversationId: string, userId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
          },
        },
      },
    });
    if (!conv || !conv.members.some((m) => m.userId === userId)) return null;
    return conv;
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.chatMember.count({ where: { conversationId, userId } });
    return count > 0;
  }

  async getUserConversationIds(userId: string): Promise<string[]> {
    const members = await this.prisma.chatMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    return members.map((m) => m.conversationId);
  }

  async listUsers(currentUserId: string) {
    const users = await this.prisma.user.findMany({
      where: { id: { not: currentUserId }, disabled: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return users.map((u) => ({ ...u, isOnline: this.presence.isOnline(u.id) }));
  }
}
