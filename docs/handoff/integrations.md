# Integrations

Every external system this project touches, how it's wired, and how it fails.
Verified against code, git history, GitHub workflows, and the live Supabase /
Vercel projects on 2026-07-09.

## Slash Golf "Live Golf Data" (RapidAPI) — the PGA data source

- **Host:** `live-golf-data.p.rapidapi.com` (override with `RAPIDAPI_HOST`).
  Auth via `x-rapidapi-key` header (`RAPIDAPI_KEY` env). `orgId=1` = PGA Tour
  (override with `ORG_ID`; centralized so Korn Ferry/DP World would be a
  parameter change).
- **Endpoints used** (client + parsers in `scripts/slashgolf.py`, pure and
  unit-tested offline):
  - `GET /schedule?orgId&year` — season events: names, dates, purses,
    `tournId`s. Does NOT carry course/location.
  - `GET /leaderboard?orgId&tournId&year` — per-player position/score/status
    (+ entry list before play, cut lines during). **No prize money.**
  - `GET /earnings?orgId&tournId&year` — prize money keyed by `playerId`.
    A full final result = leaderboard + earnings joined on `playerId`.
- **Payload quirk:** values arrive as MongoDB extended JSON
  (`{"$numberInt": "5"}`, `{"$date": …}`) — everything goes through
  `unwrap()`/`to_float()`/`to_int()`. Positions/scores stay strings
  (`"T4"`, `"-7"`, `"E"`).
- **Stable IDs are the point:** `playerId` (→ `picks.golfer_id`,
  `available_golfers.golfer_id`, `tournament_field.golfer_id`) and `tournId`
  (→ `tournaments.slashgolf_tourn_id`) enable exact joins. The predecessor
  (ESPN scraping with fuzzy name matching) was replaced precisely because it
  needed a "catastrophic match rate" gate to survive schema drift.
- **Rate budget:** code comments assume the **free tier ≈ 20 requests/day**.
  Weekly usage by design: 1 (schedule) + ~4 (field) + ~8 (live snapshots) +
  2 (Monday scoring) ≈ 15/week — comfortable, but manual dispatches and
  re-runs eat into the same budget. Do not add API calls per user action.
- **Failure modes** (`_get()` raises distinct errors): 401/403 = key
  missing/invalid/not subscribed; 429 = rate-limited; a sandbox/proxy
  "allowlist" block is detected and reported as such (the key never got
  tested). No retry logic — a failed cron run just goes red and runs again
  next schedule or by hand.

## GitHub Actions — all automation lives here

Five cron workflows + one merge workflow in `.github/workflows/`. All crons
are UTC, deliberately pinned to Eastern **Standard** Time (comments in each
file); during EDT everything lands an hour later local. GitHub cron firing is
routinely delayed by minutes-to-hours — the schedules were chosen to tolerate
that (see the long comment in `pick-reminders.yml`).

| Workflow | Cron (UTC) | Script & flags | Secrets used |
|---|---|---|---|
| `sync-schedule.yml` | Wed 13:00 | `sync_schedule.py --apply` (never `--create` on schedule) | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAPIDAPI_KEY |
| `sync-field.yml` | Tue+Wed 14:00, 22:00 | `sync_field.py --apply` | same |
| `update-leaderboard.yml` | Fri/Sat/Sun/Mon 00:00, 02:00 | `update_leaderboard.py --apply` | same |
| `update-results.yml` | Mon 09:00 | `update_results.py --apply --complete` | same + VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT |
| `pick-reminders.yml` | Wed 17:00, 23:00 | `send_reminders.py` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_* |
| `auto-merge.yml` | on push to `claude/**` | merges the pushed branch into `main` → **production deploy** | (contents: write) |

Details that matter:

- Every data workflow has `workflow_dispatch` with a `dry_run` input;
  `update-results` also has `mark_complete` and `force` inputs;
  `sync-schedule` has `create`.
- Workflows pass the service key as **both** `SUPABASE_SERVICE_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY`; `golf_common.py` accepts either name.
- Python deps install from pinned `scripts/requirements.txt` on Python 3.11.
- `update_results.py` exits non-zero when an ended tournament was due but
  couldn't be scored → the run shows **red** on purpose. An off week is green.
- ⚠️ `auto-merge.yml` means a push to any `claude/**` branch is effectively a
  push to production. Revisit this when switching agents/branch prefixes.

