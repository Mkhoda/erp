import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { SchedulesService } from './schedules.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('attendance')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get('work-schedule')
  @Page('/dashboard/attendance/work-rules')
  getSchedule() {
    return this.schedules.getDefault();
  }

  @Put('work-schedule')
  @Page('/dashboard/attendance/work-rules')
  updateSchedule(@Body() body: any) {
    return this.schedules.updateDefault(body);
  }

  // Per-user rule (used from the users panel).
  @Get('user-rules/:userId')
  getUserRule(@Param('userId') userId: string) {
    return this.schedules.getUserRule(userId);
  }

  @Put('user-rules/:userId')
  upsertUserRule(@Param('userId') userId: string, @Body() body: any) {
    return this.schedules.upsertUserRule(userId, body);
  }
}
