import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus, TicketPriority, Role } from '@prisma/client';
import { SlaService } from './sla.service';
import { CreateTicketDto, UpdateTicketDto, AssignTicketDto, TransferTicketDto, TicketFilterDto } from './dto/ticket.dto';
import { OTHER_CATEGORY_NAME } from './categories.service';

const TICKET_INCLUDE = {
  department: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, slaFirstResponseHours: true, slaResolutionHours: true } },
  requester: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  assignee: { select: { id: true, firstName: true, lastName: true, phone: true } },
  relatedUser: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { comments: true, attachments: true } },
  slaMetric: true,
} as const;

const STATUS_FA: Record<TicketStatus, string> = {
  OPEN: 'باز',
  ASSIGNED: 'تخصیص داده شده',
  IN_PROGRESS: 'در حال بررسی',
  WAITING_USER: 'منتظر کاربر',
  USER_REPLIED: 'کاربر پاسخ داد',
  RESOLVED: 'حل شده',
  CLOSED: 'بسته شده',
  CANCELLED: 'لغو شده',
  REJECTED: 'رد شده',
  REOPENED: 'بازگشایی شده',
};

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private sla: SlaService,
  ) {}

  async findAll(filter: TicketFilterDto, requestUser: { id: string; role: Role; departmentId?: string | null }) {
    const where: any = {};

    // MANAGER can only see their department's tickets
    if (requestUser.role === Role.MANAGER) {
      const deptIds = await this.userDeptIds(requestUser.id);
      where.departmentId = { in: deptIds };
    }
    // USER/EXPERT sees only their own tickets
    if (requestUser.role === Role.USER || requestUser.role === Role.EXPERT) {
      where.requesterId = requestUser.id;
    }

    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    if (filter.requesterId) where.requesterId = filter.requesterId;
    if (filter.assigneeId) where.assigneeId = filter.assigneeId;
    if (filter.isOverSla !== undefined) where.isOverSla = filter.isOverSla;
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = new Date(filter.dateFrom);
      if (filter.dateTo) where.createdAt.lte = new Date(filter.dateTo);
    }
    if (filter.search) {
      const n = parseInt(filter.search.replace(/\D/g, ''), 10);
      where.OR = [
        { description: { contains: filter.search, mode: 'insensitive' } },
        { title: { contains: filter.search, mode: 'insensitive' } },
        ...(n ? [{ number: n }] : []),
        { requester: { OR: [{ firstName: { contains: filter.search, mode: 'insensitive' } }, { lastName: { contains: filter.search, mode: 'insensitive' } }] } },
        { tags: { has: filter.search } },
      ];
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 50;
    const [total, rows] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: [{ isOverSla: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, rows };
  }

  async findOne(id: string, requestUser: { id: string; role: Role }) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...TICKET_INCLUDE,
        comments: {
          where: requestUser.role === Role.USER || requestUser.role === Role.EXPERT
            ? { isInternal: false, isDeleted: false }
            : { isDeleted: false },
          include: {
            author: { select: { id: true, firstName: true, lastName: true, role: true } },
            attachments: true,
            replyTo: { select: { id: true, content: true, author: { select: { id: true, firstName: true, lastName: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: { where: { commentId: null }, orderBy: { createdAt: 'asc' } },
        events: {
          include: { actor: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد');
    this.assertAccess(ticket, requestUser);
    return ticket;
  }

  async create(dto: CreateTicketDto, requesterId: string) {
    const config = await this.prisma.ticketDepartmentConfig.findFirst({
      where: { departmentId: dto.departmentId, isEnabled: true },
      include: { defaultAssignees: { select: { userId: true } } },
    });
    if (!config) throw new BadRequestException('این دپارتمان تیکت‌پذیر نیست');

    const category = await this.prisma.ticketCategory.findFirst({
      where: { id: dto.categoryId, configId: config.id, isActive: true },
    });
    if (!category) throw new BadRequestException('موضوع انتخاب شده معتبر نیست');

    const title = dto.title?.trim() || undefined;
    if (category.name === OTHER_CATEGORY_NAME && !title) {
      throw new BadRequestException('برای موضوع «سایر» نوشتن عنوان الزامی است');
    }

    // Auto-assign via round-robin if configured
    let assigneeId: string | null = null;
    if (config.autoAssignRoundRobin && config.defaultAssignees.length > 0) {
      const lastTicket = await this.prisma.ticket.findFirst({
        where: { departmentId: dto.departmentId, assigneeId: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { assigneeId: true },
      });
      const ids = config.defaultAssignees.map(a => a.userId);
      const lastIdx = lastTicket?.assigneeId ? ids.indexOf(lastTicket.assigneeId) : -1;
      assigneeId = ids[(lastIdx + 1) % ids.length];
    }

    const { firstResponseDueAt, resolutionDueAt } = this.sla.calcDueDates(new Date(), config, category);

    const ticket = await this.prisma.ticket.create({
      data: {
        departmentId: dto.departmentId,
        categoryId: dto.categoryId,
        requesterId,
        title,
        description: dto.description,
        priority: dto.priority ?? TicketPriority.MEDIUM,
        relatedUserId: dto.relatedUserId,
        tags: dto.tags ?? [],
        ccUserIds: dto.ccUserIds ?? [],
        assigneeId,
        status: assigneeId ? TicketStatus.ASSIGNED : TicketStatus.OPEN,
        events: {
          create: [
            { type: 'CREATED', actorId: requesterId },
            ...(assigneeId ? [{ type: 'ASSIGNED', actorId: requesterId, meta: { assigneeId, auto: true } }] : []),
          ],
        },
      },
      include: TICKET_INCLUDE,
    });

    await this.prisma.ticketSlaMetric.create({
      data: {
        ticketId: ticket.id,
        slaFirstResponseHours: category.slaFirstResponseHours ?? config.slaFirstResponseHours,
        slaResolutionHours: category.slaResolutionHours ?? config.slaResolutionHours,
        firstResponseDueAt,
        resolutionDueAt,
      },
    });

    if (assigneeId) await this.notifyUsers([assigneeId], ticket.id, 'ASSIGNED', `تیکت جدید به شما تخصیص یافت: #${ticket.number}`);
    if (config.notifyOnCreate) await this.notifyManagers(config.id, ticket.id, 'STATUS_CHANGED', `تیکت جدید دریافت شد: #${ticket.number}`);

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, actor: { id: string; role: Role }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException();
    this.assertCanManage(ticket, actor);

    const events: any[] = [];
    if (dto.status && dto.status !== ticket.status) {
      events.push({ type: 'STATUS_CHANGED', actorId: actor.id, meta: { from: ticket.status, to: dto.status } });
    }
    if (dto.priority && dto.priority !== ticket.priority) {
      events.push({ type: 'PRIORITY_CHANGED', actorId: actor.id, meta: { from: ticket.priority, to: dto.priority } });
    }

    const resolvedAt = dto.status === TicketStatus.RESOLVED && !ticket.resolvedAt ? new Date() : undefined;
    const closedAt = dto.status === TicketStatus.CLOSED && !ticket.closedAt ? new Date() : undefined;

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...dto,
        ...(resolvedAt ? { resolvedAt } : {}),
        ...(closedAt ? { closedAt } : {}),
        events: events.length ? { create: events } : undefined,
      },
      include: TICKET_INCLUDE,
    });

    if (dto.status) await this.sla.refreshMetric(id);
    return updated;
  }

  async assign(id: string, dto: AssignTicketDto, actor: { id: string; role: Role }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException();
    this.assertCanManage(ticket, actor);

    const wasAssigned = !!ticket.assigneeId;
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        assigneeId: dto.assigneeId,
        status: TicketStatus.ASSIGNED,
        events: {
          create: {
            type: wasAssigned ? 'REASSIGNED' : 'ASSIGNED',
            actorId: actor.id,
            meta: { from: ticket.assigneeId, to: dto.assigneeId },
          },
        },
      },
      include: TICKET_INCLUDE,
    });

    await this.notifyUsers([dto.assigneeId], id, 'ASSIGNED', `تیکت #${ticket.number} به شما تخصیص یافت`);
    return updated;
  }

  async transfer(id: string, dto: TransferTicketDto, actor: { id: string; role: Role }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException();
    this.assertCanManage(ticket, actor);

    const config = await this.prisma.ticketDepartmentConfig.findFirst({
      where: { departmentId: dto.departmentId, isEnabled: true },
    });
    if (!config) throw new BadRequestException('دپارتمان مقصد تیکت‌پذیر نیست');

    const category = await this.prisma.ticketCategory.findFirst({
      where: { id: dto.categoryId, configId: config.id, isActive: true },
    });
    if (!category) throw new BadRequestException('موضوع معتبر نیست');

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        departmentId: dto.departmentId,
        categoryId: dto.categoryId,
        assigneeId: null,
        status: TicketStatus.OPEN,
        events: {
          create: {
            type: 'TRANSFERRED',
            actorId: actor.id,
            meta: { fromDept: ticket.departmentId, toDept: dto.departmentId, note: dto.note },
          },
        },
      },
      include: TICKET_INCLUDE,
    });

    await this.notifyManagers(config.id, id, 'TRANSFERRED', `تیکت #${ticket.number} منتقل شد`);
    await this.sla.refreshMetric(id);
    return updated;
  }

  async closeTicket(id: string, actor: { id: string; role: Role }) {
    return this.update(id, { status: TicketStatus.CLOSED }, actor);
  }

  async reopenTicket(id: string, actor: { id: string; role: Role }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException();
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.REOPENED,
        resolvedAt: null,
        closedAt: null,
        events: { create: { type: 'REOPENED', actorId: actor.id } },
      },
      include: TICKET_INCLUDE,
    });
    await this.sla.refreshMetric(id);
    return updated;
  }

  async getMyNotifications(userId: string) {
    return this.prisma.ticketNotification.findMany({
      where: { userId },
      include: { ticket: { select: { id: true, number: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationRead(notifId: string, userId: string) {
    return this.prisma.ticketNotification.updateMany({
      where: { id: notifId, userId },
      data: { isRead: true },
    });
  }

  async markAllNotificationsRead(userId: string) {
    return this.prisma.ticketNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async userDeptIds(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, userDepartments: { select: { departmentId: true } } },
    });
    if (!user) return [];
    const ids = user.userDepartments.map(d => d.departmentId);
    if (user.departmentId) ids.push(user.departmentId);
    return [...new Set(ids)];
  }

  private assertAccess(ticket: any, user: { id: string; role: Role }) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.MANAGER) return; // dept scope already filtered in findAll
    if (ticket.requesterId === user.id) return;
    if (ticket.assigneeId === user.id) return;
    if (ticket.ccUserIds?.includes(user.id)) return;
    throw new ForbiddenException('دسترسی ندارید');
  }

  private assertCanManage(ticket: any, user: { id: string; role: Role }) {
    if (user.role === Role.ADMIN || user.role === Role.MANAGER) return;
    // Users can only change their own ticket status to specific states
    if (ticket.requesterId === user.id) return;
    throw new ForbiddenException('دسترسی ندارید');
  }

  private async notifyUsers(userIds: string[], ticketId: string, type: string, body: string) {
    if (!userIds.length) return;
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, select: { number: true } });
    await this.prisma.ticketNotification.createMany({
      data: userIds.map(uid => ({
        userId: uid,
        ticketId,
        type,
        title: `تیکت #${ticket?.number ?? ''}`,
        body,
      })),
      skipDuplicates: true,
    });
  }

  private async notifyManagers(configId: string, ticketId: string, type: string, body: string) {
    const managers = await this.prisma.ticketDeptManager.findMany({
      where: { configId },
      select: { userId: true },
    });
    await this.notifyUsers(managers.map(m => m.userId), ticketId, type, body);
  }
}
