import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsService } from './permissions.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  list(@Query('departmentId') departmentId: string) {
    return this.service.list(departmentId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  upsert(@Body() body: { departmentId: string; page: string; canRead?: boolean; canWrite?: boolean }) {
    const { departmentId, page, canRead, canWrite } = body;
    return this.service.upsert(departmentId, page, { canRead, canWrite });
  }

  @Delete(':departmentId/:page')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('departmentId') departmentId: string, @Param('page') page: string) {
    return this.service.remove(departmentId, page);
  }
}
