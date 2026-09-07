# Known issues, tech debt & fragile areas

Everything a new agent should know before trusting the code. Each item says
how it was verified. Severity: 🔴 can lose/corrupt data or money,
🟠 will bite during normal work, 🟡 cosmetic/latent.

## 🔴 Security & enforcement gaps (accepted-risk for a friends league, but real)

1. **Pick lock is client-side only.** RLS has no time predicate; any
   authenticated member could insert/update a pick after `picks_lock_time`
   via the REST API. Verified: live `picks_update` policy is
   `auth.uid() IS NOT NULL`.
2. **Any authenticated user can write ANY pick.** The live `picks_insert` /
   `picks_update` policies check only that you're logged in — not that
   `user_id = auth.uid()`. A member could edit an opponent's pick. The repo's
   `scripts/enable-rls-policies.sql` shows the stricter intended policies;
   they are NOT what's live (see database.md discrepancy #1).
3. **Broad readability, including to `anon`.** `profiles` (names + emails),
   `leagues` (invite codes!), `league_members`, `league_settings`, `picks`,
   `penalties` have `SELECT USING (true)` — with the anon key alone you can
   read them without logging in. Leaked invite codes let strangers join.
   `tournaments`, `available_golfers`, `live_leaderboard`, `tournament_field`
   at least require an authenticated session.
4. **One-golfer-once is not enforced anywhere server-side.** Purely a UI
   filter (`availableForPick`). No constraint/trigger prevents reuse.
5. **Supabase advisor:** leaked-password protection (HaveIBeenPwned check) is
   disabled on Auth.
6. **`scripts/disable-rls.sql` exists** and would open the whole DB to the
   anon key if ever run against production. It's clearly labeled dev-only —
   keep it that way.

## 🔴 Auto-merge to production

`.github/workflows/auto-merge.yml` merges **any push to a `claude/**` branch
straight into `main`** (no PR, no review), and main auto-deploys to
production via Vercel. This was the previous assistant workflow. With the
move to a different agent this is now a booby trap: an agent (or human)
pushing to a leftover `claude/...` branch ships to production instantly.
Decide: delete the workflow, or update the prefix to the new agent's branch
naming — see the gap report. (The season-model branch
`claude/league-landing-page-redesign-kwka6r` is excluded by name in the
workflow so it could go through a PR; that exclusion can be removed once
the branch is gone.)

## 🟠 Broken-but-masked: `penalties` table writes

- The DB unique constraint is `(user_id, tournament_id)`; all three App.jsx
  upserts pass `onConflict: 'user_id,tournament_id,league_id'`. Postgres
  rejects that (42P10: no matching unique constraint) and **none of the three
  call sites check the returned error** — commissioner penalty saves to this
  table fail silently.
- Nothing reads `penalties` (standings/pot use `picks.penalty_amount`), so
  users never notice. The table holds 2 stale rows.
- Fix options: add league_id to the unique constraint + keep the upserts, or
  drop the table and the dead writes. Until then treat it as write-broken.

## 🟠 Backup picks are collected but never used

`league_settings.backup_picks_enabled` gates a backup-golfer input; the value
is stored (`picks.backup_golfer_name`) and displayed — but
`update_results.py` never substitutes the backup when the primary WDs or
misses the field, and `used_backup` / `was_backup_used` (duplicate columns)
are never written. Either implement substitution in the scorer or stop
advertising the feature. (Both live leagues currently have the flag OFF —
verified 2026-07-09 — so nothing user-visible is broken today.)

## 🟠 Defaults disagree (DB vs app vs scorer)

`league_settings` DB defaults: `no_pick_penalty=500`,
`backup_picks_enabled=true`. App-created leagues: `10` / `false`. Scorer
fallback (`DEFAULT_LEAGUE_SETTINGS`, used when a league has no settings row):
`10`, while its log line's inline fallback prints 500. Harmless today (both
leagues have real rows) but any new insert path inherits the surprising 500.
Pick one set of defaults and align the three places.

## 🟠 App.jsx is a ~2,000-line god component

All state, all handlers, all data loading. It works and it's the established
pattern (see conventions.md), but merge conflicts and accidental coupling are
the tax. `docs/DESIGN_EVALUATION.md` finding 1.1 (dead duplicate extracted
components) has since been fixed — App.jsx now imports the extracted
screens/modals — but the file remains the hot spot. Prefer extracting more
logic when you're already touching it; don't attempt a big-bang refactor.

