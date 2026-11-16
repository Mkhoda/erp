import { PrismaService } from '../../prisma/prisma.service';
import { resolvePagePermissions } from '../permissions/page-perms.util';

// Resolve the department ids a user is allowed to see attendance for.
// ADMIN → undefined (no restriction). Everyone else → own department + memberships —
// unless `fullAccessPage` is given and they hold EVERY action of that page (e.g. view +
// create + edit on the daily records page, by department/role or a per-person grant):
// full access to the page means seeing all users, not just their own department.
export async function resolveDeptScope(
  prisma: PrismaService,
  user: { userId?: string; id?: string; role?: string },
  fullAccessPage?: string,
): Promise<string[] | undefined> {
  if (user?.role === 'ADMIN') return undefined;
  if (fullAccessPage) {
    const f = (await resolvePagePermissions(prisma, user, [fullAccessPage])).get(fullAccessPage);
    if (f && f.canRead && f.canCreate && f.canWrite) return undefined;
  }
  const uid = user?.userId ?? user?.id;
  if (!uid) return [];
  const [u, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { departmentId: true } }),
    prisma.userDepartment.findMany({ where: { userId: uid }, select: { departmentId: true } }),
  ]);
  const ids = new Set<string>();
  if (u?.departmentId) ids.add(u.departmentId);
  memberships.forEach((m) => ids.add(m.departmentId));
  return Array.from(ids);
}

// Parse a "YYYY-MM-DD" (Gregorian) string into the UTC-midnight work date form.
export function parseWorkDate(s: string): Date {
  const m = (s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
