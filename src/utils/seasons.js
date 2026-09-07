// Season helpers.
//
// A season is `tournaments.season` (the calendar year of the PGA Tour season;
// the FedExCup schedule runs January–August). The column was added in
// scripts/add-tournament-season.sql with a trigger that defaults it from the
// first-round date, but the frontend still tolerates rows without it — a
// database that hasn't run the migration, or a stale service-worker cache —
// by falling back to the year in tournament_date. The date is a plain
// "YYYY-MM-DD" string, so the year is sliced off it rather than parsed with
// `new Date()` (which would read a January 1st event as December 31st in US
// timezones).

export function seasonOf(tournament) {
  if (!tournament) return null;
  const explicit = Number(tournament.season);
  if (tournament.season != null && Number.isFinite(explicit)) return explicit;
  const year = parseInt(String(tournament.tournament_date || '').slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

// Distinct seasons present in a tournament list, newest first. The first
// entry is the active season: loading next year's schedule IS the rollover.
export function listSeasons(tournaments) {
  const seen = new Set();
  (tournaments || []).forEach(t => {
    const s = seasonOf(t);
    if (s != null) seen.add(s);
  });
  return [...seen].sort((a, b) => b - a);
}

export function tournamentsInSeason(tournaments, season) {
  return (tournaments || []).filter(t => seasonOf(t) === season);
}

// A season is over once every one of its tournaments has been scored and
// marked complete (by the Monday scorer or the commissioner). "Every window
// has passed" is deliberately not enough: the final week's results may still
// be pending, and a champion shouldn't be crowned on provisional numbers.
export function isSeasonComplete(tournaments) {
  return (tournaments || []).length > 0 && tournaments.every(t => !!t.completed);
}

// When a tournament's "active window" ends: the Monday 10:00 UTC (5am ET)
// after its lock time (fallback: first-round date). Until then the app stays
// on that week so results can be reviewed before advancing. Shared by
// getCurrentTournament in App.jsx and the season-over checks here.
export function activeWindowEnd(tournament) {
  const anchor = tournament?.picks_lock_time || tournament?.tournament_date;
  if (!anchor) return null;
  const anchorDate = new Date(anchor);
  if (Number.isNaN(anchorDate.getTime())) return null;
  const dayOfWeek = anchorDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 4=Thu
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7; // days from anchor to next Monday
  const windowEnd = new Date(anchorDate);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + daysUntilMonday);
  windowEnd.setUTCHours(10, 0, 0, 0);
  return windowEnd;
}

// Every tournament's window has passed but at least one isn't marked
// complete — the season is over on the calendar but its final results are
// still pending (a red scoring run, or a week the commissioner hasn't closed).
export function isSeasonAwaitingFinal(tournaments, now = new Date()) {
  const list = tournaments || [];
  if (list.length === 0 || isSeasonComplete(list)) return false;
  return list.every(t => {
    const end = activeWindowEnd(t);
    return end ? now > end : !!t.completed;
  });
}
