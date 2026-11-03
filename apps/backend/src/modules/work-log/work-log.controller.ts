import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Page } from '../permissions/page.decorator';
import { PagePermissionGuard } from '../permissions/page.guard';
import { WorkLogService } from './work-log.service';

const uid = (req: any) => req.user.userId ?? req.user.id;

// Employee self-service — every authenticated user, always scoped to themselves.
@UseGuards(JwtAuthGuard)
@Controller('work-log/me')
export class MyWorkLogController {
  constructor(private readonly service: WorkLogService) {}

  @Get('board')
  board(@Req() req: any, @Query('date') date?: string) { return this.service.board(uid(req), date); }

  @Post('categories')
  createCategory(@Req() req: any, @Body() body: any) { return this.service.createCategory(uid(req), body); }
  @Patch('categories/:id')
  updateCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.updateCategory(uid(req), id, body); }
  @Delete('categories/:id')
  removeCategory(@Req() req: any, @Param('id') id: string) { return this.service.removeCategory(uid(req), id); }

  @Post('tasks')
  createTask(@Req() req: any, @Body() body: any) { return this.service.createTask(uid(req), body); }
  @Patch('tasks/:id')
  updateTask(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.updateTask(uid(req), id, body); }
  @Delete('tasks/:id')
  removeTask(@Req() req: any, @Param('id') id: string) { return this.service.removeTask(uid(req), id); }
  @Post('tasks/:id/done')
  setDone(@Req() req: any, @Param('id') id: string, @Body() body: { done: boolean }) { return this.service.setDone(uid(req), id, !!body?.done); }

  @Post('entries')
  createEntry(@Req() req: any, @Body() body: any) { return this.service.createEntry(uid(req), body); }
  @Patch('entries/:id')
  updateEntry(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.updateEntry(uid(req), id, body); }
  @Delete('entries/:id')
  removeEntry(@Req() req: any, @Param('id') id: string) { return this.service.removeEntry(uid(req), id); }

  @Put('report')
  saveReport(@Req() req: any, @Body() body: any) { return this.service.saveReport(uid(req), body); }
}

// Review + catalog management for anyone who can see the page (department/role or per-person
// grant). Non-admins are scoped to their own departments inside the service; global
// (all-users) items and settings are ADMIN-only.
@UseGuards(JwtAuthGuard, RolesGuard, PagePermissionGuard)
@Page('/dashboard/work-log/reports')
@Controller('work-log/admin')
export class AdminWorkLogController {
  constructor(private readonly service: WorkLogService) {}

  @Get('days')
  days(@Req() req: any, @Query() q: any) { return this.service.adminDays(req.user, q); }

  @Get('day')
  day(@Req() req: any, @Query('userId') userId: string, @Query('date') date: string) { return this.service.adminDay(req.user, userId, date); }

  @Get('catalog')
  catalog(@Req() req: any, @Query() q: any) { return this.service.adminCatalog(req.user, q); }

  @Post('categories')
  createCategory(@Req() req: any, @Body() body: any) { return this.service.adminCreateCategory(req.user, body); }
  @Patch('categories/:id')
  updateCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.adminUpdateCategory(req.user, id, body); }
  @Delete('categories/:id')
  removeCategory(@Req() req: any, @Param('id') id: string) { return this.service.adminRemoveCategory(req.user, id); }

  @Post('tasks')
  createTask(@Req() req: any, @Body() body: any) { return this.service.adminCreateTask(req.user, body); }
  @Patch('tasks/:id')
  updateTask(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.adminUpdateTask(req.user, id, body); }
  @Delete('tasks/:id')
  removeTask(@Req() req: any, @Param('id') id: string) { return this.service.adminRemoveTask(req.user, id); }

  @Get('settings')
  settings() { return this.service.getSettings(); }

  @Patch('settings')
  @Roles('ADMIN')
  updateSettings(@Body() body: any) { return this.service.updateSettings(body); }
}
