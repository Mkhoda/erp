import { PrismaService } from '../../prisma/prisma.service';

export type PageFlags = { canRead: boolean; canCreate: boolean; canWrite: boolean; canDelete: boolean };
export const NO_FLAGS: PageFlags = { canRead: false, canCreate: false, canWrite: false, canDelete: false };
export const ALL_FLAGS: PageFlags = { canRead: true, canCreate: true, canWrite: true, canDelete: true };

// A row's action flags only count together with its own canRead — so an edit flag on a
// row without view can't combine with view granted by some other department.
const pick = (r: PageFlags): PageFlags => r.canRead
  ? { canRead: true, canCreate: !!r.canCreate, canWrite: !!r.canWrite, canDelete: !!r.canDelete }
  : { ...NO_FLAGS };
const or = (a: PageFlags, b: PageFlags): PageFlags => ({
  canRead: a.canRead || b.canRead, canCreate: a.canCreate || b.canCreate,
  canWrite: a.canWrite || b.canWrite, canDelete: a.canDelete || b.canDelete,
});

/**
 * Effective page permissions of one user, keyed by page path. Single source of truth for
 * PagePermissionGuard, PageAccessGuard and the sidebar menu:
 *   1. Department rows — the user's primary department plus every UserDepartment membership.
 *      Within one department a role-specific row overrides the wildcard ('*') row; results are
 *      then OR-ed across departments.
 *   2. Per-person UserPagePermission rows, OR-ed on top (they only ever add access).
 * ADMIN is not handled here — callers short-circuit it.
 */
export async function resolvePagePermissions(
  prisma: PrismaService,
  user: { userId?: string; id?: string; role?: string },
  pages?: string[],
): Promise<Map<string, PageFlags>> {
  const uid = user.userId ?? user.id;
  const result = new Map<string, PageFlags>();
  if (!uid) return result;
  const pageFilter = pages?.length ? { page: { in: pages } } : {};

  const [dbUser, memberships, personal] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
    prisma.userDepartment.findMany({ where: { userId: uid }, select: { departmentId: true } }),
    prisma.userPagePermission.findMany({ where: { userId: uid, ...pageFilter } }),
  ]);
  const deptIds = new Set<string>(memberships.map((m) => m.departmentId));
  if (dbUser?.departmentId) deptIds.add(dbUser.departmentId);

  if (deptIds.size) {
    const rows = await prisma.pagePermission.findMany({
      where: { departmentId: { in: [...deptIds] }, role: { in: ['*', user.role ?? ''] }, ...pageFilter },
    });
    const perDept = new Map<string, { flags: PageFlags; specific: boolean }>();
    for (const r of rows) {
      const key = `${r.departmentId}|${r.page}`;
      const specific = r.role !== '*';
      const cur = perDept.get(key);
      if (!cur || (specific && !cur.specific)) perDept.set(key, { flags: pick(r), specific });
    }
    for (const [key, v] of perDept) {
      const page = key.slice(key.indexOf('|') + 1);
      result.set(page, or(result.get(page) ?? NO_FLAGS, v.flags));
    }
  }
  for (const p of personal) result.set(p.page, or(result.get(p.page) ?? NO_FLAGS, pick(p)));
  return result;
}
