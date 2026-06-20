import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecordsService, RecordFilter } from './records.service';
import { resolveDeptScope, parseWorkDate } from '../scope.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Page('/dashboard/attendance/records')
@Controller('attendance/records')
export class RecordsController {
  constructor(
    private readonly records: RecordsService,
    private readonly prisma: PrismaService,
  ) {}

  private async filterFrom(req: any, q: any): Promise<RecordFilter> {
    return {
      jYear: q.jYear ? +q.jYear : undefined,
      jMonth: q.jMonth ? +q.jMonth : undefined,
      userId: q.userId || undefined,
      departmentId: q.departmentId || undefined,
      status: q.status || undefined,
      scopeDepartmentIds: await resolveDeptScope(this.prisma, req.user),
    };
  }

  @Get()
  async list(@Req() req: any, @Query() q: any) {
    return this.records.list(await this.filterFrom(req, q), q.take ? Math.min(+q.take, 5000) : 1500);
  }

  @Get('summary')
  async summary(@Req() req: any, @Query() q: any) {
    return this.records.summary(await this.filterFrom(req, q));
  }

  @Get('day')
  async day(@Query('userId') userId: string, @Query('date') date: string) {
    return this.records.dayDetail(userId, parseWorkDate(date));
  }
}
