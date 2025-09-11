import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('floors')
export class FloorsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Query('buildingId') buildingId?: string) {
    const p: any = this.prisma as any;
    return p.floor.findMany({ where: buildingId ? { buildingId } : undefined, orderBy: { name: 'asc' } });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const p: any = this.prisma as any;
    return p.floor.findUnique({ where: { id } });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() body: any) {
    const p: any = this.prisma as any;
    return p.floor.create({ data: { name: body.name, buildingId: body.buildingId } });
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() body: any) {
    const p: any = this.prisma as any;
    return p.floor.update({ where: { id }, data: { name: body.name } });
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    const p: any = this.prisma as any;
    return p.floor.delete({ where: { id } });
  }
}
