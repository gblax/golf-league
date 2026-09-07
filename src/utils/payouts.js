// Season pot and payout split, shared by the League Info tab, the standings
// payout chips, and the season-complete landing so all three agree.
//
//   totalPot = members × buy-in + Σ penalties (penalties feed the pot, they
//   are never subtracted from a member's winnings)
//   paid 1st / 2nd / 3rd by the league's configured percentages, each
//   Math.round-ed independently (matches the original League Info math).

export const DEFAULT_PAYOUT_PCTS = [65, 25, 10];

export function computePayouts(leagueSettings, players) {
  const settings = leagueSettings || {};
  const buyIn = settings.buy_in_amount ?? 50;
  const pcts = [
    settings.payout_first_pct ?? DEFAULT_PAYOUT_PCTS[0],
    settings.payout_second_pct ?? DEFAULT_PAYOUT_PCTS[1],
    settings.payout_third_pct ?? DEFAULT_PAYOUT_PCTS[2],
  ];
  const numPlayers = (players || []).length;
  const totalPenalties = (players || []).reduce((sum, p) => sum + (p.penalties || 0), 0);
  const totalPot = numPlayers * buyIn + totalPenalties;
  const amounts = pcts.map(pct => Math.round(totalPot * pct / 100));
  return { buyIn, numPlayers, totalPenalties, totalPot, pcts, amounts };
}
