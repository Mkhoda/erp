---
name: erp-attendance-engine
description: Deep context for the Arzesh ERP attendance/time-tracking engine — raw punch clock imports, the computeDay() calculation pipeline (status precedence, overtime, deficit, auto leave-conversion), schedule/holiday resolution, correction requests → override → recompute flow, and Jalali date-handling conventions. Use whenever the user asks to change attendance calculation logic, fix deficit/overtime/leave numbers, touch calc.service.ts / recompute.service.ts / guard-calc.service.ts / holidays / schedules / requests under apps/backend/src/modules/attendance, or edit any page under apps/frontend/app/dashboard/attendance — even if phrased casually like "attendance is wrong for this user", "why did this day show as absent", "add a new holiday type", or "overtime isn't capping correctly". This module is the most fragile part of the codebase: read this before changing calculation order.
---

# Arzesh ERP — Attendance Engine

Backend: `apps/backend/src/modules/attendance/`. Frontend: `apps/frontend/app/dashboard/attendance/`.

This is the most calculation-heavy, order-sensitive module in the codebase. Read the whole
relevant section before editing — reordering a few lines in `computeDay()` silently breaks
overtime, deficit, or leave-balance math for every user, and the bug won't show up until a
month-end report.

## 1. Mental model: two parallel calculation engines

- **`CalcService.computeDay()`** (`engine/calc.service.ts`) — regular FULL_TIME/HOURLY staff on
  a single fixed daily schedule (in/out window, lunch, OT, deficit, leave).
- **`GuardCalcService.computeShiftRange()`** (`engine/guard-calc.service.ts`) — 24/24 or 24/48
  guard-duty rotations where the punch clock never logs a distinct check-out; a shift's end is
  inferred from the *next* guard's punch. Deliberately skips delay/early-leave windows, the OT
  formula, the monthly OT cap, and deficit→leave auto-conversion — guards have unautomated
  comp rules, left for an admin to resolve manually via `AttendanceOverride`.

`RecomputeService.recomputeDays()` (`engine/recompute.service.ts`) is the **only** entry point
either engine should be reached through. It groups the requested `(userId, gregDate)` pairs by
user, checks `GuardCalcService.findActiveGuardShiftId()` to decide which engine a user routes
through, and — critically — **sorts everything ascending by date per user** before calling
`computeDay()`. See §6 for why ascending order is load-bearing, not cosmetic.

Never call `CalcService.computeDay()` directly from new code outside `RecomputeService` — you'll
skip the guard-routing check and the ascending-order guarantee.

## 2. `getEffectiveSchedule()` — three-layer resolution

`calc.service.ts:73-122`. Resolves one `EffectiveSchedule` object per user per call (not cached —
called fresh inside every `computeDay()`). Layers, in order:

1. **Hardcoded `DEFAULTS`** (`calc.service.ts:46-67`) — mirrors the Prisma schema's own column
   defaults. Exists so calculations never depend on a seeded `WorkSchedule` row existing; a brand
   new install still computes sane numbers.
2. **Base `WorkSchedule`** — either the group the user's `UserAttendanceRule.scheduleId` points
   to, or (if the user has no rule / no group) the org row where `isDefault: true` (falls back to
   `name: 'default'`). This layer supplies `startMin`/`endMin`/`checkInEnd`/`checkOutStart`/
   `dailyMinutes`/OT rules/`annualLeaveDays`/etc.
3. **`UserAttendanceRule` per-user overrides** — sparse; only fields that are non-null override
   the base (`employeeType`, `dailyMinutes`, window times, `flexEnabled`, `graceMinutes`,
   `otMaxDaily`/`otMaxMonthly`, `otAllowed`). `employeeType: HOURLY` forces `otAllowed = false`
   unconditionally at the end (line 120) — hourly staff never accrue OT no matter what the rule
   says.

Then, **per-day**, `computeDay()` additionally calls `applyDayOverride()`
(`calc.service.ts:174-197`) which layers a matching `ScheduleOverride` (date-range + weekday +
group scoped, e.g. "every Wednesday in Q1 the امریه group works 08:00–13:00") on top of the
resolved schedule, and can return `true` to force the day non-working (`isOff`). This happens
*before* holiday lookup, because holiday scoping uses `sched.scheduleId` which `applyDayOverride`
does not change but does depend on.

