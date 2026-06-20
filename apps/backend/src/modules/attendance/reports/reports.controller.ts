import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecordsService } from '../records/records.service';
import { ReportsService, ReportMeta } from './reports.service';
import { resolveDeptScope } from '../scope.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Page('/dashboard/attendance/reports')
@Controller('attendance/reports')
export class ReportsController {
  constructor(
    private readonly records: RecordsService,
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  private async gather(req: any, q: any): Promise<{ rows: any[]; meta: ReportMeta }> {
    const scope = await resolveDeptScope(this.prisma, req.user);
    const rows = await this.records.list(
      {
        jYear: q.jYear ? +q.jYear : undefined,
        jMonth: q.jMonth ? +q.jMonth : undefined,
        userId: q.userId || undefined,
        departmentId: q.departmentId || undefined,
        status: q.status || undefined,
        scopeDepartmentIds: scope,
      },
      5000,
    );

    // Sort person-first then by date for a readable report.
    rows.sort((a, b) =>
      (a.userId).localeCompare(b.userId) || a.gregDate.getTime() - b.gregDate.getTime());

    const [dept, person] = await Promise.all([
      q.departmentId
        ? this.prisma.department.findUnique({ where: { id: q.departmentId }, select: { name: true } })
        : null,
      q.userId
        ? this.prisma.user.findUnique({ where: { id: q.userId }, select: { firstName: true, lastName: true } })
        : null,
    ]);

    const meta: ReportMeta = {
      title: 'گزارش حضور و غیاب',
      jYear: q.jYear ? +q.jYear : undefined,
      jMonth: q.jMonth ? +q.jMonth : undefined,
      departmentName: dept?.name,
      personName: person ? `${person.firstName} ${person.lastName}` : undefined,
    };
    return { rows, meta };
  }

  @Get('excel')
  async excel(@Req() req: any, @Query() q: any, @Res() res: Response) {
    const { rows, meta } = await this.gather(req, q);
    const wb = await this.reports.buildExcel(rows, meta);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  }

  @Get('pdf')
  async pdf(@Req() req: any, @Query() q: any, @Res() res: Response) {
    const { rows, meta } = await this.gather(req, q);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.pdf"');
    const doc = this.reports.buildPdf(rows, meta);
    doc.pipe(res);
    doc.end();
  }
}
