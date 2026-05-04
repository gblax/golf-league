import React from 'react';
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import { computeWeeklyWinners, computeWinCounts } from '../utils/winners';

// Get the visible pick text for a player (returns plain string or status)
function getPickDisplay(player, currentUser, currentTournament) {
  const now = new Date();
  const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
  const isLocked = lockTime && now >= lockTime;
  const isCurrentUser = player.id === currentUser?.id;
  const pickName = player.currentPick?.golfer_name;
  const hasRealPick = pickName && pickName !== 'No Pick';

  if (isCurrentUser) {
    return hasRealPick ? { type: 'pick', name: pickName } : { type: 'none' };
  }
  if (!isLocked) {
    return hasRealPick ? { type: 'locked' } : { type: 'none' };
  }
  return hasRealPick ? { type: 'pick', name: pickName } : { type: 'none' };
}

// Render the current pick for the desktop table
function renderDesktopPick(player, currentUser, currentTournament, leagueSettings) {
  const display = getPickDisplay(player, currentUser, currentTournament);

  if (display.type === 'none') {
    return <span className="text-red-500 dark:text-red-400 text-sm">No pick</span>;
  }
  if (display.type === 'locked') {
    return <span className="text-slate-400 dark:text-slate-500 text-sm">Hidden</span>;
  }
  return (
    <div>
      <div className="text-emerald-700 dark:text-emerald-400 font-medium">{display.name}</div>
      {leagueSettings.backup_picks_enabled && player.currentPick?.backup_golfer_name && (
        <div className="text-xs text-slate-500 dark:text-slate-400">Backup: {player.currentPick.backup_golfer_name}</div>
      )}
    </div>
  );
}

// Render rank badge
function RankBadge({ idx, size = 'default' }) {
  const base = size === 'small' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs';
  if (idx === 0) {
    return <span className={`${base} inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold`}>1</span>;
  }
  if (idx === 1) {
    return <span className={`${base} inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold`}>2</span>;
  }
  if (idx === 2) {
    return <span className={`${base} inline-flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-bold`}>3</span>;
  }
  return <span className={`${base} inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold`}>{idx + 1}</span>;
}

// Small trophy badge marking the winner of a given week.
function WinnerBadge({ size = 'default', tieCount = 1 }) {
  const px = size === 'small' ? 10 : 12;
  const label = tieCount > 1 ? `Tied for winner of week (${tieCount} players)` : 'Winner of week';
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center text-amber-600 dark:text-amber-400"
    >
      <Trophy size={px} className="fill-amber-400/40" />
    </span>
  );
}

