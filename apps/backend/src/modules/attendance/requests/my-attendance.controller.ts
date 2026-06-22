import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RecordsService } from '../records/records.service';
import { RequestsService } from './requests.service';

// Employee self-service — every authenticated user sees only their own data.
@UseGuards(JwtAuthGuard)
@Controller('attendance/me')
export class MyAttendanceController {
  constructor(
    private readonly records: RecordsService,
    private readonly requests: RequestsService,
  ) {}

  private uid(req: any): string {
    return req.user?.userId ?? req.user?.id;
  }

  @Get('days')
  days(@Req() req: any, @Query() q: any) {
    return this.records.list({
      userId: this.uid(req),
      jYear: q.jYear ? +q.jYear : undefined,
      jMonth: q.jMonth ? +q.jMonth : undefined,
      status: q.status || undefined,
    });
  }

  @Get('summary')
  summary(@Req() req: any, @Query() q: any) {
    return this.records.summary({
      userId: this.uid(req),
      jYear: q.jYear ? +q.jYear : undefined,
      jMonth: q.jMonth ? +q.jMonth : undefined,
    });
  }

  @Get('periods')
  periods(@Req() req: any) {
    return this.records.periods({ userId: this.uid(req) });
  }

  @Get('requests')
  myRequests(@Req() req: any) {
    return this.requests.listForUser(this.uid(req));
  }

  @Post('requests')
  create(@Req() req: any, @Body() body: any) {
    return this.requests.create(this.uid(req), body);
  }
}