## Supabase

- Project "One And Done League" (`tdmnufmlemfszaaegczp`), us-west-2, PG 17.
- Three access paths:
  1. **Browser** — anon key + Supabase Auth session; RLS enforces access.
     Email/password auth only (no OAuth providers wired in the UI).
     Password reset via `resetPasswordForEmail(redirectTo: origin)` →
     `PASSWORD_RECOVERY` auth event → ResetPasswordScreen.
  2. **Python scripts** — service-role key, bypasses RLS entirely.
  3. **SQL editor** — manual schema changes, recorded as `scripts/*.sql`.
- No Edge Functions, no Storage, no Realtime subscriptions (data refresh is
  polling/visibility-based).
- PostgREST serialization gotcha: whole-dollar floats must be coerced to int
  before writing integer columns (pinned `postgrest==2.31.0`; see
  `requirements.txt` comment and `update_pick_winnings`).

## Vercel

- Team "Greg Brown's projects" → project **golf-league**
  (`prj_HPcxyV8KaZROljIy0X5TCDltsRan`), framework `vite`, Node 24.
- Git integration deploys `main` → production **`1anddone.vercel.app`**.
  No `vercel.json`; no serverless functions; purely static output of
  `npm run build` (SPA with hash navigation, so no rewrite rules needed).
- Build-time env vars must exist in Vercel: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` (names in
  environment.md). A missing `VITE_VAPID_PUBLIC_KEY` doesn't break the build
  — push subscription just fails at runtime with "not configured".

## Web Push (VAPID)

- Browser side: `vite-plugin-pwa` generates the SW; `public/sw-push.js`
  (imported via `workbox.importScripts`) handles `push` +
  `notificationclick`. Subscription upserts into `push_subscriptions` with
  the user's per-device endpoint/keys; per-type toggles `notify_results` /
  `notify_reminders` in NotificationSettingsModal.
- Sender side: `pywebpush` in `golf_common.send_web_push()`, VAPID private
  key + subject from env. 404/410 responses delete the dead subscription row.
- Failure mode: if VAPID keys are absent in a workflow, results/reminder
  pushes fail (results push is wrapped in try/except — scoring still
  completes; the reminder job just errors).

## Gone but historically real (so old docs/memories don't mislead you)

- **Gemini (Google LLM):** once parsed leaderboard HTML/JSON during the ESPN
  era; removed in commit `46787e1` ("Replace Gemini leaderboard parsing with
  direct ESPN JSON walk"). **No LLM is used anywhere in the current system.**
- **ESPN scraping:** replaced by Slash Golf in commit `f8f2833`; the fuzzy
  name matcher and match-rate safety gate were deleted with it.
- **Make.com:** **no trace in any commit, workflow, or the DB schema.** All
  scoring automation is GitHub Actions. If a Make.com scenario ever existed,
  it was configured entirely outside this repo (e.g. hitting the Supabase
  REST API with a service key) and would be invisible from here — confirm
  with the league operator and decommission its credentials if so.

## Silent-failure checklist (things that break without an obvious alarm)

| Risk | Symptom | Where to look |
|---|---|---|
| `tournaments.slashgolf_tourn_id` missing/wrong | Monday scoring aborts (red run), live board & field never populate for that week | run `sync_schedule.py` dry-run; check the mapping report |
| Field sync before tee times post | `tournament_field` empty → pick screen shows no in-field tags (harmless, by design) | Actions log: "Field not confirmed yet" |
| Live snapshots stale (cron missed/rate-limited) | Live board shows old scores with an old "Updated …" label | `live_leaderboard.updated_at`; Actions history |
| Push keys rotated in one place only | Reminders/results notifications silently stop for everyone | Actions secrets vs `VITE_VAPID_PUBLIC_KEY` in Vercel — the public key must be the SAME pair as the private key |
| Service worker caching | Users see up-to-5-min-old data after a write; hard refresh button exists in the header | `vite.config.js` runtimeCaching |
| `penalties` table writes | Fail silently (42P10), nothing user-visible (standings don't read it) | known-issues.md |
| Auto-merge workflow | A `claude/**` branch push deploys to production without review | `.github/workflows/auto-merge.yml` |
| GitHub cron drift | Jobs fire late (occasionally hours) — reminders/snapshots shift accordingly | workflow comments; Actions history |
