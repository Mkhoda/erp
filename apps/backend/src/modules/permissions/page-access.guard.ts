import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const PAGE_ACCESS_KEY = 'pageAccess';

export type PageAction = 'read' | 'write' | 'delete';

export type PageAccessOptions = {
  /** Pages whose read/write/delete flags (set in /dashboard/access) govern this endpoint */
  pages: string[];
  /** Extra pages that only grant GET endpoints (e.g. dropdown lookups from another page) */
  readAlso?: string[];
  /** Overrides the action derived from the HTTP method (GET→read, DELETE→delete, else→write) */
  action?: PageAction;
};

/**
 * Gates an endpoint by the department/role page permissions managed in /dashboard/access.
 * ADMIN always passes. Can be set on the class and overridden per handler.
 */
export const PageAccess = (opts: PageAccessOptions) => SetMetadata(PAGE_ACCESS_KEY, opts);

const FLAG: Record<PageAction, 'canRead' | 'canWrite' | 'canDelete'> = {
  read: 'canRead', write: 'canWrite', delete: 'canDelete',
};

@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<PageAccessOptions>(PAGE_ACCESS_KEY, [context.getHandler(), context.getClass()]);
    if (!opts) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    const action: PageAction = opts.action ?? (req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write');
    const pages = action === 'read' ? [...opts.pages, ...(opts.readAlso ?? [])] : opts.pages;

    const uid = user.userId ?? user.id;
    const [dbUser, memberships] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
      this.prisma.userDepartment.findMany({ where: { userId: uid } }),
    ]);
    const deptIds = new Set<string>(memberships.map(m => m.departmentId));
    if (dbUser?.departmentId) deptIds.add(dbUser.departmentId);

    if (deptIds.size) {
      const rows = await this.prisma.pagePermission.findMany({
        where: { page: { in: pages }, departmentId: { in: Array.from(deptIds) }, role: { in: ['*', user.role ?? ''] } },
      });
      // Per dept+page a role-specific row overrides the wildcard one (same rule as the menu);
      // access is then OR-ed across the user's departments.
      const effective = new Map<string, boolean>();
      for (const r of rows) {
        const key = `${r.departmentId}|${r.page}`;
        const granted = r.canRead && r[FLAG[action]];
        if (r.role !== '*') effective.set(key, granted);
        else if (!effective.has(key)) effective.set(key, granted);
      }
      if ([...effective.values()].some(Boolean)) return true;
    }

    const msg = action === 'delete' ? 'شما مجوز حذف در این بخش را ندارید'
      : action === 'write' ? 'شما مجوز ثبت یا ویرایش در این بخش را ندارید'
      : 'دسترسی به این بخش مجاز نیست';
    throw new ForbiddenException(msg);
  }
}
