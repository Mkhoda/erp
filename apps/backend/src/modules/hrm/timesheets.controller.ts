import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards, Req, ForbiddenException, Query, Res } from '@nestjs/common';
import { TimesheetsService } from './timesheets.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import ExcelJS from 'exceljs';

@UseGuards(JwtAuthGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get()
  async findAll(@Req() req: any) {
    const role = req.user?.role;
    if (role === 'ADMIN' || role === 'MANAGER') return this.timesheetsService.findAll();
    return this.timesheetsService.findByUser(req.user.userId);
  }

  @Get('manage')
  async findAllForManagement(@Req() req: any) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException('فقط مدیران دسترسی به این بخش دارند');
    }
    return this.timesheetsService.findAllWithUsers();
  }

  @Get('export')
  async exportUserTimesheets(@Req() req: any, @Res() res: any) {
    const timesheets = await this.timesheetsService.findByUser(req.user.userId);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ساعات کاری');
    
    worksheet.columns = [
      { header: 'تاریخ', key: 'date', width: 15 },
      { header: 'ساعات', key: 'hours', width: 10 },
      { header: 'پروژه', key: 'project', width: 20 },
      { header: 'توضیحات', key: 'note', width: 30 },
      { header: 'وضعیت', key: 'approved', width: 15 }
    ];

    timesheets.forEach(ts => {
      worksheet.addRow({
        date: new Date(ts.date).toLocaleDateString('fa-IR'),
        hours: ts.hours,
        project: ts.project || '-',
        note: ts.note || '-',
        approved: ts.approved ? 'تایید شده' : 'در انتظار تایید'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=timesheet.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('export/manage')
  async exportManageTimesheets(@Req() req: any, @Res() res: any, @Query() query: any) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException('فقط مدیران دسترسی به این بخش دارند');
    }

    const timesheets = await this.timesheetsService.findAllWithUsersFiltered(query);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('گزارش ساعات کاری');
    
    worksheet.columns = [
      { header: 'کاربر', key: 'user', width: 20 },
      { header: 'دپارتمان', key: 'department', width: 20 },
      { header: 'تاریخ', key: 'date', width: 15 },
      { header: 'ساعات', key: 'hours', width: 10 },
      { header: 'پروژه', key: 'project', width: 20 },
      { header: 'توضیحات', key: 'note', width: 30 },
      { header: 'وضعیت', key: 'approved', width: 15 }
    ];

    timesheets.forEach(ts => {
      worksheet.addRow({
        user: ts.user ? `${ts.user.firstName} ${ts.user.lastName}` : '-',
        department: ts.user?.department?.name || '-',
        date: new Date(ts.date).toLocaleDateString('fa-IR'),
        hours: ts.hours,
        project: ts.project || '-',
        note: ts.note || '-',
        approved: ts.approved ? 'تایید شده' : 'در انتظار تایید'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=timesheet_report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const ts = await this.timesheetsService.findOne(id);
    const role = req.user?.role;
    if (role === 'ADMIN' || role === 'MANAGER' || ts?.userId === req.user.userId) return ts;
    throw new ForbiddenException();
  }

  @Post()
  create(@Req() req: any, @Body() body: any) { 
    return this.timesheetsService.create({ ...body, userId: req.user.userId }); 
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const ts = await this.timesheetsService.findOne(id);
    const role = req.user?.role;
    if (role === 'ADMIN' || role === 'MANAGER' || ts?.userId === req.user.userId) {
      return this.timesheetsService.update(id, body);
    }
    throw new ForbiddenException();
  }

  @Patch(':id/approve')
  async approve(@Req() req: any, @Param('id') id: string) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException('فقط مدیران می‌توانند ساعات کاری را تایید کنند');
    }
    return this.timesheetsService.update(id, { approved: true });
  }

  @Patch(':id/reject')
  async reject(@Req() req: any, @Param('id') id: string) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      throw new ForbiddenException('فقط مدیران می‌توانند ساعات کاری را رد کنند');
    }
    return this.timesheetsService.update(id, { approved: false });
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const ts = await this.timesheetsService.findOne(id);
    const role = req.user?.role;
    if (role === 'ADMIN' || role === 'MANAGER' || ts?.userId === req.user.userId) {
      return this.timesheetsService.remove(id);
    }
    throw new ForbiddenException();
  }
}
