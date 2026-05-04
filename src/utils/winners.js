// Compute the winner(s) for each tournament week from the players' picksByWeek data.
// A "winner" is the player(s) with the highest winnings for that week, where winnings > 0.
// Ties are preserved (multiple winners possible).
//
// Returns: { [week: number]: { winnerIds: Set<string>, winnerNames: string[], amount: number } }
export function computeWeeklyWinners(players) {
  const byWeek = {};

  (players || []).forEach(player => {
    (player.picksByWeek || []).forEach(week => {
      const amount = week.winnings || 0;
      if (amount <= 0) return;
      const entry = byWeek[week.week];
      if (!entry || amount > entry.amount) {
        byWeek[week.week] = {
          amount,
          winnerIds: new Set([player.id]),
          winnerNames: [player.name],
          golferNames: [week.golfer].filter(Boolean),
        };
      } else if (amount === entry.amount) {
        entry.winnerIds.add(player.id);
        entry.winnerNames.push(player.name);
        if (week.golfer) entry.golferNames.push(week.golfer);
      }
    });
  });

  return byWeek;
}

// Count weeks won by each player. Returns { [playerId]: number }.
export function computeWinCounts(weeklyWinners) {
  const counts = {};
  Object.values(weeklyWinners || {}).forEach(({ winnerIds }) => {
    winnerIds.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });
  return counts;
}
