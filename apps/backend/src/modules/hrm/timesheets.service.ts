import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TimesheetsService {
  constructor(private prisma: PrismaService) {}

  findAll(args?: Prisma.TimesheetFindManyArgs) { 
    return this.prisma.timesheet.findMany(args); 
  }

  findByUser(userId: string) {
    return this.prisma.timesheet.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });
  }

  findAllWithUsers() {
    return this.prisma.timesheet.findMany({
      include: {
        user: {
          include: {
            department: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  findAllWithUsersFiltered(filters: any) {
    const where: any = {};

    if (filters.filter === 'pending') {
      where.approved = false;
    } else if (filters.filter === 'approved') {
      where.approved = true;
    }

    if (filters.month !== undefined && filters.year !== undefined) {
      const startDate = new Date(filters.year, filters.month, 1);
      const endDate = new Date(filters.year, parseInt(filters.month) + 1, 0);
      
      where.date = {
        gte: startDate,
        lte: endDate
      };
    }

    return this.prisma.timesheet.findMany({
      where,
      include: {
        user: {
          include: {
            department: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  findOne(id: string) { 
    return this.prisma.timesheet.findUnique({ 
      where: { id },
      include: {
        user: {
          include: {
            department: true
          }
        }
      }
    }); 
  }

  create(data: any) { 
    return this.prisma.timesheet.create({ data }); 
  }

  update(id: string, data: any) { 
    return this.prisma.timesheet.update({ where: { id }, data }); 
  }

  remove(id: string) { 
    return this.prisma.timesheet.delete({ where: { id } }); 
  }
}
