import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseFilters, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ASSIGNMENT_INCLUDE } from './assets.service';
import { AssetsPrismaErrorFilter } from './prisma-error.filter';

const str = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const WITH_ASSET = {
  ...ASSIGNMENT_INCLUDE,
  asset: { select: { id: true, name: true, barcode: true, availability: true } },
} as const;

// Assets in these states can't be handed out
const NOT_ASSIGNABLE: Record<string, string> = {
  RETIRED: 'این دارایی خارج از رده است و قابل واگذاری نیست',
  LOST: 'این دارایی مفقود ثبت شده و قابل واگذاری نیست',
  CONSUMED: 'این دارایی مصرف شده و قابل واگذاری نیست',
};

@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(AssetsPrismaErrorFilter)
@Controller('asset-assignments')
export class AssetAssignmentsController {
  constructor(private prisma: PrismaService) {}

  /**
   * Assignment history. Every hand-over is kept as its own row (closed ones have
   * `returnedAt`), so filtering by assetId gives the full chain of custody.
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'EXPERT')
  list(
    @Query('assetId') assetId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string, // 'active' | 'returned'
  ) {
    return this.prisma.assetAssignment.findMany({
      where: {
        ...(assetId ? { assetId } : {}),
        ...(userId ? { userId } : {}),
        ...(status === 'active' ? { returnedAt: null } : status === 'returned' ? { returnedAt: { not: null } } : {}),
      },
      include: WITH_ASSET,
      orderBy: { assignedAt: 'desc' },
      take: 1000,
    });
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(@Body() data: any, @Req() req: any) {
    const assignedById = req?.user?.id as string | undefined;
    const assetId = str(data?.assetId);
    if (!assetId) throw new BadRequestException('دارایی را انتخاب کنید');

    const target = {
      userId: str(data?.userId),
      departmentId: str(data?.departmentId),
      buildingId: str(data?.buildingId),
      floorId: str(data?.floorId),
      roomId: str(data?.roomId),
    };
    if (!target.userId && !target.departmentId && !target.buildingId && !target.roomId) {
      throw new BadRequestException('تحویل‌گیرنده (کاربر یا بخش) یا مکان را مشخص کنید');
    }
    const purpose = str(data?.purpose) ?? 'استفاده';
    const note = str(data?.note);

    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, select: { id: true, availability: true } });
    if (!asset) throw new NotFoundException('دارایی یافت نشد');
    if (NOT_ASSIGNABLE[asset.availability]) throw new BadRequestException(NOT_ASSIGNABLE[asset.availability]);

    // Fill in the building/floor from the room when only the room was chosen
    if (target.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: target.roomId }, select: { buildingId: true, floorId: true } });
      if (!room) throw new BadRequestException('اتاق انتخاب‌شده معتبر نیست');
      target.buildingId = target.buildingId ?? room.buildingId;
      target.floorId = target.floorId ?? room.floorId;
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Hand-over: close the currently open assignment(s) of this asset; they stay in history
      await tx.assetAssignment.updateMany({ where: { assetId, returnedAt: null }, data: { returnedAt: now } });

      const maintenance = /تعمیر/.test(purpose);
      await tx.asset.update({ where: { id: assetId }, data: { availability: maintenance ? 'MAINTENANCE' : 'IN_USE' } });

      return tx.assetAssignment.create({
        data: { assetId, ...target, purpose, note, assignedById: assignedById ?? null, assignedAt: now },
        include: WITH_ASSET,
      });
    }, { timeout: 15000 });
  }

  /** Ends an active assignment (asset returned to stock). */
  @Patch(':id/return')
  @Roles('ADMIN', 'MANAGER')
  async returnAsset(@Param('id') id: string, @Body() body: { note?: string } = {}) {
    const row = await this.prisma.assetAssignment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('واگذاری یافت نشد');
    if (row.returnedAt) throw new BadRequestException('این واگذاری قبلاً بازگشت خورده است');

    const returnNote = str(body?.note);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.assetAssignment.update({
        where: { id },
        data: {
          returnedAt: new Date(),
          ...(returnNote ? { note: row.note ? `${row.note}\nبازگشت: ${returnNote}` : `بازگشت: ${returnNote}` } : {}),
        },
        include: WITH_ASSET,
      });
      const stillOpen = await tx.assetAssignment.count({ where: { assetId: row.assetId, returnedAt: null } });
      if (!stillOpen) {
        const asset = await tx.asset.findUnique({ where: { id: row.assetId }, select: { availability: true } });
        // Don't overwrite a RETIRED/LOST/CONSUMED status set by hand
        if (asset && (asset.availability === 'IN_USE' || asset.availability === 'MAINTENANCE')) {
          await tx.asset.update({ where: { id: row.assetId }, data: { availability: 'AVAILABLE' } });
        }
      }
      return updated;
    });
  }

  /** Removes a (mistaken) assignment record. Deleting the open one frees the asset. */
  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    const row = await this.prisma.assetAssignment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('واگذاری یافت نشد');
    await this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.delete({ where: { id } });
      if (!row.returnedAt) {
        const stillOpen = await tx.assetAssignment.count({ where: { assetId: row.assetId, returnedAt: null } });
        if (!stillOpen) {
          const asset = await tx.asset.findUnique({ where: { id: row.assetId }, select: { availability: true } });
          if (asset && (asset.availability === 'IN_USE' || asset.availability === 'MAINTENANCE')) {
            await tx.asset.update({ where: { id: row.assetId }, data: { availability: 'AVAILABLE' } });
          }
        }
      }
    });
    return { ok: true };
  }
}
