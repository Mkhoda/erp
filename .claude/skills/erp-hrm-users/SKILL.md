---
name: erp-hrm-users
description: Deep context for the Arzesh ERP HRM module (apps/backend/src/modules/hrm/ — Users, Departments, Timesheets) and its frontend pages (apps/frontend/app/dashboard/users/page.tsx, apps/frontend/app/dashboard/departments/page.tsx) — the User model, the dual primary-department-vs-userDepartments-junction pattern (which also shows up in attendance/tickets/permissions scoping), bulk CSV import, per-user attendance-rule overrides edited from the users panel, maxSessions/session-enforcement wiring, and which parts of the module (Timesheets, HrmController dashboard) are dead backend code with zero frontend callers. Use whenever the user asks to add/fix/explain anything about user management, the users page, department assignment, department membership, bulk user import/CSV, per-user attendance rules from the users panel, maxSessions/session limits tied to user editing, or timesheets — even if they just say "کاربران", "دپارتمان‌ها", or "ساعات کاری".
---

# Arzesh ERP — HRM Module (Users, Departments, Timesheets)

Backend: `apps/backend/src/modules/hrm/` — `users.service.ts`/`users.controller.ts`, `departments.service.ts`/`departments.controller.ts`, `timesheets.service.ts`/`timesheets.controller.ts`, `hrm.controller.ts`, wired up in `hrm.module.ts` (imports `AttendanceModule` so `UsersService` can call `RecomputeService`).

Frontend: `apps/frontend/app/dashboard/users/page.tsx` (889 lines — list/grid, add/edit modal with embedded attendance-rule section, bulk CSV import modal, department-tree membership modal) and `apps/frontend/app/dashboard/departments/page.tsx` (134 lines — plain CRUD table, no membership UI of its own).

**Dead code in this module — do not build on it without confirming with the user first:**
- `TimesheetsService`/`TimesheetsController` (`hrm/timesheets.*`) — full CRUD + approve/reject + Excel export exists on the backend, and the `Timesheet` Prisma model is real, but **no frontend page anywhere references `/timesheets`** (grepped, zero hits). Attendance tracking today is handled entirely by the newer `attendance/` module (`AttendanceDay`, raw punches, `AttendanceRequest`). Treat `Timesheet`/`TimesheetsService` as legacy/orphaned unless the user explicitly wants it revived.
- `HrmController.getDashboardData()` (`GET /hrm/dashboard`, `apps/backend/src/modules/hrm/hrm.controller.ts:10-76`) — computes employee/department/timesheet stats but **has no frontend caller either**. The real dashboard (`/dashboard`) gets its stats elsewhere.

---

## 1. User model & the dual-department pattern

`prisma/schema.prisma` `model User` (line 11) — key fields for this module:

```prisma
role          Role      @default(USER)      // ADMIN | MANAGER | USER | EXPERT
disabled      Boolean   @default(false)     // soft-disable, not delete
maxSessions   Int       @default(1)         // 0 = unlimited concurrent sessions
departmentId  String?                       // ── PRIMARY dept FK (legacy, single) ──
department    Department? @relation(...)
userDepartments UserDepartment[]            // ── many-to-many membership (current) ──
attendanceCardNo String? @unique            // links device punches to this user
attendanceRule   UserAttendanceRule?        // 1:1 per-user override row
```

`UserDepartment` (schema.prisma:288) is a plain join table: `@@id([userId, departmentId])`, cascade-deletes with either side.

### The dual-department gotcha

A user can belong to a department two different ways, and **different parts of the codebase honor them inconsistently** — read this before touching anything department-scoped:

