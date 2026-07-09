# Business logic — One & Done rules as implemented

What the code actually does (App.jsx, the tab components, and
`scripts/update_results.py`), not the rules as anyone remembers them.
Verified 2026-07-09.

## The game

- Each league member picks **one golfer per tournament week**.
- A golfer may be used **once per season** per member (per league).
- The member earns the golfer's **official PGA prize money** for that week.
- Season standings rank by **total winnings**; the season pot (buy-ins +
  accumulated penalties) pays the top 3 by configured percentages.

## Season structure

- The season is the `tournaments` table: **32 rows, `week` 1–32** for 2026
  (Sony Open → BMW Championship). There is no "season" entity — one season is
  simply the current contents of the table. No code handles multiple seasons
  or archiving yet.
- Tournaments are **shared across all leagues** (`league_id NULL`). Both
  production leagues play the same schedule; picks/penalties/settings are
  league-scoped.
- `week` is the league's own sequence, not the PGA calendar week.
  (`sync_schedule.py --create` inserts events with Slash Golf's calendar
  `weekNumber` — a known mismatch to review whenever `--create` is used.)
- **"Current tournament"** (`getCurrentTournament` in App.jsx): the first
  tournament in week order whose "active window" hasn't ended. The window
  anchor is `picks_lock_time` (fallback `tournament_date`); the window ends
  the following **Monday 10:00 UTC (5am ET)**. Until then the app stays on
  the just-played week so results can be reviewed; after that it advances.
  If every tournament's window has passed, it falls back to the last row.

## Picks

**Submission** (`handleSubmitPick`, App.jsx):

- Requires a primary golfer; backup must differ from primary. Backup input
  only exists when `league_settings.backup_picks_enabled` is true.
- Blocked when `now >= picks_lock_time` (client-side check + the whole tab
  flips to watch mode).
- Upserts into `picks` on `(user_id, tournament_id, league_id)` with
  `winnings: 0` and a `golfer_id` resolved from this week's field first
  (`tournament_field`), then the master list (`available_golfers`), matched
  by normalized name. Repicking simply overwrites the same row.
- The UI updates optimistically (the just-picked golfer is marked used, the
  replaced golfer is freed) because the service worker may serve a stale
  read for up to 5 minutes after the write.

**Locking:**

- `tournaments.picks_lock_time` (timestamptz, Thursday morning ET) is the
  single lock signal. A live countdown shows in the header; urgency styling
  (red, pulsing) only when the user hasn't picked and <10h remain.
- After lock: submission blocked, the pick form is replaced by a "watch
  mode" card (your golfer + live status), and **other members' current-week
  picks unseal**. Pre-lock, opponents' picks render as a "Sealed" chip — you
  can see *that* they picked, never *what*.
- ⚠️ Enforcement is **client-side only**. RLS has no time predicate, so a
  crafted API request could insert/update a pick after lock. Accepted risk
  for a friends league; see known-issues.md.

**One-time golfer usage:**

- `userPicks` = all of the member's non-"No Pick" `golfer_name`s in this
  league, across the whole season. The pick dropdowns filter these out
  (`availableForPick`), so a used golfer can't be selected again. The season
  scorecard on the Picks tab shows which week each golfer was spent on and
  what he earned.
- Usage is keyed by **exact golfer_name string** within one league; usage in
  one league does not affect another.
- ⚠️ Also **client-side only** — no DB constraint prevents reusing a golfer.
  The commissioner is the backstop.

**Field backstop (advisory):**

- Once `tournament_field` is synced (Tue/Wed), dropdowns sort this week's
  confirmed field first and tag off-field golfers. Picking an off-field
  golfer requires ticking an explicit "pick at your own risk" acknowledgement
  — it is allowed, because fields firm up late and the list is advisory.

**Backup picks:**

- Stored (`backup_golfer_name`) and displayed, but **the scorer never uses
  them**. `used_backup` / `was_backup_used` are never set by any current
  code. If the primary golfer WDs before teeing off, nothing automatic
  happens — the commissioner would adjust manually. (Feature gap, flagged.)

## Scoring (Monday, `scripts/update_results.py`)

- Target week comes from **our schedule**: the most recent
  `completed=false` tournament whose start + 3d23h59m has passed. Off week →
  clean exit.
- Results come from Slash Golf `/leaderboard` + `/earnings` joined on
  `playerId`. Picks match by `golfer_id` (exact) first, then deterministic
  normalized-name fallback (accents stripped, punctuation → space, suffixes
  dropped). **No fuzzy matching** — an unmatched pick is left at $0 with an
  `error: not_found` note in the run log for manual follow-up.
- Safety gates (each aborts the run with a non-zero exit → red Actions run,
  unless `--force`):
  1. tournament can't be mapped to a Slash Golf event;
  2. event status isn't `Official` (never score a live/suspended event);
  3. the entire field shows $0 earnings (final results not posted yet);
  4. zero real picks matched (wrong event / bad mapping).
