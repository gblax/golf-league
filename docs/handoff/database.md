# Database

Full schema of the live Supabase project **"One And Done League"**
(ref `tdmnufmlemfszaaegczp`, Postgres 17, region us-west-2), pulled from the
running database on **2026-07-09** — not reconstructed from memory. Row counts
are a same-day snapshot to convey scale.

**Global facts**

- All 11 tables live in `public` and all have **RLS enabled**.
- One user-defined function + trigger in `public`:
  `tournaments_default_season()` / `tournaments_default_season` (BEFORE
  INSERT on `tournaments`, fills `season` from `tournament_date`). No views,
  **no Edge Functions**, and no Storage buckets in use.
- Two tracked migrations exist (`20260611012102_add_tee_timezone`,
  `20260907122254_add_tournament_season`). Everything else was applied by
  hand in the SQL editor; the `scripts/*.sql` files are the historical record
  of those changes (see "Schema history").
- The backend Python jobs use the service-role key and **bypass RLS**; several
  tables have no INSERT/UPDATE policies at all because only the backend writes
  them.

## Tables

### profiles (10 rows)

App user profiles, 1:1 with `auth.users` (same UUID). Renamed from `users`
(hence the index names `users_pkey` / `users_email_key`). The frontend inserts
a row here on signup — there is **no** `handle_new_user` trigger.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` (in practice set to `auth.users.id`) |
| email | text | NOT NULL, UNIQUE |
| name | text | NOT NULL |
| created_at | timestamptz | default `now()` |
| is_admin | boolean | default `false` — **legacy**, superseded by `league_members.role` |

Referenced by: `leagues.created_by`, `league_members.user_id`,
`picks.user_id`, `penalties.user_id`, `push_subscriptions.user_id`.

RLS: `profiles_select` SELECT `true` · `profiles_insert` INSERT
`auth.role() = 'authenticated'` · `profiles_update` UPDATE `auth.uid() = id`.

### leagues (2 rows)

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL |
| invite_code | text | NOT NULL, UNIQUE (8-char random string generated client-side) |
| created_by | uuid | FK → profiles.id |
| created_at | timestamptz | default `now()` |

RLS: `leagues_select` SELECT `true` · `leagues_insert` INSERT
`auth.uid() IS NOT NULL` · `leagues_update` UPDATE league commissioners only.

### league_members (10 rows)

Membership + role. UNIQUE `(league_id, user_id)`.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| league_id | uuid | NOT NULL, FK → leagues.id (ON DELETE CASCADE per creation script) |
| user_id | uuid | NOT NULL, FK → profiles.id |
| role | text | NOT NULL, default `'member'`, CHECK `role IN ('commissioner','member')` |
| joined_at | timestamptz | default `now()` |

Indexes: `(league_id)`, `(user_id)`, UNIQUE `(league_id, user_id)`.

RLS: `league_members_select` SELECT `true` · `league_members_insert` INSERT
`auth.uid() = user_id` (self-join via invite code) · `league_members_update` /
`league_members_delete` — commissioners of that league.

### tournaments (32 rows — the 2026 season, weeks 1–32)

**Shared across all leagues**: `league_id` is nullable and NULL in practice
(NULL = shared row; see `scripts/share-tournaments-golfers.sql`).

**Seasons live here.** `season` scopes a row to a year; the newest season in
the table is the active one and older seasons are read-only archives in the
app (see `docs/handoff/season-rollover.md`).

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL |
| season | integer | NOT NULL — season year (2026); defaulted from `tournament_date` by the `tournaments_default_season` trigger on insert (`scripts/add-tournament-season.sql`, 2026-09-07) |
| week | integer | NOT NULL — the league's own sequential week (1–32) **within a season**, not the PGA calendar week |
| tournament_date | date | NOT NULL — first-round day (Thursday) |
| completed | boolean | default `false` — set by the Monday scorer (or commissioner) |
| created_at | timestamptz | default `now()` |
| picks_lock_time | timestamptz | when picks lock (Thursday morning); UI + reminders read this |
| prize_pool | bigint | PGA purse in dollars; synced from Slash Golf |
| location | text | e.g. "Detroit, MI" |
| course | text | e.g. "Detroit Golf Club" |
| league_id | uuid | FK → leagues.id, **NULL = shared** (vestigial scoping) |
| winner_golfer_name | text | the actual PGA winner; drives trophy badges / recap "called it" |
| slashgolf_tourn_id | text | Slash Golf tournId (e.g. "021"); written by sync_schedule.py |
| tee_timezone | text | NOT NULL, default `'America/New_York'` — **data-only; nothing reads it yet** |

Indexes: `(league_id)`, `(slashgolf_tourn_id)`, `(season)`.

RLS: `tournaments_select` SELECT `auth.uid() IS NOT NULL` ·
`tournaments_write_commissioner` ALL — shared rows (`league_id IS NULL`)
writable by a commissioner of ANY league; league-scoped rows only by that
league's commissioner. (From `scripts/harden-rls.sql`.)

### picks (244 rows)

One row per member per tournament per league. UNIQUE
`(user_id, tournament_id, league_id)` — the app upserts with exactly that
`onConflict`.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | FK → profiles.id |
| tournament_id | uuid | FK → tournaments.id |
| golfer_name | text | NOT NULL — display name; the literal string `'No Pick'` marks a missed week |
| backup_golfer_name | text | optional backup (feature-flagged by league_settings.backup_picks_enabled) |
| winnings | integer | default 0 — **whole dollars**; the golfer's official prize money |
| was_backup_used | boolean | default false — **unused duplicate** of used_backup |
| created_at | timestamptz | default `now()` |
| penalty_amount | integer | default 0 — dollars added to the pot from this pick |
| penalty_reason | text | `'no_pick' \| 'missed_cut' \| 'withdrawal' \| 'disqualification'` |
| used_backup | boolean | default false — **never written by any current code** |
| league_id | uuid | NOT NULL, FK → leagues.id |
| golfer_id | text | Slash Golf playerId; exact-join key for scoring (nullable on legacy picks) |

Indexes: `(golfer_id)`, `(league_id)`, UNIQUE `(user_id, tournament_id, league_id)`.

RLS (loose — see known-issues.md): `picks_select` SELECT `true` ·
`picks_insert` INSERT `auth.uid() IS NOT NULL` · `picks_update` UPDATE
`auth.uid() IS NOT NULL`. Any authenticated user can technically write any
pick; the app relies on client-side discipline.

### available_golfers (334 rows)

The master pickable-golfer list. **Shared across leagues** (`league_id` NULL
in practice). `name` is globally UNIQUE.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL, UNIQUE |
| active | boolean | default true — the app only loads `active = true` |
| created_at | timestamptz | default `now()` |
| league_id | uuid | FK → leagues.id, NULL = shared (vestigial) |
| golfer_id | text | Slash Golf playerId; backfilled opportunistically by the pipeline |

Indexes: `(golfer_id)`, `(league_id)`, UNIQUE `(name)`.

RLS: `available_golfers_select` SELECT `auth.uid() IS NOT NULL` ·
`available_golfers_write_commissioner` ALL — same commissioner rule as
tournaments.

### league_settings (2 rows — one per league)

UNIQUE `(league_id)`. Created by the app when a league is created.

| Column | Type | DB default | App-created default |
|---|---|---|---|
| id | uuid PK | `gen_random_uuid()` | — |
| backup_picks_enabled | boolean | **true** | **false** |
| no_pick_penalty | integer | **500** | **10** |
| created_at / updated_at | timestamptz | `now()` | — |
| missed_cut_penalty | integer | 10 | 10 |
| withdrawal_penalty | integer | 10 | 10 |
| dq_penalty | integer | 10 | 10 |
| league_id | uuid, NOT NULL, UNIQUE, FK → leagues.id | — | — |
| buy_in_amount | integer | 50 | 50 |
| payout_first_pct | integer | 65 | 65 |
| payout_second_pct | integer | 25 | 25 |
| payout_third_pct | integer | 10 | 10 |

⚠️ Note the DB-default vs app-default disagreement on `backup_picks_enabled`
and `no_pick_penalty` (bolded). A row inserted outside the app (or a missing
settings row scored with `DEFAULT_LEAGUE_SETTINGS` in `update_results.py`,
which uses 10) behaves differently from the DB defaults. Flagged in
known-issues.md.

RLS: `league_settings_select` SELECT `true` · insert/update commissioners of
that league.

### penalties (2 rows)

Secondary penalty ledger written only by CommissionerTab flows. UNIQUE
`(user_id, tournament_id)` — **note: does NOT include league_id, but the app
upserts with `onConflict: 'user_id,tournament_id,league_id'`, which Postgres
rejects (42P10); the app swallows that error.** Standings never read this
table (they use `picks.penalty_amount`), so it is effectively vestigial.
See known-issues.md.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | FK → profiles.id |
| tournament_id | uuid | FK → tournaments.id |
| penalty_type | text | NOT NULL |
| amount | integer | default 10 |
| notes | text | |
| created_at | timestamptz | default `now()` |
| league_id | uuid | NOT NULL, FK → leagues.id |

Indexes: `(league_id)`, UNIQUE `(user_id, tournament_id)`.

RLS: `penalties_select` SELECT `true` · insert/update/delete commissioners of
that league.

### push_subscriptions (7 rows)

Web-push endpoints per user/browser. UNIQUE `(user_id, endpoint)`.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| user_id | uuid | NOT NULL, FK → profiles.id |
| endpoint | text | NOT NULL |
| p256dh | text | NOT NULL |
| auth | text | NOT NULL |
| created_at | timestamptz | default `now()` |
| notify_results | boolean | default true |
| notify_reminders | boolean | default true |

Index: `(user_id)`, UNIQUE `(user_id, endpoint)`.

RLS: all four verbs restricted to `auth.uid() = user_id`. (The Python sender
reads/deletes rows via service role; expired endpoints — push service returns
404/410 — are deleted automatically.)

### live_leaderboard (3 rows)

One snapshot row per tournament, upserted by `update_leaderboard.py`
(`on_conflict=tournament_id`). UNIQUE `(tournament_id)`.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| tournament_id | uuid | NOT NULL, UNIQUE, FK → tournaments.id |
| players | jsonb | NOT NULL, default `'[]'` — array of `{player_id, player_name, position, score, status, thru, round}` |
| cut_line | text | e.g. `"-2"` |
| event_status | text | raw Slash Golf status (`"In Progress"`, `"Official"`, …) |
| round_status | text | |
| updated_at | timestamptz | default `now()` — the UI's freshness label |

RLS: SELECT `auth.uid() IS NOT NULL` only. **No write policies** — writes are
service-role only, by design.

### tournament_field (519 rows)

The weekly entry list, fully replaced (delete + insert) by `sync_field.py`.
UNIQUE `(tournament_id, golfer_name)`.

| Column | Type | Constraints / default |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| tournament_id | uuid | NOT NULL, FK → tournaments.id |
| golfer_id | text | Slash Golf playerId |
| golfer_name | text | NOT NULL |
| status | text | active/cut/withdrawn/disqualified vocabulary |
| updated_at | timestamptz | default `now()` |

RLS: SELECT `auth.uid() IS NOT NULL` only; service-role writes only.

## Entity relationships (informal)

```
profiles ─┬─< league_members >─ leagues ──< league_settings (1:1)
          ├─< picks >─┬─ tournaments (shared, league_id NULL)
          │           └─ leagues
          ├─< penalties >─ tournaments / leagues
          └─< push_subscriptions

