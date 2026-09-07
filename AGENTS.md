# AGENTS.md — Golf One & Done League

Guide for AI coding agents (and new humans) working in this repository. It is
tool-agnostic: nothing here assumes a particular assistant or IDE.

> **Deep dives live in `docs/handoff/`** — architecture, full database schema,
> business rules, integrations, environment variables, conventions, and known
> issues. Read `docs/handoff/architecture.md` first if you're new. This file is
> the quick-reference version.

## What this project is

A mobile-first PWA for running a **PGA Tour "One & Done" fantasy league**:
each member picks one golfer per tournament week, may use each golfer only
once per season, and earns that golfer's real prize money. Highest season
total wins the pot (buy-ins + penalties).

**Stack:** React 18 + Vite + Tailwind (no TypeScript, no router, no state
library) · Supabase (Auth + Postgres + RLS, accessed directly from the
browser) · Vercel (static hosting, production = `1anddone.vercel.app`) ·
GitHub Actions cron jobs running Python 3.11 scripts that pull PGA data from
the **Slash Golf "Live Golf Data" API (RapidAPI)** and write to Supabase with
the service-role key · Web Push (VAPID) notifications.

There is **no application server of our own**. The browser talks straight to
Supabase using the anon key; RLS is the security boundary. The Python scripts
are the only other writer and they bypass RLS via the service role.

## Repository map

```
src/App.jsx              ~2,000-line root component: ALL app state, data loading,
                         auth, league selection, pick submission, admin handlers.
src/components/          Presentational tab/screen components (props-drilled from App).
                         SeasonCompleteTab is the off-season landing (champion/standings).
src/utils/               Small pure helpers (errors, live leaderboard, money, colors,
                         seasons, payouts, seasonSummary).
public/sw-push.js        Push-notification handlers imported into the generated SW.
scripts/*.py             Backend jobs (Slash Golf client, scoring, syncs, push).
scripts/test_*.py        Offline unit tests for the Python pipeline.
scripts/*.sql            Schema-as-history: idempotent scripts run by hand in the
                         Supabase SQL editor (see "Database changes" below).
.github/workflows/       Cron automation + auto-merge (see "Deployment & branches").
docs/handoff/            Full handoff documentation (schema, rules, integrations…).
```

## Commands (verified)

```bash
# Frontend (Node 18+; Vercel builds on Node 24)
npm install
npm run dev        # Vite dev server
npm run build      # production build into dist/ (also generates the PWA SW)
npm run preview    # serve the production build locally

# Backend scripts (Python 3.11)
pip install -r scripts/requirements.txt   # full set; pywebpush→http-ece needs a C toolchain
pip install requests python-dotenv        # enough for ALL unit tests (parsers/logic are pure)

# Tests — 87 unit tests, offline, no credentials needed
cd scripts && python -m unittest discover -s . -p 'test_*.py' -v

# Run a pipeline job manually (ALWAYS dry-run first; --apply to write)
cd scripts && python update_results.py             # dry run
cd scripts && python update_results.py --apply --complete
```

There is **no linter or formatter configured** (no ESLint/Prettier), and no
JS test suite. Match the style of surrounding code by eye; the Python tests
are the only automated checks.

## Environment variables (names only — see docs/handoff/environment.md)

