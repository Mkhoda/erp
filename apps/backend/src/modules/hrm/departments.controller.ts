import { Body, Controller, Get, Param, Patch, Post, Delete, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() { return this.departmentsService.findAll(); }

  // Org chart for the departments page (tree + members + people in no department).
  @Get('tree')
  @Roles('ADMIN')
  tree() { return this.departmentsService.tree(); }

  // Drag-and-drop a person between departments ("move") or into one more ("copy").
  @Post('move-member')
  @Roles('ADMIN')
  moveMember(@Body() body: any) { return this.departmentsService.moveMember(body); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.departmentsService.findOne(id); }

  @Post()
  @Roles('ADMIN')
  create(@Body() body: any) { return this.departmentsService.create(body); }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) { return this.departmentsService.update(id, body); }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) { return this.departmentsService.remove(id); }

  @Post(':id/members')
  @Roles('ADMIN')
  addMember(@Param('id') id: string, @Body() body: { userId: string; role?: string }) {
    return this.departmentsService.addMember(id, body.userId, body.role);
  }

  @Patch(':id/members/:userId')
  @Roles('ADMIN')
  setMemberRole(@Param('id') id: string, @Param('userId') userId: string, @Body() body: { role: string }) {
    return this.departmentsService.setMemberRole(id, userId, body.role);
  }

  @Post(':id/members/:userId/primary')
  @Roles('ADMIN')
  setPrimary(@Param('id') id: string, @Param('userId') userId: string) {
    return this.departmentsService.setPrimary(id, userId);
  }

  @Delete(':id/members/:userId')
  @Roles('ADMIN')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.departmentsService.removeMember(id, userId);
  }
}
