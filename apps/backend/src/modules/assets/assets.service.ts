import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as moment from 'moment-jalaali';

// Never return password hashes etc. when including related users.
export const USER_BRIEF = { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } as const;

export const ASSIGNMENT_INCLUDE = {
  user: USER_BRIEF,
  assignedBy: USER_BRIEF,
  department: { select: { id: true, name: true } },
  building: { select: { id: true, name: true } },
  floor: { select: { id: true, name: true } },
  room: { select: { id: true, name: true } },
} as const;

const CONDITIONS = ['NEW', 'USED_GOOD', 'DEFECTIVE'];
const AVAILABILITIES = ['AVAILABLE', 'IN_USE', 'CONSUMED', 'MAINTENANCE', 'RETIRED', 'LOST'];
const BARCODE_TYPES = ['QR', 'CODE128'];

const str = (v: any): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

/** Parses a purchase date given as Jalali (1403/05/15), ISO, or a Date. */
function parseDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value === 'string') {
    // Only a year before 1700 is Jalali (e.g. 1403/05/15); "2025-05-10" is Gregorian
    // and would otherwise also pass a strict jYYYY-jMM-jDD parse.
    const year = parseInt(value.slice(0, 4), 10);
    let d: Date;
    if (year && year < 1700) {
      const parsed = (moment as any)(value, ['jYYYY/jMM/jDD', 'jYYYY-jMM-jDD'], true);
      d = parsed.isValid() ? parsed.toDate() : new Date(NaN);
    } else {
      d = new Date(value);
    }
    if (isNaN(d.getTime())) throw new BadRequestException('تاریخ خرید نامعتبر است');
    return d;
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new BadRequestException('تاریخ خرید نامعتبر است');
  return d;
}

