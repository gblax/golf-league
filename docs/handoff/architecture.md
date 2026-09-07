# Architecture

System overview for the Golf One & Done League app. Verified against the
codebase, the live Supabase project, and the live Vercel project on
**2026-07-09**.

## The one-paragraph version

A React PWA served statically from Vercel talks **directly** to Supabase
(Auth + Postgres) with the public anon key; row-level security is the entire
authorization layer. Five GitHub Actions cron jobs run Python scripts that
pull PGA Tour data from the Slash Golf API (RapidAPI) and write it into the
same database with the service-role key (which bypasses RLS). The browser
never calls the golf API and never sees a privileged key; everything the app
shows — schedules, fields, live scores, results — is read from Postgres.
Web-push notifications are sent from the Python side using VAPID keys.

```
                       ┌────────────────────────────┐
                       │  Slash Golf API (RapidAPI) │
                       │  /schedule /leaderboard    │
                       │  /earnings                 │
                       └────────────▲───────────────┘
                                    │ RAPIDAPI_KEY (server-side only)
                    ┌───────────────┴────────────────┐
                    │  GitHub Actions (cron, UTC)    │
                    │  scripts/*.py  (Python 3.11)   │
                    │  - sync_schedule  (Wed)        │
                    │  - sync_field     (Tue/Wed)    │
                    │  - update_leaderboard (Fri–Mon)│
                    │  - update_results (Mon)        │
                    │  - send_reminders (Wed)        │
                    └───────┬───────────────┬────────┘
        service-role key    │               │  Web Push (VAPID)
        (bypasses RLS)      ▼               ▼
              ┌─────────────────────┐   ┌──────────────────┐
              │ Supabase Postgres   │   │ Push services    │
              │ + Supabase Auth     │   │ (FCM/APNs/etc.)  │
              │ project:            │   └────────▲─────────┘
              │ tdmnufmlemfszaaegczp│            │
              └──────────▲──────────┘            │ sw-push.js shows the toast
                         │ anon key + RLS        │
              ┌──────────┴────────────────────────┴─────┐
              │  React 18 PWA (Vite build, Tailwind)    │
              │  Vercel static hosting                  │
              │  prod: 1anddone.vercel.app (main branch)│
              └─────────────────────────────────────────┘
```

## Frontend

- **Build:** Vite 5 + `@vitejs/plugin-react`. Plain JavaScript/JSX — no
  TypeScript. `npm run dev|build|preview`.
- **UI:** Tailwind CSS 3 with a custom "clubhouse" theme (the `slate`,
  `emerald`, `green`, and `amber` scales are remapped in
  `tailwind.config.js`); shared component classes (`.card`, `.btn-primary`,
  `.input`, `.badge`, `.modal-*`) defined in `src/index.css`. Icons from
  `lucide-react`. Fonts: Inter (body) + Fraunces (display), loaded from
  Google Fonts in `index.html`.
- **Structure:** `src/App.jsx` is the container: it creates the Supabase
  client (`createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`), owns
  essentially **all** state (auth/session, league selection, tournaments,
  picks, standings, live leaderboard, settings, modals), and passes props
  down into memoized presentational components in `src/components/`:
  - `PicksTab` — weekly pick form (searchable comboboxes), off-field warning,
    season scorecard, Monday recap card, watch mode once picks lock.
  - `SeasonCompleteTab` — takes the Pick tab's slot once every tournament
    of the season is complete (or when browsing a past season): champion
    hero, podium with payouts, final standings, superlatives, "what's next".
  - `StandingsTab` — season standings, expandable week-by-week rows,
    rank-movement arrows, `SeasonTrends` (hand-rolled SVG chart, no chart lib).
  - `ScheduleTab` — 32-week schedule with purses and per-week results.
  - `LeagueInfoTab` — pot/payout calculator, rules, golfer management.
  - `CommissionerTab` — league settings, manual results entry/override,
    mark-complete, winner entry (visible only to `role='commissioner'`).
  - `LoginScreen`, `LeagueSelectScreen`, `ResetPasswordScreen`, modals, etc.
- **Navigation:** no router. The active tab lives in the URL hash
  (`#picks`, `#season`, `#standings`, `#schedule`, `#admin`, `#results`) so
  the browser back button moves between tabs and notifications can
  deep-link.
- **Seasons:** all tournaments (every season) load once; the app works on
  the newest season unless the viewer picks an older one from the header
  (read-only archive). See `season-rollover.md`.
- **State management:** none beyond React hooks + props drilling. Data loads
  via `loadData()` in App.jsx on login/league-switch, on manual refresh, and
  silently when the app regains visibility (throttled to once/60s, using a
  `preservePick` path so a stale cached read can't clobber a just-submitted
  pick).
- **PWA:** `vite-plugin-pwa` (`registerType: 'autoUpdate'`) generates the
  service worker; `public/sw-push.js` is imported into it for push events.
  Supabase requests are runtime-cached **NetworkFirst with a 5-minute TTL** —
  a deliberate freshness/offline tradeoff that the optimistic-update code in
  App.jsx works around after writes. `controllerchange` triggers a full page
  reload when a new SW takes over.

