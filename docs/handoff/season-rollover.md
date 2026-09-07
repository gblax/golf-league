# Season rollover

How a season ends in the app and how the next one starts. Written against
the live project on **2026-09-07**, the day the season model was added (all
32 tournaments of 2026 were complete).

## The model

- **`tournaments.season`** (integer year) is the season key. Added by
  `scripts/add-tournament-season.sql` (tracked migration
  `add_tournament_season`, applied 2026-09-07), backfilled from
  `tournament_date`, with a `BEFORE INSERT` trigger that defaults it from the
  date so any insert path — the schedule sync, the SQL editor — gets one.
- There is still no `seasons` table. A season is simply "every tournament
  with that year". Picks belong to a season through `tournament_id`.
- **The active season is the newest year in the table.** Loading next
  year's schedule *is* the rollover: the moment those rows exist the app
  moves to them, and the finished season becomes a read-only archive
  (season picker in the header, `viewSeason` in App.jsx).
- Everything the frontend computes is scoped to the season being viewed
  (`src/utils/seasons.js`): standings, the one-golfer-once filter, the
  schedule, the recap card, the pot. A member's 2026 picks neither count
  toward 2027 nor block golfers in 2027.
- **Season complete** = every tournament in the season has
  `completed = true`. The Pick tab is then replaced by the **Season** tab
  (`SeasonCompleteTab`): champion hero, podium with payouts, final
  standings, superlatives, the viewer's own season, and what's next. The
  Standings tab becomes "Final Standings" with payout chips; the League tab
  shows named payouts and a Champions honor roll.
- **Final results pending** = every tournament's active window has passed
  but at least one isn't marked complete. The header says so and the Admin
  tab tells the commissioner which week to close.

## End-of-season checklist (commissioner)

1. Make sure the last week is scored and marked complete. If the Monday
   `update-results` run was red, re-run it once the event is Official (or
   enter results by hand in Admin → Manage Results), then **Mark as
   Complete**. The champion page appears on its own once every week is
   closed.
2. Settle the payouts. League tab → Prize Pool & Payouts shows the amounts
   with names on them. Ties on winnings are flagged, not broken — that's
   the commissioner's call.
3. Remove members who aren't coming back (Admin → Members → Remove). The
   scorer inserts a `No Pick` row and charges the no-pick penalty to
   **every** league member each week, so a departed member would rack up
   penalties and pollute next year's standings. Their picks stay as history.
4. Change the buy-in, penalties or payout split in League Settings if the
   league is changing them.

## Loading the next season

The schedule comes from Slash Golf via the **Sync Tournament Schedule**
workflow (`.github/workflows/sync-schedule.yml`). It runs in GitHub Actions
because it needs the RapidAPI key, which the browser must never hold. The
Admin tab links straight to the workflow's dispatch page.

1. Actions → Sync Tournament Schedule → **Run workflow** with
   `dry_run = true`, `year = 2027`, `create = true`. Read the log: the "New
   tournaments to create" list, numbered by start date.
2. Run again with `dry_run = false`. Rows insert with `season = 2027`,
   `week` 1..N in date order, `picks_lock_time` = first-round tee-off
   (UTC), `prize_pool` from Slash Golf, `slashgolf_tourn_id` set.
   **The app switches to 2027 immediately** and picks open for week 1.
3. The PGA calendar has more events than the league plays (opposite-field
   weeks, the fall series). Delete the extras in the Supabase SQL editor —
   `DELETE FROM tournaments WHERE season = 2027 AND name IN (...)` — before
   anyone picks.
4. Run the workflow with `year = 2027`, `renumber = true` (dry-run first)
   so weeks run 1..N again. It refuses once the season has picks.
5. Review lock times. The sync sets `picks_lock_time` to Slash Golf's
   start timestamp; the 2026 rows used 07:00 UTC on the Thursday, well
   before any US tee time. To match that convention:
   `UPDATE tournaments SET picks_lock_time = tournament_date + interval '7 hours' WHERE season = 2027;`
   `course`, `location` and `tee_timezone` are not populated by the sync
   (the schedule endpoint doesn't carry them) — fill them in by hand if you
   want them shown.
6. Timing is up to you. Slash Golf usually has next year's schedule by
   December. Loading it early just means members see "Wk 1 · Sony Open"
   with a long countdown; the crons stay quiet until the opener is
   imminent (below). Until it's loaded, the champion page stays up.

## What resets and what carries over

| Resets with the new season | Carries over |
|---|---|
| standings, used golfers, the recap card, the live board and field | the league, its members and roles, invite code |
| the Season tab goes back to being the Pick tab | league settings (buy-in, penalties, payout split) |
| | `available_golfers` (shared master list) and push subscriptions |
| | every past season's picks and results (browsable as an archive) |

## The crons in the off-season

Every job is schedule-driven and short-circuits before touching Slash Golf
when there's nothing to do, so leaving them running year-round costs no API
budget:

- `update_leaderboard.py` / `sync_field.py` target the earliest unscored
  tournament — next year's opener, once loaded — but skip unless it is
  inside its play window (−1..+7 days from the first round) or field window
  (−8..+3 days). See `golf_common.days_from_start` and
  `scripts/test_play_window.py`.
- `update_results.py` finds no ended, incomplete tournament → green no-op.
  A tournament from a past season left incomplete would make every Monday
  run red until it's marked complete. That is on purpose.
- `send_reminders.py` only fires within 96 hours of a future lock.
- `sync_schedule.py` runs weekly against the current calendar year. In the
  autumn that is still the finished season: everything already matches,
  nothing is written.

## Known gaps

- The Champions honor roll only counts **current** members (it's computed
  from the same pick rows the standings use). A past champion who has since
  been removed won't appear.
- There is no in-app schedule editor. Pruning events, fixing lock times and
  adding course/location are SQL-editor jobs.
- Removing a member keeps their picks; re-adding them later (same invite
  code) restores their history in past seasons automatically.
- `tournaments.tee_timezone` is still unread by any code.
