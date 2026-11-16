import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Page } from '../permissions/page.decorator';
import { PagePermissionGuard } from '../permissions/page.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveDeptScope } from '../attendance/scope.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly prisma: PrismaService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'EXPERT', 'USER')
  @Page('/dashboard/users')
  @UseGuards(PagePermissionGuard)
  findAll(@Req() req: any) { return this.usersService.findAll(req.user); }

  // Minimal people list for pickers on pages other than /dashboard/users (records, work-log
  // reports, analytics, access). Same visibility scoping as findAll, but only name/card/phone.
  @Get('brief')
  @Roles('ADMIN', 'MANAGER', 'EXPERT', 'USER')
  @PageAccess({
    pages: [
      '/dashboard/users', '/dashboard/attendance/records', '/dashboard/attendance/monthly', '/dashboard/attendance/shifts',
      '/dashboard/attendance/sync', '/dashboard/work-log/reports', '/dashboard/analytics',
      '/dashboard/assets', '/dashboard/assets/assignments', '/dashboard/tickets', '/dashboard/tickets/settings',
      '/dashboard/notifications/announcements', '/dashboard/performance', '/dashboard/departments',
    ],
    action: 'read',
  })
  @UseGuards(PageAccessGuard)
  async brief(@Req() req: any) {
    // Full access to daily records lifts a manager's own-department limit here too.
    const unrestricted = (await resolveDeptScope(this.prisma, req.user, '/dashboard/attendance/records')) === undefined;
    const users: any[] = await this.usersService.findAll(unrestricted ? { ...req.user, role: 'ADMIN' } : req.user);
    return users.map(u => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, phone: u.phone, email: u.email,
      attendanceCardNo: u.attendanceCardNo, role: u.role, disabled: u.disabled, departmentId: u.departmentId, department: u.department ? { id: u.department.id, name: u.department.name } : null,
    }));
  }

  @Get('me')
  me(@Req() req: any) { return this.usersService.findOne(req.user.userId); }

  @Patch('me')
  updateMe(@Req() req: any, @Body() body: any) { return this.usersService.update(req.user.userId, { firstName: body.firstName, lastName: body.lastName, phone: body.phone }); }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'EXPERT', 'USER')
  @Page('/dashboard/users')
  @UseGuards(PagePermissionGuard)
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  @Roles('ADMIN')
  create(@Body() body: any) { return this.usersService.create(body); }

  @Post('bulk')
  @Roles('ADMIN', 'MANAGER')
  bulkCreate(@Req() req: any, @Body() body: { users: any[] }) {
    return this.usersService.bulkCreate(body.users || [], req.user);
  }

  // Bulk actions from the users grid (department assignment, enable/disable, role, purge cards).
  @Post('bulk-action')
  @Roles('ADMIN')
  bulkAction(@Req() req: any, @Body() body: any) {
    return this.usersService.bulk(req.user.userId ?? req.user.id, body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) { return this.usersService.update(id, body); }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) { return this.usersService.remove(id); }
}
