import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingGateway } from '../messaging/messaging.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationCategory } from '@prisma/client';
import { CreateAnnouncementDto, UpdateAnnouncementDto, AnnouncementFilterDto } from './dto/notification.dto';

type Viewer = { role: string; deptIds: string[] };

export type AnnouncementAttachment = { url: string; name: string; size?: number; mimeType?: string };

/** Keeps only well-formed attachments that point at our own announcement upload folder. */
export function sanitizeAttachments(input: any): AnnouncementAttachment[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a) => a && typeof a.url === 'string' && a.url.startsWith('/uploads/announcements/'))
    .slice(0, 10)
    .map((a) => ({
      url: a.url,
      name: typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 200) : a.url.split('/').pop(),
      size: typeof a.size === 'number' ? a.size : undefined,
      mimeType: typeof a.mimeType === 'string' ? a.mimeType.slice(0, 100) : undefined,
    }));
}

@Injectable()
export class AnnouncementsService implements OnModuleInit {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: MessagingGateway,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Production schema is managed with `prisma db push` and deploys don't reliably
   * apply migrations, so make sure the attachments column exists (idempotent).
   */
  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "attachments" JSONB');
    } catch (err: any) {
      this.logger.warn(`could not ensure Announcement.attachments column: ${err?.message ?? err}`);
    }
  }

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
        attachments: sanitizeAttachments(dto.attachments) as any,
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
        attachments: dto.attachments !== undefined ? (sanitizeAttachments(dto.attachments) as any) : undefined,
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
    const visibleNow = !updated.publishAt || updated.publishAt <= new Date();
    const userIds = visibleNow ? await this.resolveTargetUsers(ann) : [];
    if (userIds.length > 0) {
      // NOTIFICATION type also lands in the bell / notification center
      if (ann.type === 'NOTIFICATION') {
        await this.notificationsService.publish({
          userIds,
          category: NotificationCategory.ANNOUNCEMENT,
          priority: ann.priority,
          title: ann.title,
          body: ann.body,
          link: '/dashboard/announcements',
          sourceModule: 'announcements',
          sourceId: id,
        });
      }
      // Every type is pushed live so the dashboard can show it immediately
      // (banner on top, popup modal, or a notification card in the corner).
      const payload = {
        id: ann.id,
        title: ann.title,
        body: ann.body,
        type: ann.type,
        priority: ann.priority,
        isSticky: ann.isSticky,
        showOnce: ann.showOnce,
        showUntilAck: ann.showUntilAck,
        attachments: sanitizeAttachments((ann as any).attachments),
        publishAt: updated.publishAt,
      };
      for (const userId of userIds) {
        this.gateway.server?.to(`user:${userId}`).emit('announcement:new', payload);
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

  /** Loads the user's role + every department they belong to (primary + memberships). */
  private async resolveViewer(userId: string, role: string): Promise<Viewer> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, departmentId: true, userDepartments: { select: { departmentId: true } } },
    });
    const deptIds = new Set<string>();
    if (u?.departmentId) deptIds.add(u.departmentId);
    u?.userDepartments?.forEach((d) => deptIds.add(d.departmentId));
    return { role: u?.role ?? role, deptIds: [...deptIds] };
  }

  private activeWhere(extra: any = {}) {
    const now = new Date();
    return {
      isPublished: true,
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      AND: [{ OR: [{ expireAt: null }, { expireAt: { gt: now } }] }],
      ...extra,
    };
  }

  /**
   * Returns active announcements visible to a specific user, each flagged with
   * `seen` / `acked` so the dashboard can decide what to surface as a banner,
   * popup or notification card.
   */
  async getActiveForUser(userId: string, user: { role: string; departmentId?: string | null }) {
    const viewer = await this.resolveViewer(userId, user.role);
    const all = await this.prisma.announcement.findMany({
      where: this.activeWhere(),
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        popupSeens: { where: { userId }, select: { id: true } },
        acks: { where: { userId }, select: { id: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { isSticky: 'desc' }, { createdAt: 'desc' }],
    });

    return all
      .filter((ann) => this.isTargetedAt(ann, userId, viewer))
      .map(({ popupSeens, acks, ...ann }) => ({
        ...ann,
        attachments: sanitizeAttachments((ann as any).attachments),
        seen: popupSeens.length > 0,
        acked: acks.length > 0,
      }));
  }

  /** Count of active announcements the user hasn't seen yet — badge for the "اطلاعیه‌ها" menu item. */
  async getUnreadCount(userId: string, user: { role: string; departmentId?: string | null }) {
    const viewer = await this.resolveViewer(userId, user.role);
    const all = await this.prisma.announcement.findMany({
      where: this.activeWhere(),
      include: { popupSeens: { where: { userId } } },
    });
    const count = all.filter((ann) => this.isTargetedAt(ann, userId, viewer) && ann.popupSeens.length === 0).length;
    return { count };
  }

  /** Returns pending popup announcements the user hasn't seen (or hasn't acknowledged). */
  async getPendingPopups(userId: string, user: { role: string; departmentId?: string | null }) {
    const viewer = await this.resolveViewer(userId, user.role);
    const active = await this.prisma.announcement.findMany({
      where: this.activeWhere({ type: 'POPUP' }),
      include: { popupSeens: { where: { userId } }, acks: { where: { userId } } },
    });

    return active
      .filter((ann) => {
        if (!this.isTargetedAt(ann, userId, viewer)) return false;
        const seen = ann.popupSeens.length > 0;
        const acked = ann.acks.length > 0;
        if (ann.showUntilAck) return !acked;
        return !seen;
      })
      .map(({ popupSeens, acks, ...ann }) => ({ ...ann, attachments: sanitizeAttachments((ann as any).attachments) }));
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

  private isTargetedAt(ann: any, userId: string, viewer: Viewer): boolean {
    if (ann.targetType === 'ALL') return true;
    if (ann.targetType === 'USER') return ann.targetUserIds.includes(userId);
    if (ann.targetType === 'ROLE') return ann.targetRoles.includes(viewer.role);
    if (ann.targetType === 'DEPARTMENT') return viewer.deptIds.some((d) => ann.targetDeptIds.includes(d));
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
        where: {
          disabled: false,
          OR: [
            { departmentId: { in: ann.targetDeptIds } },
            { userDepartments: { some: { departmentId: { in: ann.targetDeptIds } } } },
          ],
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    return [];
  }
}
