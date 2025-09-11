import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Query('buildingId') buildingId?: string, @Query('floorId') floorId?: string) {
    const p: any = this.prisma as any;
    return p.room.findMany({ where: { AND: [buildingId ? { buildingId } : {}, floorId ? { floorId } : {}] }, orderBy: { name: 'asc' } });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const p: any = this.prisma as any;
    return p.room.findUnique({ where: { id } });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() body: any) {
    const p: any = this.prisma as any;
    return p.room.create({ data: { name: body.name, buildingId: body.buildingId, floorId: body.floorId || null } });
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() body: any) {
    const p: any = this.prisma as any;
    return p.room.update({ where: { id }, data: { name: body.name, floorId: body.floorId ?? undefined } });
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    const p: any = this.prisma as any;
    return p.room.delete({ where: { id } });
  }
}
