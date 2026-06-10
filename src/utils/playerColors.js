// Stable per-player identity colors, shared by the standings, live
// leaderboard, members grid, and season-trends chart so a player is
// recognizable by color across surfaces. Assignment is by sorted member id
// (not rank) so a player keeps their color all season; it only reshuffles
// if league membership changes.
export const PLAYER_PALETTE = ['#6366f1', '#0ea5e9', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#f59e0b', '#84cc16', '#f97316', '#a855f7'];

export function buildPlayerColors(players) {
  const map = {};
  [...(players || [])]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .forEach((p, i) => { map[p.id] = PLAYER_PALETTE[i % PLAYER_PALETTE.length]; });
  return map;
}
