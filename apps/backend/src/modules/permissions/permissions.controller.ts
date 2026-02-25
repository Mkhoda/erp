import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsService } from './permissions.service';

@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  list(@Query('departmentId') departmentId: string) {
    return this.service.list(departmentId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  upsert(@Body() body: { departmentId: string; page: string; canRead?: boolean; canWrite?: boolean }) {
    const { departmentId, page, canRead, canWrite } = body;
    return this.service.upsert(departmentId, page, { canRead, canWrite });
  }

  @Delete(':departmentId/:page')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('departmentId') departmentId: string, @Param('page') page: string) {
    return this.service.remove(departmentId, page);
  }

  // Returns effective permissions and menu pages for the current user.
  // Admins may pass ?departmentId=<id> to view permissions for that department.
  @Get('menu')
  async menu(@Req() req: any, @Query('departmentId') departmentId?: string) {
    const user = req.user;
    // Only admins may request arbitrary departmentId
    if (departmentId && user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins may request specific department permissions');
    }
    return this.service.menuForUser(user, departmentId);
  }
}
