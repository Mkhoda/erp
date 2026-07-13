import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingGateway } from '../messaging/messaging.gateway';
import { NotificationCategory, NotificationPriority } from '@prisma/client';
import { PublishNotificationDto, NotificationFilterDto, MarkReadDto } from './dto/notification.dto';

export interface PublishOptions {
  userIds: string[];
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  body: string;
  link?: string;
  icon?: string;
  sourceModule?: string;
  sourceId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,
  ) {}

  /** Central publish method — call from any module to notify users. */
  async publish(opts: PublishOptions) {
    if (!opts.userIds.length) return;
    const data = opts.userIds.map((userId) => ({
      userId,
      category: opts.category,
      priority: opts.priority ?? NotificationPriority.NORMAL,
      title: opts.title,
      body: opts.body,
      link: opts.link,
      icon: opts.icon,
      sourceModule: opts.sourceModule,
      sourceId: opts.sourceId,
    }));

    await this.prisma.notification.createMany({ data, skipDuplicates: false });

    // Emit real-time update to each user's socket room
    for (const userId of opts.userIds) {
      const unread = await this.prisma.notification.count({
        where: { userId, isRead: false, isArchived: false },
      });
      this.gateway.server?.to(`user:${userId}`).emit('notification:new', {
        title: opts.title,
        body: opts.body,
        category: opts.category,
        unreadCount: unread,
      });
    }
  }

  async getForUser(userId: string, filter: NotificationFilterDto) {
    const where: any = { userId, isArchived: filter.isArchived ?? false };
    if (filter.category) where.category = filter.category;
    if (filter.isRead !== undefined) where.isRead = filter.isRead;
    if (filter.isPinned !== undefined) where.isPinned = filter.isPinned;
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { body: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 30;
    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, rows };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false, isArchived: false },
    });
    return { count };
  }

  async getRecent(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false, isArchived: false },
    });
    return { rows, unreadCount };
  }

  async markRead(userId: string, dto: MarkReadDto) {
    await this.prisma.notification.updateMany({
      where: { id: { in: dto.ids }, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return this.getUnreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return this.getUnreadCount(userId);
  }

  async toggleArchive(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException();
    return this.prisma.notification.update({
      where: { id },
      data: { isArchived: !notif.isArchived },
    });
  }

  async togglePin(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException();
    return this.prisma.notification.update({
      where: { id },
      data: { isPinned: !notif.isPinned },
    });
  }

  async deleteOne(id: string, userId: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { ok: true };
  }

  async deleteAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId, isRead: true } });
    return { ok: true };
  }

  async getAnalytics() {
    const [total, unread, byCategory, byPriority, recentPerDay] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { isRead: false } }),
      this.prisma.notification.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { _count: { category: 'desc' } } }),
      this.prisma.notification.groupBy({ by: ['priority'], _count: { _all: true } }),
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM "Notification"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day
      `,
    ]);
    return {
      total,
      unread,
      readRate: total ? Math.round(((total - unread) / total) * 100) : 0,
      byCategory: byCategory.map((r) => ({ category: r.category, count: r._count._all })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
      recentPerDay: recentPerDay.map((r) => ({ day: r.day, count: Number(r.count) })),
    };
  }
}
