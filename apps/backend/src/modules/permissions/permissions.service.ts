import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KNOWN_PAGES } from './pages.constant';
import { ALL_FLAGS, NO_FLAGS, PageFlags, resolvePagePermissions } from './page-perms.util';

/** Pages that ALL authenticated users can access, regardless of department or role. */
const BASE_PAGES = [
  '/dashboard',
  '/dashboard/profile',
  '/dashboard/chat',
  '/dashboard/messaging',
  '/dashboard/attendance/my',
  '/dashboard/tickets/my',
  '/dashboard/work-log/my',
];

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  // ── Page registry (Page table) ─────────────────────────────────────────────

  /** All registered pages from DB. Falls back to static list if table is empty. */
  async listPages() {
    const rows = await this.prisma.page.findMany({ orderBy: { path: 'asc' } });
    if (rows.length) return rows;
    // fallback before first sync
    return KNOWN_PAGES.map(p => ({ id: p.page, path: p.page, label: p.label, isActive: true, createdAt: new Date(), updatedAt: new Date() }));
  }

  /** Upsert every KNOWN_PAGES entry into the Page table (adds new, updates label, keeps isActive). */
  async syncPages() {
    let created = 0;
    for (const { page, label } of KNOWN_PAGES) {
      const existing = await this.prisma.page.findUnique({ where: { path: page } });
      if (!existing) {
        await this.prisma.page.create({ data: { path: page, label, isActive: true } });
        created++;
      } else {
        await this.prisma.page.update({ where: { path: page }, data: { label } });
      }
    }
    return { created, total: KNOWN_PAGES.length };
  }

  /** Enable or disable a page by its DB id. */
  setPageActive(id: string, isActive: boolean) {
    return this.prisma.page.update({ where: { id }, data: { isActive } });
  }

  /** Returns the set of currently active page paths (empty set = no DB rows yet → treat all as active).
   *  BASE_PAGES are always included regardless of the Page table state. */
  private async activePagePaths(): Promise<Set<string> | null> {
    const count = await this.prisma.page.count();
    if (count === 0) return null; // table not yet seeded — skip filter
    const rows = await this.prisma.page.findMany({ where: { isActive: true }, select: { path: true } });
    const active = new Set(rows.map(r => r.path));
    // Always ensure base pages are included (they may not be in the Page table yet)
    for (const p of BASE_PAGES) active.add(p);
    return active;
  }

  /** List all permission rows for a department (optionally filtered by role). */
  list(departmentId: string, role?: string) {
    return this.prisma.pagePermission.findMany({
      where: { departmentId, ...(role ? { role } : {}) },
      orderBy: [{ page: 'asc' }, { role: 'asc' }],
    });
  }

  /** List ALL permission rows across all departments with department info — for admin UI. */
  listAll() {
    return this.prisma.pagePermission.findMany({
      orderBy: [{ page: 'asc' }, { role: 'asc' }],
      include: { department: { select: { id: true, name: true } } },
    });
  }

  /** Upsert a permission row. role defaults to '*' (all roles). Only the flags sent are changed. */
  upsert(departmentId: string, page: string, role: string = '*', data: { canRead?: boolean; canCreate?: boolean; canWrite?: boolean; canDelete?: boolean }) {
    const flags = {
      ...(data.canRead !== undefined ? { canRead: data.canRead } : {}),
      ...(data.canWrite !== undefined ? { canWrite: data.canWrite } : {}),
      ...(data.canDelete !== undefined ? { canDelete: data.canDelete } : {}),
      ...(data.canCreate !== undefined ? { canCreate: data.canCreate } : {}),
    };
    return this.prisma.pagePermission.upsert({
      where: { departmentId_page_role: { departmentId, page, role } },
      update: flags,
      create: { departmentId, page, role, canRead: true, canCreate: false, canWrite: false, canDelete: false, ...flags },
    });
  }

  /** Remove a specific permission row. */
  remove(departmentId: string, page: string, role: string = '*') {
    return this.prisma.pagePermission.delete({
      where: { departmentId_page_role: { departmentId, page, role } },
    });
  }

  /** Disabled: wildcard permissions are no longer used. Access must be explicitly granted per role via the access page. */
  async syncDefaults() {
    return { created: 0, total: 0, message: 'syncDefaults is disabled — grant access explicitly via the access page.' };
  }

  /**
   * Returns the effective menu for the requesting user.
   * - ADMIN: all ACTIVE pages (from DB; falls back to static list if DB empty).
   * - Others: merges canRead=true rows for the user's depts+role, then filters by isActive.
   */
  async menuForUser(user: any, departmentId?: string) {
    const activePaths = await this.activePagePaths();

    // ── ADMIN: all known pages (no Page-table filter — ADMIN bypasses PagePermissionGuard anyway)
    if (user?.role === 'ADMIN') {
      return {
        departments: [],
        permissions: KNOWN_PAGES.map(p => ({ page: p.page, ...ALL_FLAGS, role: '*' })),
        menuPages: KNOWN_PAGES.map(p => p.page),
      };
    }

    // ── Single dept override (MANAGER requesting a specific dept) ──────────────
    if (departmentId) {
      const rows = await this.list(departmentId);
      const relevant = rows.filter(r => r.role === '*' || r.role === user?.role);
      const depts = await this.prisma.department.findMany({ where: { id: departmentId } });
      const permissions = relevant
        .filter(p => !activePaths || activePaths.has(p.page))
        .map(p => ({ page: p.page, canRead: p.canRead, canWrite: p.canWrite, role: p.role, departmentId: p.departmentId }));
      const menuPages = Array.from(new Set(permissions.filter(r => r.canRead).map(r => r.page)));
      return { departments: depts, permissions, menuPages };
    }

    // ── Non-admin: department/role rows + per-person grants (same resolver as the guards) ──
    const uid = user?.userId ?? user?.id;
    const [effective, dbUser, memberships] = await Promise.all([
      resolvePagePermissions(this.prisma, user ?? {}),
      this.prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
      this.prisma.userDepartment.findMany({ where: { userId: uid }, select: { departmentId: true } }),
    ]);
    const deptIds = new Set<string>(memberships.map(m => m.departmentId));
    if (dbUser?.departmentId) deptIds.add(dbUser.departmentId);
    const depts = deptIds.size ? await this.prisma.department.findMany({ where: { id: { in: [...deptIds] } } }) : [];

    const permissions: Array<{ page: string } & PageFlags> = [];
    for (const [page, f] of effective) {
      if (activePaths && !activePaths.has(page)) continue;
      permissions.push({ page, ...f });
    }
    // Base pages (profile, my attendance, …) are always visible.
    const baseVisible = activePaths ? BASE_PAGES.filter(p => activePaths.has(p)) : BASE_PAGES;
    for (const bp of baseVisible) {
      const cur = permissions.find(p => p.page === bp);
      if (!cur) permissions.push({ page: bp, ...NO_FLAGS, canRead: true });
      else cur.canRead = true;
    }
    const menuPages = permissions.filter(p => p.canRead).map(p => p.page);
    return { departments: depts, permissions, menuPages };
  }

  /** The current user's flags on one page — drives which actions a page shows (view/create/edit/delete). */
  async myPageFlags(user: any, page: string): Promise<PageFlags> {
    if (user?.role === 'ADMIN') return { ...ALL_FLAGS };
    if (BASE_PAGES.includes(page)) return { ...NO_FLAGS, canRead: true };
    const perms = await resolvePagePermissions(this.prisma, user ?? {}, [page]);
    return perms.get(page) ?? { ...NO_FLAGS };
  }

  // ── Per-person grants (UserPagePermission) ─────────────────────────────────

  listUserGrants(userId?: string) {
    return this.prisma.userPagePermission.findMany({
      where: userId ? { userId } : {},
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, department: { select: { name: true } } } },
        grantedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ userId: 'asc' }, { page: 'asc' }],
    });
  }

  /** Create or update one person's grant; viewing is implied by any action flag. */
  async upsertUserGrant(grantedById: string, dto: { userId: string; page: string } & Partial<PageFlags>) {
    const flags: Partial<PageFlags> = {};
    for (const k of ['canRead', 'canCreate', 'canWrite', 'canDelete'] as const) if (dto[k] !== undefined) flags[k] = !!dto[k];
    if (flags.canCreate || flags.canWrite || flags.canDelete) flags.canRead = true;
    return this.prisma.userPagePermission.upsert({
      where: { userId_page: { userId: dto.userId, page: dto.page } },
      update: { ...flags, grantedById },
      create: { userId: dto.userId, page: dto.page, canRead: true, canCreate: false, canWrite: false, canDelete: false, ...flags, grantedById },
    });
  }

  removeUserGrant(userId: string, page: string) {
    return this.prisma.userPagePermission.deleteMany({ where: { userId, page } });
  }
}
