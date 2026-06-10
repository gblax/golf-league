# UI / Design Evaluation

A review of the app's UI and design for polish opportunities, focused on consistency,
empty/loading states, mobile ergonomics, accessibility, and micro-interactions.
Every finding below was verified against the source on this branch; file and line
references are accurate as of the commit that introduced this document.

> **Status:** all three batches from the roadmap at the bottom have been implemented,
> so the quoted "current" code throughout reflects the pre-fix state. This document
> now serves as the rationale/record for those changes.

**Overall assessment:** the app is in good shape. The clubhouse theme (emerald/amber on
cool slate, Fraunces display headings) is cohesive, the mobile-first layouts are
thoughtful (dynamic viewport height, safe-area insets, 16px inputs to prevent iOS zoom,
keyboard-navigable comboboxes with proper ARIA), and dark mode is pervasive. The gaps
are mostly *consistency* gaps: a few screens missed the theme retune, several shared
patterns (badges, spinners, toasts) are re-implemented with slightly different values,
and a handful of accessibility attributes are present in some places but missing in
others.

Findings are tagged **Impact** (what it costs users) and **Effort** (to fix).

---

## 1. Top priorities (high impact, low effort)

| # | Finding | Where | Impact | Effort |
|---|---------|-------|--------|--------|
| 1 | Six extracted components are dead code that duplicates live inline UI | `src/components/{LoginScreen,LeagueSelectScreen,ResetPasswordScreen,NotificationSettingsModal,AccountSettingsModal,NotificationToast}.jsx` | High (drift) | Medium |
| 2 | League-select screen and notifications modal use the pre-retune `green-*`/`gray-*` palette | `src/App.jsx:1697-1746`, `1970-2028` | Medium | Small |
| 3 | Toasts have no `role="status"`/`aria-live`; dismiss button unlabeled | `src/App.jsx:1824-1843` (+3 inline copies), `src/components/NotificationToast.jsx:8-25` | Medium (a11y) | Small |
| 4 | Schedule rows expand via a clickable `<div>` — no keyboard access | `src/components/ScheduleTab.jsx:26-29` | Medium (a11y) | Small |
| 5 | Toggle switch track nearly invisible when off in dark mode | `src/App.jsx:2001`, `2017` | Medium (a11y) | Small |

### 1.1 Dead duplicated components (the biggest cleanup win)

`App.jsx` (2,313 lines) renders its own inline login screen, reset-password screen,
league-select screen, notifications modal, account-settings modal, and toast — yet
extracted versions of all six exist in `src/components/` and **nothing imports them**
(`NotificationToast` is imported only by the other unused screens). The copies have
already diverged: the inline league-select screen still uses the old `green-*`/`gray-*`
palette (see 1.2), and the inline account-settings close button is missing the
`aria-label` that the notifications modal has.

**Recommendation:** pick one source of truth. Either wire App.jsx to the extracted
components (preferred — it also shrinks App.jsx) or delete the extracted files. Until
then, every styling fix risks landing in only one of the two copies.

### 1.2 Off-theme palette on the league-select screen and notifications modal

The theme retune (commit `593f153 "Retune clubhouse theme"`) moved the app to
`emerald-*` accents on `slate-*` neutrals, but two surfaces were missed:

- League-select tabs and cards, `src/App.jsx:1701-1746`:
  `border-green-500 text-green-600 dark:text-green-400`, `text-gray-500 dark:text-gray-400`,
  `bg-gray-50 dark:bg-slate-700`, `hover:bg-green-50 … hover:border-green-400`
- Notifications modal body text and toggles, `src/App.jsx:1970-2028`:
  `text-gray-600 dark:text-gray-400`, `text-gray-800 dark:text-gray-200`, toggle on-state `bg-green-500`

Tailwind's `green`/`gray` are warmer than the theme's `emerald`/custom `slate`, so these
screens look subtly "off" next to every other surface — most visible on the league
picker, which is the first thing a new user sees.