`getRulesSummary()` (line 127) is the same resolution used to render the "قوانین کارکرد" info
panel on `/dashboard/attendance/my` — always live, never hardcoded on the frontend.

## 3. `computeDay()` pipeline — the calculation order that matters

`calc.service.ts:208-444`. Read top to bottom; the order below is the actual execution order and
each step depends on state built by the previous one. This is the part to re-read fully before
touching any single line.

1. **Resolve time window.** `gregDate` is a *work-date label* (UTC-midnight of the Tehran
   calendar day), not a real instant — `tehranMidnightInstant(gregDate)` converts it to the true
   UTC instant to bound the `RawAttendanceRecord` query. Using `gregDate` directly as a query
   bound is a classic bug here: it silently shifts the window by +3:30 (see §5).
2. **Resolve schedule + day-override + holiday in parallel**, schedule first since the other two
   both depend on `sched.scheduleId`/`sched.workDays`.
3. **Resolve first-in/last-out from raw punches**, then let `AttendanceOverride.newCheckIn` /
   `clearCheckIn` / `newCheckOut` / `clearCheckOut` replace either side. An override can clear one
   side while leaving the other from real punches.
4. **`ambiguousPunches` guard** (line 259-262): if there are more than 2 raw punches that day
   (e.g. stepped out for a mission and came back) the day is flagged `INCOMPLETE` for manual
   resolution — *unless* an override has "pinned" both check-in and check-out
   (`pinnedByOverride`). Without that pin-check, a day resolved once by an admin would flip back
   to `INCOMPLETE` on every subsequent recompute, because the raw punch count on disk never
   changes.
5. **If both punches exist:** compute `workedMinutes`, `delayMinutes`, `earlyLeaveMinutes`,
   `overtimeMinutes`, `nightMinutes` — all in one block (lines 264-305). Key sub-rules:
   - **Flextime** clamps early arrival (`inMin < flexInStart - graceMinutes`) out of
     `workedMinutes`/`nightMinutes` only — it does NOT affect `delayMinutes`, which is always
     computed from the raw arrival time. So flextime can never disguise genuine lateness.
   - **Overtime is `max()` of two measures**, not one: `(a)` minutes worked past
     `sched.endMin` (rewards staying late regardless of arrival time), and `(b)`
     `workedMinutes + delayMinutes - dailyMinutes` (net minutes beyond the required total, with
     the late-arrival gap added back so it isn't double-penalized — late arrival is covered by
     leave/deficit separately, never by shrinking OT). Whichever is bigger wins.
   - `otMaxDaily === 0` means **unlimited**, not zero — same convention as `otMaxMonthly`.
6. **HOURLY staff**: `delayMinutes`/`earlyLeaveMinutes` zeroed unconditionally (line 308-311) —
   presence-only, no punctuality penalties.
7. **Approved hourly leave** (`override.leaveMinutes`, lines 317-333): `> 180` minutes ⇒ whole
   day becomes `LEAVE`, and any time actually worked that day converts entirely to overtime
   (`forceLeaveFull`). `<= 180` minutes ⇒ partial leave that counts *toward* the required daily
   total, so it can both excuse a shortfall and, combined with real work, still trigger overtime.
8. **Monthly OT cap** (lines 339-346): clamps `overtimeMinutes` so the running monthly total never
   exceeds `otMaxMonthly`. Queries `SUM(overtimeMinutes)` for **strictly earlier days only**
   (`gregDate: { lt: gregDate }`) in the same Jalali month — this is why ascending recompute order
   is mandatory (§6): a later day's OT must never retroactively steal from or zero out an earlier
   day's already-finalized number.
9. **Status precedence** (lines 348-368) — evaluated as an if/else chain, first match wins:
   `override.forceStatus` (admin/approved-request override always wins) →
   `forceLeaveFull` (>3h approved leave) → `holiday` (`COMPANY_HOLIDAY` vs `HOLIDAY`) →
   `isWeekend` → `!hasPunch → ABSENT` → `!bothPunches || ambiguousPunches → INCOMPLETE` →
   `delayMinutes > 0 → LATE` → `earlyLeaveMinutes > 0 → EARLY_LEAVE` → else `PRESENT`.
