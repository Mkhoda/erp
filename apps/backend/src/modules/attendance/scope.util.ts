import { PrismaService } from '../../prisma/prisma.service';

// Resolve the department ids a user is allowed to see attendance for.
// ADMIN → undefined (no restriction). MANAGER → own department + memberships.
export async function resolveDeptScope(
  prisma: PrismaService,
  user: { userId?: string; id?: string; role?: string },
): Promise<string[] | undefined> {
  if (user?.role === 'ADMIN') return undefined;
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
