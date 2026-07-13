# Arzesh ERP — Claude Context

## Project Overview
Iranian ERP system (RTL/Persian) built as a monorepo. Deployed at **erp.arzesh.net** (server: 91.92.181.146).

## Stack
| Layer | Tech |
|---|---|
| Backend | NestJS 11, TypeScript, Prisma ORM, PostgreSQL 15 |
| Frontend | Next.js 16 (React 19), Tailwind CSS 4, Framer Motion, Recharts |
| Auth | JWT + Passport + OTP via Bale (Iranian SMS) |
| Infra | Docker Compose, Nginx (reverse proxy + SSL) |
| Realtime | Socket.IO via `@nestjs/websockets` |
| Utilities | ExcelJS, Sharp, BWIP-js (barcodes), moment-jalaali |

## Monorepo Layout
```
apps/backend/src/modules/   ← NestJS feature modules
apps/frontend/app/          ← Next.js app router pages
nginx/nginx.conf            ← reverse proxy config
docker-compose.prod.yml     ← production stack
```

---

## Backend Modules (`apps/backend/src/modules/`)
- **auth/** — JWT + OTP auth (email & phone), password reset, `bale.service.ts` for SMS
- **auth-settings/** — singleton AuthSettings row: dynamic JWT TTL, global token version, force-logout
- **sessions/** — Session table: one row per login, soft-revoke (`isRevoked`), `enforceLimit()` for maxSessions
- **hrm/** — Users (with `maxSessions`, `disabled`), Departments, Timesheets (CRUD + approve + Excel export)
- **assets/** — Assets, Types, Categories, Buildings, Floors, Rooms, Assignments, Upload, Reports, Barcode utils
- **permissions/** — Page-level access control per dept/role; `pages.constant.ts` is the single source of truth for all pages
- **system-settings/** — Singleton DB row for runtime config (Bale credentials, messaging limits, etc.)
- **messaging/** — Socket.IO gateway + REST: conversations, messages, reactions, presence, file upload, admin settings
- **attendance/** — Full workforce management: raw punches, computed days, requests/approvals, work schedules, holidays, overrides
- **todos/** — Per-user todo list (dashboard widget)
- **ai-settings/** / **chat-history/** / **quota/** — AI chat integration
- **request-logs/** / **system-logs** — Audit/log infrastructure

---

## Frontend Pages (`apps/frontend/app/`)

### Public (`(application)/`)
`landing`, `signin`, `signup`, `forgot-password`, `about`, `services`, `blog`, `contact`

### Dashboard (`dashboard/`)
| Path | Description | Access |
|---|---|---|
| `/dashboard` | Overview / stats | All |
| `/dashboard/profile` | User profile | All |
| `/dashboard/change-password` | Password change | All |
| `/dashboard/chat` | AI chat | All |
| `/dashboard/messaging` | Real-time internal messaging | All |
| `/dashboard/assets` | Asset list | Restricted |
| `/dashboard/assets/[id]` | Asset detail | Restricted |
| `/dashboard/assets/types` | Asset types | Restricted |
| `/dashboard/assets/categories` | Asset categories | Restricted |
| `/dashboard/assets/assignments` | Assignments | Restricted |
| `/dashboard/users` | User management | Restricted |
| `/dashboard/departments` | Departments | Restricted |
| `/dashboard/buildings` / `floors` / `rooms` | Locations | Restricted |
| `/dashboard/reports` | Reports | Restricted |
| `/dashboard/attendance` | Attendance overview | Restricted |
| `/dashboard/attendance/my` | My attendance + leave requests | All |
| `/dashboard/attendance/records` | Daily records (admin/manager) | Restricted |
| `/dashboard/attendance/calendar` | Attendance calendar | Restricted |
| `/dashboard/attendance/requests` | Correction requests | Restricted |
| `/dashboard/attendance/approvals` | Approval queue | Restricted |
| `/dashboard/attendance/holidays` | Holiday list | Restricted |
| `/dashboard/attendance/work-rules` | Work schedule + holidays editor | Admin |
| `/dashboard/attendance/settings` | Attendance system settings | Admin |
| `/dashboard/attendance/sync` | Sync monitor | Admin |
| `/dashboard/security/sessions` | Session management | Admin |
| `/dashboard/settings` | System settings (5 tabs) | Admin |
| `/dashboard/access` | Page permission editor | Admin |
| `/dashboard/ai-settings` | AI configuration | Admin |
| `/dashboard/ai-usage` / `/dashboard/quota` | AI usage/quota | Admin |
| `/dashboard/system-logs` | System logs | Admin |

---

## ⚠️ CHECKLIST: Adding a New Page

When adding any new dashboard page, **all four steps are required**:

### 1. Create the frontend page
`apps/frontend/app/dashboard/<name>/page.tsx`

### 2. Register in `pages.constant.ts`
`apps/backend/src/modules/permissions/pages.constant.ts`

```typescript
// Add to KNOWN_PAGES array:
{ page: '/dashboard/<name>', label: 'نام فارسی' }
// If admin-only, add adminOnly: true AND add to ADMIN_PAGES array:
{ page: '/dashboard/<name>', label: 'نام فارسی', adminOnly: true }

export const ADMIN_PAGES: string[] = [
  '/dashboard/<name>',   // ← add here too
  // ...
];
```

**Why this matters:** `TwoLayerSidebar` filters menu items against `allowedPages` from DB. Pages not in `KNOWN_PAGES` are invisible to the permission seeder and never appear in the admin menu. Pages in `ADMIN_PAGES` are auto-granted to ADMIN role.

### 3. Add to the sidebar menu
`apps/frontend/lib/menu.tsx` — add a menu item with the route path and a Lucide icon.

### 4. (If merging from old pages)
If the new page replaces old standalone pages (e.g., `/dashboard/settings` absorbed `/dashboard/security/settings` and `/dashboard/messaging/admin`), remove the old pages from `KNOWN_PAGES` and `ADMIN_PAGES`.

---

## Database Schema Rules

- **Always use `npx prisma db push`** in `apps/backend/` — NOT `migrate dev`. Production has schema drift from direct edits; `db push` reconciles without migration history conflicts.
- After any schema change: `db push` auto-regenerates Prisma Client.
- `"already in sync"` from `db push` = schema already matched; Client was regenerated. Normal when multiple fields were pushed together.

### Key Models
`User`, `Department`, `UserDepartment`, `Role(enum)`, `Asset`, `AssetType`, `AssetCategory`, `AssetImage`, `AssetAssignment`, `AssetMaintenance`, `AssetCost`, `AssetCondition(enum)`, `AssetAvailability(enum)`, `Building`, `Floor`, `Room`, `Timesheet`, `PagePermission`, `Page`, `Otp`

**Auth/Session models:** `Session`, `AuthSettings` (singleton id="singleton"), `AuditLog`

**Messaging models:** `ChatConversation`, `ChatMember`, `ChatMessage`, `ChatAttachment`, `ChatReaction`, `ChatRead`, `UserPresence`, `ChatSettings`

**Attendance models:** `AttendanceDay`, `RawAttendanceRecord`, `AttendanceOverride`, `AttendanceRequest`, `WorkSchedule`, `UserAttendanceRule`, `Holiday`, `ScheduleOverride`

**System:** `SystemSettings` (singleton id="singleton"), `Todo`

---

## Auth & Authorization

### Roles
`ADMIN | MANAGER | USER | EXPERT`

### Guards & Decorators
- `JwtAuthGuard`, `RolesGuard`, `PagePermissionGuard`
- `@Roles()`, `@Page()`
- Managers are dept-scoped (see only their dept's users/assets)
- Permissions: dept-based, OR-merged across user's departments, `canRead`/`canWrite` per role

### JWT Payload (since 2026-07)
```typescript
{ sub: userId, email, role, sid: sessionId, gtv: globalTokenVersion }
```
- `sid` → validated against `Session.isRevoked` (30s in-memory cache)
- `gtv` → validated against `AuthSettings.globalTokenVersion` (30s cache)
- Old tokens without `sid`/`gtv` still accepted (backward compat)

### Session Management
- **Single session by default** (`User.maxSessions = 1`): new login auto-revokes old sessions
- Configurable per user in `/dashboard/users` → "حداکثر نشست همزمان" field (`0` = unlimited)
- `SessionsService.enforceLimit(userId, maxSessions, newSessionId)` called after every login (non-blocking)
- `enforceLimit` evicts oldest sessions (by `lastSeenAt`) beyond the limit

### OTP / Phone Auth
- Bale SMS gateway (`bale.service.ts`); mock mode: `BALE_MOCK=true` in env
- OTP rate limit: 30/hour per phone number
- **Phone normalization**: DB may store `09120525614` or `989120525614`. Always query with OR:
  ```typescript
  const phoneAlt = phone.startsWith('98') ? '0' + phone.slice(2) : '98' + phone.slice(1);
  where: { OR: [{ phone }, { phone: phoneAlt }] }
  ```
- Display phone in RTL context: wrap in `<bdi dir="ltr">` to prevent digit reversal

---

## Settings Page (`/dashboard/settings`)

5-tab unified settings page replacing old `/dashboard/security/settings` and `/dashboard/messaging/admin`:

| Tab | Content | API |
|---|---|---|
| عمومی | Org name, logo, etc. | `GET/PATCH /api/system-settings` |
| Bale OTP | Client ID/Secret + inline test section | `GET/PATCH /api/system-settings` + `POST /api/system-settings/test-bale` |
| امنیت | JWT TTL, session rules | `GET/PATCH /api/auth-settings` |
| پیام‌رسانی | File size limits, edit/delete windows | `GET/PATCH /api/messaging/settings` |
| پایگاه داده | DB info/maintenance | — |

System settings are a **singleton row** in `SystemSettings` table (`id="singleton"`). Use `SystemSettingsService.get()` which caches the row.

---

## Real-time Messaging (Socket.IO)

- Gateway: `@WebSocketGateway({ cors, transports: ['websocket','polling'] })`
- JWT verified in `handleConnection()` including `sid`+`gtv` checks
- Nginx location: `/socket.io/` → proxied to backend with WebSocket upgrade headers
- Socket URL (frontend derivation):
  ```typescript
  // If NEXT_PUBLIC_API_URL = "https://erp.arzesh.net/api" → "https://erp.arzesh.net"
  // If relative "/api" → window.location.origin
  ```
- `ChatWidget` floats bottom-left (`fixed left-6 bottom-6 z-[9990]`) — mounted in dashboard layout
- `MessagingProvider` wraps dashboard layout, exposes `useMessaging()` hook

---

## Attendance System Patterns

### Deficit Calculation
**Correct formula** (stored as `deficitMinutes` on `AttendanceDay`):
```typescript
deficitMinutes = (!holidayWork && employeeType === 'FULL_TIME')
  ? Math.max(0, dailyMinutes - workedMinutes - leaveMinutes)
  : 0;
```
- `delayMinutes` / `earlyLeaveMinutes` are punctuality metrics (window-based), NOT the same as deficit
- `deficitMinutes` captures ALL shortfall cases: late arrival, early departure, absent, insufficient hours

### Jalali Calendar (Frontend)
The following utility functions are copy-pasted inline in any page that needs Jalali ↔ Gregorian:
```typescript
function toJalali(gy, gm, gd) { /* jdf algorithm */ }
function jalaliToGregorian(jy, jm, jd) { /* returns { y, m, d } (1-indexed) */ }
const jMonthLen = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jy % 4 === 3 ? 30 : 29);
const todayJ = () => { const t = new Date(); return toJalali(t.getFullYear(), t.getMonth()+1, t.getDate()); };
```
Canonical source: `apps/frontend/app/dashboard/attendance/work-rules/page.tsx`

### Jalali Date Picker (three-select)
Use three `<select>` elements for year/month/day. See `JalaliDateSelect` component in `work-rules/page.tsx` or inline IIFE pattern in `my/page.tsx` leave modal. Never use a plain `<input type="text">` for Jalali dates.

### Gregorian Date for API
Convert before sending to API: `${g.y}-${String(g.m).padStart(2,'0')}-${String(g.d).padStart(2,'0')}`

---

## Frontend Patterns

### API Calls
```typescript
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const token = localStorage.getItem('token');
const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
fetch(`${API}/some-route`, { headers: h })
```

### Auth Guard (pages with existing token)
Always validate the token before redirecting to `/dashboard` — stale/revoked tokens cause a signin ↔ dashboard redirect loop:
```typescript
// In signin page useEffect:
const token = localStorage.getItem('token');
if (token) {
  fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (r.ok) window.location.replace('/dashboard'); else { localStorage.removeItem('token'); document.cookie = 'token=; path=/; max-age=0'; setReady(true); } })
    .catch(() => setReady(true));
} else { setReady(true); }
```

### Theme Classes
Use these, never raw Tailwind colors for themed elements:
- Backgrounds: `bg-theme-primary`, `bg-theme-card`, `bg-theme-secondary`, `bg-theme-hover`
- Text: `text-theme-primary`, `text-theme-secondary`, `text-theme-muted`
- Borders: `border-theme`
- Buttons: `btn-theme-primary`, `btn-theme-secondary`
- Inputs: `input-theme`
- Gradient: `bg-gradient-theme-light`

Dark mode supported via CSS variables in `app/styles/global.css`.

**Migration status**: ~20 pages still use raw Tailwind colors. Only `dashboard/page.tsx` and `dashboard/assets/page.tsx` fully migrated.

### RTL / Numbers
- All dashboard containers: `dir="rtl"`
- Phone numbers, times, IDs, numeric inputs: `dir="ltr"`
- Phone display in RTL: `<bdi dir="ltr">{phone}</bdi>` (prevents digit reversal)
- Persian digits: `n.toLocaleString('fa-IR')` or `s.replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])`

### Modal Pattern
```tsx
<Modal open={!!modal} onClose={() => setModal(null)} title="عنوان" size="md"
  footer={<><button className="btn-theme-secondary">انصراف</button><button className="btn-theme-primary">ثبت</button></>}
