import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PAGE_KEY } from './page.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PagePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const page = this.reflector.get<string>(PAGE_KEY, context.getHandler()) || this.reflector.get<string>(PAGE_KEY, context.getClass());
    if (!page) return true; // no page metadata => no page check

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    // Admins bypass page permission checks
    if (user.role === 'ADMIN') return true;

    // Collect department ids (primary + memberships)
    const deptIds = new Set<string>();
    if (user.departmentId) deptIds.add(user.departmentId);
    const memberships = await this.prisma.userDepartment.findMany({ where: { userId: user.userId ?? user.id } });
    memberships.forEach(m => deptIds.add(m.departmentId));

    if (deptIds.size === 0) throw new ForbiddenException('No department assigned for page access');

    const found = await this.prisma.pagePermission.findFirst({ where: { page, departmentId: { in: Array.from(deptIds) } } });
    if (!found || !found.canRead) throw new ForbiddenException('Access to page denied');
    return true;
  }
}