## 🟠 Client clock & timezone assumptions

- Lock enforcement and countdowns compare against the **user's device
  clock** — a wrong clock shows wrong lock state (writes are still only as
  safe as issue #1 above).
- `getCurrentTournament` hardcodes "window ends Monday 10:00 UTC" and the UI
  hardcodes the "Picks reopen Mon 5:00 AM ET" label — both are EST-pinned
  (off by an hour during EDT, like the crons, which is documented and
  accepted).
- Lock-time labels format the timestamp in the device's local zone but
  append a hardcoded "ET".
- `tournaments.tee_timezone` was added (2026-06-11) to eventually fix
  tee-time-derived deadlines for overseas events — **no code reads it yet**.

## 🟡 Data & pipeline quirks

- **Season rollover** (specified 2026-09-07, see `season-rollover.md`):
  `tournaments.season` scopes everything and the newest season is active.
  Remaining rough edges: pruning events / fixing lock times is SQL-editor
  work; the Champions honor roll only counts current members; ties for
  first are flagged, not broken.
- **`sync_schedule.py --create` lock times:** `picks_lock_time` defaults to
  Slash Golf's start timestamp, not the 07:00 UTC Thursday convention the
  2026 rows use. Review (and `UPDATE`) after loading a season. Week numbers
  are now sequential by date; `--renumber` closes gaps after pruning.
  (Scheduled runs never use `--create`.)
- **US Open name mapping** needed a special-case (initialism collapsing) —
  `tournament_names_match` handles "US Open" ↔ "U.S. Open"; be careful
  editing that function (tests cover it).
- **Live leaderboard is snapshot-based, not live.** 2 snapshots per round
  evening; the UI's "updated" label is the only staleness signal. Users
  sometimes read it as realtime.
- **SW caching:** Supabase GETs cached NetworkFirst for 5 min. After a write
  on a flaky network, reads may be stale — pick flow compensates
  (optimistic + `preservePick`), other writes just reload and may briefly
  show old data. The header refresh button nukes caches.
- **`available_golfers` is global** (unique on name, shared `league_id NULL`)
  — a commissioner adding/deactivating a golfer affects every league.
- **Legacy columns:** `profiles.is_admin` (superseded by
  `league_members.role`), `picks.was_backup_used`/`used_backup`,
  `tournaments.league_id` + `available_golfers.league_id` (vestigial,
  NULL = shared), `tournaments.tee_timezone` (unread).
- **`add-slashgolf-ids.sql` references `scripts/sync_golfers.py`** which was
  never committed; golfer_id backfill actually happens inside
  `update_results.py`/`sync_field.py`.
- **`http-ece` (pywebpush dep) fails to build** without a C toolchain —
  fine in CI (ubuntu), annoying locally; tests deliberately need only
  `requests` + `python-dotenv`.
- **Only one Supabase-tracked migration exists**; the rest of schema history
  is hand-run scripts. Drift between `scripts/*.sql` and live is possible —
  the live-vs-repo RLS mismatch (database.md) is the proven instance.

## 🟡 Frontend polish debt

`docs/DESIGN_EVALUATION.md` is a full audit (a11y, consistency, dark-mode
contrast). Its three fix batches were implemented, but re-check before doing
UI work — some quoted line numbers predate later edits. No JS tests and no
linter means visual regressions are caught by eyeballs only.

## Operational gotchas (memorize these before touching the pipeline)

1. Never run a pipeline script with `--apply` against production casually —
   dry-run first, read the report.
2. A RED `update-results` run is usually correct behavior (results not
   final / mapping missing), not an outage. Re-run after the event goes
   Official, or fix `slashgolf_tourn_id` via `sync_schedule.py`.
3. `--force` on the scorer bypasses ALL gates — it can zero every pick if
   pointed at the wrong event. Last resort only.
4. Rotating VAPID keys invalidates all existing push subscriptions and must
   be synchronized across Vercel + GitHub secrets.
5. Free-tier Slash Golf budget (~20 req/day per code comments) — manual
   dispatch re-runs draw from the same pool as the crons.
