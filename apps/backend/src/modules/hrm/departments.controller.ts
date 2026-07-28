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
  addMember(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.departmentsService.addMember(id, body.userId);
  }

  @Delete(':id/members/:userId')
  @Roles('ADMIN')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.departmentsService.removeMember(id, userId);
  }
}
