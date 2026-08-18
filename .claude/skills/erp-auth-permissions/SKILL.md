---
name: erp-auth-permissions
description: Covers Arzesh ERP's auth/session system (JWT sid+gtv validation, OTP login via Bale, password reset/change, session revocation, /dashboard/profile security tab) and the page-permission system (KNOWN_PAGES/ADMIN_PAGES/BASE_PAGES, PagePermissionGuard, dept+role-scoped PagePermission rows, the /dashboard/access admin UI, TwoLayerSidebar menu filtering). Load this before touching anything in apps/backend/src/modules/auth/, auth-settings/, sessions/, or permissions/, or apps/frontend/app/dashboard/access, dashboard/profile, dashboard/layout.tsx, or lib/menu.tsx. Trigger on tasks like: adding a new dashboard page, changing who can see a menu item, debugging "page not showing in sidebar" or "403 Access to page denied" or "session revoked" or "Session invalidated by global logout" errors, editing login/OTP/password-reset/change-password flows, session/force-logout features, or anything referencing sid, gtv, globalTokenVersion, PagePermission, or pages.constant.ts.
---

# Arzesh ERP: Auth/Sessions + Page Permissions

Two systems, read together because the permission guard runs *after* the auth
guard on every protected route, and both are commonly touched in the same
"add a page" or "fix access" task.

## Part A — Auth & Sessions

### JWT payload & validation flow
Files: `apps/backend/src/modules/auth/jwt.strategy.ts`, `auth.service.ts`,
`sessions/sessions.service.ts`, `auth-settings/auth-settings.service.ts`.

Payload shape (`auth.service.ts` `signUser()`, line ~201):
```ts
{ sub, email, role, sid: sessionId, gtv: globalTokenVersion }
```
- `sid` — a `randomUUID()` generated fresh on every login, used as the primary
  key of a new `Session` row (`sessions.service.ts` `createSession()`). The
  session row is written to the DB **before** the token is returned to the
  caller — if you ever refactor `signUser()`, keep that order, otherwise a
  client that calls `/auth/me` immediately after login can 401 on a session
  row that doesn't exist yet.
- `gtv` — copied from `AuthSettings.globalTokenVersion` at sign time.

`JwtStrategy.validate()` (`jwt.strategy.ts:22`) does two independent checks,
**both optional** for backward compatibility with pre-session-management
tokens that lack these fields:
1. If `payload.gtv !== undefined`: compare against the *current*
   `AuthSettingsService.get().globalTokenVersion`. Mismatch → 401 "Session
   invalidated by global logout". This is how "force logout everyone" works —
   `AuthSettingsService.forceGlobalLogout()` / `.update()` increment
   `globalTokenVersion`, which instantly invalidates every previously issued
   token without touching the `Session` table at all.
2. If `payload.sid`: look up `SessionsService.isSessionValid(sid)` — false if
   the `Session` row is missing, `isRevoked`, or past `expiresAt`. On success
   it also fires `touchSession(sid)` (non-blocking `lastSeenAt` update).