>
  {/* content */}
</Modal>
```
Sizes: `sm | md | lg | xl`

### Error Display
For form errors that block progression (e.g., forgot-password phone step), show **inline error box** below the submit button — don't rely solely on toast:
```tsx
{error && (
  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-800 rounded-xl">
    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
    <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
  </div>
)}
```

---

## Key Patterns (Backend)

- **Barcode auto-gen**: `PREFIX-jYYYYjMM-SEQ` using Jalali calendar
- **Asset assignment**: `$transaction()` auto-closes previous before creating new
- **Bulk user import**: wrapped in transaction (all-or-nothing)
- **Singleton rows**: `SystemSettings`, `AuthSettings`, `ChatSettings` all use `upsert({ where: { id: 'singleton' }, ... })` — never create more than one row
- **Service caching**: Auth/system settings services keep a 30s in-memory cache; call `.invalidateCache()` after PATCH
- **Prisma toggle pattern**: `findFirst` → `update` (never `updateMany` with computed `set: undefined`):
  ```typescript
  const row = await this.prisma.model.findFirst({ where: { id, userId } });
  return this.prisma.model.update({ where: { id }, data: { done: !row.done } });
  ```
- **Nginx rate limits**: 10 req/s API, 1 req/s login

---

## Environment Variables
**Backend** (`.env`): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `BALE_CLIENT_ID`, `BALE_CLIENT_SECRET`, `CORS_ORIGIN`
**Frontend**: `NEXT_PUBLIC_API_URL`
**Bale mock mode**: `BALE_MOCK=true` skips real SMS (for dev/test)

---

## Commands
```bash
# Dev
npm run dev              # root — starts both apps (backend :3001, frontend :3000)
cd apps/backend && npx prisma studio      # DB GUI
cd apps/backend && npx prisma db push     # apply schema changes (use this, NOT migrate dev)
cd apps/backend && npx prisma generate    # regenerate client after manual schema edits

