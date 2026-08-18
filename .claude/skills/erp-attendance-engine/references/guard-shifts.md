# Guard-duty shift engine deep dive

Full algorithm behind `GuardCalcService.computeShiftRange()`
(`apps/backend/src/modules/attendance/engine/guard-calc.service.ts`). Read this only if you're
changing 24/24 or 24/48 guard-rotation behavior — regular FULL_TIME/HOURLY staff never touch this
code path. See `SKILL.md` §1 for how `RecomputeService` decides whether a user routes here.

## Why this exists as a separate engine

The punch device never logs a distinct "check-out" for guard rotations: each guard on a shift
template scans exactly once, at handoff time. So a shift's end isn't found on that guard's own
timeline — it's the moment the *next* guard on the same `Shift` template scans in, whoever that
is. `computeShiftRange()` merges every assigned guard's punches into one chronological relay
chain per `Shift` template and walks it: each punch closes the previous guard's shift and opens
the next.

Two config values on `Shift` (`configOf()`, lines 77-84) drive the tolerance:
- `dutyMinutes` — nominal duty length (e.g. 1440 for 24h). Defaults to 1440 if unset.
- `fullCreditMinutes` — worked >= this ⇒ zero deficit. Defaults to `dutyMinutes` if unset.
- `absentBelowMinutes` — worked < this ⇒ full `ABSENT` (no partial credit). Defaults to 0.

## Handoff clustering (why not just "next punch closes the shift")

At a real handoff, BOTH guards tend to scan within a short window of each other — the arriving
guard's own scan and the outgoing guard's departure confirmation — and NOT in a fixed order
(sometimes arrival logs first, sometimes departure does). A naive "next event closes the current
shift" walk breaks here: whichever of the two scans happens to come second gets misread as yet
another handoff, doubling the guard count.

Fix: events within `CLUSTER_WINDOW_MS` (3 hours — deliberately small relative to `dutyMinutes`'s
24h so it can never accidentally merge two genuinely separate shifts) of each other are grouped
into one "handoff cluster" (`guard-calc.service.ts:213-218`). When resolving a cluster, the code
looks for whichever event in it belongs to a user *different* from whoever is currently on duty
(`cluster.find((e) => e.userId !== cur.userId)`) — that's the real incoming guard, regardless of
which of the two events in the cluster actually has the earlier timestamp.

## Walking the chain (`guard-calc.service.ts:220-258`)

- **Bootstrap**: the very first cluster in the (possibly wide, lookback-padded) query window just
  starts a shift instance from its last event — this only affects lookback context, not what gets
  written, since only instances whose `start` falls inside `[from, to]` are persisted.
- **Same-guard cluster (no differing user)**: normally noise (duplicate scans), UNLESS a full
  `dutyMinutes` has already elapsed since `cur.start` with nobody relieving them — that's
  self-relief / a forgotten handoff scan, and the shift auto-closes at `start + dutyMinutes` with
  a fresh instance starting from the same guard's later scan.
- **Differing-guard cluster**: if the elapsed time since `cur.start` is `>= dutyMinutes`, no
  timely relief arrived — auto-close `cur` at the nominal duty length (benefit of the doubt: full
  credit, nothing proves they left early) and treat the gap between that auto-close and the
  actual relief scan as an unstaffed gap (handled by the LEAVE fill-in below, not attributed as
  worked time to anyone). Otherwise, `cur` closes exactly at the relieving guard's scan time.
- **Trailing (most recent, still-open) instance**: only auto-closes if real wall-clock time
  (`Date.now()`) has actually exceeded `dutyMinutes` since it started — using `Date.now()` here
  (not the query range) is deliberate so historical/backfill recomputes of past ranges don't
  spuriously auto-close a shift that in reality was later relieved; but it does mean the very
  latest live shift's status can flip between `INCOMPLETE` and resolved depending on *when* you
  run the recompute, which is expected.

## Manual calendar entries as synthetic punches

`ShiftCalendarDay` (supervisor manual override for a user/day with no real punch) is injected into
the same event stream as a synthetic punch at `tehranMidnightInstant(day)`, but ONLY for a
user/day that has no real punch already (`realDayKeys` guard, lines 196-200) — a manual entry
never overrides an actual scan, it only fills gaps.

## Per-instance resolution (`resolveInstance()`, lines 102-141)

Applies any matching `AttendanceOverride` (same clear/replace semantics as the regular engine),
then:
- No check-in at all ⇒ `ABSENT`, deficit = `fullCreditMinutes - leaveMinutes`.
- Check-in only (still open) ⇒ `INCOMPLETE`, deficit deliberately left at 0 (don't finalize a
  shortfall on an in-progress shift).
- `workedMinutes < absentBelowMinutes` ⇒ `ABSENT` even though they showed up — didn't stay long
  enough to count as present at all.
- `absentBelowMinutes <= workedMinutes < fullCreditMinutes` ⇒ `PRESENT` with a proportional
  deficit (`fullCreditMinutes - workedMinutes - leaveMinutes`).
- `workedMinutes >= fullCreditMinutes` ⇒ `PRESENT`, zero deficit (over-serving your shift doesn't
  generate guard overtime automatically — that's left to manual `AttendanceOverride` handling per
  the module-level doc comment).

Note this engine has no monthly OT cap, no OT formula, no delay/early-leave windows, and no
deficit→leave auto-conversion — none of §3/§6's ascending-order dependencies apply here. Guard
compensation is intentionally left manual.

## Filling in the rest of `[from, to]` (lines 289-315)

After writing a row for every resolved shift instance, every OTHER day in the range for every
currently-`ShiftAssignment`-active guard gets filled in:
- If some instance covers that calendar day (`coveredDayKeys`, built while walking instances,
  lines 262-274) but it isn't this guard's own shift-start day ⇒ `OFF_DUTY` (their rest day within
  the rotation — a real "not working, not owed anything" state distinct from `WEEKEND`/`HOLIDAY`).
- If NO instance covers that day at all — meaning nobody assigned to the shift template punched
  in on that stretch — every currently-assigned guard for that shift is granted `LEAVE` for it
  (`autoConvertedLeave: true`) rather than flagged `ABSENT`: the assumption is "the post wasn't
  needed" (e.g. temporarily stood down), not that everyone simultaneously failed to show up.

## Recompute grouping (see also `SKILL.md` §6)

`RecomputeService.recomputeDays()` re-groups guard users **by `shiftId`**, merging the requested
date ranges of every guard on the same template into one wide `{from, to}`, and calls
`computeShiftRange()` once per shift — never per individual guard. This is required for the
handoff chain to resolve correctly; computing one guard's dates in isolation would have no
visibility into who relieved them. If you add a new call site that recomputes guard users, always
go through `RecomputeService.recomputeDays()`, never call `GuardCalcService` methods directly for
a subset of one shift's guards.
