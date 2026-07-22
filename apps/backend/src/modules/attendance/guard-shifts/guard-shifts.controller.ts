import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Page } from '../../permissions/page.decorator';
import { PagePermissionGuard } from '../../permissions/page.guard';
import { GuardShiftsService } from './guard-shifts.service';

@UseGuards(JwtAuthGuard, RolesGuard, PagePermissionGuard)
@Roles('ADMIN')
@Page('/dashboard/attendance/shifts')
@Controller('attendance/guard-shifts')
export class GuardShiftsController {
  constructor(private readonly guardShifts: GuardShiftsService) {}

  // ── Shift templates (duty length + deficit/absence thresholds) — ADMIN only,
  // these change how deficit/absence is computed for every assigned guard. ──
  @Get()
  @Roles('ADMIN', 'MANAGER')
  list() {
    return this.guardShifts.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.guardShifts.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.guardShifts.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.guardShifts.remove(id);
  }

  // ── Assignments (who is on which guard shift, since when) — ADMIN only ──
  @Get('assignments')
  @Roles('ADMIN', 'MANAGER')
  listAssignments(@Query('shiftId') shiftId?: string) {
    return this.guardShifts.listAssignments(shiftId);
  }

  @Post('assignments')
  createAssignment(@Body() body: any) {
    return this.guardShifts.createAssignment(body);
  }

  @Delete('assignments/:id')
  removeAssignment(@Param('id') id: string) {
    return this.guardShifts.removeAssignment(id);
  }

  // ── Calendar (on-duty days) — supervisors (MANAGER) can also maintain this ──
  @Get('calendar')
  @Roles('ADMIN', 'MANAGER')
  listCalendar(@Query('userId') userId: string, @Query('jYear') jYear?: string, @Query('jMonth') jMonth?: string) {
    return this.guardShifts.listCalendar(userId, jYear ? +jYear : undefined, jMonth ? +jMonth : undefined);
  }

  @Post('calendar')
  @Roles('ADMIN', 'MANAGER')
  markOnDuty(@Body() body: any) {
    return this.guardShifts.markOnDuty(body);
  }

  @Delete('calendar')
  @Roles('ADMIN', 'MANAGER')
  unmarkOnDuty(@Query('userId') userId: string, @Query('date') date: string) {
    return this.guardShifts.unmarkOnDuty(userId, date);
  }
}
