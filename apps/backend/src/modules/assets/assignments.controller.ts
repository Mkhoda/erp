import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asset-assignments')
export class AssetAssignmentsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  list(@Query('assetId') assetId?: string) {
    return (this.prisma as any).assetAssignment.findMany({
      where: assetId ? { assetId } : undefined,
  include: { asset: true, user: true, department: true, building: true, floor: true, room: true, assignedBy: true } as any,
      orderBy: { assignedAt: 'desc' },
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() data: any, @Req() req: any) {
    const assignedById = req?.user?.userId as string | undefined;
    const assetId = data?.assetId as string;
    const purpose: string | undefined = data?.purpose;
    if (!assetId) {
      throw new (require('@nestjs/common').BadRequestException)('assetId is required');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // close previous active assignment for this asset (if any)
      const active = await tx.assetAssignment.findFirst({ where: { assetId, returnedAt: null }, orderBy: { assignedAt: 'desc' } });
      if (active) {
        await tx.assetAssignment.update({ where: { id: active.id }, data: { returnedAt: now } });
      }
      
      // update asset availability based on purpose
      const maintenance = !!(purpose && /\u062A\u0639\u0645\u06CC\u0631/.test(purpose)); // contains "تعمیر"
      const availability = maintenance ? 'MAINTENANCE' : 'IN_USE';
      await tx.asset.update({ where: { id: assetId }, data: { availability } });
      
      // create new assignment
      const created = await (tx as any).assetAssignment.create({
        data: { ...data, assignedById, assignedAt: now },
        include: { asset: true, user: true, department: true, building: true, floor: true, room: true, assignedBy: true } as any,
      });
      
      return created;
    }, {
      timeout: 15000, // Increase timeout to 15 seconds
    });
    return result;
  }

  @Patch(':id/return')
  @Roles('ADMIN', 'MANAGER')
  async returnAsset(@Param('id') id: string) {
    const now = new Date();
    const updated = await this.prisma.assetAssignment.update({ where: { id }, data: { returnedAt: now } });
    // When explicitly returning, mark asset as AVAILABLE
    await this.prisma.asset.update({ where: { id: updated.assetId }, data: { availability: 'AVAILABLE' } });
    return updated;
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.prisma.assetAssignment.delete({ where: { id } });
  }
}
