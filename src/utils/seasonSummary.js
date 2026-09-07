import { computeCorrectPickCounts } from './winners';

// Everything the season-complete landing needs, derived from the standings
// the app already computes (players with picksByWeek) and the season's
// tournaments. Pure so it can be unit-smoke-tested without React.
//
// Standings are expected pre-sorted (winnings desc, name asc) — the same
// `sortedStandings` the Standings tab renders — so index 0 is the champion.

function bestWeekOf(player) {
  let best = null;
  (player.picksByWeek || []).forEach(w => {
    if ((w.winnings || 0) > (best?.winnings || 0)) {
      best = { week: w.week, tournamentName: w.tournamentName, golfer: w.golfer, winnings: w.winnings || 0 };
    }
  });
  return best;
}

export function buildSeasonSummary({ standings, tournaments, currentUserId }) {
  const players = standings || [];
  const winCounts = computeCorrectPickCounts(players);
  const champion = players[0] && (players[0].winnings || 0) > 0 ? players[0] : null;
  const championTied = !!champion && players.filter(p => (p.winnings || 0) === champion.winnings).length > 1;

  // Biggest single week by any member.
  let bestWeek = null;
  players.forEach(p => {
    const b = bestWeekOf(p);
    if (b && b.winnings > (bestWeek?.winnings || 0)) bestWeek = { ...b, playerId: p.id, name: p.name };
  });

  // Most tournament winners called (ties resolve to the higher-ranked member).
  let mostWinners = null;
  players.forEach(p => {
    const n = winCounts[p.id] || 0;
    if (n > (mostWinners?.count || 0)) mostWinners = { playerId: p.id, name: p.name, count: n };
  });

  // The golfer who earned the league the most across every member's picks.
  const byGolfer = {};
  players.forEach(p => (p.picksByWeek || []).forEach(w => {
    if (!w.golfer) return;
    const g = byGolfer[w.golfer] || (byGolfer[w.golfer] = { golfer: w.golfer, winnings: 0, picks: 0 });
    g.winnings += w.winnings || 0;
    g.picks += 1;
  }));
  const topGolfer = Object.values(byGolfer).sort((a, b) => b.winnings - a.winnings || a.golfer.localeCompare(b.golfer))[0] || null;

  const meIndex = players.findIndex(p => p.id === currentUserId);
  const mePlayer = meIndex >= 0 ? players[meIndex] : null;
  const me = mePlayer
    ? {
        rank: meIndex + 1,
        name: mePlayer.name,
        winnings: mePlayer.winnings || 0,
        penalties: mePlayer.penalties || 0,
        winnersCalled: winCounts[mePlayer.id] || 0,
        bestWeek: bestWeekOf(mePlayer),
        isChampion: !!champion && champion.id === mePlayer.id,
      }
    : null;

  const list = tournaments || [];
  return {
    champion,
    championTied,
    podium: players.slice(0, 3),
    winCounts,
    bestWeek: bestWeek && bestWeek.winnings > 0 ? bestWeek : null,
    mostWinners,
    topGolfer: topGolfer && topGolfer.winnings > 0 ? topGolfer : null,
    me,
    weeks: list.length,
    weeksCompleted: list.filter(t => t.completed).length,
    memberCount: players.length,
  };
}