## Backend (data pipeline)

There is no server. The "backend" is `scripts/` run by GitHub Actions:

| Script | Workflow / schedule (UTC) | What it does |
|---|---|---|
| `sync_schedule.py` | Wed 13:00 | Maps each DB tournament to its Slash Golf event: stores `tournaments.slashgolf_tourn_id` + real `prize_pool`. `--year N --create` (manual only) loads a new season's events with `season` + sequential weeks; `--renumber` closes week gaps after pruning. |
| `sync_field.py` | Tue/Wed 14:00 & 22:00 | Replaces `tournament_field` with the current entry list once tee times post; attaches `golfer_id` to matching picks; backfills `available_golfers.golfer_id`. Empty field = no-op. |
| `update_leaderboard.py` | Fri/Sat/Sun/Mon 00:00 & 02:00 (evening ET of each round day) | Upserts ONE snapshot row per tournament into `live_leaderboard` (JSONB players, cut line, status). Single API call, no earnings. |
| `update_results.py` | Mon 09:00 | The Monday scorer. See below. |
| `send_reminders.py` | Wed 17:00 & 23:00 | Push reminder to members without a pick for the next lock, only while the deadline is in the future and within 96h. |

Shared plumbing: `golf_common.py` (service-role Supabase client, env
aliasing, web-push send loop with expired-subscription cleanup) and
`slashgolf.py` (pure API client + parsers: Mongo extended-JSON unwrapping,
name normalization, tournament-name matching, leaderboard/earnings/schedule
parsing — unit-testable offline).

### The Monday scoring flow (`update_results.py`)

1. Pick the target week from **our own schedule**: the most recent
   `completed=false` tournament whose start date + ~4 days has passed.
   (Never trusts whatever event the API currently surfaces.)
2. Resolve the Slash Golf `tournId` (stored ID first, name-match fallback).
3. Fetch `/leaderboard` + `/earnings`, join on `playerId`.
4. Safety gates — refuse (exit non-zero → red Actions run) unless `--force`:
   event status is `Official`; the field has non-zero total earnings; the
   tournament mapped; at least one real pick matched.
5. Insert `golfer_name='No Pick'` rows for every league member without a pick
   (across **all** leagues), then per league apply that league's penalty
   settings: no-pick / missed-cut / WD / DQ. Existing manually-entered
   penalties are preserved, never overwritten.
6. Write `picks.winnings` (integer dollars) per pick; record
   `tournaments.winner_golfer_name`; opportunistically backfill
   `available_golfers.golfer_id` from the fetched field.
7. Send a "Results posted" push; `--complete` marks the tournament completed.

## Data flow: a week in the life

- **Mon** — scorer finalizes last week; UI advances to the next tournament at
  Monday 10:00 UTC (5am ET); recap card appears; picks reopen.
- **Tue/Wed** — field sync fills `tournament_field`; pick screen marks
  golfers in/out of the field and warns on off-field picks (advisory only).
  Schedule sync refreshes IDs/purses. Wednesday reminders nudge non-pickers.
- **Thu ~tee-off** — `tournaments.picks_lock_time` passes: the app hard-stops
  submissions client-side, opponents' picks unseal, PicksTab flips to watch
  mode.
- **Thu–Sun evenings** — leaderboard snapshots land in `live_leaderboard`;
  the app renders live positions for every member's pick (data is only as
  fresh as the last snapshot; the UI shows an "updated" label).
- **Deployment** — any merge to `main` → Vercel production build. NOTE:
  `.github/workflows/auto-merge.yml` auto-merges any `claude/**` branch push
  into `main` without review.

## Hosting / accounts

- **Vercel:** team "Greg Brown's projects", project `golf-league`
  (`prj_HPcxyV8KaZROljIy0X5TCDltsRan`), framework preset `vite`, Node 24.
  Domains: `1anddone.vercel.app` (production), plus
  `golf-league-git-main-*.vercel.app` (main-branch alias). No `vercel.json`
  in the repo — defaults are fine because the app has no client-side routes
  (hash navigation only).
- **Supabase:** project "One And Done League", ref `tdmnufmlemfszaaegczp`,
  region us-west-2, Postgres 17. No Edge Functions, no Storage buckets in use.
- **GitHub:** `gblax/golf-league`; Actions provide all automation.

## Corrections to prior mental models (verified 2026-07-09)

- **There is no Make.com scenario in this system.** Nothing in the code, git
  history, workflows, or DB references Make.com/Integromat; all scoring
  automation is the GitHub Actions + Python pipeline above. (If an external
  Make.com scenario ever wrote to the DB, it lived outside this repo — see
  the gap report in the PR/handoff summary.)
- **Gemini is no longer used.** Git history shows Gemini once parsed
  leaderboards, was replaced by a direct ESPN JSON walk (commit `46787e1`),
  and ESPN scraping was later replaced wholesale by the Slash Golf API
  (commit `f8f2833`). No LLM is involved anywhere today.
- The PGA data source is **Slash Golf "Live Golf Data" via RapidAPI**, not
  ESPN and not an official PGA feed.
