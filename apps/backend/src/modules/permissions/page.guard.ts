import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PAGE_KEY } from './page.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { resolvePagePermissions } from './page-perms.util';

// View-level gate: the user must be able to see `@Page(...)` — through a department/role
// row or a per-person grant (see resolvePagePermissions). ADMIN always passes.
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
    if (user.role === 'ADMIN') return true;

    const perms = await resolvePagePermissions(this.prisma, user, [page]);
    if (!perms.get(page)?.canRead) throw new ForbiddenException('Access to page denied');
    return true;
  }
}
