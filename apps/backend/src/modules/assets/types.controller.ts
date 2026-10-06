import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { AssetsPrismaErrorFilter } from './prisma-error.filter';

@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/assets/types'], readAlso: ['/dashboard/assets'] })
@UseFilters(AssetsPrismaErrorFilter)
@Controller('asset-types')
export class AssetTypesController {
  constructor(private prisma: PrismaService) {}

  private async pick(data: any, selfId?: string) {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('نام نوع دارایی الزامی است');
    const dup = await this.prisma.assetType.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, ...(selfId ? { NOT: { id: selfId } } : {}) } });
    if (dup) throw new BadRequestException('نوعی با این نام قبلاً ثبت شده است');
    const description = typeof data?.description === 'string' && data.description.trim() ? data.description.trim() : null;
    return { name, description };
  }

  @Get()
  list() { return this.prisma.assetType.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { assets: true } } } }); }

  @Post()
  async create(@Body() data: any) { return this.prisma.assetType.create({ data: await this.pick(data) }); }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    if (!(await this.prisma.assetType.findUnique({ where: { id } }))) throw new NotFoundException('نوع دارایی یافت نشد');
    return this.prisma.assetType.update({ where: { id }, data: await this.pick(data, id) });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const t = await this.prisma.assetType.findUnique({ where: { id }, include: { _count: { select: { assets: true } } } });
    if (!t) throw new NotFoundException('نوع دارایی یافت نشد');
    if (t._count.assets > 0) throw new BadRequestException(`این نوع به ${t._count.assets} دارایی اختصاص دارد و قابل حذف نیست`);
    await this.prisma.assetType.delete({ where: { id } });
    return { ok: true };
  }
}
