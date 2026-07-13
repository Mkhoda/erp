import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingGateway } from '../messaging/messaging.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationCategory } from '@prisma/client';
import { CreateAnnouncementDto, UpdateAnnouncementDto, AnnouncementFilterDto } from './dto/notification.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateAnnouncementDto, authorId: string) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        type: dto.type ?? 'NOTIFICATION',
        priority: dto.priority ?? 'NORMAL',
        targetType: dto.targetType ?? 'ALL',
        targetDeptIds: dto.targetDeptIds ?? [],
        targetRoles: dto.targetRoles ?? [],
        targetUserIds: dto.targetUserIds ?? [],
        isSticky: dto.isSticky ?? false,
        isPinned: dto.isPinned ?? false,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : null,
        expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
        showOnce: dto.showOnce ?? false,
        showUntilAck: dto.showUntilAck ?? false,
        authorId,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { acks: true } } },
    });
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException();
    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...dto,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        expireAt: dto.expireAt ? new Date(dto.expireAt) : undefined,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { acks: true } } },
    });
  }

  async publish(id: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new NotFoundException();
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { isPublished: true, publishAt: ann.publishAt ?? new Date() },
    });

    // Broadcast to matching users via notification + socket
    const userIds = await this.resolveTargetUsers(ann);
    if (userIds.length > 0) {
      // Create in-app notifications for NOTIFICATION type
      if (ann.type === 'NOTIFICATION') {
        await this.notificationsService.publish({
          userIds,
          category: NotificationCategory.ANNOUNCEMENT,
          priority: ann.priority,
          title: ann.title,
          body: ann.body,
          link: '/dashboard/notifications',
          sourceModule: 'announcements',
          sourceId: id,
        });
      } else {
        // BANNER / POPUP: emit via socket only
        for (const userId of userIds) {
          this.gateway.server?.to(`user:${userId}`).emit('announcement:new', {
            id: ann.id,
            title: ann.title,
            body: ann.body,
            type: ann.type,
            priority: ann.priority,
            isSticky: ann.isSticky,
            showOnce: ann.showOnce,
            showUntilAck: ann.showUntilAck,
          });
        }
      }
    }

    return updated;
  }

  async delete(id: string) {
    await this.prisma.announcement.delete({ where: { id } });
    return { ok: true };
  }

  async findAll(filter: AnnouncementFilterDto) {
    const where: any = {};
    if (filter.type) where.type = filter.type;
    if (filter.isPublished !== undefined) where.isPublished = filter.isPublished;
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { body: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 30;
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { acks: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, rows };
  }

  async findOne(id: string) {
    const ann = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { acks: true, popupSeens: true } },
      },
    });
    if (!ann) throw new NotFoundException();
    return ann;
  }

  /** Returns active announcements visible to a specific user. */
  async getActiveForUser(userId: string, user: { role: string; departmentId?: string | null }) {
    const now = new Date();
    // Resolve actual departmentId from DB since JWT doesn't carry it
    let deptId = user.departmentId ?? null;
    if (!deptId) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
      deptId = u?.departmentId ?? null;
    }
    const resolvedUser = { ...user, departmentId: deptId };

    const all = await this.prisma.announcement.findMany({
      where: {
        isPublished: true,
        OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        AND: [{ OR: [{ expireAt: null }, { expireAt: { gt: now } }] }],
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ isPinned: 'desc' }, { isSticky: 'desc' }, { createdAt: 'desc' }],
    });

    return all.filter((ann) => this.isTargetedAt(ann, userId, resolvedUser));
  }

  /** Returns pending popup announcements the user hasn't seen (or hasn't acknowledged). */
  async getPendingPopups(userId: string, user: { role: string; departmentId?: string | null }) {
    const now = new Date();
    const active = await this.prisma.announcement.findMany({
      where: {
        isPublished: true,
        type: 'POPUP',
        OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        AND: [{ OR: [{ expireAt: null }, { expireAt: { gt: now } }] }],
      },
      include: { popupSeens: { where: { userId } }, acks: { where: { userId } } },
    });

    return active.filter((ann) => {
      if (!this.isTargetedAt(ann, userId, user)) return false;
      const seen = ann.popupSeens.length > 0;
      const acked = ann.acks.length > 0;
      if (ann.showUntilAck && !acked) return true;
      if (ann.showOnce && seen) return false;
      if (!ann.showOnce && seen && !ann.showUntilAck) return false;
      if (seen) return false;
      return true;
    });
  }

  async markPopupSeen(announcementId: string, userId: string) {
    await this.prisma.announcementPopupSeen.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: { seenAt: new Date() },
    });
    return { ok: true };
  }

  async acknowledge(announcementId: string, userId: string) {
    await this.prisma.announcementAck.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: { ackedAt: new Date() },
    });
    return { ok: true };
  }

  async getAckStats(announcementId: string) {
    const ann = await this.prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!ann) throw new NotFoundException();
    const ackCount = await this.prisma.announcementAck.count({ where: { announcementId } });
    const acks = await this.prisma.announcementAck.findMany({
      where: { announcementId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { ackedAt: 'desc' },
    });
    return { ackCount, acks };
  }

  private isTargetedAt(ann: any, userId: string, user: { role: string; departmentId?: string | null }): boolean {
    if (ann.targetType === 'ALL') return true;
    if (ann.targetType === 'USER') return ann.targetUserIds.includes(userId);
    if (ann.targetType === 'ROLE') return ann.targetRoles.includes(user.role);
    if (ann.targetType === 'DEPARTMENT') {
      return user.departmentId ? ann.targetDeptIds.includes(user.departmentId) : false;
    }
    return false;
  }

  private async resolveTargetUsers(ann: any): Promise<string[]> {
    if (ann.targetType === 'ALL') {
      const users = await this.prisma.user.findMany({ where: { disabled: false }, select: { id: true } });
      return users.map((u) => u.id);
    }
    if (ann.targetType === 'USER') return ann.targetUserIds;
    if (ann.targetType === 'ROLE') {
      const users = await this.prisma.user.findMany({
        where: { role: { in: ann.targetRoles }, disabled: false },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (ann.targetType === 'DEPARTMENT') {
      const users = await this.prisma.user.findMany({
        where: { departmentId: { in: ann.targetDeptIds }, disabled: false },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    return [];
  }
}