**Recommendation:** mechanical rename `green-→emerald-`, `gray-→slate-` on these two
surfaces (and toggle on-state to `bg-emerald-500`).

### 1.3 Toast accessibility

`NotificationToast.jsx:8` and the four inline toast blocks in App.jsx (`1481`, `1538`,
`1677`, `1825`) render a plain `div` — screen readers never announce success/error
feedback. The dismiss button (`App.jsx:1836-1841`, `NotificationToast.jsx:19-25`) is an
icon-only button with no `aria-label`.

**Recommendation:** add `role="status" aria-live="polite" aria-atomic="true"` to the
toast container and `aria-label="Dismiss notification"` to the close button — in *one*
shared component (see 1.1).

### 1.4 Schedule rows aren't keyboard-operable

Completed tournaments expand via `onClick` on a `div` (`ScheduleTab.jsx:26-29`) with
`cursor-pointer` styling. There's no `role="button"`, no `tabIndex`, no key handler, and
no `aria-expanded`, so keyboard and screen-reader users cannot open week results.

**Recommendation:** make the row header a `<button>` (the standings mobile cards at
`StandingsTab.jsx:226` already do this correctly) and add `aria-expanded`.

### 1.5 Toggle contrast in dark mode

Off-state track is `bg-gray-300 dark:bg-slate-500` (`App.jsx:2001`, `2017`) on a
`dark:bg-slate-900` modal — the track all but disappears; only the white knob is
visible. (The toggles already have `role="switch"` + `aria-checked`, which is good.)

**Recommendation:** `dark:bg-slate-700` with a `border border-slate-600`, or follow the
emerald rename from 1.2 for the on-state at the same time.

---

## 2. Consistency findings

### 2.1 Repeated one-off badge styles
The "chip" pattern is re-implemented with different paddings/radii/sizes:

- Header prize pool: `px-2 py-0.5 rounded-md text-xs` (`App.jsx:1857`)
- PicksTab lock timer: `px-2.5 py-1 rounded-lg text-xs` (`PicksTab.jsx:160`)
- Standings trophy count: `px-1.5 py-0.5 rounded-md text-[10px]` (`StandingsTab.jsx:246`)
- Schedule prize pool: `px-1.5 py-0.5 rounded-md text-[10px]` (`ScheduleTab.jsx:44`)
- Schedule "Current"/"Upcoming": `px-2 py-1 rounded-lg text-[10px]` (`ScheduleTab.jsx:77`, `90`)

**Recommendation:** add a `.badge` component class in `src/index.css` (next to `.card`
/ `.btn-*`) with color-variant modifiers, and migrate call sites opportunistically.

### 2.2 Spinner sizes and no skeletons
The same hand-rolled spinner appears at `w-10 h-10` (`App.jsx:1471`) and `w-8 h-8`
(`PicksTab.jsx:136`, `CommissionerTab.jsx:337`). All loading states are
spinner-then-content, which causes a visible layout jump on the Picks tab.
**Recommendation:** extract a `<Spinner size>` component now (small); consider skeleton
rows for Picks/Standings later (medium).

### 2.3 Buttons
- `.btn-primary` default is `py-2.5` (`index.css:109`) but call sites override to `py-3`
  (`PicksTab.jsx:433`) and `py-2` (`App.jsx:2033`). Consider `.btn-lg` / `.btn-sm` variants.
- Duplicate class artifacts: `className="w-full btn-primary w-full py-3"` at
  `App.jsx:1515`, `1767`, `1797`.
- Inconsistent in-flight feedback: PicksTab's submit button disables itself and shows an
  inline spinner (`PicksTab.jsx:430-441` — the model to copy), but CommissionerTab's
  "Save Changes" (`405-410`) and "Save Settings" (`173-194`) have no disabled/loading
  state, so double-submits are possible.

