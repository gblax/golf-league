// Compact player-facing winnings: "$1.2M" above a million, "$12,345" below.
// (Prize pools have their own formatter in App.jsx with a "TBA" fallback.)
export function formatWinnings(n) {
  const v = Math.round(n || 0);
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}
