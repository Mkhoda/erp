import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PAGE_KEY } from './page.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PagePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const page = this.reflector.get<string>(PAGE_KEY, context.getHandler())
      ?? this.reflector.get<string>(PAGE_KEY, context.getClass());
    if (!page) return true; // no page metadata — skip check

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    // Admins bypass all page permission checks
    if (user.role === 'ADMIN') return true;

    // Collect department ids from both the legacy single FK and the many-to-many memberships
    const uid = user.userId ?? user.id;
    const [dbUser, memberships] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
      this.prisma.userDepartment.findMany({ where: { userId: uid } }),
    ]);
    const deptIdSet = new Set<string>(memberships.map(m => m.departmentId));
    if (dbUser?.departmentId) deptIdSet.add(dbUser.departmentId);
    const deptIds = Array.from(deptIdSet);

    if (deptIds.length === 0) throw new ForbiddenException('No department assigned for page access');

    // Find a row matching: (dept IN user.depts) AND (role='*' OR role=user.role) AND canRead=true
    const found = await this.prisma.pagePermission.findFirst({
      where: {
        page,
        departmentId: { in: deptIds },
        role: { in: ['*', user.role ?? ''] },
        canRead: true,
      },
    });
    if (!found) throw new ForbiddenException('Access to page denied');
    return true;
  }
}

