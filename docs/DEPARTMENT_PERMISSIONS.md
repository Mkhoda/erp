Department-Scoped Page Permissions — Design & API

Goal
- Limit page visibility based on department membership. Admin users should be able to see all pages across departments.
- Provide a simple API for the frontend to obtain the allowed pages (or permission flags) for the current user and/or a selected department.

Existing DB support
- Prisma model: `PagePermission` exists with fields: `id, departmentId, page, canRead, canWrite` (see `apps/backend/prisma/schema.prisma`).
- `PermissionsService.list(departmentId)` and `PermissionsController` currently expose `GET /permissions?departmentId=` for `ADMIN` and `MANAGER` (not available to regular users).

Design overview
1. New (or extended) API endpoint: `GET /permissions/menu` (authenticated)
   - Behavior:
     - If request has query `departmentId` and user `role` is `ADMIN` or `MANAGER`, return permissions for that department.
     - If no `departmentId` provided, server computes allowed pages for the current user by merging permissions for the user's departments (primary `user.departmentId` + `userDepartments` membership).
     - If user.role === 'ADMIN', return the union of all pages (or a full menu tree) so Admin sees everything.
   - Response shape (recommended):
     {
       "departments": [{ id, name }],
       "permissions": [ { page: string, canRead: boolean, canWrite: boolean, departmentId?: string } ],
       "menuPages": ["/dashboard","/dashboard/assets", ...] // optional flattened array of allowed page slugs for quick checks
     }
   - HTTP status: 200 on success, 403 if user requests `departmentId` they are not allowed to inspect.

2. Authorization rules
   - Admin: allowed to view/modify permissions for any department.
   - Manager: allowed to view/modify permissions for their own department(s).
   - User/Expert: allowed to request their effective permissions (no departmentId param) but cannot request arbitrary departmentId unless they are Admin/Manager and belong to that department.

3. Permission merging logic
   - For a non-admin user, gather department IDs:
     - primary: `user.departmentId` (if present)
     - extra: `userDepartments` (many-to-many)
   - For each department, fetch `PagePermission` rows. Compute effective permission per page with OR semantics for `canRead` and `canWrite` (if any department grants read, user can read).
   - If no `PagePermission` row exists for a given page for the user's departments, treat as default: `canRead: false, canWrite: false` (or use default business rule — currently PagePermission `canRead` default true in DB; be explicit in policy).

4. Frontend usage
   - On login, frontend calls `GET /auth/me` to get `role` and `departmentId` plus `userDepartments` if available.
   - When rendering the sidebar/menu, frontend calls `GET /permissions/menu` without `departmentId` to get the effective permissions for current user.
   - If the app allows switching department context (e.g., Admin viewing another department), frontend can call `GET /permissions/menu?departmentId=<id>` (Admin only).
   - The frontend maps `permissions` to the two-layer menu structure. Menu entries include `roles?: Role[]` (optional), `page` slug, and child items.

5. Backend implementation notes (PR-sized changes)
   - Add new controller handler in `PermissionsController`:
     - `@Get('menu')` public to authenticated users (JwtAuthGuard) — additional RolesGuard logic for departmentId query param.
   - New service method `menuForUser(user, departmentId?)` that:
     - If `user.role === 'ADMIN'` and `departmentId` not provided: return global list of pages (all distinct `page` values in PagePermission or full menu tree if stored elsewhere).
     - If `departmentId` provided: verify user is ADMIN or MANAGER for that department (or belongs to it) then return `list(departmentId)`.
     - If no `departmentId`: resolve user's departments, call `list` for each, merge results, and return effective permissions.
   - Tests: unit tests for merging logic and controller access rules. Integration test hitting `GET /permissions/menu` as different roles.

6. Frontend implementation notes
   - Add a small permissions client method: `GET /permissions/menu` (attach auth header).
   - Introduce menu data shape in frontend (example):
     type MenuItem = { id: string; title: string; page: string; icon?: string; children?: MenuItem[] }
   - Menu rendering logic:
     - Receive permissions from server and filter menu items by `permissions.menuPages.includes(item.page)`.
     - Build two-layer menu by grouping child routes under categories (e.g., Assets → [Assets List, Types, Assignments]).
     - Persist expanded/collapsed state in `localStorage` per user.

7. Admin UI for managing department permissions (optional)
   - Reuse existing `PermissionsController` `POST` and `DELETE` endpoints; build a simple UI under `dashboard/settings/permissions` that lists pages and toggles `canRead`/`canWrite` per department.

8. Rollout & Safety
   - Feature-flag new menu endpoint if needed. Ensure that back-end APIs still enforce per-page authorization when serving sensitive data — UI filtering is not sufficient.

Example frontend fetch (pseudo):

fetch('/permissions/menu', { headers: { Authorization: `Bearer ${token}` } })
  .then(r => r.json())
  .then(data => {
    // data.permissions => filter menu
    // data.menuPages => quick membership checks
  });

Implementation plan (PR-sized tasks)
- PR 1: Add `PermissionsController.getMenu()` + `PermissionsService.menuForUser()` with unit tests.
- PR 2: Frontend: menu client + two-layer Menu component + integration test for visibility by role.
- PR 3: Optional Admin permissions UI.

Notes / Decisions required from product
- Default behavior when no PagePermission exists for a page: treat as allowed or denied? (Recommend deny unless explicit allow.)
- Whether Managers can manage permissions across departments or only their own.

