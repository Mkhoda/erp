---
name: erp-tickets
description: Deep context for the Arzesh ERP ticketing/help-desk module (apps/backend/src/modules/tickets/, apps/frontend/app/dashboard/tickets/) — data model, department routing, SLA calculation, comment/notification flow, and known permission gaps. Use whenever the user asks to add, fix, or explain anything about tickets, help-desk, department SLA, ticket assignment, ticket comments/replies, or the tickets dashboard/settings pages — even if they just say "تیکت" or "تیکتینگ" without more detail.
---

# Arzesh ERP — Tickets Module

A full help-desk system. Backend: `apps/backend/src/modules/tickets/` (`tickets.service.ts`, `tickets.controller.ts`, `comments.service.ts`, `categories.service.ts`, `analytics.service.ts`, `sla.service.ts`). Frontend: `apps/frontend/app/dashboard/tickets/{page.tsx, my/page.tsx, new/page.tsx, [id]/page.tsx, dashboard/page.tsx, settings/page.tsx}`.

Note: unlike other modules, **tickets is not yet listed in the root `CLAUDE.md`** — if you make structural changes here, consider adding it to CLAUDE.md's module list too.

## Data model (`prisma/schema.prisma` ~line 1140+)

- `TicketStatus`: `OPEN → ASSIGNED → IN_PROGRESS → WAITING_USER ⇄ USER_REPLIED → RESOLVED → CLOSED`, plus `CANCELLED, REJECTED, REOPENED`.
- `TicketPriority`: `LOW | MEDIUM | HIGH | CRITICAL`.
- `Ticket` — `number` (autoincrement, human-readable `TKT-#`), `departmentId` + `categoryId` (both required — a ticket always belongs to exactly one department/category), `requesterId`, `assigneeId?`, `title?` (only used when category is the "سایر" catch-all), `description`, `tags[]`, `ccUserIds[]`, SLA timestamps (`dueAt`, `firstResponseAt`, `resolvedAt`, `closedAt`, `isOverSla`).
- `TicketComment` — replies AND internal notes share one table, distinguished by `isInternal`. Supports `replyToId` (threading), soft-delete (`isDeleted`), edit tracking.
- `TicketAttachment` — linked to a ticket directly (`commentId: null`) or to a specific comment.
- `TicketEvent` — full audit timeline; `type` is a free string (`CREATED, ASSIGNED, REASSIGNED, TRANSFERRED, STATUS_CHANGED, PRIORITY_CHANGED, COMMENT_ADDED, INTERNAL_NOTE, ATTACHMENT_ADDED, CLOSED, REOPENED, SLA_BREACHED`).
- `TicketDepartmentConfig` — one row per department that has ticketing enabled (`isEnabled`), holds SLA hours + business-hours window (`workHoursStart/End`, `workDays`), `autoAssignRoundRobin`, and `notifyOnCreate/Reply/Close` toggles.
- `TicketDeptManager` / `TicketDeptAssignee` — junction tables: managers (who can triage/manage the dept's queue) vs. default assignees (the round-robin pool). A user can be in both, neither, or just one.
- `TicketCategory` — predefined subjects per department config; **users must pick one, no free text** except when the category is the auto-created "سایر" (Other) catch-all, which requires a manual `title`. Categories can override the department's SLA hours.
- `TicketSettings` — singleton (`id: "singleton"`), global: max file size, allowed extensions, `autoCloseAfterDays`, `allowUserPriority`, `ticketPrefix`.
- `TicketSlaMetric` — one row per ticket, computed/refreshed by `sla.service.ts`: minutes to first response/assignment/resolution/close, business-hours breakdown, breach flags.

## Creation flow

`POST /tickets` → `tickets.service.ts create()`:
1. Requires an **enabled** `TicketDepartmentConfig` for the chosen department, and a valid **active** category under that config.
2. "سایر" category requires `dto.title`.
3. If `config.autoAssignRoundRobin` and there are `defaultAssignees`, auto-assigns: finds the department's most-recently-assigned ticket, picks the *next* assignee in the `defaultAssignees` array (simple round-robin, not least-busy).
4. Computes SLA due dates via `sla.calcDueDates()` (business-hours aware) and creates the `TicketSlaMetric` row.
5. Notifies the auto-assignee (if any) and all department managers (`notifyOnCreate`).

## Listing / access scoping (`findAll()`, `assertAccess()`, `assertCanManage()`)

- `ADMIN` — sees/manages everything, no scoping.
- `MANAGER` — `findAll()` scopes `where.departmentId` to the user's own department(s) (`userDeptIds()` = `user.departmentId` + `userDepartments` join rows).
- `USER` / `EXPERT` — `findAll()` forces `where.requesterId = self`; only see their own submitted tickets.
- `GET /tickets/my` special-cases `MANAGER` to call `findAll()` with their normal (dept-scoped) role, but re-labels every other role as `ADMIN` internally just to bypass the `requesterId` filter it would otherwise add on top of the one already being added — read `myTickets()` carefully before touching it, the role juggling there is easy to break.

**⚠️ Known gap (flag before extending):** `assertAccess()` (used by `findOne()`, the ticket detail endpoint) and `assertCanManage()` (used by `update/assign/transfer/closeTicket`) grant **blanket access to any `MANAGER`, regardless of department** — the "dept scope already filtered in findAll" comment in `assertAccess()` does NOT apply to `findOne()`, since that endpoint fetches by raw ticket ID with no department filter. Practically: a MANAGER who knows/guesses a ticket ID outside their own department can currently view *and manage* it (change status/priority, assign, transfer, close). Likewise `comments.service.ts create()` only checks `isStaff` (ADMIN/MANAGER/EXPERT), not department match. If asked to tighten permissions, this is the first place to fix — add a `userDeptIds().includes(ticket.departmentId)` check for `MANAGER` in both `assertAccess` and `assertCanManage`, and thread department scoping into `comments.create()`.

## Comment/reply flow (`comments.service.ts create()`)

- `isInternal` notes: staff-only (ADMIN/MANAGER/EXPERT); a `USER` posting one is rejected.
- Anyone allowed to comment: staff, the requester, or the current assignee.
- First **public** (non-internal) staff comment sets `ticket.firstResponseAt` (drives the SLA first-response metric) — internal notes never count as a response.
- Status auto-advances on a public comment: staff replying to `OPEN`/`USER_REPLIED`/`REOPENED` → `IN_PROGRESS`; requester replying to `WAITING_USER`/`RESOLVED` → `USER_REPLIED`. Internal notes never change status.
- Notifications: staff reply → notify requester; requester reply → notify assignee (if any).

## SLA (`sla.service.ts`)

- All durations are **business-hours only** (`addBusinessHours()` / `businessMinutesBetween()`), skipping non-`workDays` and outside `workHoursStart/End` — a ticket created at 6pm on a day with 8am–5pm hours effectively "starts the clock" at next business-day 8am.
- `refreshMetric(ticketId)` recomputes everything from scratch (idempotent) and is called after status changes, transfers, and reopens. It also flips `ticket.isOverSla` when `resolutionBreached` changes — this is the flag the list/dashboard sort/filter on.
- Category-level SLA hours override the department config's, when set.

## Department config / categories admin (`categories.service.ts`, `/dashboard/tickets/settings`)

- `ADMIN`-only to create/edit categories, upsert department configs, and edit global `TicketSettings`.
- `upsertConfig()` fully replaces the `managers`/`defaultAssignees` junction rows on every save (delete-then-recreate) — not a diff/patch.
- The "سایر" category is auto-ensured on every config upsert and on `getCategoriesByDept()`/`getEnabledConfigs()` (self-healing for configs created before this fallback existed); it can never be renamed or deleted (`updateCategory`/`deleteCategory` both reject it explicitly).
- Deleting a category that's already in use on tickets soft-deletes it (`isActive: false`) instead of a hard delete, to avoid breaking FK references on existing tickets.

## Permissions on the page itself (not the ticket data)

`/dashboard/tickets` and `/dashboard/tickets/dashboard` are normal (non-`adminOnly`) pages in `pages.constant.ts` — a `MANAGER` does **not** get automatic menu/page access; an admin must grant it per-department via `/dashboard/access` (`/dashboard/tickets/my` is the only ticket page in `BASE_PAGES`, auto-granted to everyone). `/dashboard/tickets/settings` is `adminOnly: true`. This was a deliberate choice confirmed with the user (2026-08-18) — don't "fix" it into an auto-grant without asking first.

## Analytics dashboard (`analytics.service.ts`, `/dashboard/tickets/dashboard`)

Endpoints: `GET /tickets/analytics/{dashboard,workload,sla}`, all gated by `@Page('/dashboard/tickets/dashboard')`. Read `analytics.service.ts` directly before extending — it wasn't fully re-verified in this skill; treat its exact stat set as unconfirmed until checked.
