---
name: erp-frontend-conventions
description: Load this before writing or editing ANY page, component, form, or modal under apps/frontend/app/ in the Arzesh ERP monorepo — especially when creating a new dashboard page, adding a form with validation/errors, building anything with a date or time picker, touching theming/dark-mode/RTL, wiring up a fetch() call with the auth token, or adding a backend "settings" service. Covers the actual verified conventions (not generic Next.js advice): the bg-theme-*/text-theme-*/btn-theme-* class system and its real CSS mechanism, the shared Modal and TimeSelect components, the copy-paste Jalali calendar functions, the auth-token/cookie fetch pattern, the /auth/me pre-redirect guard, RTL and Persian-digit formatting habits, the inline-error-box pattern, and the singleton-settings-service shape used by every *Settings backend module. Trigger on phrases like "add a new page", "add a settings tab", "build a modal", "add a date picker", "add a time picker", "why is dark mode not working", "how do I call the API", or "add a new settings service".
---

# Arzesh ERP — Frontend Conventions

Practical reference for writing a *new* page/component so it matches the rest of the
codebase on the first pass, not after three rounds of review comments. Every claim
below was checked against real files as of this writing — file:line references are
given so you can re-verify after the code moves.

Read `CLAUDE.md` at the repo root first — this skill expands on its "Frontend
Patterns" section. Where this doc corrects something CLAUDE.md implies, that
correction is called out explicitly.

---

## 1. Theme system

**Correction to CLAUDE.md:** the theming is *not* CSS custom properties
(`--var`) despite being called "theme variables" colloquially. It's plain
utility classes in `apps/frontend/app/styles/global.css`, each with a light-mode
rule and a `.dark <class>` override rule sitting right below it, e.g.:

```css
.bg-theme-primary { background-color: rgb(255 255 255); }
.dark .bg-theme-primary { background-color: rgb(30 41 59); }
```

Dark mode is a single `.dark` class toggled on `<html>`
(`document.documentElement.classList.toggle('dark', isDark)` —
`apps/frontend/app/dashboard/layout.tsx:61-65`), not a `data-theme` attribute and
not `prefers-color-scheme` alone. The three-state cycle (`light → dark → system`)
lives in `dashboard/layout.tsx:157-163`, persisted to `localStorage["theme"]`, with
a `matchMedia("(prefers-color-scheme: dark)")` listener for the "system" case
(`layout.tsx:150-154`). The signin page (`apps/frontend/app/(application)/signin/page.tsx:23-30,51-57`)
duplicates this same read/toggle logic independently — there is no shared
`useTheme()` hook. If you add a page outside the dashboard shell that needs a
theme toggle, copy that block rather than inventing a new mechanism.

### Class reference (all in `apps/frontend/app/styles/global.css`)

| Purpose | Classes |
|---|---|
| Surfaces | `bg-theme-base`, `bg-theme-primary`, `bg-theme-secondary`, `bg-theme-tertiary` |
| Glass card | `bg-theme-card` — **already includes** `backdrop-filter: blur(12px)` + its own border; don't also add `border` / `bg-white` on top of it |
| Interactive surfaces | `bg-theme-hover`, `bg-theme-active`, `bg-theme-navbar` |
| Text | `text-theme-primary`, `text-theme-secondary`, `text-theme-muted`, `text-theme-inverted` |
| Borders | `border-theme`, `border-theme-light`, `border-theme-strong`, `border-theme-focus` |
| Inputs | `input-theme`, `select-theme` (both include focus ring + placeholder color) |
| Buttons | `btn-theme-primary` (gradient blue), `btn-theme-secondary`, `btn-theme-danger` |
| Tables/cards | `table-theme-container`, `table-theme`, `card-theme`, `card-theme-header`, `card-theme-body` |
| Badges | `badge-theme` (generic pill) + role badges `badge-admin/manager/expert/user` + status badges `badge-success/warning/danger/info/neutral/purple/teal` |
| Shadows/gradients | `shadow-theme`, `shadow-theme-lg`, `bg-gradient-theme`, `bg-gradient-theme-light` |

### The badge classes exist but are rarely used — know the *actual* status-color convention

`global.css` defines a full `badge-*` system, but real pages mostly don't call it.
Instead, every module that needs status pills defines its own local
`STATUS_BADGE`/`STATUS_CLS` map of raw Tailwind classes, e.g.
`apps/frontend/app/dashboard/attendance/page.tsx:34-48` (`STATUS_BADGE`, keys like
`PRESENT`, `LATE`, `ABSENT`) and `apps/frontend/app/dashboard/tickets/[id]/page.tsx:20-31`
(`STATUS_CLS`), both following the shape:
```ts
bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400
```
When you need a new status/category badge, check the nearest existing page in the
same module for its color map first — copy that local-map pattern (it's the
living convention) rather than reaching for the `badge-*` utility classes, unless
you're deliberately trying to consolidate a module's badges (not something to do
unprompted).

