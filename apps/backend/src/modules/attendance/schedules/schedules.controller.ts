import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
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

  // ── Multiple schedules (groups) ──
  @Get('work-schedules')
  @Page('/dashboard/attendance/work-rules')
  list() {
    return this.schedules.list();
  }

  @Post('work-schedules')
  @Page('/dashboard/attendance/work-rules')
  create(@Body() body: any) {
    return this.schedules.create(body);
  }

  @Put('work-schedules/:id')
  @Page('/dashboard/attendance/work-rules')
  update(@Param('id') id: string, @Body() body: any) {
    return this.schedules.update(id, body);
  }

  @Delete('work-schedules/:id')
  @Page('/dashboard/attendance/work-rules')
  remove(@Param('id') id: string) {
    return this.schedules.remove(id);
  }

  // ── Back-compat: single default ──
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

  // ── Per-user rule (used from the users panel) ──
  // Schedules list is needed by the users panel (manager allowed to read).
  @Get('schedules-lite')
  @Roles('ADMIN', 'MANAGER')
  schedulesLite() {
    return this.schedules.list();
  }

  @Get('user-rules/:userId')
  @Roles('ADMIN', 'MANAGER')
  getUserRule(@Param('userId') userId: string) {
    return this.schedules.getUserRule(userId);
  }

  @Put('user-rules/:userId')
  upsertUserRule(@Param('userId') userId: string, @Body() body: any) {
    return this.schedules.upsertUserRule(userId, body);
  }
}
