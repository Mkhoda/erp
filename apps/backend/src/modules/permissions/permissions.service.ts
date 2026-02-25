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

  async menuForUser(user: any, departmentId?: string) {
    // Admin: return union of all pages and departments
    if (user?.role === 'ADMIN') {
      const all = await this.prisma.pagePermission.findMany({ orderBy: { page: 'asc' } });
      const departments = await this.prisma.department.findMany({ where: { id: { in: all.map(p => p.departmentId) } } });
      const permissions = all.map(p => ({ page: p.page, canRead: p.canRead, canWrite: p.canWrite, departmentId: p.departmentId }));
      const menuPages = Array.from(new Set(all.map(p => p.page)));
      return { departments, permissions, menuPages };
    }

    // If a departmentId is explicitly requested by a non-admin, deny by not returning (controller should guard this).
    if (departmentId) {
      const list = await this.list(departmentId);
      const departments = await this.prisma.department.findMany({ where: { id: departmentId ? { in: [departmentId] } : undefined } });
      const permissions = list.map(p => ({ page: p.page, canRead: p.canRead, canWrite: p.canWrite, departmentId: p.departmentId }));
      const menuPages = Array.from(new Set(list.map(p => p.page)));
      return { departments, permissions, menuPages };
    }

    // Non-admin: compute effective permissions from user's departments
    const deptIds = new Set<string>();
    if (user?.departmentId) deptIds.add(user.departmentId);
    const memberships = await this.prisma.userDepartment.findMany({ where: { userId: user?.userId ?? user?.id } });
    memberships.forEach(m => deptIds.add(m.departmentId));

    if (deptIds.size === 0) {
      return { departments: [], permissions: [], menuPages: [] };
    }

    const deptArray = Array.from(deptIds);
    const perms = await this.prisma.pagePermission.findMany({ where: { departmentId: { in: deptArray } } });
    const departments = await this.prisma.department.findMany({ where: { id: { in: deptArray } } });

    // merge permissions by page: OR semantics across departments
    const map = new Map<string, { page: string; canRead: boolean; canWrite: boolean; departments: Array<{ departmentId: string; canRead: boolean; canWrite: boolean }> }>();
    for (const p of perms) {
      const existing = map.get(p.page);
      if (!existing) {
        map.set(p.page, { page: p.page, canRead: p.canRead, canWrite: p.canWrite, departments: [{ departmentId: p.departmentId, canRead: p.canRead, canWrite: p.canWrite }] });
      } else {
        existing.canRead = existing.canRead || p.canRead;
        existing.canWrite = existing.canWrite || p.canWrite;
        existing.departments.push({ departmentId: p.departmentId, canRead: p.canRead, canWrite: p.canWrite });
      }
    }

    const permissions = Array.from(map.values()).map(v => ({ page: v.page, canRead: v.canRead, canWrite: v.canWrite, departments: v.departments }));
    const menuPages = permissions.filter(p => p.canRead).map(p => p.page);
    return { departments, permissions, menuPages };
  }
}
