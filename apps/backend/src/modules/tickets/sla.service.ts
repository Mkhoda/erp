import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SlaService {
  constructor(private prisma: PrismaService) {}

  /** Calculate due dates based on dept config SLA hours and business hours */
  calcDueDates(
    createdAt: Date,
    config: { slaFirstResponseHours: number; slaResolutionHours: number; workHoursStart: string; workHoursEnd: string; workDays: number[] },
    categoryOverride?: { slaFirstResponseHours?: number | null; slaResolutionHours?: number | null },
  ) {
    const firstResponseHours = categoryOverride?.slaFirstResponseHours ?? config.slaFirstResponseHours;
    const resolutionHours = categoryOverride?.slaResolutionHours ?? config.slaResolutionHours;
    return {
      firstResponseDueAt: this.addBusinessHours(createdAt, firstResponseHours, config),
      resolutionDueAt: this.addBusinessHours(createdAt, resolutionHours, config),
    };
  }

  /** Add N business hours to a date, skipping non-work days and outside work hours */
  addBusinessHours(
    start: Date,
    hoursToAdd: number,
    config: { workHoursStart: string; workHoursEnd: string; workDays: number[] },
  ): Date {
    const [startH, startM] = config.workHoursStart.split(':').map(Number);
    const [endH, endM] = config.workHoursEnd.split(':').map(Number);
    const workStartMin = startH * 60 + startM;
    const workEndMin = endH * 60 + endM;
    const workMinutesPerDay = workEndMin - workStartMin;

    let remaining = hoursToAdd * 60;
    let current = new Date(start);

    // Snap to work hours if outside
    if (!config.workDays.includes(current.getDay())) {
      current = this.nextWorkDayStart(current, config);
    } else {
      const minOfDay = current.getHours() * 60 + current.getMinutes();
      if (minOfDay < workStartMin) {
        current.setHours(startH, startM, 0, 0);
      } else if (minOfDay >= workEndMin) {
        current = this.nextWorkDayStart(current, config);
      }
    }

    while (remaining > 0) {
      const minOfDay = current.getHours() * 60 + current.getMinutes();
      const availableToday = workEndMin - minOfDay;
      if (remaining <= availableToday) {
        current = new Date(current.getTime() + remaining * 60 * 1000);
        remaining = 0;
      } else {
        remaining -= availableToday;
        current = this.nextWorkDayStart(current, config);
      }
    }
    return current;
  }

  private nextWorkDayStart(
    date: Date,
    config: { workHoursStart: string; workDays: number[] },
  ): Date {
    const [h, m] = config.workHoursStart.split(':').map(Number);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    next.setHours(h, m, 0, 0);
    while (!config.workDays.includes(next.getDay())) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  /** Compute elapsed business minutes between two dates */
  businessMinutesBetween(
    from: Date,
    to: Date,
    config: { workHoursStart: string; workHoursEnd: string; workDays: number[] },
  ): number {
    const [startH, startM] = config.workHoursStart.split(':').map(Number);
    const [endH, endM] = config.workHoursEnd.split(':').map(Number);
    const workStartMin = startH * 60 + startM;
    const workEndMin = endH * 60 + endM;

    let total = 0;
    const cur = new Date(from);

    while (cur < to) {
      if (config.workDays.includes(cur.getDay())) {
        const dayStart = new Date(cur);
        dayStart.setHours(startH, startM, 0, 0);
        const dayEnd = new Date(cur);
        dayEnd.setHours(endH, endM, 0, 0);

        const periodStart = cur < dayStart ? dayStart : cur;
        const periodEnd = to < dayEnd ? to : dayEnd;

        if (periodStart < periodEnd) {
          total += (periodEnd.getTime() - periodStart.getTime()) / 60000;
        }
      }
      // Advance to next calendar day
      cur.setDate(cur.getDate() + 1);
      cur.setHours(startH, startM, 0, 0);
    }
    return Math.round(total);
  }

  /** Create or refresh the SlaMetric row for a ticket */
  async refreshMetric(ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: true,
        department: { include: { ticketConfig: true } },
        events: { where: { type: 'ASSIGNED' }, orderBy: { createdAt: 'asc' }, take: 1 },
        slaMetric: true,
      },
    });
    if (!ticket) return;

    const config = ticket.department.ticketConfig;
    if (!config) return;

    const slaFirstResponseHours = ticket.category.slaFirstResponseHours ?? config.slaFirstResponseHours;
    const slaResolutionHours = ticket.category.slaResolutionHours ?? config.slaResolutionHours;

    const firstResponseDueAt = this.addBusinessHours(ticket.createdAt, slaFirstResponseHours, config);
    const resolutionDueAt = this.addBusinessHours(ticket.createdAt, slaResolutionHours, config);

    const now = new Date();
    const minutesToFirstResponse = ticket.firstResponseAt
      ? this.businessMinutesBetween(ticket.createdAt, ticket.firstResponseAt, config)
      : null;
    const minutesToFirstAssignment = ticket.events[0]
      ? this.businessMinutesBetween(ticket.createdAt, ticket.events[0].createdAt, config)
      : null;
    const minutesToResolution = ticket.resolvedAt
      ? this.businessMinutesBetween(ticket.createdAt, ticket.resolvedAt, config)
      : null;
    const minutesToClose = ticket.closedAt
      ? this.businessMinutesBetween(ticket.createdAt, ticket.closedAt, config)
      : null;

    const firstResponseBreached = ticket.firstResponseAt
      ? ticket.firstResponseAt > firstResponseDueAt
      : now > firstResponseDueAt;
    const resolutionBreached = ticket.resolvedAt
      ? ticket.resolvedAt > resolutionDueAt
      : now > resolutionDueAt;

    await this.prisma.ticketSlaMetric.upsert({
      where: { ticketId },
      create: {
        ticketId,
        slaFirstResponseHours,
        slaResolutionHours,
        firstResponseDueAt,
        resolutionDueAt,
        minutesToFirstResponse,
        minutesToFirstAssignment,
        minutesToResolution,
        minutesToClose,
        firstResponseBreached,
        resolutionBreached,
      },
      update: {
        slaFirstResponseHours,
        slaResolutionHours,
        firstResponseDueAt,
        resolutionDueAt,
        minutesToFirstResponse,
        minutesToFirstAssignment,
        minutesToResolution,
        minutesToClose,
        firstResponseBreached,
        resolutionBreached,
      },
    });

    // Mark ticket isOverSla if resolution is breached
    if (resolutionBreached !== ticket.isOverSla) {
      await this.prisma.ticket.update({ where: { id: ticketId }, data: { isOverSla: resolutionBreached } });
    }
  }
}