/** Accepts ['url', …] or [{ url }, …] and returns clean uploaded-image urls. */
function imageUrls(images: any): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((i) => (typeof i === 'string' ? i : i?.url))
    .filter((u): u is string => typeof u === 'string' && !!u.trim());
}

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  list(params: any = {}) {
    const { q, availability, status, categoryId, typeId, skip = 0, take = 50 } = params;
    return this.prisma.asset.findMany({
      where: {
        AND: [
          q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { barcode: { contains: q, mode: 'insensitive' } }] } : {},
          availability ? { availability } : (status ? { availability: status } : {}),
          categoryId ? { categoryId } : {},
          typeId ? { typeId } : {},
        ],
      },
      include: {
        category: true,
        images: true,
        type: true,
        // current holder, so lists can show who has it
        assignments: { where: { returnedAt: null }, include: ASSIGNMENT_INCLUDE, orderBy: { assignedAt: 'desc' }, take: 1 },
      },
      skip: Number(skip) || 0,
      take: Math.min(Number(take) || 50, 500),
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        type: true,
        images: { orderBy: { createdAt: 'asc' } },
        assignments: { include: ASSIGNMENT_INCLUDE, orderBy: { assignedAt: 'desc' } },
        createdBy: USER_BRIEF,
      },
    });
    if (!asset) throw new NotFoundException('دارایی یافت نشد');
    return asset;
  }

  /** Copies only known, writable asset columns out of an arbitrary request body. */
  private pickFields(data: any) {
    const out: any = {};
    if (data.name !== undefined) {
      const name = str(data.name);
      if (!name) throw new BadRequestException('نام دارایی الزامی است');
      out.name = name;
    }
    for (const k of ['oldBarcode', 'description', 'serialNumber', 'location']) {
      if (data[k] !== undefined) out[k] = str(data[k]);
    }
    if (data.condition !== undefined && data.condition !== '') {
      if (!CONDITIONS.includes(data.condition)) throw new BadRequestException('وضعیت فیزیکی نامعتبر است');
      out.condition = data.condition;
    }
    if (data.availability !== undefined && data.availability !== '') {
      if (!AVAILABILITIES.includes(data.availability)) throw new BadRequestException('وضعیت دسترس نامعتبر است');
      out.availability = data.availability;
    }
    if (data.barcodeType !== undefined && data.barcodeType !== '') {
      if (!BARCODE_TYPES.includes(data.barcodeType)) throw new BadRequestException('نوع بارکد نامعتبر است');
      out.barcodeType = data.barcodeType;
    }
    if (data.cost !== undefined) {
      if (data.cost === null || data.cost === '') out.cost = null;
      else {
        const n = Number(data.cost);
        if (!isFinite(n) || n < 0) throw new BadRequestException('قیمت نامعتبر است');
        out.cost = n;
      }
    }
    if (data.purchaseDate !== undefined) out.purchaseDate = parseDate(data.purchaseDate);
    return out;
  }

  private async resolveTypeId(typeId: any, typeName: any): Promise<string | null> {
    const id = str(typeId);
    if (id) {
      const t = await this.prisma.assetType.findUnique({ where: { id } });
      if (!t) throw new BadRequestException('نوع دارایی نامعتبر است');
      return id;
    }
    const name = str(typeName);
    if (name) {
      const t = await this.prisma.assetType.upsert({ where: { name }, update: {}, create: { name } });
      return t.id;
    }
    return null;
  }

  async create(data: any) {
    const categoryId = str(data.categoryId);
    if (!categoryId) throw new BadRequestException('دسته‌بندی دارایی را انتخاب کنید');
    const cat = await this.prisma.assetCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new BadRequestException('دسته‌بندی نامعتبر است');

    const typeId = await this.resolveTypeId(data.typeId, data.typeName);
    if (!typeId) throw new BadRequestException('نوع دارایی را انتخاب کنید');

    const fields = this.pickFields(data);
    if (!fields.name) throw new BadRequestException('نام دارایی الزامی است');
    const purchaseDate: Date = fields.purchaseDate ?? new Date();

    let barcode = str(data.barcode);
    if (!barcode) {
      // PREFIX-jYYYYjMM-SEQ
      const prefix = cat.codePrefix || 'AST';
      const like = `${prefix}-${moment(purchaseDate).format('jYYYYjMM')}-`;
      const last = await this.prisma.asset.findFirst({ where: { barcode: { startsWith: like } }, orderBy: { barcode: 'desc' } });
      const nextSeq = last?.barcode ? (parseInt(last.barcode.split('-').pop() || '0') || 0) + 1 : 1;
      barcode = `${like}${String(nextSeq).padStart(4, '0')}`;
    }
    const exists = await this.prisma.asset.findUnique({ where: { barcode } });
    if (exists) throw new BadRequestException('این بارکد قبلاً برای دارایی دیگری ثبت شده است');

    const urls = imageUrls(data.images);
    return this.prisma.asset.create({
      data: {
        ...fields,
        condition: fields.condition ?? 'NEW',
        name: fields.name,
        barcode,
        purchaseDate,
        categoryId,
        typeId,
        createdById: str(data.createdById),
        images: urls.length ? { createMany: { data: urls.map((url) => ({ url })) } } : undefined,
      },
      include: { images: true, category: true, type: true },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.asset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('دارایی یافت نشد');

    const patch: any = this.pickFields(data);
    if (data.barcode !== undefined) {
      const barcode = str(data.barcode);
      if (!barcode) throw new BadRequestException('بارکد نمی‌تواند خالی باشد');
      if (barcode !== existing.barcode) {
        const dup = await this.prisma.asset.findUnique({ where: { barcode } });
        if (dup) throw new BadRequestException('این بارکد قبلاً برای دارایی دیگری ثبت شده است');
      }
      patch.barcode = barcode;
    }
    if (str(data.categoryId)) {
      const cat = await this.prisma.assetCategory.findUnique({ where: { id: str(data.categoryId)! } });
      if (!cat) throw new BadRequestException('دسته‌بندی نامعتبر است');
      patch.categoryId = cat.id;
    }
    const typeId = await this.resolveTypeId(data.typeId, data.typeName);
    if (typeId) patch.typeId = typeId;

    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id }, data: patch });
      // `images` (when sent) is the complete new list of image urls
      if (Array.isArray(data.images)) {
        const urls = imageUrls(data.images);
        await tx.assetImage.deleteMany({ where: { assetId: id, url: { notIn: urls } } });
        const kept = await tx.assetImage.findMany({ where: { assetId: id }, select: { url: true } });
        const keptUrls = new Set(kept.map((k) => k.url));
        const toAdd = urls.filter((u) => !keptUrls.has(u));
        if (toAdd.length) await tx.assetImage.createMany({ data: toAdd.map((url) => ({ assetId: id, url })) });
      }
    });
    return this.prisma.asset.findUnique({ where: { id }, include: { images: true, category: true, type: true } });
  }

  async addImage(assetId: string, url: string, caption?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
    if (!asset) throw new NotFoundException('دارایی یافت نشد');
    return this.prisma.assetImage.create({ data: { assetId, url, caption: str(caption) } });
  }

  async removeImage(assetId: string, imageId: string) {
    const img = await this.prisma.assetImage.findFirst({ where: { id: imageId, assetId } });
    if (!img) throw new NotFoundException('تصویر یافت نشد');
    await this.prisma.assetImage.delete({ where: { id: imageId } });
    return { ok: true };
  }

  /** Deletes the asset together with its images, assignment history, maintenance and cost records. */
  async remove(id: string) {
    const existing = await this.prisma.asset.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('دارایی یافت نشد');
    await this.prisma.$transaction([
      this.prisma.assetAssignment.deleteMany({ where: { assetId: id } }),
      this.prisma.assetMaintenance.deleteMany({ where: { assetId: id } }),
      this.prisma.assetCost.deleteMany({ where: { assetId: id } }),
      this.prisma.assetImage.deleteMany({ where: { assetId: id } }),
      this.prisma.asset.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