10. **Holiday-work reclassification** (lines 370-381): if `holidayWork` (holiday OR weekend) and
    both punches exist, ALL worked time moves to `holidayOvertimeMinutes` and
    `overtimeMinutes` is reset to 0 — regular OT and holiday OT use different pay multipliers
    (1.4× vs 2.0×) so they must never mix. `delayMinutes`/`earlyLeaveMinutes` are also zeroed —
    punctuality windows don't apply on non-working days.
11. **Deficit** (lines 383-393): `deficitMinutes = max(0, dailyMinutes - workedTowardRequirement -
    leaveMinutes)`, only for `FULL_TIME` staff on a working day, and only once the day is "final"
    (`bothPunches || !hasPunch` — a day with only a check-in, still in progress, is deliberately
    left at 0 so an open shift doesn't get flagged as short before it's even over).
    `workedTowardRequirement = max(0, workedMinutes - overtimeMinutes)` — minutes already paid out
    as overtime are subtracted from "worked" first, otherwise staying late could silently cancel
    out a late arrival (same minutes double-counted as both paid OT and covering the requirement).
12. **Automatic leave conversion** (lines 395-425) — runs only for `FULL_TIME` staff, working
    days, and only when no human has already decided the outcome
    (`!override?.forceStatus && !forceLeaveFull`). Two independent rules, each gated by a
    `WorkSchedule` toggle and the user's **prior-days-only** remaining annual balance
    (`remainingLeaveMinutesBefore`, same ascending-stability contract as the OT cap):
    - `ABSENT` + `absentToLeaveEnabled` + a full day's balance remains ⇒ flips status to `LEAVE`,
      zeroes deficit.
    - `deficitMinutes > 0` + `deficitToLeaveEnabled` ⇒ converts **only the shortfall amount**
      from balance (`Math.min(deficitMinutes, remaining)`), never inflated to a full day just
      because balance ran low — a 10-minute deficit must never cost a full day of leave.
13. **Upsert** `AttendanceDay` by `(userId, gregDate)` unique constraint — the function is fully
    idempotent; it never reads or mutates `RawAttendanceRecord`, so re-running it any number of
    times on the same inputs reproduces the same row.

## 4. Holiday matching — `holidayFor()` (`calc.service.ts:140-169`)

Two independent lookup paths, both scoped by `scheduleIds` (empty array = applies to all groups;
non-empty = only those `WorkSchedule` group ids):

- **Fixed-range holidays** (`recurring: false`): simple `startDate <= gregDate <= endDate` range
  query.
- **Recurring holidays** (`recurring: true`): only the **start day's** `(jMonth, jDay)` is stored
  on the row, not a fixed Gregorian range (Jalali↔Gregorian drifts by a day roughly every 4
  years). Each year the anchor `moment(jYear/jMonth/jDay)` is re-derived and the original
  `spanDays` (computed once from the stored `endDate - startDate`) is re-applied from that fresh
  anchor — so a multi-day recurring holiday (e.g. Nowruz 01/01–01/04) re-expands correctly every
  year instead of being matched as a single day. The loop tries `jYear + {0, -1, 1}` so a range
  crossing the Jalali new year (e.g. Esfand 29 → Farvandin 2) still matches when queried from
  either side of the boundary.

**Recompute fan-out**: `HolidaysService.create/update/remove()` (`holidays/holidays.service.ts`)
calls `RecomputeService.recomputeAllUsersForDays()` over every calendar day the holiday spans —
this recomputes that fixed date range for **every mapped user**, once, regardless of recurrence.
It does NOT retroactively recompute past years for a *newly added recurring* holiday, and does
NOT proactively recompute *future* years either — only the literal date range on the row. If you
need historical years re-evaluated against a new recurring holiday, that requires an explicit
`recomputeAllForMonth`/`recomputeUserMonth` call for those years too.

## 5. Jalali date handling

Canonical helpers: `apps/backend/src/modules/attendance/engine/jalali.util.ts`. Iran is a fixed
UTC+03:30 offset (`TEHRAN_OFFSET_MIN = 210`; DST was abolished in 2022, so this never varies).

- **`workDateOf(instant)`** — the Gregorian "work date" (UTC midnight) for the Tehran calendar day
  an instant falls on. This is the canonical form stored in `AttendanceDay.gregDate` and used as
  join/lookup key everywhere.
