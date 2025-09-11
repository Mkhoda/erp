import { Controller, Get, Query, UseGuards, Req, ForbiddenException, Res } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getReports(@Req() req: any, @Query() query: any) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException('فقط مدیران دسترسی به گزارشات دارند');
    }

    const year = parseInt(query.year) || new Date().getFullYear();
    
    // Get all timesheets for the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate
        }
      },
      include: {
        user: {
          include: {
            department: true
          }
        }
      }
    });

    // Group by month
    const timesheetsByMonth = Array.from({ length: 12 }, (_, i) => {
      const monthTimesheets = timesheets.filter((ts: any) => new Date(ts.date).getMonth() === i);
      const persianMonths = [
        'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
      ];
      
      return {
        month: persianMonths[i],
        hours: monthTimesheets.reduce((sum: number, ts: any) => sum + ts.hours, 0),
        count: monthTimesheets.length
      };
    });

    // Group by department
    const departmentMap = new Map();
    timesheets.forEach((ts: any) => {
      const deptName = ts.user?.department?.name || 'بدون دپارتمان';
      if (!departmentMap.has(deptName)) {
        departmentMap.set(deptName, { department: deptName, hours: 0, count: 0 });
      }
      const dept = departmentMap.get(deptName);
      dept.hours += ts.hours;
      dept.count += 1;
    });
    const timesheetsByDepartment = Array.from(departmentMap.values());

    // Group by user
    const userMap = new Map();
    timesheets.forEach((ts: any) => {
      const userName = `${ts.user?.firstName} ${ts.user?.lastName}`;
      if (!userMap.has(userName)) {
        userMap.set(userName, { user: userName, hours: 0, approved: 0, pending: 0 });
      }
      const user = userMap.get(userName);
      user.hours += ts.hours;
      if (ts.approved) {
        user.approved += 1;
      } else {
        user.pending += 1;
      }
    });
    const timesheetsByUser = Array.from(userMap.values())
      .sort((a: any, b: any) => b.hours - a.hours);

    // Monthly stats
    const monthlyStats = {
      totalHours: timesheets.reduce((sum: number, ts: any) => sum + ts.hours, 0),
      totalTimesheets: timesheets.length,
      approvedTimesheets: timesheets.filter((ts: any) => ts.approved).length,
      pendingTimesheets: timesheets.filter((ts: any) => !ts.approved).length,
      averageHoursPerDay: timesheets.length > 0 ? 
        timesheets.reduce((sum: number, ts: any) => sum + ts.hours, 0) / timesheets.length : 0
    };

    return {
      timesheetsByMonth,
      timesheetsByDepartment,
      timesheetsByUser,
      monthlyStats
    };
  }

  @Get('export/:type')
  async exportReport(@Req() req: any, @Res() res: any, @Query() query: any) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException('فقط مدیران دسترسی به گزارشات دارند');
    }

    const reportData = await this.getReports(req, query);
    const type = req.params.type;
    
    const workbook = new (ExcelJS as any).Workbook();
    const worksheet = workbook.addWorksheet(`گزارش ${type}`);

    switch (type) {
      case 'overview':
        worksheet.columns = [
          { header: 'شاخص', key: 'metric', width: 20 },
          { header: 'مقدار', key: 'value', width: 15 }
        ];
        
        worksheet.addRow({ metric: 'کل ساعات', value: reportData.monthlyStats.totalHours });
        worksheet.addRow({ metric: 'کل گزارشات', value: reportData.monthlyStats.totalTimesheets });
        worksheet.addRow({ metric: 'تایید شده', value: reportData.monthlyStats.approvedTimesheets });
        worksheet.addRow({ metric: 'در انتظار', value: reportData.monthlyStats.pendingTimesheets });
        break;

      case 'timesheets':
        worksheet.columns = [
          { header: 'ماه', key: 'month', width: 15 },
          { header: 'ساعات', key: 'hours', width: 10 },
          { header: 'تعداد', key: 'count', width: 10 }
        ];
        
        reportData.timesheetsByMonth.forEach(item => {
          worksheet.addRow(item);
        });
        break;

      case 'departments':
        worksheet.columns = [
          { header: 'دپارتمان', key: 'department', width: 20 },
          { header: 'ساعات', key: 'hours', width: 10 },
          { header: 'تعداد', key: 'count', width: 10 }
        ];
        
        reportData.timesheetsByDepartment.forEach(item => {
          worksheet.addRow(item);
        });
        break;

      case 'users':
        worksheet.columns = [
          { header: 'کاربر', key: 'user', width: 20 },
          { header: 'ساعات', key: 'hours', width: 10 },
          { header: 'تایید شده', key: 'approved', width: 12 },
          { header: 'در انتظار', key: 'pending', width: 12 }
        ];
        
        reportData.timesheetsByUser.forEach(item => {
          worksheet.addRow(item);
        });
        break;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  }
}
