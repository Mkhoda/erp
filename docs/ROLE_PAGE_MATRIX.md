ROLE → PAGES (visibility matrix)

Notes
- Matrix below is an initial recommendation based on existing dashboard pages under `apps/frontend/app/dashboard`. `ADMIN` is full access by default. These are visibility/read mappings — write/edit permissions should be enforced separately in backend APIs using `pagePermission` and role/department checks.

Legend
- A = ADMIN
- M = MANAGER
- E = EXPERT
- U = USER

Pages (file → recommended visible roles)
- `/dashboard` (apps/frontend/app/dashboard/page.tsx): A, M, E, U
- `/dashboard/profile` (profile/page.tsx): A, M, E, U
- `/dashboard/change-password` (change-password/page.tsx): A, M, E, U
- `/dashboard/users` (users/page.tsx, page-new.tsx): A, M
- `/dashboard/roles` (roles/page.tsx): A
- `/dashboard/settings` (settings/page.tsx): A, M
- `/dashboard/settings/departments` (settings/departments.tsx): A, M
- `/dashboard/settings/buildings-rooms` (settings/buildings-rooms.tsx): A, M
- `/dashboard/departments` (departments/page.tsx): A, M
- `/dashboard/buildings` (buildings/page.tsx): A, M
- `/dashboard/floors` (floors/page.tsx): A, M
- `/dashboard/rooms` (rooms/page.tsx): A, M
- `/dashboard/access` (access/page.tsx): A, M
- `/dashboard/accounting` (accounting/page.tsx): A, M
- `/dashboard/assets` (assets/page.tsx): A, M, E, U (view); editing/assignment limited to A/M
- `/dashboard/assets/[id]` (assets/[id]/page.tsx): A, M, E, U (view)
- `/dashboard/assets/types` (assets/types/page.tsx): A, M
- `/dashboard/assets/assignments` (assets/assignments/page.tsx): A, M, E

Recommendations / next steps
1. Confirm visibility for each page (business decision) — I can generate an editable CSV/Google-style table to gather decisions from stakeholders.
2. Decide whether Managers can manage users/permissions or if that is Admin-only.
3. For pages where `U` (USER) is allowed to view, ensure backend APIs respect `canRead` and do not leak sensitive fields.
4. After confirmation, implement menu as a two-layer structure (categories + child links) and map the matrix into either a backend-managed `GET /permissions/menu` or a hybrid frontend filter.

If you confirm this mapping or provide adjustments, I will next produce a two-layer menu spec (component API, data shape, behavior) and a minimal implementation plan (PR-sized tasks).