- **`tehranMidnightInstant(gregDate)`** — the inverse-ish helper, and the one most likely to be
  misused. A `gregDate` work-date label (as produced by `workDateOf`) is `Date.UTC(Y,M,D)`, which
  reads as Tehran **03:30**, not Tehran 00:00 — it is NOT the real instant of Tehran midnight.
  Any code that bounds a `punchAt` query range using the raw `gregDate` label directly (instead of
  `tehranMidnightInstant(gregDate)`) silently queries `[Tehran 03:30, next-day 03:30)` instead of
  `[00:00, 24:00)`, shifting every punch near midnight into the wrong day. Every place in this
  module that queries `RawAttendanceRecord.punchAt` by day range goes through this function first
  — follow that pattern in new code.
- **`minutesOfDay(instant)`** — minutes since Tehran local midnight (0..1439), used for all
  in/out/window comparisons in `computeDay()`.
- **`toJalaliParts(gregDate)`** — Jalali `{jYear, jMonth, jDay}` via `moment-jalaali`.
- **`jalaliMonthRange(jYear, jMonth)`** — `{start, endExcl}` Gregorian bounds for a whole Jalali
  month; used by `recomputeUserMonth`/`recomputeAllForMonth`.
- **`parseHHmm`**, **`formatJalali`**, **`minutesToHHMM`** — small formatting/parsing helpers.

**Frontend duplication is intentional** (documented convention, not an oversight — see root
`CLAUDE.md`). The inline IIFE pair `toJalali()` / `jalaliToGregorian()` (jdf algorithm) plus
`jMonthLen()` / `todayJ()` is copy-pasted verbatim into every attendance page that needs a Jalali
date picker:
- `apps/frontend/app/dashboard/attendance/work-rules/page.tsx` (lines ~40-68) — **canonical
  copy**; also defines the reusable `JalaliDateSelect` three-`<select>` component (line ~401).
- `apps/frontend/app/dashboard/attendance/my/page.tsx` (lines ~27-47) — same functions, inline IIFE
  pattern in the leave-request modal instead of the `JalaliDateSelect` component.
- `apps/frontend/app/dashboard/attendance/shifts/page.tsx` (lines ~35-53).

`records/page.tsx` instead uses `currentJalali()` — a lighter `Intl.DateTimeFormat` persian
calendar call — because it only needs the *current* Jalali year/month to default filters, not
arbitrary conversion. `settings/page.tsx` uses a shared `components/ui/JalaliDatePicker` component
instead of the inline pattern. When adding a new page with a Jalali date picker, copy the
`work-rules/page.tsx` block (or reuse `JalaliDatePicker` if a single-date picker suffices) rather
than inventing a fourth implementation. Never use a plain `<input type="text">` for a Jalali date.

**Always convert to Gregorian before calling the API**:
`${g.y}-${String(g.m).padStart(2,'0')}-${String(g.d).padStart(2,'0')}`. Backend endpoints that
accept free-form date strings (`holidays.service.ts`'s `parseFlexDate`,
`schedules.service.ts`'s `parseFlexDate`) tolerate either `jYYYY/jM/jD` (heuristically: 4-digit
first segment between 1300 and 1700) or Gregorian `YYYY-MM-DD`, but `scope.util.ts`'s
`parseWorkDate()` (used by records/requests) only accepts Gregorian `YYYY-MM-DD` — don't assume
every date-string endpoint is jalali-tolerant.

## 6. Recompute fan-out and the ascending-order requirement

`RecomputeService.recomputeDays()` is the funnel every mutation eventually calls:

- **Holiday create/update/delete** → `recomputeAllUsersForDays(daysOf(start,end))` — all mapped
  users, the holiday's date span.