- Winnings: `picks.winnings = int(round(prize_money))` — integer dollars.
  Players with position/status CUT, WD, DQ, or MDF are forced to **$0**
  regardless of any stray earnings value in the payload.
- The **winner** is the row with position exactly `"1"` (not `"T1"`) and
  active status → written to `tournaments.winner_golfer_name`. Drives the
  standings trophy badge, schedule winner line, and the recap card's
  "called it" confetti.
- `--complete` (the scheduled default) marks the tournament `completed=true`
  afterward, which advances scoring eligibility and the recap card.
- A "Results posted" web push goes to all subscriptions with
  `notify_results=true`.

## Penalties

Per-league amounts from `league_settings`, applied by the scorer per pick:

| Trigger | Settings column | Detection |
|---|---|---|
| No pick submitted | `no_pick_penalty` | scorer inserts a `golfer_name='No Pick'` row for every league member without one, then penalizes it |
| Missed cut | `missed_cut_penalty` | status `cut` or position `CUT` (MDF counts as cut) |
| Withdrawal | `withdrawal_penalty` | status `withdrawn` / position `WD` |
| Disqualification | `dq_penalty` | status `disqualified` / position `DQ` |

- Written onto the pick itself: `penalty_amount` + `penalty_reason`.
- **Existing penalties are preserved**: if a pick already carries
  `penalty_amount > 0` with a reason (e.g. commissioner entered it manually),
  the scorer keeps it rather than recalculating.
- Penalties are **not subtracted from winnings**. They accumulate into the
  prize pot (see below) and are shown as a separate column/marker in the UI.
- Leagues without a settings row score with fallbacks of $10 across the board
  (`DEFAULT_LEAGUE_SETTINGS`).
- The separate `penalties` table is a secondary ledger written only by
  commissioner flows — and those writes currently fail silently (conflict
  target mismatch, see known-issues.md). Nothing reads it. Source of truth is
  `picks.penalty_amount`.

## Standings & purse

- **Standings** (App.jsx → StandingsTab): per member, `winnings` = sum of
  `picks.winnings` in this league; `penalties` = sum of `picks.penalty_amount`.
  Sort: winnings **desc**, ties by name **asc**. Rank movement arrows compare
  against the standings recomputed *without* the latest completed week.
- **Purse** (LeagueInfoTab):
  `totalPot = (memberCount × buy_in_amount) + Σ penalties`,
  paid `payout_first_pct / payout_second_pct / payout_third_pct`
  (defaults 65/25/10, `Math.round` each). CommissionerTab warns when the
  three percentages don't total 100 and blocks saving >100.
- Money is displayed as whole dollars; ≥$1M renders as `$1.2M`
  (`formatWinnings` / `formatPrizePool`).

## Commissioner powers (CommissionerTab, role `commissioner`)

- Edit league settings (penalty amounts, backup toggle, buy-in, payout split).
- Enter/override results for any tournament & member: set winnings, set a
  penalty type (amount derived from settings), create a `No Pick` row for a
  member who didn't submit, clear penalties.
- Set/clear `winner_golfer_name` manually.
- Mark a tournament complete (themed confirm dialog) — the manual fallback
  when the scorer refused to (e.g. it couldn't verify final results).
- Add golfers to the shared `available_golfers` list (LeagueInfoTab; unique
  by name; affects every league).

## Notifications

- **Pick reminders** (Wed 17:00 & 23:00 UTC): target the soonest tournament
  whose deadline (`picks_lock_time`, fallback `tournament_date`) is in the
  future **and** within 96h; skip members who already picked or disabled
  `notify_reminders`. A tournament already locked is never reminded for
  (that was a real bug, fixed — see the long docstring in
  `send_reminders.py`).
- **Results** (Monday, after applying): to everyone with
  `notify_results=true`.
- Delivery cleans up dead subscriptions (push service 404/410 → row deleted).

## Edge cases summary

| Case | Behavior |
|---|---|
| Member never submits | Scorer inserts `'No Pick'` row, applies `no_pick_penalty`, $0 winnings |
| Golfer misses cut / WD / DQ / MDF | $0 winnings + corresponding penalty on the pick |
| Golfer not on final leaderboard (legacy name-only pick, typo) | $0, logged as unmatched, fix manually via CommissionerTab |
| Tournament unmapped / results not final / $0 field / zero matches | Run aborts loudly (red CI), nothing written, retry after Official or fix mapping |
| Off week (nothing ended & unscored) | Scorer exits green, no-op |
| Picking an off-field golfer | Allowed with explicit risk acknowledgement |
| Changing a pick before lock | Same-row upsert; old golfer freed, new one marked used |
| Two leagues | All shared data (tournaments, golfers, live board, field) identical; picks/penalties/settings/standings independent; scorer processes both in one run |
| Backup golfer needed | **Nothing automatic** — commissioner intervention only |