### Migration status — more accurate than CLAUDE.md's "~20 pages"

As of this check, 44 of 49 `dashboard/**/page.tsx` files use at least one
`bg-theme-*` class; only 9 use **zero** theme classes (fully raw Tailwind):
`agents`, `assets/types`, `buildings`, `departments`, `floors`, `knowledge`,
`rooms`, `workflows`, `worldmonitor`. So "not migrated at all" is now a
minority. But **"uses theme classes" ≠ "fully migrated"**: pages that do use
`bg-theme-*`/`text-theme-*` almost universally still hardcode raw Tailwind colors
for status badges, charts, and accent chips (see the badge section above) — that
mixing is the current steady state, not a bug to silently fix. When writing a new
page: use `bg-theme-*`/`text-theme-*`/`border-theme`/`input-theme`/`btn-theme-*`
for structural chrome (cards, panels, inputs, buttons, text), and raw Tailwind
color utilities (with explicit `dark:` variants) for semantic/status color, same
as the rest of the app.

### Gotcha: `transform` breaks both native `<select>` and `position: fixed` children

Two real bugs are documented in the code and matter for anyone building modals
or animated containers:

1. `apps/frontend/app/styles/global.css:988-994` — the `.page-enter` fade-in
   animation deliberately has **no `transform`**, because an ancestor with an
   active (or `fill-mode: forwards`) transform becomes the containing block for
   any `position: fixed` descendant — every full-screen modal rendered inside a
   dashboard page would then center on that scrollable content box instead of
   the real viewport.
2. `apps/frontend/app/components/ui/Modal.tsx:57-65` — Framer Motion leaves an
   inline `transform` on the modal panel after its enter animation finishes;
   Chromium refuses to open native `<select>` dropdowns when any ancestor has a
   `transform` set (even an at-rest identity one), so `Modal` explicitly clears
   `panelRef.current.style.transform = "none"` in `onAnimationComplete`.

If you build a custom animated wrapper (not `Modal`) that will contain a
`<select>` or a fixed-position child, replicate one of these two mitigations —
don't animate `transform` on it and leave it set.

---

## 2. Modal component

`apps/frontend/app/components/ui/Modal.tsx` — the shared modal, used everywhere. Signature:

```ts
type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";   // default "md"
  footer?: React.ReactNode;
};
```

Usage matches CLAUDE.md's snippet, plus the optional `subtitle` prop CLAUDE.md
doesn't mention:

```tsx
<Modal open={!!modal} onClose={() => setModal(null)} title="عنوان" subtitle="توضیح کوتاه" size="md"
  footer={<><button className="btn-theme-secondary">انصراف</button><button className="btn-theme-primary">ثبت</button></>}
>
  {/* content */}
</Modal>
```

Notes from the implementation:
- Renders via `createPortal` into `document.body` at `z-[9999]`, backdrop
  `bg-black/50 backdrop-blur-sm`. `dir="rtl"` is hardcoded on the panel — don't
  re-add it on children.
- Closes on `Escape` automatically (`Modal.tsx:30-35`); you still need your own
  backdrop-click handling if you want click-outside-to-close (the backdrop div
  has no `onClick` wired to `onClose` in the current implementation — check
  before assuming it closes on outside click).
- `size` maps to `max-w-sm/md/lg/xl`; body scrolls independently
  (`overflow-y-auto`) with the header/footer pinned.

---

## 3. TimeSelect — reuse this for ANY clock-time picker

`apps/frontend/app/components/ui/TimeSelect.tsx`:

```ts
interface Props {
  value: string;              // "HH:MM" or ""
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;         // default "input-theme text-sm"
}
```

It's a full custom analog-clock time picker (drag or click the clock face, or
type directly into the header hour/minute inputs), themed for dark mode via a
`MutationObserver` on `documentElement.classList`, and its picker overlay uses
`z-[10000]` — one above `Modal`'s `z-[9999]`, so it layers correctly when used
inside a modal. **Do not build a new `<input type="time">` or a custom time
input anywhere in the app — import this component.** It was recently reused
for hourly-leave request forms in
`apps/frontend/app/dashboard/attendance/my/page.tsx` (lines 451, 453, 502, 504,
523, 541 — leave start/end and correction-request in/out times), which is the
reference call site to copy from:

```tsx
<TimeSelect value={leaveForm.leaveStart} onChange={v => setLeaveForm(s => ({ ...s, leaveStart: v }))} />
```

