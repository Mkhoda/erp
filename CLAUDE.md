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
| Utilities | ExcelJS, Sharp, BWIP-js (barcodes), moment-jalaali |

## Monorepo Layout
```
apps/backend/src/modules/   ← NestJS feature modules
apps/frontend/app/          ← Next.js app router pages
nginx/nginx.conf            ← reverse proxy config
docker-compose.prod.yml     ← production stack
```

## Backend Modules (`apps/backend/src/modules/`)
- **auth/** — JWT + OTP auth (email & phone), password reset, `bale.service.ts` for SMS
- **hrm/** — Users, Departments, Timesheets (CRUD + approve + Excel export)
- **assets/** — Assets, Types, Categories, Buildings, Floors, Rooms, Assignments, Upload, Reports, Barcode utils
- **permissions/** — Page-level access control per dept/role; `pages.constant.ts` holds 20 known pages

## Frontend Pages (`apps/frontend/app/`)
- **Public** (`(application)/`): landing, signin, signup, forgot-password, about, services, blog, contact
- **Dashboard** (`dashboard/`): assets, assets/[id], assets/types, assets/categories, assets/assignments, users, departments, buildings, floors, rooms, accounting, access, pages, roles, profile, settings, change-password

## Database Entities (Prisma schema)
Users, Department, UserDepartment, Role(enum), Asset, AssetType, AssetCategory, AssetImage, AssetAssignment, AssetMaintenance, AssetCost, AssetCondition(enum), AssetAvailability(enum), Building, Floor, Room, Timesheet, PagePermission, Page, Otp

## Auth & Authorization
- Roles: `ADMIN | MANAGER | USER | EXPERT`
- Guards: `JwtAuthGuard`, `RolesGuard`, `PagePermissionGuard`
- Decorators: `@Roles()`, `@Page()`
- Managers are dept-scoped (see only their dept's users/assets)
- Permissions: dept-based, OR-merged across user's departments, canRead/canWrite per role

## Key Patterns
- **Barcode auto-gen**: `PREFIX-jYYYYjMM-SEQ` using Jalali calendar
- **Asset assignment**: `$transaction()` auto-closes previous before creating new
- **Bulk user import**: wrapped in transaction (all-or-nothing)
- **OTP rate limit**: 30/hour per phone number
- **Date support**: Gregorian + Jalali via `moment-jalaali`
- **Nginx rate limits**: 10 req/s API, 1 req/s login

## Theme System (Frontend)
Custom Tailwind theme in `app/styles/global.css`. Use `bg-theme-primary`, `text-theme-secondary`, `border-theme`, etc. Dark mode supported. RTL layout for Persian.

**Migration status**: Only `dashboard/page.tsx` and `dashboard/assets/page.tsx` fully migrated to the new theme classes. ~20 pages still use old Tailwind classes.

## What's Complete ✅
- Auth (email + OTP, password reset, JWT)
- User management (CRUD, bulk import, dept assignment)
- Asset management (CRUD, barcode, QR, costs, maintenance, images)
- Asset assignments (return workflow, auto-close previous)
- Timesheets (create, approve/reject, Excel export)
- Departments, Buildings, Floors, Rooms
- Page permissions system (dept + role scoped)
- Reports (timesheet analytics, Excel export)
- Dashboard (stats, quick actions, activity)
- Docker + Nginx production deployment
- PWA support

## What's Incomplete / TODO ⚠️
1. **Theme migration** — 20 frontend pages need theme class updates
2. **Accounting page** — UI stub exists, no real backend logic
3. **Roles page** — frontend exists, backend CRUD is limited
4. **Settings page** — minimal/stub
5. **Blog** — landing page reference only, no CMS/backend
6. **App-level rate limiting** — only at Nginx level currently
7. **Asset costs/maintenance UI** — backend complete, frontend unclear

## Environment Variables
**Backend** (`.env`): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `BALE_CLIENT_ID`, `BALE_CLIENT_SECRET`, `CORS_ORIGIN`
**Frontend**: `NEXT_PUBLIC_API_URL`
**Bale mock mode**: `BALE_MOCK=true` skips real SMS

## Commands
```bash
# Dev
npm run dev              # root — starts both apps
cd apps/backend && npx prisma studio   # DB GUI
cd apps/backend && npx prisma migrate dev

# Production
docker compose -f docker-compose.prod.yml up -d
./deploy.sh              # full deploy
./update.sh              # pull + restart
./backup.sh              # DB backup
```

## File Conventions
- Backend DTOs live in `modules/<name>/dto/`
- All controllers use `@UseGuards(JwtAuthGuard)` + role/page guards
- Services import `PrismaService` from `../../prisma/prisma.service`
- Frontend API calls go to `NEXT_PUBLIC_API_URL/api/<route>`
