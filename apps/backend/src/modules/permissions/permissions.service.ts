import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KNOWN_PAGES } from './pages.constant';

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

  /** Returns the set of currently active page paths (empty set = no DB rows yet → treat all as active). */
  private async activePagePaths(): Promise<Set<string> | null> {
    const count = await this.prisma.page.count();
    if (count === 0) return null; // table not yet seeded — skip filter
    const rows = await this.prisma.page.findMany({ where: { isActive: true }, select: { path: true } });
    return new Set(rows.map(r => r.path));
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

  /** Upsert a permission row. role defaults to '*' (all roles). */
  upsert(departmentId: string, page: string, role: string = '*', data: { canRead?: boolean; canWrite?: boolean }) {
    return this.prisma.pagePermission.upsert({
      where: { departmentId_page_role: { departmentId, page, role } },
      update: { canRead: data.canRead ?? true, canWrite: data.canWrite ?? false },
      create: { departmentId, page, role, canRead: data.canRead ?? true, canWrite: data.canWrite ?? false },
    });
  }

  /** Remove a specific permission row. */
  remove(departmentId: string, page: string, role: string = '*') {
    return this.prisma.pagePermission.delete({
      where: { departmentId_page_role: { departmentId, page, role } },
    });
  }

  /**
   * Sync defaults: for every known page × every department, create a canRead=true row
   * with role='*' if one does not exist yet. Existing rows are NOT overwritten.
   */
  async syncDefaults() {
    const departments = await this.prisma.department.findMany({ select: { id: true } });
    let created = 0;
    for (const dept of departments) {
      for (const { page } of KNOWN_PAGES) {
        const existing = await this.prisma.pagePermission.findUnique({
          where: { departmentId_page_role: { departmentId: dept.id, page, role: '*' } },
        });
        if (!existing) {
          await this.prisma.pagePermission.create({
            data: { departmentId: dept.id, page, role: '*', canRead: true, canWrite: false },
          });
          created++;
        }
      }
    }
    return { created, total: departments.length * KNOWN_PAGES.length };
  }

  /**
   * Returns the effective menu for the requesting user.
   * - ADMIN: all ACTIVE pages (from DB; falls back to static list if DB empty).
   * - Others: merges canRead=true rows for the user's depts+role, then filters by isActive.
   */
  async menuForUser(user: any, departmentId?: string) {
    const activePaths = await this.activePagePaths();

    // ── ADMIN: all active pages ────────────────────────────────────────────────
    if (user?.role === 'ADMIN') {
      const pages = activePaths
        ? KNOWN_PAGES.filter(p => activePaths.has(p.page))
        : KNOWN_PAGES;
      return {
        departments: [],
        permissions: pages.map(p => ({ page: p.page, canRead: true, canWrite: true, role: '*' })),
        menuPages: pages.map(p => p.page),
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

    // ── Non-admin: compute from user's own departments ─────────────────────────
    const deptIds = new Set<string>();
    const memberships = await this.prisma.userDepartment.findMany({ where: { userId: user?.userId ?? user?.id } });
    memberships.forEach(m => deptIds.add(m.departmentId));

    if (deptIds.size === 0) {
      return { departments: [], permissions: [], menuPages: [] };
    }

    const deptArray = Array.from(deptIds);
    const perms = await this.prisma.pagePermission.findMany({
      where: { departmentId: { in: deptArray }, role: { in: ['*', user?.role ?? ''] } },
    });
    const depts = await this.prisma.department.findMany({ where: { id: { in: deptArray } } });

    // Merge by page: canRead/canWrite = OR across matching rows
    const pageMap = new Map<string, { canRead: boolean; canWrite: boolean }>();
    for (const p of perms) {
      if (activePaths && !activePaths.has(p.page)) continue; // skip inactive pages
      const cur = pageMap.get(p.page);
      if (!cur) pageMap.set(p.page, { canRead: p.canRead, canWrite: p.canWrite });
      else { cur.canRead = cur.canRead || p.canRead; cur.canWrite = cur.canWrite || p.canWrite; }
    }

    const permissions = Array.from(pageMap.entries()).map(([page, v]) => ({ page, canRead: v.canRead, canWrite: v.canWrite }));
    const menuPages = permissions.filter(p => p.canRead).map(p => p.page);
    return { departments: depts, permissions, menuPages };
  }
}
