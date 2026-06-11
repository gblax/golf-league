import React from 'react';
import { Activity, ChevronDown, ChevronRight, Clock, Trophy } from 'lucide-react';
import { lookupLive, positionRank, formatUpdatedLabel, isOutStatus, outLabel, normalizeName } from '../utils/liveLeaderboard';
import PlayerAvatar from './PlayerAvatar';

// Color a to-par score: under par green, over par slate, even neutral.
function scoreClass(score) {
  const s = String(score || '').trim();
  if (s.startsWith('-')) return 'text-emerald-600 dark:text-emerald-400';
  if (s.startsWith('+')) return 'text-slate-600 dark:text-slate-300';
  return 'text-slate-500 dark:text-slate-400';
}

// One golfer's live status chip: position · score (· thru / CUT).
function LiveStatus({ live, showThru = true }) {
  if (!live) return <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>;
  const out = isOutStatus(live.status);
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {out ? (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
          {outLabel(live.status)}
        </span>
      ) : (
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{live.position || '—'}</span>
      )}
      <span className={`text-xs font-semibold ${out ? 'text-slate-400 dark:text-slate-500' : scoreClass(live.score)}`}>
        {live.score || ''}
      </span>
      {showThru && !out && live.thru && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{live.thru === 'F' ? 'F' : `thru ${live.thru}`}</span>
      )}
    </span>
  );
}

const LiveLeaderboard = React.memo(function LiveLeaderboard({
  index,
  members = [],
  tournamentName,
  currentUserId,
  playerColors = {},
}) {
  const [showField, setShowField] = React.useState(false);

  if (!index || index.isEmpty) return null;

  const updatedLabel = formatUpdatedLabel(index.updatedAt);
  const isOfficial = (index.eventStatus || '').toLowerCase() === 'official';

  // League members with a real pick, resolved to their live row and sorted by
  // current position (golfers not on the board — e.g. didn't play — sink last).
  const memberRows = members
    .filter((m) => m.golferName)
    .map((m) => ({ ...m, live: lookupLive(index, { golferId: m.golferId, golferName: m.golferName }) }))
    .sort((a, b) => (a.live ? positionRank(a.live.position) : Infinity) - (b.live ? positionRank(b.live.position) : Infinity));

  // Normalized names of league picks, to highlight them in the full field.
  const pickedNorms = new Set(memberRows.map((m) => normalizeName(m.golferName)));

  const fieldSorted = [...index.players].sort((a, b) => positionRank(a.position) - positionRank(b.position));

  return (
    <div className="card p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className={isOfficial ? 'text-amber-500' : 'text-emerald-500 dark:text-emerald-400'} size={16} />
            {isOfficial ? 'Final Leaderboard' : 'Leaderboard'}
          </h3>
          {tournamentName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{tournamentName}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {!isOfficial && (
            <span className="badge bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              In progress
            </span>
          )}
          {index.cutLine && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 tabular-nums">Cut: {index.cutLine}</p>
          )}
        </div>
      </div>

      {/* Freshness disclaimer — always visible so snapshot scores aren't mistaken for live or final */}
      {updatedLabel && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mb-3">
          <Clock size={11} />
          {isOfficial
            ? `Final results as of ${updatedLabel}`
            : `Scores as of ${updatedLabel} · refreshed nightly after each round`}
        </p>
      )}

      {/* League picks */}
      {memberRows.length > 0 ? (
        <div className="space-y-1">
          {memberRows.map((m) => {
            // Match by member id, not display name — names can collide.
            const isYou = !!currentUserId && m.id === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 border ${
                  isYou
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-transparent'
                }`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <PlayerAvatar name={m.name} color={playerColors[m.id]} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {m.name}
                      {isYou && <span className="ml-1 text-emerald-600 dark:text-emerald-400 text-[10px]">(you)</span>}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{m.golferName}</p>
                  </div>
                </div>
                <LiveStatus live={m.live} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-3 py-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No league picks on the board yet.</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Members' picks appear here once their golfers are on the leaderboard.</p>
        </div>
      )}

      {/* Full field (collapsible) */}
      <button
        onClick={() => setShowField((v) => !v)}
        aria-expanded={showField}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        {showField ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {showField ? 'Hide full field' : `Full field (${fieldSorted.length})`}
      </button>

      {showField && (
        <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="py-1.5 px-2 text-left text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pos</th>
                <th className="py-1.5 px-2 text-left text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Player</th>
                <th className="py-1.5 px-2 text-right text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Score</th>
                <th className="py-1.5 px-2 text-right text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Thru</th>
              </tr>
            </thead>
            <tbody>
              {fieldSorted.map((p, i) => {
                const isPick = pickedNorms.has(normalizeName(p.player_name));
                const out = isOutStatus(p.status);
                return (
                  <tr
                    key={p.player_id || `${p.player_name}-${i}`}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${
                      isPick ? 'bg-amber-50 dark:bg-amber-950/20' : i % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''
                    }`}
                  >
                    <td className="py-1.5 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {out ? <span className="text-red-500 dark:text-red-400">{outLabel(p.status)}</span> : (p.position || '—')}
                    </td>
                    <td className="py-1.5 px-2 text-xs text-slate-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1">
                        {isPick && <Trophy size={10} className="text-amber-500 fill-amber-400/40 shrink-0" />}
                        {p.player_name}
                      </span>
                    </td>
                    <td className={`py-1.5 px-2 text-right text-xs font-semibold tabular-nums ${out ? 'text-slate-400 dark:text-slate-500' : scoreClass(p.score)}`}>
                      {p.score || ''}
                    </td>
                    <td className="py-1.5 px-2 text-right text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {out ? '' : p.thru || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

export default LiveLeaderboard;
