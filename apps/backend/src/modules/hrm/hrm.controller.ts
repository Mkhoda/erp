import { Controller, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('hrm')
export class HrmController {
  constructor(private prisma: PrismaService) {}

  @Get('dashboard')
  async getDashboardData(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException('فقط مدیران دسترسی به این بخش دارند');
    }

    const totalEmployees = await this.prisma.user.count();
    const departmentCount = await this.prisma.department.count();
    
    const pendingTimesheets = await this.prisma.timesheet.count({
      where: { approved: false }
    });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0);

    const thisMonthTimesheets = await this.prisma.timesheet.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const thisMonthHours = thisMonthTimesheets.reduce((sum, ts) => sum + ts.hours, 0);

    // Recent activities
    const recentTimesheets = await this.prisma.timesheet.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });

    const recentUsers = await this.prisma.user.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    const recentActivities = [
      ...recentTimesheets.map(ts => ({
        id: ts.id,
        type: 'timesheet' as const,
        message: `${ts.user.firstName} ${ts.user.lastName} ساعات کاری ثبت کرد`,
        date: ts.createdAt.toISOString(),
        user: `${ts.user.firstName} ${ts.user.lastName}`
      })),
      ...recentUsers.map(user => ({
        id: user.id,
        type: 'user' as const,
        message: `کاربر جدید ${user.firstName} ${user.lastName} اضافه شد`,
        date: user.createdAt.toISOString(),
        user: `${user.firstName} ${user.lastName}`
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

    return {
      totalEmployees,
      departmentCount,
      pendingTimesheets,
      thisMonthHours: Math.round(thisMonthHours * 10) / 10,
      recentActivities
    };
  }
}
