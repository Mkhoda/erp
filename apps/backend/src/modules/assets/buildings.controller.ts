import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('buildings')
export class BuildingsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Query('q') q?: string) {
  const p: any = this.prisma as any;
  return p.building.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
  const p: any = this.prisma as any;
  return p.building.findUnique({ where: { id } });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() body: any) {
  const p: any = this.prisma as any;
  return p.building.create({ data: { name: body.name } });
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() body: any) {
  const p: any = this.prisma as any;
  return p.building.update({ where: { id }, data: { name: body.name } });
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
  const p: any = this.prisma as any;
  return p.building.delete({ where: { id } });
  }
}
