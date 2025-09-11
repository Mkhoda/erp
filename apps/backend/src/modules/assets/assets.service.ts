import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as moment from 'moment-jalaali';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  list(params: any = {}) {
  const { q, availability, status, categoryId, skip = 0, take = 50 } = params;
    return this.prisma.asset.findMany({
      where: {
        AND: [
      q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { barcode: { contains: q, mode: 'insensitive' } }] } : {},
      availability ? { availability } : (status ? { availability: status } : {}),
          categoryId ? { categoryId } : {},
        ],
      },
  include: { category: true, images: true, type: true },
      skip: Number(skip),
      take: Math.min(Number(take), 100),
      orderBy: { createdAt: 'desc' },
    });
  }

  get(id: string) {
    return (this.prisma as any).asset.findUnique({
      where: { id },
      include: {
        category: true,
        images: true,
  assignments: { include: { user: true, department: true, building: true, floor: true, room: true, assignedBy: true } as any },
  createdBy: true,
      },
    });
  }

  async create(data: any) {
    const { images, barcode, oldBarcode, categoryId, purchaseDate, typeId, typeName, ...rest } = data;
    const cat = await this.prisma.assetCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new BadRequestException('Invalid category');
    // Normalize purchase date (supports Jalali string like 1403/05/15)
    let d: Date;
    if (!purchaseDate) {
      d = new Date();
    } else if (typeof purchaseDate === 'string') {
      // Try parse as Jalali first
      let parsed = (moment as any)(purchaseDate, ['jYYYY/jMM/jDD', 'jYYYY-jMM-jDD'], true);
      if (!parsed.isValid()) {
        // Then try ISO_8601 (Gregorian) strictly; if still invalid, fallback to native Date
        try {
          const isoParsed = (moment as any)(purchaseDate, (moment as any).ISO_8601, true);
          parsed = isoParsed.isValid() ? isoParsed : parsed;
        } catch { /* ignore */ }
      }
      d = parsed.isValid() ? parsed.toDate() : new Date(purchaseDate);
    } else {
      d = new Date(purchaseDate);
    }
    const yyyymm = moment(d).format('jYYYYjMM');
    let finalBarcode = barcode;
    if (!finalBarcode) {
      const prefix = cat.codePrefix || 'AST';
      // find next sequence
      const like = `${prefix}-${yyyymm}-`;
      const last = await this.prisma.asset.findFirst({ where: { barcode: { startsWith: like } }, orderBy: { barcode: 'desc' } });
      const nextSeq = last?.barcode ? (parseInt((last.barcode as string).split('-').pop() || '0') + 1) : 1;
      finalBarcode = `${like}${String(nextSeq).padStart(4, '0')}`;
    }
    // ensure uniqueness
    const exists = await this.prisma.asset.findUnique({ where: { barcode: finalBarcode } }).catch(()=>null);
    if (exists) throw new BadRequestException('Duplicate asset barcode');

    // Resolve asset type
    let finalTypeId = typeId as string | undefined;
    if (!finalTypeId && typeName) {
      const type = await this.prisma.assetType.upsert({
        where: { name: typeName },
        update: {},
        create: { name: typeName },
      });
      finalTypeId = type.id;
    }
    if (!finalTypeId) throw new BadRequestException('typeId or typeName is required');

    return this.prisma.asset.create({
      data: {
        ...rest,
        categoryId,
        typeId: finalTypeId,
        barcode: finalBarcode,
        oldBarcode: oldBarcode || null,
        purchaseDate: d,
        images: images?.length ? { createMany: { data: images.map((u: string) => ({ url: u })) } } : undefined,
      },
      include: { images: true, category: true },
    });
  }

  async update(id: string, data: any) {
    const { images, purchaseDate, ...rest } = data;
    let patch: any = { ...rest };
    if (purchaseDate !== undefined) {
      if (!purchaseDate) {
        patch.purchaseDate = null;
      } else if (typeof purchaseDate === 'string') {
        // parse Jalali or ISO
        let parsed = (moment as any)(purchaseDate, ['jYYYY/jMM/jDD', 'jYYYY-jMM-jDD'], true);
        if (!parsed.isValid()) {
          try { const iso = (moment as any)(purchaseDate, (moment as any).ISO_8601, true); parsed = iso.isValid()? iso : parsed; } catch {}
        }
        patch.purchaseDate = parsed.isValid() ? parsed.toDate() : new Date(purchaseDate);
      } else {
        patch.purchaseDate = new Date(purchaseDate);
      }
    }
    const res = await this.prisma.asset.update({ where: { id }, data: patch, include: { images: true, category: true } });
    if (Array.isArray(images)) {
      await this.prisma.assetImage.deleteMany({ where: { assetId: id } });
      if (images.length) {
        await this.prisma.assetImage.createMany({ data: images.map((u: string) => ({ assetId: id, url: u })) });
      }
    }
    return this.prisma.asset.findUnique({ where: { id }, include: { images: true, category: true } });
  }

  remove(id: string) {
    return this.prisma.asset.delete({ where: { id } });
  }
}