### 2.4 Copy variations
"No pick" (`StandingsTab.jsx:48`, `ScheduleTab.jsx:148`) vs "No Pick"
(`LeagueInfoTab.jsx:278`) vs "No pick submitted" (`CommissionerTab.jsx:357`).
Standardize on one casing (suggest "No pick").

### 2.5 Error message tone
Some errors are user-friendly (`App.jsx:246` "Invalid invite code. Please check and try
again.") while others concatenate raw Supabase errors (`App.jsx:193`, `269`, `799`,
`867` `'Login error: ' + error.message`). Raw messages can leak technical detail and
read poorly. **Recommendation:** map known error codes to friendly copy; log the raw
error to the console instead.

---

## 3. Mobile UX

| Finding | Where | Impact / Effort |
|---|---|---|
| Tables scroll horizontally with no affordance (no edge fade/snap), easy to miss columns on phones | `ScheduleTab.jsx:104`, `StandingsTab.jsx:315`, `383` | Med / Small |
| Golfer dropdown (`max-h-60`) can sit behind the on-screen keyboard; no `scrollIntoView` on focus | `PicksTab.jsx:263-268`, `357-362` | Med / Med |
| Clear-✕ buttons in the golfer inputs are ~16px icons with no padding (small touch target) and no `aria-label` | `PicksTab.jsx:255-262`, `349-355` | Med / Small |
| Header "Playing as" block is `hidden sm:block` but keeps `mr-2`, leaving phantom spacing on phones | `App.jsx:1879` | Low / Small |
| Absolute lock time (`lockTimeLabel`) is `hidden sm:inline` in the header; mobile users only see the relative countdown there. *Mitigating:* PicksTab shows the full lock datetime under the submit button (`PicksTab.jsx:443-454`), so this only matters on other tabs | `App.jsx:1871-1873` | Low / Small |
| Top tab bar works, but with 5 tabs the icon-over-label layout is cramped at `px-1`; a fixed bottom nav (thumb reach, standard PWA pattern) is worth considering | `App.jsx:2173-2195` | Med / Large |

## 4. Remaining accessibility gaps

The foundation is solid (combobox ARIA in PicksTab, `role="switch"` on toggles,
focus-visible rings, reduced-motion support). What's missing is mostly `aria-expanded`
on disclosure controls:

- Standings expand controls: mobile card button (`StandingsTab.jsx:226-232`) and desktop
  chevron button (`366-371`, also icon-only with no `aria-label`).
- League Settings accordion (`CommissionerTab.jsx:63-75`).
- Account-settings modal close button has no `aria-label` (`App.jsx:2064-2069`); the
  notifications modal one does (`1959-1963`) — copy that.
- Main tabs (`App.jsx:2182-2193`) have no `aria-current` (or `role="tablist"`/`tab`
  semantics); selected state is conveyed by color only.
- Heading hierarchy: `h1` (league name, `text-lg sm:text-xl`, `App.jsx:1853`) renders
  the same size as section `h2`s (`text-lg`). Visual hierarchy relies on placement
  alone; bump `h1` to `text-xl sm:text-2xl` (it's also where the Fraunces serif —
  already applied to h1/h2 via `index.css:35-39` — would actually show).

## 5. Empty states & first-run

- **Good pattern already exists:** CommissionerTab's "select a tournament" empty state
  (`CommissionerTab.jsx:424-429` — icon + caption in a tinted panel). Reuse it.
- PicksTab's "No pick yet" card (`PicksTab.jsx:212-217`) is a passive dashed box; it's
  the main call to action of the whole app on a fresh week. Give it the empty-state
  treatment (icon, one line of copy, visual pointer toward the search input).
- LiveLeaderboard's "No league picks to show…" (`LiveLeaderboard.jsx:124`) is faint
  italic text and doesn't explain *why* (picks hidden until lock). Use the tinted-panel
  pattern with explanatory copy.
