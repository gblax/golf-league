// Helpers for the in-event live leaderboard (Phase 1).
//
// The backend (scripts/update_leaderboard.py) stores one snapshot per
// tournament in the `live_leaderboard` table. These helpers index that snapshot
// and resolve a league member's pick to its live row so the UI can show
// position/score/status during play.

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

// Mirror of scripts/slashgolf.py normalize_name: strip accents, lowercase,
// punctuation -> space, collapse whitespace, drop trailing name suffixes.
// Keeps the JS pick<->leaderboard match consistent with the Python scorer.
export function normalizeName(name) {
  if (!name) return '';
  const stripped = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const despaced = stripped.toLowerCase().replace(/[.,'"`‘’“”\-–—]/g, ' ');
  const tokens = despaced.split(/\s+/).filter(Boolean);
  while (tokens.length && NAME_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}

// Sortable rank from a Slash Golf position string. 'T4' -> 4, '1' -> 1;
// non-finishers sort to the bottom in a sensible order.
export function positionRank(position) {
  const pos = String(position || '').trim().toUpperCase();
  if (pos === 'CUT' || pos === 'MDF') return 9000;
  if (pos === 'WD') return 9001;
  if (pos === 'DQ') return 9002;
  const digits = pos.replace(/[^0-9]/g, '');
  if (digits) return parseInt(digits, 10);
  return 8000; // unknown / no position yet
}

// True when a thru value means the round is done. Slash Golf reports 'F' for
// a finished round and 'F*' when the player finished after a back-nine start.
export function isThruFinished(thru) {
  const t = String(thru || '').trim().toUpperCase();
  return t === 'F' || t === 'F*';
}

// Build fast lookups from a live_leaderboard snapshot row (or null/undefined).
export function indexLiveLeaderboard(snapshot) {
  const players = snapshot?.players || [];
  const byId = {};
  const byName = {};
  let currentRound = null;
  let roundInProgress = false;
  for (const p of players) {
    if (p.player_id) byId[String(p.player_id)] = p;
    const norm = normalizeName(p.player_name);
    if (norm && !(norm in byName)) byName[norm] = p;
    if (Number.isFinite(p.round)) currentRound = Math.max(currentRound ?? 0, p.round);
    if (!isOutStatus(p.status) && p.thru && !isThruFinished(p.thru)) roundInProgress = true;
  }
  return {
    byId,
    byName,
    players,
    cutLine: snapshot?.cut_line || null,
    eventStatus: snapshot?.event_status || '',
    roundStatus: snapshot?.round_status || '',
    updatedAt: snapshot?.updated_at || null,
    currentRound,
    roundInProgress,
    isEmpty: players.length === 0,
  };
}

// Resolve a pick to its live row (by Slash Golf id first, then normalized name).
export function lookupLive(index, { golferId, golferName } = {}) {
  if (!index) return null;
  if (golferId && index.byId[String(golferId)]) return index.byId[String(golferId)];
  const norm = normalizeName(golferName);
  return (norm && index.byName[norm]) || null;
}

// "Sat 9:14 PM EDT" style label for the freshness disclaimer.
export function formatUpdatedLabel(updatedAt) {
  if (!updatedAt) return '';
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

// True when a status means the golfer is out (no further scoring this week).
export function isOutStatus(status) {
  return status === 'cut' || status === 'withdrawn' || status === 'disqualified';
}

// Short uppercase label for an out status ('CUT' / 'WD' / 'DQ').
export function outLabel(status) {
  if (status === 'cut') return 'CUT';
  if (status === 'withdrawn') return 'WD';
  if (status === 'disqualified') return 'DQ';
  return '';
}
