import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asset-types')
export class AssetTypesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  list() { return (this.prisma as any).assetType.findMany({ orderBy: { name: 'asc' } }); }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() data: any) { return (this.prisma as any).assetType.create({ data }); }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() data: any) { return (this.prisma as any).assetType.update({ where: { id }, data }); }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) { return (this.prisma as any).assetType.delete({ where: { id } }); }
}