Other shared `components/ui/` pieces worth checking before writing something new:
`SearchSelect` (searchable dropdown) and `Toast`/`useToast` (toast notifications) —
both are imported together in `apps/frontend/app/dashboard/tickets/[id]/page.tsx:9-10`
as a typical example of what a form-heavy page pulls in.

---

## 4. Jalali (Persian) calendar handling

There is **no shared Jalali utility module** — this is confirmed, not an
oversight to fix unprompted. The same four functions are copy-pasted verbatim
(sometimes reformatted) into every page that needs Jalali↔Gregorian conversion.
Canonical copy: `apps/frontend/app/dashboard/attendance/work-rules/page.tsx:40-68`.
Also duplicated in `apps/frontend/app/dashboard/attendance/my/page.tsx:27-47`.

```ts
function toJalali(gy0: number, gm: number, gd: number) { /* jdf algorithm */ }
function jalaliToGregorian(jy0: number, jm: number, jd: number) { /* returns a JS Date */ }
const jMonthLen = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jy % 4 === 3 ? 30 : 29);
const todayJ = () => { const t = new Date(); return toJalali(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
```

When a new page needs Jalali dates: copy these four functions in verbatim from
`work-rules/page.tsx`. Convert to Gregorian before sending to the API:
`` `${g.y}-${String(g.m).padStart(2,'0')}-${String(g.d).padStart(2,'0')}` `` (note:
`jalaliToGregorian` here returns a JS `Date`, so read `.getFullYear()` /
`.getMonth()+1` / `.getDate()` off it rather than a `{y,m,d}` object — some
per-page variants return the object form instead, so check the copy you're
pasting from).

### Jalali date picker — always three `<select>`s, never a text input

Two patterns exist for the year/month/day triple-select, both acceptable —
pick whichever fits the surrounding code better:

1. **Named component**: `JalaliDateSelect` in `work-rules/page.tsx:401-432` — a
   local (non-exported) function component in that file. It's not lifted into
   `components/ui/`, so copy the whole function into your page rather than
   trying to import it directly.
2. **Inline block**: `my/page.tsx` builds the three `<select>`s directly inside
   the leave-request modal JSX (around `my/page.tsx:405-435`) without factoring
   out a component, using the same `jMonthLen`/`todayJ` helpers.

Both wrap the three selects in `dir="ltr"` and render Persian digit labels via
`n.toLocaleString('fa-IR', { useGrouping: false })`. Never use a plain
`<input type="text">` for a Jalali date — every existing page uses the
three-select pattern.

---

## 5. API calls — token source and cookie mirror

Standard shape, unchanged from CLAUDE.md and verified in every page checked:

```ts
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const token = localStorage.getItem('token');
const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
fetch(`${API}/some-route`, { headers: h })
```

The token is written to **both** `localStorage` and a `token` cookie at login
time (`signin/page.tsx:91-93`):
```ts
localStorage.setItem('token', data.access_token);
document.cookie = `token=${data.access_token}; path=/; max-age=${cookieTtl}; SameSite=Lax`;
```
The cookie exists purely so `apps/frontend/middleware.ts:11-18` can gate
`/dashboard/*` routes at the edge (redirecting to `/signin?redirect=<path>` if no
`token` cookie is present) — the middleware never validates the token, only
checks presence. All actual API calls read from `localStorage`, not the cookie.
Logout clears both (`layout.tsx:219-223`: `localStorage.removeItem('token')` +
`document.cookie = 'token=; path=/; max-age=0'`) — replicate both halves
whenever you write a manual logout/session-clear path, or the middleware will
keep letting the user back into `/dashboard` on a stale cookie.

---

## 6. Auth guard on pages with an existing token

Confirmed still implemented exactly as CLAUDE.md describes, in
`apps/frontend/app/(application)/signin/page.tsx:31-49`:

```ts
const token = localStorage.getItem('token');
if (token) {
  fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => {
      if (r.ok) { window.location.replace('/dashboard'); }
      else {
        localStorage.removeItem('token');
        document.cookie = 'token=; path=/; max-age=0';
        setReady(true);
      }
    })
    .catch(() => setReady(true));
} else { setReady(true); }
```
Note the network-error branch (`.catch`) sets `ready` **without** clearing the
token — a transient network failure shouldn't log the user out, only an
explicit 401/403 from `/auth/me` should. The page renders `null` until `ready`
is `true` (`signin/page.tsx:108`), preventing a flash of the signin form for
users who are actually still logged in. `dashboard/layout.tsx:87-111` runs the
mirror-image version of this same check on every dashboard mount (redirect to
`/signin` on failure instead of redirect away from it) — copy whichever
direction matches the page you're adding.

