// Count, per league member, how many tournaments they correctly picked the winner of.
// A "correct pick" is when the player's picks_by_week entry has pickedWinner === true.
// Returns: { [playerId: string]: number }
export function computeCorrectPickCounts(players) {
  const counts = {};
  (players || []).forEach(player => {
    const n = (player.picksByWeek || []).filter(w => w.pickedWinner).length;
    if (n > 0) counts[player.id] = n;
  });
  return counts;
}
