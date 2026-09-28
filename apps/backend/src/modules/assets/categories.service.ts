import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const str = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

@Injectable()
export class AssetCategoriesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true } }, parent: { select: { id: true, name: true } } },
    });
  }

  /** Only name/description/codePrefix/parentId are writable; blanks become null. */
  private async pick(data: any, selfId?: string) {
    const out: any = {};
    if (data.name !== undefined || !selfId) {
      const name = str(data.name);
      if (!name) throw new BadRequestException('نام دسته‌بندی الزامی است');
      const dup = await this.prisma.assetCategory.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, ...(selfId ? { NOT: { id: selfId } } : {}) } });
      if (dup) throw new BadRequestException('دسته‌بندی با این نام قبلاً ثبت شده است');
      out.name = name;
    }
    if (data.description !== undefined) out.description = str(data.description);
    if (data.codePrefix !== undefined) {
      const prefix = str(data.codePrefix)?.toUpperCase() ?? null;
      // used inside barcodes (PREFIX-jYYYYjMM-SEQ), so keep it barcode-safe
      if (prefix && !/^[\p{L}\p{N}]{1,10}$/u.test(prefix)) {
        throw new BadRequestException('پیشوند کد فقط می‌تواند شامل حرف و عدد (بدون فاصله و خط تیره، حداکثر ۱۰ کاراکتر) باشد');
      }
      out.codePrefix = prefix;
    }
    if (data.parentId !== undefined) {
      const parentId = str(data.parentId);
      if (parentId && parentId === selfId) throw new BadRequestException('دسته‌بندی نمی‌تواند والد خودش باشد');
      if (parentId && !(await this.prisma.assetCategory.findUnique({ where: { id: parentId } }))) {
        throw new BadRequestException('دسته‌بندی والد نامعتبر است');
      }
      out.parentId = parentId;
    }
    return out;
  }

  async create(data: any) {
    return this.prisma.assetCategory.create({ data: await this.pick(data) });
  }

  async update(id: string, data: any) {
    if (!(await this.prisma.assetCategory.findUnique({ where: { id } }))) throw new NotFoundException('دسته‌بندی یافت نشد');
    return this.prisma.assetCategory.update({ where: { id }, data: await this.pick(data, id) });
  }

  async remove(id: string) {
    const cat = await this.prisma.assetCategory.findUnique({ where: { id }, include: { _count: { select: { assets: true } } } });
    if (!cat) throw new NotFoundException('دسته‌بندی یافت نشد');
    if (cat._count.assets > 0) {
      throw new BadRequestException(`این دسته‌بندی به ${cat._count.assets} دارایی اختصاص دارد؛ ابتدا دسته آن دارایی‌ها را تغییر دهید`);
    }
    await this.prisma.$transaction([
      this.prisma.assetCategory.updateMany({ where: { parentId: id }, data: { parentId: null } }),
      this.prisma.assetCategory.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