- **`users.service.ts` `findAll()`** (line 35) — when the requester is a `MANAGER`, scopes visible users via `resolveManagerDeptIds()` (line 23), which merges **both** `User.departmentId` (direct DB read, since the JWT payload never carries `departmentId`) **and** `userDepartments` memberships into one `OR` query.
- **`permissions.service.ts` `menuForUser()`** (apps/backend/src/modules/permissions/permissions.service.ts:103) — for non-admins, page-permission scoping (`deptIds`) is built **only** from `prisma.userDepartment.findMany(...)` (line 129). The primary `User.departmentId` is **never consulted** here. A user whose only department link is the legacy `departmentId` FK (no `UserDepartment` row) gets **zero** department-scoped page permissions, even though other code (like the manager-scoping above) treats them as belonging to that department.
- **The users-page edit UI never writes the primary `departmentId` at all.** `onSubmit()` in `users/page.tsx` (line 175) builds its PATCH/POST payload with `departmentIds` (plural — the join table) and never includes a `departmentId` key. So editing a user through `/dashboard/users` only ever touches `UserDepartment` rows; the primary FK stays whatever it was set to at row creation (only settable today via a bulk-import CSV row's `departmentId` column, see §3) or a direct DB write. In practice, for any user edited through the UI, **`userDepartments` is the department source of truth** — don't rely on `user.departmentId` being populated or current.
- Backend `create()`/`update()` in `users.service.ts` accept `departmentIds: string[]` in the payload and manage `UserDepartment` rows explicitly: `create()` does `createMany` (line 84-86) if the array is non-empty; `update()` **fully replaces** membership — `deleteMany` then `createMany` (line 185-190), not a diff.

**Other modules that also read `departmentId`** (grep hits, not deep-dived here — check each before assuming behavior): `attendance/records/records.service.ts`, `attendance/requests/requests.service.ts`, `attendance/dashboards/dashboards.service.ts`, `tickets/tickets.service.ts` (`userDeptIds()` — see `erp-tickets` skill), `tickets/categories.service.ts`, `tickets/analytics.service.ts`, `tickets/comments.service.ts`, `notifications/announcements.service.ts`. This same "primary FK vs. join-table membership, and which one a given query actually uses" question recurs in most of them — verify per-module rather than assuming.

---

## 2. User CRUD (`users.service.ts`)

`create()` (line 51) and `update()` (line 145) share a normalization pipeline before hitting Prisma:
- **Email**: blank string → `null`; otherwise trimmed + lowercased.
- **Phone**: blank string → `null` (no normalization here — the `09.../989...` OR-query pattern from `CLAUDE.md` is for auth lookups, not this module).
- **`attendanceCardNo`**: blank → `null` (column is `@unique`, so empty strings must never collide). If a non-empty card number is being assigned, `recompute.freeCard(cardNo, excludeUserId?)` is called first (best-effort, wrapped in try/catch) to release that card number from any other holder (e.g. a "provision cards" placeholder user) — this moves that holder's punches/`AttendanceDay` rows aside so the unique constraint on `attendanceCardNo` doesn't throw, then `linkAttendance(userId)` (line 93, also best-effort) calls `RecomputeService.relinkUser()` to re-attach punches and recompute attendance for the new holder. **Both steps swallow errors silently** — a failed relink doesn't fail the user save; the admin has to notice and re-run the "اتصال و بازمحاسبه" (connect & recompute) action manually.
- **Duplicate-value errors**: Prisma `P2002` is caught and rethrown as a `ConflictException` with a Persian message via the `FIELD_FA` map (line 7: `phone` → «شماره موبایل», `email` → «ایمیل», `attendanceCardNo` → «کد کارت»). Add new unique fields to `FIELD_FA` too, or the error message falls back to the raw field name.
- **Password**: hashed with `bcrypt.hash(..., 10)` only when `payload.password` is truthy; `update()` explicitly `delete`s the key otherwise so an empty-string password never gets persisted.

`findAll()`/`findOne()` select shape includes `userDepartments: { select: { departmentId: true, department: true } }` — the frontend's `User.userDepartments` type expects exactly this shape; if you add fields to the select, update the frontend `User` type in `users/page.tsx:13-25` too.

`remove()` is a hard `prisma.user.delete()` — no soft-delete path here (that's what `disabled` is for; the frontend never exposes a delete button, only the disable/enable toggle via `onToggleDisable()`).

Controller (`users.controller.ts`): `POST /users` and `PATCH /users/:id` are `@Roles('ADMIN')`-only; `GET /users` (list) and `GET /users/:id` additionally require `@Page('/dashboard/users')` via `PagePermissionGuard` and allow `MANAGER`/`EXPERT`/`USER` too (scoped down for managers as above). `POST /users/bulk` allows `ADMIN` and `MANAGER`. `GET/PATCH /users/me` are self-service, no page-permission check.

---

## 3. Bulk user import (`bulkCreate()`, `users.service.ts:103`)

**Transactional, all-or-nothing**: the whole batch runs inside one `prisma.$transaction(async (tx) => {...})` (line 126) that loops and `tx.user.create()`s each row plus its `UserDepartment` rows; if *any* row throws (e.g. duplicate phone), the entire transaction rolls back and the method returns `{ imported: 0, errors: [{ row: 0, message: ... }] }` — there is no partial-import / per-row-error-collection mode despite the `errors` array shape suggesting one. If you're asked to make bad rows skip-and-continue instead of all-or-nothing, this is the function to restructure (drop the single `$transaction` wrapper, or catch per-row inside the loop and stop using `tx` for failed rows).

Password hashing happens **before** the transaction (`Promise.all` over rows, line 114), department fallback for `MANAGER` callers happens there too: if the caller is a `MANAGER` and a row has no `departmentId`, it defaults to `managerDeptIds[0]` (line 117) — i.e., bulk-imported-by-manager users default into the *first* department the manager's `resolveManagerDeptIds()` resolves to, not necessarily a department the manager "primarily" belongs to.

Expected row shape (frontend `BulkImportModal`, `users/page.tsx:771-889`): CSV or pasted text, parsed client-side (`parseCSV()`, handles quoted fields and tab/comma delimiters), then column→field mapping UI lets the admin map arbitrary CSV headers to: `phone, email, firstName, lastName, role, departmentId, password`. Auto-detection guesses common header names (English and Persian — e.g. `تلفن`/`موبایل` → `phone`, `نام` → `firstName`, `دپارتمان` → `departmentId`). **Note**: the bulk-import row's `departmentId` becomes both the row's plain-object key sent to `POST /users/bulk` *and*, per `bulkCreate()`'s own logic (line 120), gets folded into `departmentIds: [payload.departmentId]` if no explicit `departmentIds` array is given — so this is the one UI path that actually sets the legacy primary `User.departmentId` FK (since it's included verbatim in `payload` passed to `tx.user.create()`), unlike editing a user through the normal modal (§1).

---

## 4. Department assignment, `maxSessions`, and session enforcement

- **Departments tree modal** (`DepartmentsTreeModal`, `users/page.tsx:669-769`) — reachable via the "دپارتمان‌ها" header button on `/dashboard/users`. Lets an admin expand a department and add/remove members directly, calling `POST /departments/:id/members` and `DELETE /departments/:id/members/:userId`, which map to `DepartmentsService.addMember()`/`removeMember()` (`departments.service.ts:23-35`) — thin wrappers over `UserDepartment` `upsert`/`deleteMany`. This is a **separate** UI/API path from editing a user's `departmentIds` in the add/edit modal — both ultimately touch the same `UserDepartment` table, so either one is a valid way to manage membership, but they don't share client-side state (each does its own `load()`).
- **`maxSessions`** — editable per-user in the add/edit modal (`users/page.tsx:508-525`), `0` shown as "نامحدود" (unlimited), otherwise the helper text says "هنگام ورود جدید، N نشست باقی می‌ماند" (on new login, N sessions remain). This value only takes effect at **login time**: `AuthService` calls `SessionsService.enforceLimit(sub, ctx.maxSessions ?? 1, sessionId)` non-blockingly (`auth.service.ts:228`) right after issuing a new session. `enforceLimit()` (`sessions.service.ts:83-98`) evicts the **oldest-by-`lastSeenAt`** active, non-revoked, non-expired sessions beyond the limit — editing `maxSessions` on an already-logged-in user does **not** retroactively revoke anything until their next login (or someone else's, since the eviction runs against that user's whole session set).

---

## 5. Per-user attendance rule editing (`UserAttendanceRule`)

This is the module's best example of the **per-user override pattern** used elsewhere in attendance (group `WorkSchedule` defaults → per-user `UserAttendanceRule` override → per-day `AttendanceOverride`/`ScheduleOverride`, in ascending specificity).

`UserAttendanceRule` (schema.prisma:744) — 1:1 with `User` (`userId @unique`), all fields **nullable except `employeeType`/`otAllowed`**, meaning "inherit from the assigned `WorkSchedule`, or the org default schedule if `scheduleId` is null":

```prisma
scheduleId    String?        // null = organization's default WorkSchedule
employeeType  EmployeeType   @default(FULL_TIME)   // FULL_TIME | HOURLY
startTime / endTime          String?  // "HH:mm"
dailyMinutes  Int?
checkInStart / checkInEnd    String?
checkOutStart / checkOutEnd  String?
graceMinutes  Int?
flexEnabled   Boolean?
otAllowed     Boolean @default(true)
otMaxDaily / otMaxMonthly    Int?
```

Endpoints live in the **attendance** module, not hrm — `apps/backend/src/modules/attendance/schedules/schedules.controller.ts`:
- `GET /attendance/schedules-lite` (`ADMIN`, `MANAGER`) — list of `WorkSchedule` groups for the dropdown, used by the users page to populate `schedules` state.
- `GET /attendance/user-rules/:userId` (`ADMIN`, `MANAGER`) → `SchedulesService.getUserRule()` — plain `findUnique`, may return `null` (no override row yet).
- `PUT /attendance/user-rules/:userId` — **no `@Roles()` guard on this specific route** (unlike its siblings on the same controller, which are all `ADMIN`/`ADMIN+MANAGER` — the class-level `@Roles('ADMIN')` from `@Controller('attendance')` still applies since there's no method-level override, so it *is* ADMIN-gated via the class decorator, just don't assume MANAGER can call it without re-checking if the class decorator ever changes). `SchedulesService.upsertUserRule()` (schedules.service.ts:162) normalizes empty-string/`null` inputs to `null` (`str()`/`num()` helpers) and upserts.

Frontend flow (`users/page.tsx`):
- `onEdit()` (line 139) opens the modal immediately with a `DEFAULT_RULE` stub, then **asynchronously** fetches `GET /attendance/user-rules/:id` and merges the response over the defaults once it lands — so the rule section can visibly "pop in" a moment after the modal opens. `DEFAULT_RULE` (line 131) intentionally uses `""` for numeric/optional fields (not `null`) since they're bound to controlled `<input>`s.
- `onSubmit()` (line 165) saves the user first (`POST`/`PATCH /users`), then — **only if the user save succeeded** — fires a **separate, best-effort** `PUT /attendance/user-rules/:id` (line 191-195, wrapped in its own try/catch that's silently swallowed). This means a failed rule save does **not** roll back or even surface an error on the user save — the toast still says "کاربر ویرایش شد" (user edited) even if the attendance-rule PUT 500'd. If you're debugging "I changed the schedule/OT limits but it didn't stick," check this silent catch first.
- UI conditionally hides OT fields (`otAllowed`, `otMaxDaily`, `otMaxMonthly`) entirely when `employeeType === "HOURLY"` (lines 618-622, 642-651) — hourly employees have no overtime concept in this system.

---

## 6. Timesheets (`hrm/timesheets.*`) — orphaned backend, no frontend

Full CRUD + workflow exists and is reachable via API, but **is dead code from a product standpoint** (confirmed: zero references to `/timesheets` or `timesheet` anywhere under `apps/frontend`). `Timesheet` (schema.prisma:99) is a flat per-day-hours record (`date`, `hours: Float`, `project?`, `note?`, `approved: Boolean`) — much simpler than the `attendance/` module's `AttendanceDay`/raw-punch model, and does **not** interact with `deficitMinutes` or any of the attendance-engine calculations described in `CLAUDE.md`.

If asked to "fix the timesheets page" or similar, first confirm the user actually means `/dashboard/attendance/*` (the real, live system) — they may be misremembering an old feature name. If they genuinely want timesheets revived as a separate concept, the backend (`timesheets.service.ts`, `timesheets.controller.ts`) is intact: `GET /timesheets` (self or all for ADMIN/MANAGER), `GET /timesheets/manage` (management view with user+department), `GET /timesheets/export` / `GET /timesheets/export/manage` (ExcelJS `.xlsx` exports, Persian headers, `res.setHeader('Content-Disposition', 'attachment; ...')`), `PATCH /timesheets/:id/approve` / `/reject` (ADMIN/MANAGER only, just flips `approved`), ownership check pattern repeated across `findOne`/`update`/`remove`: `role === 'ADMIN' || role === 'MANAGER' || ts.userId === req.user.userId` else `ForbiddenException`.

---

## 7. Departments (`hrm/departments.*`)

Plain CRUD, no soft-delete, no cascading-membership warning on delete (a `Department.delete()` with existing `UserDepartment`/`User.departmentId` references will hit FK constraints — not handled gracefully in `departments.service.ts:21`, so a delete on an in-use department will throw a raw Prisma error up through the controller). `findAll()`/`findOne()` both `include` the `MEMBER_SELECT` shape (userDepartments → user firstName/lastName/role/disabled) for the membership modal.

`/dashboard/departments/page.tsx` itself is a bare CRUD table (name + description + created date) with **no membership management UI** — that lives entirely in the users page's `DepartmentsTreeModal` (§4). If asked to add member management to the departments page itself, `POST /departments/:id/members` / `DELETE /departments/:id/members/:userId` are already there to call — just needs a frontend UI, no backend work required.

**Where department IDs get consumed elsewhere** (pointer only — see each module's own context/skill before changing):
- **Permissions**: `/dashboard/access` page-permission rows are keyed by `departmentId` (`PagePermission.departmentId`); see §1 gotcha re: `userDepartments`-only scoping in `menuForUser()`.
- **Tickets**: every `Ticket` requires a `departmentId` (routing/SLA config lives on `TicketDepartmentConfig` per department) — see the `erp-tickets` skill.
- **Attendance**: `records.service.ts`, `requests.service.ts`, `dashboards.service.ts` all filter/scope by department for manager views (each has its own dept-resolution logic — don't assume it matches `resolveManagerDeptIds()` in `users.service.ts` without checking).
- **Announcements**: `notifications/announcements.service.ts` can target specific departments.
