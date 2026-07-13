import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus, Role } from '@prisma/client';
import { CreateCommentDto, UpdateCommentDto } from './dto/ticket.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(ticketId: string, dto: CreateCommentDto, authorId: string, authorRole: Role) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, number: true, requesterId: true, assigneeId: true, status: true, firstResponseAt: true, departmentId: true },
    });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد');

    // Only ADMIN/MANAGER can post internal notes
    if (dto.isInternal && authorRole === Role.USER) throw new ForbiddenException('امکان ثبت یادداشت داخلی ندارید');

    const isStaff = authorRole === Role.ADMIN || authorRole === Role.MANAGER || authorRole === Role.EXPERT;
    const isRequester = ticket.requesterId === authorId;

    if (!isStaff && !isRequester && ticket.assigneeId !== authorId) throw new ForbiddenException('دسترسی ندارید');

    const comment = await this.prisma.ticketComment.create({
      data: {
        ticketId,
        authorId,
        content: dto.content,
        isInternal: dto.isInternal ?? false,
        replyToId: dto.replyToId,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        attachments: true,
        replyTo: { select: { id: true, content: true, author: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    // Event log
    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: authorId,
        type: dto.isInternal ? 'INTERNAL_NOTE' : 'COMMENT_ADDED',
        meta: { commentId: comment.id },
      },
    });

    // Track first staff response for SLA
    const updates: any = {};
    if (isStaff && !ticket.firstResponseAt && !dto.isInternal) {
      updates.firstResponseAt = new Date();
    }

    // Auto-advance status
    if (!dto.isInternal) {
      if (isStaff && ticket.status === TicketStatus.OPEN) updates.status = TicketStatus.IN_PROGRESS;
      if (isStaff && ticket.status === TicketStatus.USER_REPLIED) updates.status = TicketStatus.IN_PROGRESS;
      if (isStaff && ticket.status === TicketStatus.REOPENED) updates.status = TicketStatus.IN_PROGRESS;
      if (isRequester && (ticket.status === TicketStatus.WAITING_USER || ticket.status === TicketStatus.RESOLVED)) {
        updates.status = TicketStatus.USER_REPLIED;
      }
    }

    if (Object.keys(updates).length) {
      await this.prisma.ticket.update({ where: { id: ticketId }, data: updates });
    }

    // Notifications
    const notifyIds: string[] = [];
    if (isStaff && !dto.isInternal) notifyIds.push(ticket.requesterId);
    if (isRequester && ticket.assigneeId) notifyIds.push(ticket.assigneeId);
    if (notifyIds.length) {
      await this.prisma.ticketNotification.createMany({
        data: notifyIds.map(uid => ({
          userId: uid,
          ticketId,
          type: 'REPLIED',
          title: `پاسخ جدید در تیکت #${ticket.number}`,
          body: dto.content.slice(0, 120),
        })),
        skipDuplicates: true,
      });
    }

    return comment;
  }

  async update(commentId: string, dto: UpdateCommentDto, userId: string) {
    const comment = await this.prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException();
    if (comment.authorId !== userId) throw new ForbiddenException('فقط نویسنده می‌تواند ویرایش کند');
    return this.prisma.ticketComment.update({
      where: { id: commentId },
      data: { content: dto.content, isEdited: true, editedAt: new Date() },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: true } }, attachments: true },
    });
  }

  async softDelete(commentId: string, actor: { id: string; role: Role }) {
    const comment = await this.prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException();
    if (comment.authorId !== actor.id && actor.role !== Role.ADMIN) throw new ForbiddenException();
    return this.prisma.ticketComment.update({ where: { id: commentId }, data: { isDeleted: true } });
  }
}
