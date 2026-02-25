import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Page } from '../permissions/page.decorator';
import { PagePermissionGuard } from '../permissions/page.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @Page('/dashboard/users')
  @UseGuards(PagePermissionGuard)
  findAll(@Req() req: any) { return this.usersService.findAll(req.user); }

  @Get('me')
  me(@Req() req: any) { return this.usersService.findOne(req.user.userId); }

  @Patch('me')
  updateMe(@Req() req: any, @Body() body: any) { return this.usersService.update(req.user.userId, { firstName: body.firstName, lastName: body.lastName }); }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
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
