import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssetCategoriesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.assetCategory.findMany({ orderBy: { name: 'asc' } });
  }
  create(data: any) {
    return this.prisma.assetCategory.create({ data });
  }
  update(id: string, data: any) {
    return this.prisma.assetCategory.update({ where: { id }, data });
  }
  remove(id: string) {
    return this.prisma.assetCategory.delete({ where: { id } });
  }
}