- League-select screen (`App.jsx:1687-1718`) is functional but bare for a brand-new user
  (no leagues): consider one sentence of guidance above the Join/Create tabs ("Join a
  league with an invite code, or create your own and invite friends").

## 6. Micro-interactions (all low impact, small/medium effort)

- Pick submission success is toast-only; a brief highlight/scale-in on the "Current
  Pick" card (`PicksTab.jsx:190-210`) would land the confirmation where the eye is.
- "Copy" invite button (`CommissionerTab.jsx:49-57`) gives no inline feedback — swap
  label to "Copied ✓" for ~2s. Also wrap `navigator.clipboard.writeText` in a
  try/catch; it can throw on insecure contexts/older browsers.
- Tab content swaps instantly (`App.jsx:2198+`); the existing `animate-fade-in` utility
  on the content wrapper would soften it (and is already neutralized for
  reduced-motion users by `index.css:58-65`).
- Input placeholder `dark:placeholder-slate-500` on `dark:bg-slate-800`
  (`index.css:101`) is borderline; `dark:placeholder-slate-400` reads better.
- Disabled `.btn-primary` is `opacity-50` (`index.css:113`), which gets murky in dark
  mode; a solid muted fill (`disabled:bg-slate-300 dark:disabled:bg-slate-700` +
  muted text) stays legible.

---

## Suggested roadmap

**Batch 1 — quick wins (✅ implemented alongside this report):**
toast `aria-live` + dismiss label; `aria-expanded`/`aria-label` on disclosure controls;
ScheduleTab row → `<button>`; toggle track contrast; `green-/gray-` → `emerald-/slate-`
rename on the two off-theme surfaces; "No pick" casing; duplicate `w-full` cleanup;
loading/disabled state on commissioner save buttons; "Copied ✓" state;
placeholder/disabled contrast tweaks. (One finding from the original draft was dropped:
"Mark as Complete" already confirms via `window.confirm` in its App.jsx handler.)

**Batch 2 — consolidation (✅ implemented):**
the dead-component duplication is resolved — App.jsx now renders the extracted
screens/modals/toast components (`LoginScreen`, `ResetPasswordScreen`,
`LeagueSelectScreen`, `NotificationSettingsModal`, `AccountSettingsModal`,
`NotificationToast`), which were first updated to match the live inline behavior;
shared `<Spinner>` extracted (`src/components/Spinner.jsx`); `.badge` and
`.btn-lg`/`.btn-sm` component classes added to `src/index.css` and adopted at the
chip/button call sites; raw Supabase error messages now route through
`friendlyError()` (`src/utils/errors.js`), which logs the raw error and returns
user-appropriate copy. The never-imported `src/hooks/` directory (five stale
duplicates of App.jsx auth/league/notification logic) was deleted for the same
single-source-of-truth reason.

**Batch 3 — larger UX investments (✅ implemented):**
PicksTab now shows a layout-mirroring skeleton instead of a spinner (`.skeleton`
class in `src/index.css`); the schedule results table has a right-edge fade hinting
at sideways scroll on phones; the golfer search inputs scroll themselves into view
on focus so the dropdown isn't hidden behind the on-screen keyboard; designed empty
states landed for PicksTab (no-pick call to action), LiveLeaderboard, and the
league-select first run, with a shared `EmptyState` component
(`src/components/EmptyState.jsx`); phones get a fixed bottom tab bar (top tab strip
remains on `sm+`), with `aria-current` on both; pick submission pings the pick card
with a one-shot `flash-success` animation; tab switches fade in. (Standings renders
from already-loaded state, so it has no loading window for a skeleton to fill.)

All three batches are complete. The pick-state bug where changing a pick left the
replaced golfer permanently flagged as "used" for the session was fixed alongside
batch 3 (swap-not-append in `handleSubmitPick`; the post-write reconcile now trusts
the fresh read instead of unioning stale state).
