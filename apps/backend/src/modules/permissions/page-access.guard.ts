import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { resolvePagePermissions } from './page-perms.util';

export const PAGE_ACCESS_KEY = 'pageAccess';

// 'create' is only used by endpoints that opt in explicitly (pages whose UI separates
// creating from editing); by default POST/PATCH/PUT map to 'write'.
export type PageAction = 'read' | 'create' | 'write' | 'delete';

export type PageAccessOptions = {
  /** Pages whose read/write/delete flags (set in /dashboard/access) govern this endpoint */
  pages: string[];
  /** Extra pages that only grant GET endpoints (e.g. dropdown lookups from another page) */
  readAlso?: string[];
  /** Overrides the action derived from the HTTP method (GET→read, DELETE→delete, else→write) */
  action?: PageAction;
};

/**
 * Gates an endpoint by the page permissions managed in /dashboard/access (department/role
 * rows plus per-person grants).
 * ADMIN always passes. Can be set on the class and overridden per handler.
 */
export const PageAccess = (opts: PageAccessOptions) => SetMetadata(PAGE_ACCESS_KEY, opts);

const FLAG: Record<PageAction, 'canRead' | 'canCreate' | 'canWrite' | 'canDelete'> = {
  read: 'canRead', create: 'canCreate', write: 'canWrite', delete: 'canDelete',
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

    // Department/role rows + per-person grants, merged the same way as the menu.
    const perms = await resolvePagePermissions(this.prisma, user, pages);
    if (pages.some(p => perms.get(p)?.[FLAG[action]])) return true;

    const msg = action === 'delete' ? 'شما مجوز حذف در این بخش را ندارید'
      : action === 'create' ? 'شما مجوز ثبت در این بخش را ندارید'
      : action === 'write' ? 'شما مجوز ثبت یا ویرایش در این بخش را ندارید'
      : 'دسترسی به این بخش مجاز نیست';
    throw new ForbiddenException(msg);
  }
}
