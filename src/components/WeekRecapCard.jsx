import React from 'react';
import { Trophy, X } from 'lucide-react';
import { formatWinnings } from '../utils/money';

// Deterministic particle layout so the celebration renders identically each
// time without a randomness re-render. Falls once (forwards fill), and the
// global reduced-motion rule collapses it to nothing.
const CONFETTI_COLORS = ['#bd9c47', '#2b8049', '#0ea5e9', '#ec4899', '#8b5cf6', '#f97316'];
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 7 + 3) % 100}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${(i % 5) * 0.12}s`,
}));

// One-time recap of the most recent completed tournament, shown on the Picks
// tab until dismissed. Dismissal is remembered per league+tournament in
// localStorage, so each new week's results surface exactly once.
const WeekRecapCard = React.memo(function WeekRecapCard({ recap, storageKey }) {
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });

  // A new tournament's recap re-arms the card under a fresh key.
  React.useEffect(() => {
    try { setDismissed(localStorage.getItem(storageKey) === '1'); } catch { setDismissed(false); }
  }, [storageKey]);

  if (!recap || dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* private mode etc. */ }
    setDismissed(true);
  };

  const { me } = recap;

  return (
    <div
      className={`relative overflow-hidden mb-5 p-4 rounded-xl border ${
        recap.calledIt
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      {recap.calledIt && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute top-0 w-1.5 h-2.5 rounded-[1px] animate-confetti-fall"
              style={{ left: c.left, backgroundColor: c.color, animationDelay: c.delay }}
            />
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            Week {recap.week} Recap
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-0.5">
            {recap.tournamentName}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss recap"
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {recap.calledIt ? (
        <p className="mt-2.5 text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <Trophy size={15} className="fill-amber-400/40 shrink-0" />
          You called it — {recap.winnerGolfer} won!
        </p>
      ) : recap.winnerGolfer ? (
        <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Trophy size={13} className="text-amber-500 fill-amber-400/40 shrink-0" />
          Won by <span className="font-semibold">{recap.winnerGolfer}</span>
        </p>
      ) : null}

      <div className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
        {me && (
          <p>
            <span className="text-slate-400 dark:text-slate-500">Your week:</span>{' '}
            {me.golfer ? (
              <>
                <span className="font-medium">{me.golfer}</span>
                {' — '}
                <span className={`font-semibold tabular-nums ${me.winnings > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                  {formatWinnings(me.winnings)}
                </span>
                {me.penalty > 0 && (
                  <span className="font-semibold tabular-nums text-red-500 dark:text-red-400"> (−${me.penalty})</span>
                )}
              </>
            ) : (
              <span className="text-red-500 dark:text-red-400 font-medium">
                No pick{me.penalty > 0 ? ` — −$${me.penalty} penalty` : ''}
              </span>
            )}
          </p>
        )}
        {recap.topEarner && (
          <p>
            <span className="text-slate-400 dark:text-slate-500">Week&rsquo;s best:</span>{' '}
            <span className="font-medium">{recap.topEarner.name}</span>
            {recap.topEarner.golfer ? ` (${recap.topEarner.golfer})` : ''}
            {' — '}
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatWinnings(recap.topEarner.winnings)}
            </span>
          </p>
        )}
        {recap.leader && (
          <p>
            <span className="text-slate-400 dark:text-slate-500">League lead:</span>{' '}
            <span className="font-medium">{recap.leader.name}</span>
            {' — '}
            <span className="font-semibold tabular-nums">{formatWinnings(recap.leader.winnings)}</span>
          </p>
        )}
      </div>
    </div>
  );
});

export default WeekRecapCard;