**Both checks are backed by independent 30-second in-memory caches**
(`AuthSettingsService.cache`/`cacheAt`, `SessionsService.validityCache`), each
process-local (not shared across horizontally-scaled backend instances, if
that's ever introduced). This means:
- After `AuthSettingsService.update()` or `forceGlobalLogout()`, the service
  calls `this.invalidateCache()` itself — no manual step needed.
- After revoking a specific session (`revokeSession`, `revokeUserSessions`,
  `enforceLimit`, `revokeAll`), `SessionsService` always calls
  `this.invalidateCache(sessionId)` for every affected id in the same
  transaction path — again handled internally. If you add a new code path
  that flips `isRevoked` directly via Prisma without going through these
  service methods, the 30s cache will keep validating the stale session.

### Session limits (`maxSessions`)
`User.maxSessions` (0 = unlimited, default effectively 1). After every
successful login, `AuthService.signUser()` calls
`this.sessions.enforceLimit(sub, ctx.maxSessions ?? 1, sessionId)`
**without awaiting it** (`.catch(() => {})` fire-and-forget) — the response to
the client isn't delayed by eviction. `enforceLimit` evicts the
oldest-by-`lastSeenAt` active sessions beyond the limit, excluding the
session that was just created.

### OTP / Bale SMS
File: `apps/backend/src/modules/auth/bale.service.ts`.

Despite what CLAUDE.md's env-var table says (`BALE_CLIENT_ID`/`BALE_CLIENT_SECRET`),
**the actual runtime credentials are `BALE_SAFIR_API_KEY` and `BALE_BOT_ID`**,
read via `SystemSettingsService.get()` first (DB `SystemSettings` singleton,
fields `baleSafirApiKey`/`baleBotId`/`baleMock`) and falling back to env vars
only as bootstrap (`resolveSettings()`, `bale.service.ts:32`). `BALE_CLIENT_ID`
is only consulted as a last-resort fallback for the API key, mostly dead
weight from an older naming scheme. This is the Bale **Safir v3** OTP message
API (`https://safir.bale.ai/api/v3/send_message`), not a generic SMS gateway —
don't confuse it with the Bale bot/messaging APIs used elsewhere.

Mock mode: `db.baleMock === true` OR `BALE_MOCK` env `'true'`/`'1'` — checked
in DB first, so an admin can flip mock mode from `/dashboard/settings` (Bale
OTP tab) without redeploying.

`sendOtp()`/`verifyOtp()` phone matching always normalizes to `98XXXXXXXXXX`
via `AuthService.normalizePhone()` then queries **both** representations:
```ts
const phoneAlt = phone.startsWith('98') ? '0' + phone.slice(2) : '98' + phone.slice(1);
where: { OR: [{ phone }, { phone: phoneAlt }] }
```
This exact pattern is repeated in `login`, `loginByPhone`, `sendOtp`,
`verifyOtp`, `forgotPassword`, and `changePassword` in `auth.service.ts` — if
you add a new phone-keyed lookup, copy this pattern rather than assuming the
DB is normalized (it isn't; existing rows are a mix of `09...` and `989...`).

OTP records (`Otp` table) are purpose-agnostic at storage time — `purpose`
(`login|forgot|change|signup`) only affects the SMS message template
(`messageTemplate()`) and whether an existing-user check is required
(`sendOtp()`: `signup` requires the phone to be *unregistered*; every other
purpose requires it to already belong to a user). Codes: 6 digits, 60-second
expiry (`expiresAt = now + 60_000`, **not** 5 minutes despite what the SMS
text itself says — the templates in `messageTemplate()` claim "۵ دقیقه
اعتبار دارد" (5 min validity) but the actual `expiresAt` computation is 60
seconds; if you change one, check the other). Rate limit: 30 OTPs/phone/hour
(`sendOtp()`, `count >= 30`).

### Password reset vs. change-password — different session consequences
- **`forgotPassword()`** (unauthenticated, phone+OTP+newPassword): updates
  the password hash only. Does **not** touch `tokenVersion` or revoke
  sessions — any device already logged in stays logged in.
- **`changePassword()`** (authenticated, requires an OTP sent to the user's
  own phone + newPassword): increments `User.tokenVersion` (currently
  unused by `JwtStrategy` — see note below) **and calls
  `sessions.revokeUserSessions(userId)` with no `exceptSessionId`**, which
  revokes *every* session including the one the request is currently using.
  Practically: after a successful change-password call, the caller's own
  current JWT is revoked (its `sid` now fails `isSessionValid`) and the next
  API call 401s. `apps/frontend/app/dashboard/profile/page.tsx`'s
  `changePassword()` (security tab) does **not** currently handle this — it
  just shows a success toast and resets the OTP form fields, it does not
  force a re-login. If you touch this flow, that's the gap to close, not a
  behavior to preserve.
- Note: `User.tokenVersion` is incremented on change-password but
  `JwtStrategy.validate()` never reads/compares it — the schema field exists
  from an earlier design that was superseded by the `sid`/session-revocation
  mechanism. Don't assume incrementing it does anything by itself.

### `/dashboard/profile` security tab (as of 2026-08-18)
The old standalone `/dashboard/change-password` page has been **deleted**;
its functionality is merged into `apps/frontend/app/dashboard/profile/page.tsx`
as the `security` tab (`?tab=security`, one of `profile|security|notifications`).
The flow there: `sendOtp()` posts to `/auth/send-otp` with
`purpose: 'change'` using the user's own phone from `/auth/me`, then
`changePassword()` posts `{ otp, newPassword }` to `/auth/change-password`
(`JwtAuthGuard`-protected; userId comes from the token, not the body). If you
see a memory note or old doc referencing `/dashboard/change-password` as a
separate page, it is stale — correct it to the profile security tab.

### Session/auth admin endpoints (all `@Roles('ADMIN')`)
- `sessions.controller.ts`: `GET /sessions` (paginated, filters:
  `userId`/`includeRevoked`/`onlineOnly`), `GET /sessions/stats`,
  `DELETE /sessions/:id`, `POST /sessions/revoke-all` (system-wide),
  `POST /sessions/purge-expired?days=`.
- `auth-settings.controller.ts`: `GET/PATCH /auth-settings`
  (`accessTokenTtlSec`, `rememberMeTtlSec`, `idleTimeoutSec`,
  `maxSessionLifetimeSec` — note `idleTimeoutSec` and
  `maxSessionLifetimeSec` are stored but **not enforced anywhere** in
  `jwt.strategy.ts`, they're schema-ready, not wired up), and
  `POST /auth-settings/force-logout` (bumps `globalTokenVersion`, no other
  field changes).
- `auth.controller.ts` also exposes user-scoped session self-service:
  `POST /auth/logout` (revoke own current session by `sid`),
  `POST /auth/logout-all`, `GET /auth/sessions` (own list, marks
  `isCurrent`), `DELETE /auth/sessions/:id` (own session only — 404s if the
  session belongs to someone else), and admin-only
  `POST /auth/users/:userId/logout`.

---

## Part B — Page Permission System

### The three page lists — precise semantics
File: `apps/backend/src/modules/permissions/pages.constant.ts`.

| List | Where | What it actually does |
|---|---|---|
| `KNOWN_PAGES` | `pages.constant.ts` | The **only** source of truth for what pages exist. `{ page, label, adminOnly? }[]`. `PermissionsService.syncPages()` upserts these into the `Page` DB table (add new / update label / **preserve existing `isActive`**). Anything not in this array is invisible everywhere — the seeder won't create a `Page` row, `menuForUser()` for ADMIN won't include it, and the `/dashboard/access` admin UI has nothing to render for it. |
| `ADMIN_PAGES` | `pages.constant.ts` | **Currently dead code.** Defined but not imported or read anywhere else in the repo (backend or frontend) — verified by full-repo grep. It does *not* drive any auto-grant behavior today, despite the CLAUDE.md checklist describing it that way. Real ADMIN auto-grant happens two other ways (see below). Still worth keeping in sync per the checklist (cheap, future-proof, and other tooling may start reading it), but don't debug an access problem by staring at this array — it has no runtime effect. |
| `BASE_PAGES` | `permissions.service.ts` (separate, **not exported** from `pages.constant.ts`) | The actual list of pages every authenticated user gets regardless of department/role: `/dashboard`, `/dashboard/profile`, `/dashboard/chat`, `/dashboard/messaging`, `/dashboard/attendance/my`, `/dashboard/tickets/my`. Always OR'd into `menuForUser()`'s result (`activePagePaths()` force-includes them even if the `Page` row is missing/inactive; the merge step at the end of `menuForUser()` always adds them to `menuPages`/`permissions`). |

**How ADMIN actually gets full access** (two independent, redundant
mechanisms — neither reads `ADMIN_PAGES`):
1. `PagePermissionGuard.canActivate()` (`page.guard.ts:20`): `if (user.role
   === 'ADMIN') return true;` — short-circuits before any `PagePermission`
   DB lookup.
2. `PermissionsService.menuForUser()` (`permissions.service.ts:107`): if
   `user.role === 'ADMIN'`, returns `menuPages: KNOWN_PAGES.map(p =>
   p.page)` directly — every known page, unconditionally, no DB permission
   rows required.

So `adminOnly: true` in `KNOWN_PAGES` is purely descriptive/documentation —
it isn't read by any enforcement code either. The actual "only admin can see
this" behavior for non-ADMIN roles comes from simply **never creating a
`PagePermission` row** granting that page to MANAGER/EXPERT/USER (the
`/dashboard/access` UI enforces this by not offering admin-only pages as
configurable — see `ADMIN_LOCKED` below).

### Enforcement chain for a protected backend route
1. `@UseGuards(JwtAuthGuard, ...)` — authenticates, populates `req.user`.
2. `@Page('/dashboard/some-page')` decorator (`page.decorator.ts`, sets
   `PAGE_KEY` metadata) + `PagePermissionGuard` in the guard list.
3. `PagePermissionGuard.canActivate()` (`page.guard.ts`):
   - No `@Page()` metadata on the handler/class → allow (guard is opt-in per
     route, not global).
   - `role === 'ADMIN'` → allow.
   - Otherwise collects the user's department ids from **both** the legacy
     single `User.departmentId` FK and the many-to-many `UserDepartment`
     table (`deptIdSet` union), 400s with "No department assigned" if empty.
   - Looks for **any** `PagePermission` row where `page` matches, `role IN
     ('*', user.role)`, `canRead: true`, and `departmentId IN` the user's
     depts. One matching row from any one department is sufficient — access
     is **OR'd across all departments the user belongs to**, not AND'd.
4. Individual controllers apply `@Page()` per-route, not per-controller
   uniformly — e.g. `hrm/users.controller.ts` only guards two specific
   handlers. Don't assume every handler in a `@Page()`-decorated controller
   file is actually protected; check each method.

### `PagePermission` rows and the wildcard-vs-specific merge
`role` on a `PagePermission` row is either `'*'` (all configurable roles) or
one of `MANAGER|EXPERT|USER`. `PermissionsService.menuForUser()` merges them
per page as: **wildcard sets the baseline, then role-specific rows override
it** (`wildcardMap` applied first, `specificMap` applied second into the same
`pageMap`) — so an admin can grant `*` broadly and then explicitly revoke it
for one role with a `role`-specific `canRead: false` row, or vice versa. When
a user belongs to multiple departments, role-specific rows across those
depts are **OR'd** (`cur.canRead = cur.canRead || p.canRead`) — any granting
department wins.

`activePagePaths()` filters everything through the `Page.isActive` flag
(toggled via `PATCH /permissions/pages/:id`, admin-only) — an inactive page
disappears from every user's menu including ADMIN's... actually not ADMIN's:
the ADMIN branch of `menuForUser()` returns `KNOWN_PAGES` directly without
consulting `activePagePaths()` at all, so **disabling a `Page` row hides it
from everyone except ADMIN**, who bypasses the whole `Page`-table filter.

### Frontend: `/dashboard/access` admin UI has its own hardcoded page lists
`apps/frontend/app/dashboard/access/page.tsx` does **not** derive
admin-only/universal pages from the backend `ADMIN_PAGES` or `BASE_PAGES` —
it hardcodes its own parallel copies: `ADMIN_LOCKED` / `ADMIN_LOCKED_DISPLAY`
(shown as a read-only "system pages" panel) and `UNIVERSAL_PAGES` /
`UNIVERSAL_DISPLAY` (read-only "universal pages" panel). Configurable pages
(the actual matrix with MANAGER/EXPERT/USER toggle buttons) come from a
third structure, `SECTIONS` (an array of `{ id, title, groups: [{ title,
icon, pages: [...] }] }`), which explicitly enumerates page paths — a page
must appear in a `SECTIONS` group's `pages` array to be manageable in this
UI at all.

**Consequence for the "add a new page" workflow**: adding a page to
`KNOWN_PAGES` makes it exist (DB row, guard-enforceable, included in ADMIN's
implicit menu) but does **not** make it configurable in `/dashboard/access`
— you must also add its path to one of: `ADMIN_LOCKED`/`ADMIN_LOCKED_DISPLAY`
(if `adminOnly`), `UNIVERSAL_PAGES`/`UNIVERSAL_DISPLAY` (if it should be a
`BASE_PAGES`-style universal page — and add it to `BASE_PAGES` in
`permissions.service.ts` too if so), or a `SECTIONS` group (if it needs
per-dept/role toggles). Skip this and the page is real but invisible in the
admin matrix — non-ADMIN roles can never be granted it through the UI (an
admin would have to call `POST /permissions` directly).

At the time of writing several `KNOWN_PAGES` entries (e.g.
`/dashboard/attendance/monthly`, everything under `/dashboard/tickets/*`,
`/dashboard/notifications/*`) are **not yet wired into any `SECTIONS`
group** in `access/page.tsx` — check current state before assuming a page
you're adding is automatically manageable.

### Frontend: sidebar menu filtering
`apps/frontend/lib/menu.tsx` defines the static `MENU` tree (`MenuItem[]`,
optional `roles?: Role[]` hard-coded per item/group and optional `children`).
`apps/frontend/app/components/TwoLayerSidebar.tsx`'s `shouldShow()` combines
this static `roles` hint with the dynamic `allowedPages` array fetched from
`GET /permissions/menu` (`.menuPages`, fetched once in
`dashboard/layout.tsx` and passed down):
- Leaf item with no `roles`: always shown (this is how universal/base pages
  render without any permission check on the frontend).
- Leaf item with `roles`: shown only if `role` matches **and** `page ∈
  allowedPages`.
- Group (has `children`): shown if the group's own `roles` matches the
  user's role, **or** — even if the role doesn't match — if any child's
  `page` is in `allowedPages` (`hasExplicitChildAccess`). This lets a
  MANAGER-only group surface for a USER who was explicitly granted one child
  page via `PagePermission`.

This is purely a **display** filter — it does not enforce anything. A user
who guesses a URL still has to pass `PagePermissionGuard` on the backend
route, and the frontend `dashboard/layout.tsx` itself does a second,
independent check (`BASE_ALWAYS_ALLOWED_EXACT`/`_PREFIX` + `allowedPages`)
that renders a full "access denied" screen for the current `pathname` if
it's not covered — see lines ~124-142 of `dashboard/layout.tsx`. Both
`TwoLayerSidebar`'s base-page list and `dashboard/layout.tsx`'s
`BASE_ALWAYS_ALLOWED_*` are **yet another hardcoded copy** of the
`BASE_PAGES` concept, kept manually in sync with the backend — currently all
three lists (backend `BASE_PAGES`, frontend `UNIVERSAL_PAGES`/`UNIVERSAL_DISPLAY`,
frontend `BASE_ALWAYS_ALLOWED_*`) agree, but nothing enforces that they stay
in sync if one is edited without the others.

### Checklist: Adding a New Page (restated from root CLAUDE.md — follow exactly)
1. **Create the page**: `apps/frontend/app/dashboard/<name>/page.tsx`.
2. **Register it**: add `{ page: '/dashboard/<name>', label: '...' }` to
   `KNOWN_PAGES` in `apps/backend/src/modules/permissions/pages.constant.ts`.
   If admin-only, add `adminOnly: true` and also add the path to
   `ADMIN_PAGES` (currently unread by code, but keep the checklist habit —
   see dead-code note above).
3. **Add to the sidebar**: `apps/frontend/lib/menu.tsx` — new `MenuItem`
   with `page` and a Lucide `icon`; set `roles` if it should default-hide
   for non-matching roles pending explicit grants.
4. **Make it manageable in `/dashboard/access`** (not in the original
   CLAUDE.md checklist, but required in practice — see above): add the path
   to `ADMIN_LOCKED`+`ADMIN_LOCKED_DISPLAY` (admin-only), or
   `UNIVERSAL_PAGES`+`UNIVERSAL_DISPLAY` **and** backend `BASE_PAGES` in
   `permissions.service.ts` (universal), or a `SECTIONS` group (dept/role
   configurable) in `apps/frontend/app/dashboard/access/page.tsx`.
5. **Protect the backend routes**: add `@Page('/dashboard/<name>')` +
   `PagePermissionGuard` to the relevant controller handlers (guard is
   opt-in per-route, see enforcement chain above).
6. **If replacing an old page**: remove it from `KNOWN_PAGES` and
   `ADMIN_PAGES`, and from any of the frontend hardcoded lists in step 4 and
   `dashboard/layout.tsx`'s `BASE_ALWAYS_ALLOWED_*` if applicable. Example
   precedent: `/dashboard/change-password` was deleted and folded into
   `/dashboard/profile`'s security tab (2026-08-18).
7. **Run the sync**: an admin (or you, via `POST /permissions/pages/sync`,
   `@Roles('ADMIN')`) must call it once so `KNOWN_PAGES` gets upserted into
   the `Page` DB table — until then `PermissionsService.listPages()` falls
   back to the static list (fine for ADMIN, but the `/dashboard/access` UI
   reads from this endpoint too, so real DB rows matter for `isActive`
   toggling).
