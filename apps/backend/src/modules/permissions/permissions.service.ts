import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  list(departmentId: string) {
    return this.prisma.pagePermission.findMany({ where: { departmentId }, orderBy: { page: 'asc' } });
  }

  upsert(departmentId: string, page: string, data: { canRead?: boolean; canWrite?: boolean }) {
    return this.prisma.pagePermission.upsert({
      where: { departmentId_page: { departmentId, page } },
      update: { canRead: data.canRead ?? true, canWrite: data.canWrite ?? false },
      create: { departmentId, page, canRead: data.canRead ?? true, canWrite: data.canWrite ?? false },
    });
  }

  remove(departmentId: string, page: string) {
    return this.prisma.pagePermission.delete({ where: { departmentId_page: { departmentId, page } } });
  }
}