- **`WorkSchedule` update** → `recomputeScheduleUsers(scheduleId, isDefault)` — users explicitly
  assigned to that group, plus (if it's the default) every mapped user with no group of their own.
- **`ScheduleOverride` create/update/delete** → `recomputeAllUsersForDays(matchingDays(...))` — on
  update, recomputes BOTH the old day-set and the new one (in case the range/weekdays shrank).
- **`UserAttendanceRule` upsert** → `relinkUser(userId)` → recomputes that user from their first
  ever punch through today (fills gaps/absences too, not just touched days).
- **Sync import** (`sync.service.ts`) → `recomputeForRawRows(affected)` — only the specific
  `(userId, workDateOf(punchAt))` pairs actually touched by the imported batch.
- **Request approval / admin override** (`requests.service.ts`) → `recomputeDays([{userId,
  gregDate}])` for that single day only.

**Why ascending order matters**: `recomputeDays()` sorts all pairs ascending by date per user
(`recompute.service.ts:29-33`) before dispatching to `CalcService.computeDay()`, specifically
because two calculations inside `computeDay()` look backward at prior days in the same period:
the monthly OT cap (§3 step 8) and the annual-leave-balance auto-conversion (§3 step 12). Both
only count days *strictly before* the one being computed. If a later day were computed first, it
could reserve OT/leave budget that an earlier day (computed second) would then also try to claim,
producing different totals depending on call order — i.e. non-idempotent, order-dependent output.
Preserving ascending order is what makes a full-month or full-history recompute stable regardless
of how the caller batched the work. If you add a new recompute entry point, funnel it through
`recomputeDays()` rather than calling `CalcService.computeDay()` in a loop yourself.

Guard-duty users are additionally re-grouped **by shift template** (not by user) before dispatch,
because the handoff-chain algorithm in `GuardCalcService` needs every guard on the same rotation
computed together — one guard's punch resolves the *previous* guard's checkout time. See
`references/guard-shifts.md` for the full handoff-clustering algorithm if you're touching guard
rotations.

## 7. Requests / approvals flow

`AttendanceRequest` (employee-submitted) → admin/manager `decide()` → materializes an
`AttendanceOverride` → triggers a targeted recompute of that one day. The override is what
actually changes the computed output; the request row itself is just an audit trail of what was
asked and by whom.

- **`POST /attendance/me/requests`** (`my-attendance.controller.ts` → `RequestsService.create()`)
  — employee self-service, one PENDING request per `(user, date)` at a time (enforced in
  `create()`, throws `ConflictException` otherwise). `type` is one of the `AttnRequestType` enum:
  `CHECK_IN_FIX`, `CHECK_OUT_FIX`, `FULL_DAY_FIX`, `EXPLANATION`, `LEAVE`. For leave-type
  requests the frontend (`my/page.tsx`) sets `targetStatus` to `LEAVE` | `MISSION` |
  `REMOTE_WORK` — whichever `AttendanceStatus` the day should become on approval.
- **`GET /attendance/requests`** (admin/manager queue, `requests.controller.ts`) — scoped by
  `resolveDeptScope()` (`scope.util.ts`): ADMIN sees everything, MANAGER only sees requests from
  users in their own department(s) (own `departmentId` + `UserDepartment` memberships, OR-merged).
- **`PATCH /attendance/requests/:id/decision`** → `RequestsService.decide()`
  (`requests.service.ts:86-118`):
  - `APPROVE` → creates an `AttendanceOverride` row copying `newCheckIn`/`newCheckOut`/
    `clearCheckIn`/`clearCheckOut`/`forceStatus` (from `targetStatus`)/`leaveMinutes` off the
    request, tagged with `requestId` for traceability, then calls
    `recompute.recomputeDays([{userId, gregDate}])` for just that day.
  - `REJECT` → no override created, request just marked `REJECTED`. The day's `AttendanceDay` is
    untouched.
  - Note `AttnRequestStatus` has `MANAGER_APPROVED` / `HR_APPROVED` intermediate values in the
    schema, but `decide()` as implemented only ever writes `PENDING` → `APPROVED` / `REJECTED`
    directly — there is no currently-wired two-stage manager-then-HR approval chain, despite the
    enum suggesting one. Don't assume the intermediate states are reachable without checking
    whether that's changed.
- **`POST /attendance/overrides`** (`requests.controller.ts` → `RequestsService.adminOverride()`)
  — the direct-edit path used from `/dashboard/attendance/records`, bypassing the request/approval
  flow entirely (an admin/manager editing someone's day directly). Same `AttendanceOverride`
  shape, no `requestId`, immediate recompute.

**Overrides accumulate, never merge** — `AttendanceOverride` has no upsert; each approval/admin
edit is a new row. `computeDay()` always reads
`findFirst({ where: { userId, gregDate }, orderBy: { createdAt: 'desc' } })` — i.e. **only the
most recent override for that day wins**, older ones are inert history kept for audit purposes,
not layered together.

## 8. Frontend page map

| Page | Purpose | Notes |
|---|---|---|
| `page.tsx` | Attendance overview/dashboard | Calls `attendance/dashboard` |
| `my/page.tsx` | Self-service: my days, leave-balance, submit correction/leave requests | Inline Jalali IIFE + leave modal |
| `records/page.tsx` | Admin/manager daily records grid, direct override edit | `currentJalali()` only, not full IIFE |
| `monthly/page.tsx` | Monthly aggregated report per user | `records/monthly-summary` |
| `approvals/page.tsx` | Approval queue for pending `AttendanceRequest`s | dept-scoped |
| `holidays/page.tsx` | Holiday CRUD (fixed + recurring) | admin |
| `work-rules/page.tsx` | **Canonical** Jalali util source; `WorkSchedule` + `ScheduleOverride` editor | admin-only page |
| `settings/page.tsx` | Attendance system-wide toggles | uses shared `JalaliDatePicker` component |
| `sync/page.tsx` | Punch-clock source sync monitor/trigger | admin-only page |
| `shifts/page.tsx` | Guard-duty shift template + assignment + manual calendar editor | admin; own Jalali IIFE copy |

`KNOWN_PAGES` in `permissions/pages.constant.ts` also registers `/dashboard/attendance/calendar`
and `/dashboard/attendance/requests`, but **neither page file currently exists** under
`app/dashboard/attendance/` — a known gap (see root `CLAUDE.md` TODO list). Don't assume every
registered page has a corresponding file; check before wiring new links to them.

## 9. Other gotchas worth knowing before editing

- **`RawAttendanceRecord` is never mutated by the calc engines** — `computeDay()` and
  `computeShiftRange()` are pure functions of (punches, schedule, holiday, override) → upserted
  `AttendanceDay`. If numbers look wrong, the bug is almost always in schedule/override/holiday
  resolution, not in the raw import — the raw table is the one thing you can trust unless the
  sync itself is broken (`sync.service.ts`).
- **Card-based user linking**: a `RawAttendanceRecord` only gets a `userId` once a `User` row's
  `attendanceCardNo` matches its `cardNo`. Unmatched punches sit with `userId: null` forever until
  someone assigns the card — `RecomputeService.relinkUser()` / `relinkAndRecomputeAll()` /
  `provisionCardsAndRecompute()` (exposed via `attendance/maintenance/*`, admin-only) are the
  recovery tools. `freeCard()` handles reassigning a card from one user to another, including
  deleting placeholder "کارت <n>" users auto-created by `provisionCardsAndRecompute`.
- **Monthly OT cap and leave-balance queries are O(days-in-month) per computed day** — each
  `computeDay()` call does an aggregate query over all prior days in the month. A full-month
  recompute for one user is O(n²) in days-in-month (~30² ≈ 900 small queries), which is fine at
  current scale but worth knowing before batch-recomputing many users' full histories at once
  (`relinkAndRecomputeAll`, `recomputeAllForMonth`) — these are already used sparingly (manual
  admin trigger, or once per schedule/holiday edit), don't add them to a hot path.
- **`autoConvertedLeave` flag matters for balance math**: `remainingLeaveMinutesBefore()` and
  `RecordsService.leaveBalance()` both exclude `autoConvertedLeave: true` days from the
  delay/early-leave "tardy minutes" sum (they're excluded via `autoConvertedLeave: false` in the
  aggregate `where`) — because that day's shortfall was already charged against the balance once,
  as `leaveMinutes`. Counting it again via `tardyMinutes` would double-deduct. If you add a new
  path that writes `leaveMinutes` outside `computeDay()`'s own auto-conversion block, make sure
  `autoConvertedLeave` is set consistently or leave-balance totals will drift.
- **`RecordsService.leaveBalance()` and `CalcService.remainingLeaveMinutesBefore()` must stay in
  sync** — they compute the same "remaining annual leave" formula independently (one open-ended
  for the whole year, one bounded to "before this date" for use inside a recompute). They are
  deliberately duplicated rather than sharing a function; if you change the formula in one, mirror
  it in the other or the self-service leave-balance widget will disagree with what the engine
  actually deducted.
- **Prisma toggle/read-then-write pattern**: this module follows the project-wide convention of
  `findFirst` → explicit `update`/`upsert`, never `updateMany` with a computed `set`. See
  `AttendanceOverride`'s always-`create()`-never-`update()` pattern above — it's intentional
  (append-only audit trail), not a missed optimization.
