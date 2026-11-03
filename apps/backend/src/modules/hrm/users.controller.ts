import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Page } from '../permissions/page.decorator';
import { PagePermissionGuard } from '../permissions/page.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    pages: ['/dashboard/users', '/dashboard/attendance/records', '/dashboard/attendance/monthly', '/dashboard/work-log/reports', '/dashboard/analytics'],
    action: 'read',
  })
  @UseGuards(PageAccessGuard)
  async brief(@Req() req: any) {
    const users: any[] = await this.usersService.findAll(req.user);
    return users.map(u => ({
      id: u.id, firstName: u.firstName, lastName: u.lastName, phone: u.phone,
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

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) { return this.usersService.update(id, body); }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) { return this.usersService.remove(id); }
}