Frontend (build-time, `VITE_*`, set in Vercel + local `.env`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.

Scripts (GitHub Actions secrets + local `scripts/.env`): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` (alias `SUPABASE_SERVICE_KEY`), `RAPIDAPI_KEY`
(alias `X_RAPIDAPI_KEY`), optional `RAPIDAPI_HOST` / `ORG_ID`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Deployment & branches — read before pushing

- `main` deploys to **production** automatically via Vercel's Git integration.
  There is no staging environment.
- **`.github/workflows/auto-merge.yml` merges ANY push to a `claude/**` branch
  straight into `main` with no review.** A push to such a branch is a
  production deploy. If you are not intentionally using that flow, work on a
  differently-prefixed branch and open a PR to `main`.
- Cron workflows (`update-results`, `update-leaderboard`, `sync-field`,
  `sync-schedule`, `pick-reminders`) run on schedules pinned to Eastern time
  in UTC; each has a `workflow_dispatch` with a dry-run input.

## Database changes

The live schema is the Supabase project **"One And Done League"**
(`tdmnufmlemfszaaegczp`). Convention for schema changes:

1. Write an **idempotent** SQL script (`CREATE TABLE IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`),
   ending with `NOTIFY pgrst, 'reload schema';` when it touches tables/policies.
2. Run it in the Supabase SQL editor (or as a tracked migration).
3. Commit the script to `scripts/*.sql` **as the record**, with a comment
   noting when/whether it was applied (see `scripts/add-tee-timezone.sql`).

`scripts/disable-rls.sql` is **development-only** — never run it against the
production project.

## Rules of the road (do's and don'ts)

- **Never** put the Supabase service-role key, the RapidAPI key, or the VAPID
  private key anywhere the frontend can see them (no `VITE_*`, no client code).
  The browser gets live scores by reading the `live_leaderboard` table, never
  by calling Slash Golf directly.
- **Dry-run first.** Every pipeline script defaults to a no-write preview and
  only writes with `--apply`. Keep that contract for new scripts.
- **Don't weaken the scoring safety gates** in `scripts/update_results.py`
  (event must be `Official`, field must have non-zero earnings, at least one
  pick must match, tournament must map to a Slash Golf ID). They exist because
  scoring the wrong/unfinished event zeroes every pick. A failed scheduled run
  exits non-zero **on purpose** so the Actions run goes red.
- **Mind the Slash Golf rate budget.** The comment-documented assumption is a
  free tier of ~20 requests/day; the cron cadence is sized to fit. Don't add
  per-user or per-page-load API calls.
- **Keep name normalization in sync** between `scripts/slashgolf.py
  normalize_name()` and `src/utils/liveLeaderboard.js normalizeName()` — picks
  are joined to leaderboards by Slash Golf `golfer_id` first, normalized name
  as the legacy fallback, in both languages.
- **Money is integer dollars.** `picks.winnings` / `penalty_amount` are `int`
  columns; coerce floats before writing (PostgREST serializes `1068200.0` in a
  way Postgres rejects for integer columns — this has bitten the Monday job).
- **Python deps are pinned** in `scripts/requirements.txt` (including the
  `postgrest` transitive pin). Bump deliberately, run the jobs, then commit.
- **Picks upsert key is `(user_id, tournament_id, league_id)`** — always pass
  `onConflict: 'user_id,tournament_id,league_id'` when upserting picks.
- Tournaments and `available_golfers` are **shared across all leagues**
  (`league_id NULL`); picks, penalties, settings, and members are league-scoped.
  Changing shared rows affects every league.
- **Seasons are `tournaments.season`; the newest year is the active season.**
  Inserting next year's rows is the rollover (the app switches immediately),
  so never insert future-season tournaments casually. Scope any new
  standings/picks logic to the season being viewed (`src/utils/seasons.js`).
  Runbook: `docs/handoff/season-rollover.md`.
- The frontend shows friendly errors via `friendlyError()` (`src/utils/errors.js`)
  and toast notifications; keep raw errors on the console.
- Don't commit `.env` / `scripts/.env` (gitignored). `scripts/.env.example`
  shows the shape.
- One-time repair scripts (`scripts/migrate-users-to-supabase-auth.js`,
  `scripts/fix-auth-identities.js`, most `scripts/*.sql`) are history, not
  live code — don't "fix" or re-run them casually.

## Things that look wrong but are intentional

- `App.jsx` holds nearly all state and passes ~20 props into each tab: that's
  the established pattern (props drilling, no context/store). Follow it rather
  than introducing new state management piecemeal.
- Positions/scores from Slash Golf are kept as **strings** (`"T4"`, `"-7"`,
  `"E"`, `"CUT"`) end-to-end and rendered verbatim.
- Tailwind's `slate`/`emerald`/`green`/`amber` scales are **remapped** in
  `tailwind.config.js` to a "clubhouse" palette — existing utility class names
  render the custom theme. Use those scales; don't hardcode hex values.
- The picks lock countdown, "sealed" opponents' picks, and the Monday-recap
  card are deliberate product mechanics (see `docs/handoff/business-logic.md`).

## Known sharp edges (full list in docs/handoff/known-issues.md)

- Pick locking and one-golfer-once are enforced **client-side only**; RLS does
  not check lock time or prior usage, and several live RLS policies are looser
  than the repo's SQL suggests (e.g. any authenticated user can UPDATE any pick).
- The app's writes to the `penalties` table use a conflict target that doesn't
  match the table's unique constraint, and the error is swallowed — standings
  are unaffected (they read `picks.penalty_amount`), but don't trust
  `penalties` as a source of truth.
- `backup_golfer_name` is collected and stored but the scorer never
  substitutes it; backup picks are currently cosmetic.
- The service worker caches Supabase reads (NetworkFirst, 5 min) — stale reads
  after writes are mitigated by optimistic UI (`preservePick`), not solved.
