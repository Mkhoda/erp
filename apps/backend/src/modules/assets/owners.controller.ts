import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PageAccess, PageAccessGuard } from '../permissions/page-access.guard';
import { AssetsPrismaErrorFilter } from './prisma-error.filter';

// تعلق — the organizations/companies an asset can belong to. Managed from the assets page,
// so it follows that page's view / add-edit / delete flags.
@UseGuards(JwtAuthGuard, PageAccessGuard)
@PageAccess({ pages: ['/dashboard/assets'], readAlso: ['/dashboard/reports'] })
@UseFilters(AssetsPrismaErrorFilter)
@Controller('asset-owners')
export class AssetOwnersController {
  constructor(private prisma: PrismaService) {}

  private async pick(data: any, selfId?: string) {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new BadRequestException('نام سازمان الزامی است');
    const dup = await this.prisma.assetOwner.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, ...(selfId ? { NOT: { id: selfId } } : {}) } });
    if (dup) throw new BadRequestException('سازمانی با این نام قبلاً ثبت شده است');
    const description = typeof data?.description === 'string' && data.description.trim() ? data.description.trim() : null;
    return { name, description, sortOrder: Math.round(+data?.sortOrder || 0) };
  }

  @Get()
  list() {
    return this.prisma.assetOwner.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { assets: true } } } });
  }

  @Post()
  async create(@Body() data: any) { return this.prisma.assetOwner.create({ data: await this.pick(data) }); }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    if (!(await this.prisma.assetOwner.findUnique({ where: { id } }))) throw new NotFoundException('سازمان یافت نشد');
    return this.prisma.assetOwner.update({ where: { id }, data: await this.pick(data, id) });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const o = await this.prisma.assetOwner.findUnique({ where: { id }, include: { _count: { select: { assets: true } } } });
    if (!o) throw new NotFoundException('سازمان یافت نشد');
    if (o._count.assets > 0) throw new BadRequestException(`${o._count.assets} دارایی به این سازمان تعلق دارد و قابل حذف نیست`);
    await this.prisma.assetOwner.delete({ where: { id } });
    return { ok: true };
  }
}
