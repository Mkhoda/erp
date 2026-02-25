USERS & ROLES — Audit

Summary
- User model: defined in Prisma (`apps/backend/prisma/schema.prisma`). Key fields: `id`, `email`, `phone?`, `password?`, `firstName`, `lastName`, `role: Role`, `departmentId?`, `createdAt`, `updatedAt`.
- Roles: Prisma enum `Role` with values: `ADMIN`, `MANAGER`, `USER`, `EXPERT`.

Authentication & session
- Endpoints:
  - `POST /auth/login` — email/password login (returns JWT)
  - `POST /auth/login-phone` — phone/OTP login
  - `POST /auth/register` — registration endpoint (if enabled)
  - `GET /auth/me` — returns current user (protected)
- Token handling: backend issues JWT signed with user `sub`, `email`, and `role`. JWT strategy uses `ExtractJwt.fromAuthHeaderAsBearerToken()`.
- Frontend uses token in `Authorization: Bearer <token>` and calls `/auth/me` to get `role` and profile.

Guards & authorization
- `JwtAuthGuard` enforces authentication on protected routes.
- `Roles` decorator (type `AppRole = 'ADMIN'|'MANAGER'|'USER'|'EXPERT'`) + `RolesGuard` restricts handlers to specific roles.
- Permissions / page-level control: `pagePermission` table and `PermissionsService` exist (CRUD for `canRead`/`canWrite`). Controller endpoints are protected with `@UseGuards(JwtAuthGuard, RolesGuard)` and commonly limited to `ADMIN`/`MANAGER`.

Frontend notes
- Sidebar/dashboard is currently a flat list (single-layer). Conditional rendering is used in `dashboard/layout.tsx` and other components based on `user.role` to hide/show links.
- Token storage pattern: token persisted in `localStorage` (frontend code uses that to call `/auth/me`).

Gaps and recommendations
- Some backend services accept `any` for create/update user payloads. Add typed DTOs and validation for safety.
- Consider adding refresh tokens for longer sessions and secure refresh workflow.
- Enforce page-level `canRead` checks in API handlers (do not rely solely on UI hiding links).
- Decide menu data source: static frontend config (simple), backend-managed menu (flexible, supports per-department menus), or hybrid (frontend structure + backend permission flags). Hybrid is recommended for balance.
- Add an Admin UI to manage `pagePermission` per department/page (optional but useful in multi-department setups).