---

## 7. RTL and number formatting

- Every dashboard container: `dir="rtl"`.
- Phone numbers, times, IDs, and other left-to-right numeric strings:
  `dir="ltr"` on that specific element, not the whole container.
- Phone display inside RTL text: wrap in `<bdi dir="ltr">{phone}</bdi>` to stop
  digit-reversal — **but this is aspirational, not a followed convention**: a
  repo-wide check found exactly one file actually doing it
  (`apps/frontend/app/(application)/forgot-password/page.tsx`). Most phone
  displays elsewhere just use a plain `dir="ltr"` span/div instead. Prefer the
  `<bdi>` form per CLAUDE.md when writing new code, but don't be surprised the
  surrounding page doesn't already do it.
- Persian digit conversion has **no shared helper** — 32+ files independently
  define their own tiny `faNum`/`toFa` function, almost always one of:
  ```ts
  const faNum = (n: number) => (n ?? 0).toLocaleString('fa-IR');
  const toFa = (s: string) => s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  ```
  (see `apps/frontend/app/dashboard/attendance/page.tsx:51-53` and
  `apps/frontend/app/dashboard/tickets/[id]/page.tsx:50` for two near-identical
  copies). This duplication is the existing convention — add your own local
  `faNum`/`toFa` in a new page rather than importing one from elsewhere or
  refactoring toward a shared util, unless specifically asked to consolidate.

---

## 8. Error display — inline box below submit, not toast-only

For a form error that should block the user from proceeding (wrong OTP,
invalid phone, failed login), don't rely on the toast alone — it's a passive
transient element the user can easily miss on a page reload or on mobile.
Render a persistent inline box near the submit button. Two real
implementations, both fine to copy:

```tsx
{/* forgot-password/page.tsx:199-205 — plain SVG icon */}
{phoneError && (
  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">…</svg>
    {phoneError}
  </div>
)}
```

```tsx
{/* pattern used across ~12 dashboard pages — lucide AlertCircle */}
{error && (
  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-800 rounded-xl">
    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
    <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
  </div>
)}
```
Either the raw inline SVG or `lucide-react`'s `AlertCircle` is fine — both are
in active use; `AlertCircle` is more common in dashboard pages, the raw SVG
form shows up on the pre-login `(application)/` pages. Show both this box
*and* fire a toast (`toast.error(msg)`) for the same error — that's what
`signin/page.tsx:98-104` does — the box is for persistence, the toast is for
immediacy.

---

## 9. Backend: singleton settings service pattern

Every module that stores one global config row (`SystemSettings`,
`AuthSettings`, `TicketSettings`, `ai-settings`'s config, …) follows the same
shape: a single DB row with `id: 'singleton'`, upserted (never plain `create`,
which would risk a second row on a race), an in-process cache with manual
invalidation, and an `updatedById` audit field. Reference implementation —
`apps/backend/src/modules/system-settings/system-settings.service.ts`:

```ts
@Injectable()
export class SystemSettingsService {
  private cache: SystemSettingsData | null = null;
  private cacheAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService, /* … */) {}

  async get(): Promise<SystemSettingsData> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < this.CACHE_TTL_MS) return this.cache;

    const row = await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });

    this.cache = { /* map row fields into the DTO shape */ };
    this.cacheAt = now;
    return this.cache;
  }

  invalidateCache() { this.cache = null; }

  async update(data: Partial<UpdateInput>, adminId: string) {
    const updated = await this.prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data, updatedById: adminId },
      update: { ...data, updatedById: adminId },
    });
    this.invalidateCache();   // caller MUST call this after every PATCH
    return updated;
  }
}
```

Notes:
- `AuthSettingsService` (`apps/backend/src/modules/auth-settings/auth-settings.service.ts`)
  follows the identical shape, plus increments `globalTokenVersion` on
  `update`/`forceGlobalLogout` to invalidate every existing JWT in one write.
- **Not every singleton service has the cache.** `TicketSettingsService`
  (`apps/backend/src/modules/tickets/categories.service.ts:164-180`, the
  `getSettings`/`updateSettings` methods) uses the same `upsert({ where: { id:
  'singleton' } })` shape but reads straight from the DB every call, with no
  `cache`/`cacheAt`/`invalidateCache`. Add the 30s cache when the settings are
  read on a hot path (e.g. every request, like `SystemSettings.get()` is via
  `getOrgName()`); skip it for settings only read from an admin settings page,
  where the extra DB round-trip doesn't matter.
- Always `upsert`, never `findUnique` + conditional `create`/`update` — the
  upsert makes the "does the singleton row exist yet" question atomic and
  removes an entire class of first-request-after-deploy bugs.