tournaments ──< live_leaderboard (1:1 snapshot)
tournaments ──< tournament_field (weekly entry list)
available_golfers (shared master list; golfer_id links names → Slash Golf IDs)
```

## Schema history (`scripts/*.sql` = the record)

Rough chronological order, per file comments and git history:

1. Initial tables (no script in repo — predates the convention).
2. `rename-users-to-profiles.sql` — `users` → `profiles` (fixes PostgREST
   conflict with `auth.users`); re-created open profile policies.
3. `migrate-users-to-supabase-auth.js` / `fix-auth-identities.js` — one-time
   auth migration of pre-Auth users.
4. `migrate-multi-league.sql` — leagues, league_members, `league_id` columns
   everywhere, backfill into a default league.
5. `share-tournaments-golfers.sql` — made tournaments/available_golfers
   shared (league_id nullable, NULL = shared); loosened their policies.
6. `harden-rls.sql` — re-tightened tournaments/available_golfers writes to
   commissioners (this IS the live state).
7. `create-push-subscriptions.sql`, `add-buyin-payout-columns.sql`,
   `add-tournament-winner.sql`.
8. `add-slashgolf-ids.sql` — `slashgolf_tourn_id`, `picks.golfer_id`,
   `available_golfers.golfer_id` + indexes.
9. `create-live-leaderboard.sql`, `create-tournament-field.sql`.
10. `add-tee-timezone.sql` — applied 2026-06-11 as tracked migration
    `add_tee_timezone`; per-event IANA timezones; column not yet read by code.
11. `enable-rls-policies.sql` and `disable-rls.sql` — see discrepancies below.
12. `add-tournament-season.sql` — applied 2026-09-07 as tracked migration
    `add_tournament_season`; `tournaments.season` + backfill + default
    trigger + index. The first schema change that gives the app a notion of
    seasons.

## Where code/docs and the live database disagree (verified)

1. **`scripts/enable-rls-policies.sql` describes stricter policies than are
   live.** The live picks policies are `SELECT true` / INSERT & UPDATE
   `auth.uid() IS NOT NULL`, and `leagues/league_members/league_settings/
   penalties/profiles` SELECT are `true` (visible without league membership,
   and — because policies apply to the `public` role and Supabase grants
   SELECT to `anon` — readable with just the anon key). The repo script's
   membership-scoped SELECTs and owner-scoped pick writes were evidently
   replaced at some point (likely to avoid recursive league_members policy
   errors); no script in the repo records the exact live policy set for those
   tables. `harden-rls.sql` DOES match the live tournaments/available_golfers
   policies.
2. **`penalties` unique key vs app upsert** — UNIQUE `(user_id,
   tournament_id)` in the DB; `onConflict: 'user_id,tournament_id,league_id'`
   in App.jsx (three call sites). The upsert errors (42P10) and the error is
   discarded.
3. **`migrate-multi-league.sql` sets `league_id NOT NULL` on tournaments and
   available_golfers** — later reversed by `share-tournaments-golfers.sql`;
   live columns are nullable. Read the two scripts together.
4. **`league_settings` DB defaults vs app-created defaults** — DB says
   `no_pick_penalty=500`, `backup_picks_enabled=true`; the app creates leagues
   with `10`/`false`. `update_results.py`'s fallback constant uses 10, but its
   per-league log line uses 500 as the dict-get fallback — cosmetic, but
   confusing.
5. **`add-slashgolf-ids.sql` mentions `scripts/sync_golfers.py`** — that
   script does not exist; `available_golfers.golfer_id` is actually populated
   by the backfill inside `update_results.py` / `sync_field.py`.

## Supabase advisor findings (2026-07-09)

- WARN: **Leaked-password protection is disabled** (Auth → enable HaveIBeenPwned
  checking). No other security or performance lints reported.
