---
name: commit-style
description: Standard for writing and structuring git commits in the Arzesh ERP repo — message format, one-logical-change-per-commit, and the no-Claude-coauthor rule. Use whenever creating a git commit in this repo (erp/), including via the plain `git commit` flow — not just when the user says "commit this".
---

# Arzesh ERP — Commit Conventions

## Never add a Claude/Anthropic co-author trailer

**Do not append `Co-Authored-By: Claude ...` (or any other Claude/Anthropic attribution) to commits in this repo.** This overrides Claude Code's normal default of adding that trailer — it is an explicit, standing instruction for this repo specifically, not a one-off.

Two commits in the history still have it (`87360e0`, `8db1297`) from before this rule was set (2026-09-27) — don't treat those as precedent to follow.

## Message format

Subject line: short, imperative, ~50-70 chars, no trailing period. Body (when the change isn't self-explanatory from the subject alone): blank line, then prose wrapped ~80-90 chars explaining **why**, not a restatement of the diff. For a commit touching several unrelated things, use a `- ` bullet per item instead of one paragraph. No issue/ticket references (this repo doesn't use an issue tracker in commit messages) — see [[deployment_operational_facts]] for where project context instead lives (memory), not commit trailers.

Good examples from this repo's own history (`git log`):

```
Fix TimeSelect popup confined by backdrop-filter ancestor

Render the picker overlay via createPortal to document.body instead of inline,
so a bg-theme-card ancestor's backdrop-filter can no longer become its
containing block and confine/hide it behind later cards (e.g. work-rules).
```

```
Add per-group cap on daily hourly leave with overtime conversion

WorkSchedule gets maxDailyLeaveEnabled/maxDailyLeaveMinutes (default 3:30,
reusing the previously-unwired hourlyLeaveCapMinutes column). Replaces the
hardcoded 180-minute threshold in computeDay(): granted leave beyond the cap
now forces the day to full LEAVE and converts worked time to overtime, same
as before but configurable and toggleable per group from work-rules settings.
```

Multi-part example (when one commit genuinely can't be split further, e.g. a batch bugfix session):

```
Fix attendance bugs, move password change to profile, add approval-queue filters

- Move "change password" from a standalone page into the profile page's
  security tab; delete the old page and its permission/menu references.
- Approval queue: add username search, request-type filter, and sortable
  columns.
- ...
```

## One logical change per commit

Prefer splitting unrelated changes into separate commits over bundling them, even within the same working session — e.g. a UI bug fix and a new backend feature touched in the same sitting became two commits (`7e662a5` fix, `b7a398f` feature), not one. Bundle only when the pieces are genuinely inseparable (a schema change + the engine code that requires it + the UI that configures it can be one commit if they don't work independently).

## Before committing

- Run the relevant `tsc --noEmit` (backend: `apps/backend`, frontend: `apps/frontend`) — this repo has no pre-commit hook enforcing it, so it's on you.
- `git status --porcelain` first and stage files explicitly by name — never `git add -A`/`git add .` blindly. `/opt/arzesh-erp/uploads/` on the production checkout is a known trap (real user-uploaded files not covered by `.gitignore`); the same risk exists locally if a local `uploads/` directory has stray content.

## Pushing to `main` deploys to production

Since 2026-09-27, a cron job on the production server (`auto-update.sh`, see [[deployment_operational_facts]]) polls `origin/main` every 5 minutes and auto-deploys any new commit — unreviewed, no staging gate. A `git push origin main` is not just "save to GitHub" anymore; treat it with the same care as a manual deploy. Don't push half-finished or unverified work to `main`.