# Production
docker compose -f docker-compose.prod.yml up -d
./deploy.sh              # full deploy
./update.sh              # git pull + pm2 restart
./backup.sh              # DB backup

# If running with pm2 directly (not Docker):
pm2 restart arzesh-backend --update-env
pm2 restart arzesh-frontend
sudo nginx -s reload     # after nginx.conf changes
```

---

## File Conventions
- Backend DTOs: `modules/<name>/dto/`
- All controllers: `@UseGuards(JwtAuthGuard)` + role/page guards
- Services: `constructor(private prisma: PrismaService) {}`
- Frontend API calls: `NEXT_PUBLIC_API_URL/api/<route>` with `Authorization: Bearer <token>`
- Frontend token: stored in both `localStorage` and a `token` cookie (for middleware/SSR)

---

## What's Complete ✅
- Auth (email + OTP, password reset, JWT with session tracking)
- Session management (per-user maxSessions, session table, force-revoke, gtv invalidation)
- User management (CRUD, bulk import, dept assignment, maxSessions config)
- Asset management (CRUD, barcode, QR, costs, maintenance, images)
- Asset assignments (return workflow, auto-close previous)
- Timesheets (create, approve/reject, Excel export)
- Departments, Buildings, Floors, Rooms
- Page permissions system (dept + role scoped, admin-only pages auto-granted)
- Reports (timesheet analytics, Excel export)
- Dashboard (stats, quick actions, activity, todo widget)
- Real-time messaging (Socket.IO, ChatWidget, full page, reactions, presence)
- Attendance system (raw punches, computed days with correct deficit, requests, approvals, work schedules, Jalali date pickers)
- System settings page (5 tabs: General, Bale OTP, Security, Messaging, Database)
- Docker + Nginx production deployment
- PWA support

## What's Incomplete / TODO ⚠️
1. **Theme migration** — ~20 frontend pages still use raw Tailwind classes instead of `bg-theme-*` etc.
2. **Accounting page** — UI stub exists, no real backend logic
3. **Roles page** — frontend exists, backend CRUD is limited
4. **Blog** — landing page reference only, no CMS/backend
5. **App-level rate limiting** — only at Nginx level currently
6. **AuditLog population** — schema + table exist, no write calls yet
7. **Attendance recompute** — existing `AttendanceDay` rows have `deficitMinutes=0` until admin triggers recompute
8. **Group chat creation UI** — backend supports groups, frontend only creates direct chats
9. **Attendance calendar page** — listed in KNOWN_PAGES but page file missing