// Mobile expanded details - card-based layout
function MobileExpandedDetails({ player, currentUser, currentWeek, currentTournament, leagueSettings, weeklyWinners }) {
  return (
    <div className="px-3 pb-3 pt-2">
      <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Week-by-Week</p>
      <div className="space-y-1.5">
        {player.picksByWeek.filter(w => w.week <= currentWeek + 1).map((weekData, weekIdx) => {
          const isCurrentWeekRow = weekData.week === currentWeek;
          const isViewingOwnPicks = player.id === currentUser?.id;
          const now = new Date();
          const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
          const isLocked = lockTime && now >= lockTime;
          const shouldHidePick = isCurrentWeekRow && !isViewingOwnPicks && !isLocked;
          const weekWinner = weeklyWinners?.[weekData.week];
          const isWinnerRow = weekWinner?.winnerIds?.has(player.id);

          return (
            <div key={weekIdx} className={`rounded-lg border p-2.5 ${
              isWinnerRow
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                  Wk {weekData.week}
                  {isWinnerRow && <WinnerBadge size="small" tieCount={weekWinner.winnerIds.size} />}
                </span>
                <div className="flex items-center gap-2 tabular-nums">
                  {weekData.winnings > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">${weekData.winnings.toLocaleString()}</span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600 text-xs">$0</span>
                  )}
                  {weekData.penalty > 0 && (
                    <span className="text-red-500 dark:text-red-400 font-semibold text-xs">
                      -${weekData.penalty}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mb-1">{weekData.tournamentName}</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 dark:text-slate-500">Pick:</span>
                {shouldHidePick ? (
                  weekData.golfer ? (
                    <span className="text-slate-400 dark:text-slate-500">Hidden</span>
                  ) : (
                    <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                  )
                ) : weekData.golfer ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">{weekData.golfer}</span>
                ) : weekData.isPast ? (
                  <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">&mdash;</span>
                )}
              </div>
              {leagueSettings.backup_picks_enabled && !shouldHidePick && weekData.backup && (
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span className="text-slate-400 dark:text-slate-500">Backup:</span>
                  <span className="text-amber-600 dark:text-amber-400">{weekData.backup}</span>
                </div>
              )}
              {weekData.penalty > 0 && weekData.penaltyReason && (
                <div className="text-[10px] text-red-500 dark:text-red-400 mt-1">
                  Penalty: {weekData.penaltyReason.replaceAll('_', ' ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Totals */}
      <div className="mt-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-2.5 flex items-center justify-between">
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Totals</span>
        <div className="flex items-center gap-3 tabular-nums">
          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">${player.winnings.toLocaleString()}</span>
          <span className="text-red-500 dark:text-red-400 font-bold text-xs">
            {player.penalties > 0 ? `-$${player.penalties}` : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

const StandingsTab = React.memo(function StandingsTab({
  sortedStandings,
  currentUser,
  currentWeek,
  currentTournament,
  leagueSettings,
  expandedRows,
  toggleRowExpansion,
}) {
  const weeklyWinners = React.useMemo(() => computeWeeklyWinners(sortedStandings), [sortedStandings]);
  const winCounts = React.useMemo(() => computeWinCounts(weeklyWinners), [weeklyWinners]);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Standings</h2>

      {/* ===== Mobile card layout (visible < sm) ===== */}
      <div className="sm:hidden space-y-1.5">
        {sortedStandings.map((player, idx) => {
          const isCurrentUser = player.id === currentUser?.id;
          const isExpanded = expandedRows[player.id];

          return (
            <div key={player.id}>
              <button
                onClick={() => toggleRowExpansion(player.id)}
                className={`w-full text-left rounded-xl border transition-colors ${
                  isCurrentUser
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                } ${isExpanded ? 'rounded-b-none' : ''} px-3 py-2.5`}
              >
                {/* Row 1: rank, name, expand icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex-shrink-0">
                      <RankBadge idx={idx} size="small" />
                    </span>
                    <span className={`text-sm truncate ${isCurrentUser ? 'font-bold' : 'font-medium'} text-slate-900 dark:text-white`}>
                      {player.name}
                    </span>
                    {winCounts[player.id] > 0 && (
                      <span
                        title={`${winCounts[player.id]} weekly ${winCounts[player.id] === 1 ? 'win' : 'wins'}`}
                        className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                      >
                        <Trophy size={10} className="fill-amber-400/40" />
                        {winCounts[player.id]}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </div>
                {/* Row 2: stats in a fixed 3-column grid */}
                {(() => {
                  const pickDisplay = getPickDisplay(player, currentUser, currentTournament);
                  return (
                    <div className="grid grid-cols-3 gap-1 ml-8 mt-1 text-xs">
                      <div className="tabular-nums">
                        <span className="text-slate-400 dark:text-slate-500">Won</span>{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">${player.winnings.toLocaleString()}</span>
                      </div>
                      <div className="tabular-nums">
                        {player.penalties > 0 && (
                          <>
                            <span className="text-slate-400 dark:text-slate-500">Pen</span>{' '}
                            <span className="font-semibold text-red-500 dark:text-red-400">${player.penalties}</span>
                          </>
                        )}
                      </div>
                      <div className="truncate text-right">
                        {pickDisplay.type === 'pick' && (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">{pickDisplay.name}</span>
                        )}
                        {pickDisplay.type === 'locked' && (
                          <span className="text-slate-400 dark:text-slate-500">Hidden</span>
                        )}
                        {pickDisplay.type === 'none' && (
                          <span className="text-red-500 dark:text-red-400">No pick</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className={`rounded-b-xl border border-t-0 ${
                  isCurrentUser
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'
                }`}>
                  <MobileExpandedDetails
                    player={player}
                    currentUser={currentUser}
                    currentWeek={currentWeek}
                    currentTournament={currentTournament}
                    leagueSettings={leagueSettings}
                    weeklyWinners={weeklyWinners}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Desktop table layout (visible sm+) ===== */}
      <div className="hidden sm:block overflow-x-auto card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-3 px-4 text-left text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">#</th>
              <th className="py-3 px-4 text-left text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Player</th>
              <th className="py-3 px-4 text-right text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Won</th>
              <th className="py-3 px-4 text-right text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pen.</th>
              <th className="py-3 px-4 text-left text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pick</th>
              <th className="py-3 px-2 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {sortedStandings.map((player, idx) => (
              <React.Fragment key={player.id}>
                <tr
                  className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    player.id === currentUser?.id ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <RankBadge idx={idx} />
                  </td>
                  <td className={`py-3 px-4 text-sm text-slate-900 dark:text-white ${player.id === currentUser?.id ? 'font-bold' : 'font-medium'}`}>
                    <span className="inline-flex items-center gap-2">
                      {player.name}
                      {winCounts[player.id] > 0 && (
                        <span
                          title={`${winCounts[player.id]} weekly ${winCounts[player.id] === 1 ? 'win' : 'wins'}`}
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                        >
                          <Trophy size={10} className="fill-amber-400/40" />
                          {winCounts[player.id]}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-sm tabular-nums font-semibold text-slate-900 dark:text-white">
                    ${player.winnings.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-sm tabular-nums">
                    {player.penalties > 0 ? (
                      <span className="text-red-500 dark:text-red-400 font-semibold">${player.penalties}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {renderDesktopPick(player, currentUser, currentTournament, leagueSettings)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => toggleRowExpansion(player.id)}
                      className="text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {expandedRows[player.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </td>
                </tr>

                {/* Expanded weekly results row */}
                {expandedRows[player.id] && (
                  <tr className="bg-slate-50 dark:bg-slate-900/50">
                    <td colSpan="6" className="py-4 px-4">
                      <div className="max-w-5xl mx-auto">
                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                          Week-by-Week &mdash; {player.name}
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="py-2 px-3 text-left text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Wk</th>
                                <th className="py-2 px-3 text-left text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tournament</th>
                                <th className="py-2 px-3 text-left text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Golfer</th>
                                {leagueSettings.backup_picks_enabled && (
                                  <th className="py-2 px-3 text-left text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Backup</th>
                                )}
                                <th className="py-2 px-3 text-right text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Won</th>
                                <th className="py-2 px-3 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Penalty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {player.picksByWeek.filter(w => w.week <= currentWeek + 1).map((weekData, weekIdx) => {
                                const isCurrentWeekRow = weekData.week === currentWeek;
                                const isViewingOwnPicks = player.id === currentUser?.id;
                                const now = new Date();
                                const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                                const isLocked = lockTime && now >= lockTime;
                                const shouldHidePick = isCurrentWeekRow && !isViewingOwnPicks && !isLocked;
                                const weekWinner = weeklyWinners?.[weekData.week];
                                const isWinnerRow = weekWinner?.winnerIds?.has(player.id);

                                return (
                                <tr key={weekIdx} className={`border-b border-slate-100 dark:border-slate-800 ${
                                  isWinnerRow
                                    ? 'bg-amber-50 dark:bg-amber-950/20'
                                    : weekIdx % 2 === 1 ? 'bg-slate-100/50 dark:bg-slate-800/30' : ''
                                }`}>
                                  <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white text-xs">
                                    <span className="inline-flex items-center gap-1">
                                      {weekData.week}
                                      {isWinnerRow && <WinnerBadge size="small" tieCount={weekWinner.winnerIds.size} />}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300 text-xs">{weekData.tournamentName}</td>
                                  <td className="py-2 px-3 text-xs">
                                    {shouldHidePick ? (
                                      weekData.golfer ? (
                                        <span className="text-slate-400 dark:text-slate-500">Hidden</span>
                                      ) : (
                                        <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                                      )
                                    ) : weekData.golfer ? (
                                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">{weekData.golfer}</span>
                                    ) : weekData.isPast ? (
                                      <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-600">&mdash;</span>
                                    )}
                                  </td>
                                  {leagueSettings.backup_picks_enabled && (
                                    <td className="py-2 px-3 text-xs">
                                      {shouldHidePick ? (
                                        <span className="text-slate-300 dark:text-slate-600">-</span>
                                      ) : weekData.backup ? (
                                        <span className="text-amber-600 dark:text-amber-400">{weekData.backup}</span>
                                      ) : (
                                        <span className="text-slate-300 dark:text-slate-600">-</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="py-2 px-3 text-right tabular-nums text-xs">
                                    {weekData.winnings > 0 ? (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">${weekData.winnings.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-600">$0</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center text-xs">
                                    {weekData.penalty > 0 ? (
                                      <span className="text-red-500 dark:text-red-400 font-semibold">
                                        ${weekData.penalty} ({weekData.penaltyReason?.replaceAll('_', ' ')})
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-600">-</span>
                                    )}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <td colSpan={leagueSettings.backup_picks_enabled ? 4 : 3} className="py-2 px-3 text-right text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Totals</td>
                                <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400 tabular-nums text-xs">
                                  ${player.winnings.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-center text-red-500 dark:text-red-400 tabular-nums text-xs">
                                  {player.penalties > 0 ? `$${player.penalties}` : '-'}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default StandingsTab;
