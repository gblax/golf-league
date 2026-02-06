import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
    return <span className="text-gray-500 dark:text-gray-400">🔒</span>;
  }
  return (
    <div>
      <div className="text-green-700 dark:text-green-400">{display.name}</div>
      {leagueSettings.backup_picks_enabled && player.currentPick?.backup_golfer_name && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Backup: {player.currentPick.backup_golfer_name}</div>
      )}
    </div>
  );
}

// Render rank badge
function RankBadge({ idx, size = 'default' }) {
  const emojiSize = size === 'small' ? 'text-sm' : 'text-base sm:text-lg';
  if (idx === 0) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className={emojiSize}>🥇</span>
        {size !== 'small' && <span className="hidden sm:inline font-bold text-yellow-600 dark:text-yellow-400">1</span>}
      </span>
    );
  }
  if (idx === 1) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className={emojiSize}>🥈</span>
        {size !== 'small' && <span className="hidden sm:inline font-semibold text-gray-500 dark:text-gray-400">2</span>}
      </span>
    );
  }
  if (idx === 2) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className={emojiSize}>🥉</span>
        {size !== 'small' && <span className="hidden sm:inline font-semibold text-amber-700 dark:text-amber-500">3</span>}
      </span>
    );
  }
  return <span>{idx + 1}</span>;
}

// Mobile expanded details - card-based layout
function MobileExpandedDetails({ player, currentUser, currentWeek, currentTournament, leagueSettings }) {
  return (
    <div className="px-2 pb-3 pt-1">
      <h4 className="font-bold text-gray-800 dark:text-gray-200 text-xs mb-2">Week-by-Week Results</h4>
      <div className="space-y-2">
        {player.picksByWeek.map((weekData, weekIdx) => {
          const isCurrentWeekRow = weekData.week === currentWeek;
          const isViewingOwnPicks = player.id === currentUser?.id;
          const now = new Date();
          const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
          const isLocked = lockTime && now >= lockTime;
          const shouldHidePick = isCurrentWeekRow && !isViewingOwnPicks && !isLocked;

          return (
            <div key={weekIdx} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Wk {weekData.week}</span>
                <div className="flex items-center gap-2">
                  {weekData.winnings > 0 ? (
                    <span className="text-green-600 dark:text-green-400 font-semibold text-xs">${weekData.winnings.toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs">$0</span>
                  )}
                  {weekData.penalty > 0 && (
                    <span className="text-red-600 dark:text-red-400 font-semibold text-xs">
                      -${weekData.penalty}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-700 dark:text-gray-300 mb-1">{weekData.tournamentName}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 dark:text-gray-400">Pick:</span>
                {shouldHidePick ? (
                  weekData.golfer ? (
                    <span className="text-gray-500 dark:text-gray-400">🔒 Hidden</span>
                  ) : (
                    <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                  )
                ) : weekData.golfer ? (
                  <span className="text-green-700 dark:text-green-400 font-medium">{weekData.golfer}</span>
                ) : weekData.isPast ? (
                  <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                ) : (
                  <span className="text-gray-300 dark:text-gray-600">—</span>
                )}
              </div>
              {leagueSettings.backup_picks_enabled && !shouldHidePick && weekData.backup && (
                <div className="flex items-center gap-2 text-xs mt-0.5">
                  <span className="text-gray-500 dark:text-gray-400">Backup:</span>
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
      <div className="mt-2 bg-gray-200 dark:bg-slate-600 rounded-lg p-2.5 flex items-center justify-between">
        <span className="font-bold text-xs text-gray-800 dark:text-gray-200">TOTALS</span>
        <div className="flex items-center gap-3">
          <span className="text-green-700 dark:text-green-400 font-bold text-xs">${player.winnings.toLocaleString()}</span>
          <span className="text-red-600 dark:text-red-400 font-bold text-xs">
            {player.penalties > 0 ? `$${player.penalties}` : '-'}
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
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">League Standings</h2>

      {/* ===== Mobile card layout (visible < sm) ===== */}
      <div className="sm:hidden space-y-1.5">
        {sortedStandings.map((player, idx) => {
          const isCurrentUser = player.id === currentUser?.id;
          const isExpanded = expandedRows[player.id];

          return (
            <div key={player.id}>
              <button
                onClick={() => toggleRowExpansion(player.id)}
                className={`w-full text-left rounded-lg border transition-colors active:scale-[0.99] ${
                  isCurrentUser
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                } px-2.5 py-2`}
              >
                {/* Row 1: rank, name, expand icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-5 flex-shrink-0 text-center">
                      <RankBadge idx={idx} size="small" />
                    </span>
                    <span className={`text-sm truncate ${isCurrentUser ? 'font-bold' : 'font-medium'} text-gray-800 dark:text-gray-200`}>
                      {player.name}
                    </span>
                  </div>
                  <span className="text-green-600 dark:text-green-400 flex-shrink-0 ml-2">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </div>
                {/* Row 2: stats in a fixed 3-column grid */}
                {(() => {
                  const pickDisplay = getPickDisplay(player, currentUser, currentTournament);
                  return (
                    <div className="grid grid-cols-3 gap-1 ml-7 mt-1 text-xs">
                      <div>
                        <span className="text-gray-400 dark:text-gray-500">Won</span>{' '}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">${player.winnings.toLocaleString()}</span>
                      </div>
                      <div>
                        {player.penalties > 0 && (
                          <>
                            <span className="text-gray-400 dark:text-gray-500">Pen</span>{' '}
                            <span className="font-semibold text-red-600 dark:text-red-400">${player.penalties}</span>
                          </>
                        )}
                      </div>
                      <div className="truncate text-right">
                        {pickDisplay.type === 'pick' && (
                          <span className="text-green-700 dark:text-green-400 font-medium">{pickDisplay.name}</span>
                        )}
                        {pickDisplay.type === 'locked' && (
                          <span className="text-gray-400 dark:text-gray-500">🔒</span>
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
                <div className={`rounded-b-lg border border-t-0 ${
                  isCurrentUser
                    ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                    : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50'
                }`}>
                  <MobileExpandedDetails
                    player={player}
                    currentUser={currentUser}
                    currentWeek={currentWeek}
                    currentTournament={currentTournament}
                    leagueSettings={leagueSettings}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== Desktop table layout (visible sm+) ===== */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 dark:bg-slate-700">
              <th className="py-3 px-4 text-left font-semibold text-gray-700 dark:text-gray-300 text-sm rounded-tl-lg">#</th>
              <th className="py-3 px-4 text-left font-semibold text-gray-700 dark:text-gray-300 text-sm">Player</th>
              <th className="py-3 px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm">Won</th>
              <th className="py-3 px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm">Pen.</th>
              <th className="py-3 px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm">Pick</th>
              <th className="py-3 px-2 text-center font-semibold text-gray-700 dark:text-gray-300 text-sm rounded-tr-lg"></th>
            </tr>
          </thead>
          <tbody>
            {sortedStandings.map((player, idx) => (
              <React.Fragment key={player.id}>
                <tr
                  className={`border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${player.id === currentUser?.id ? 'bg-green-50 dark:bg-green-900/20 font-semibold' : ''}`}
                >
                  <td className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200">
                    <RankBadge idx={idx} />
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-800 dark:text-gray-200">{player.name}</td>
                  <td className="py-3 px-4 text-center text-sm text-gray-800 dark:text-gray-200">${player.winnings.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center text-red-600 dark:text-red-400 font-semibold text-sm">
                    {player.penalties > 0 ? `$${player.penalties}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-center text-sm">
                    {renderDesktopPick(player, currentUser, currentTournament, leagueSettings)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => toggleRowExpansion(player.id)}
                      className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1 mx-auto text-sm transition-all active:scale-95"
                    >
                      {expandedRows[player.id] ? (
                        <>
                          <ChevronDown size={16} />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight size={16} />
                          <span>Details</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>

                {/* Expanded weekly results row */}
                {expandedRows[player.id] && (
                  <tr className="bg-gray-50 dark:bg-slate-700/50">
                    <td colSpan="6" className="py-4 px-4">
                      <div className="max-w-5xl mx-auto">
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">Week-by-Week Results for {player.name}</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-200 dark:bg-slate-600">
                                <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Week</th>
                                <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Tournament</th>
                                <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Golfer</th>
                                {leagueSettings.backup_picks_enabled && (
                                  <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Backup</th>
                                )}
                                <th className="py-2 px-3 text-right text-gray-800 dark:text-gray-200">Winnings</th>
                                <th className="py-2 px-3 text-center text-gray-800 dark:text-gray-200">Penalty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {player.picksByWeek.map((weekData, weekIdx) => {
                                const isCurrentWeekRow = weekData.week === currentWeek;
                                const isViewingOwnPicks = player.id === currentUser?.id;
                                const now = new Date();
                                const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                                const isLocked = lockTime && now >= lockTime;
                                const shouldHidePick = isCurrentWeekRow && !isViewingOwnPicks && !isLocked;

                                return (
                                <tr key={weekIdx} className="border-b border-gray-300 dark:border-slate-600">
                                  <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">{weekData.week}</td>
                                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{weekData.tournamentName}</td>
                                  <td className="py-2 px-3">
                                    {shouldHidePick ? (
                                      weekData.golfer ? (
                                        <span className="text-gray-500 dark:text-gray-400">🔒 Hidden</span>
                                      ) : (
                                        <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                                      )
                                    ) : weekData.golfer ? (
                                      <span className="text-green-700 dark:text-green-400 font-medium">{weekData.golfer}</span>
                                    ) : weekData.isPast ? (
                                      <span className="text-red-500 dark:text-red-400 font-medium">No pick</span>
                                    ) : (
                                      <span className="text-gray-300 dark:text-gray-600">—</span>
                                    )}
                                  </td>
                                  {leagueSettings.backup_picks_enabled && (
                                    <td className="py-2 px-3">
                                      {shouldHidePick ? (
                                        <span className="text-gray-300 dark:text-gray-600">-</span>
                                      ) : weekData.backup ? (
                                        <span className="text-amber-600 dark:text-amber-400 text-xs">{weekData.backup}</span>
                                      ) : (
                                        <span className="text-gray-300 dark:text-gray-600">-</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="py-2 px-3 text-right">
                                    {weekData.winnings > 0 ? (
                                      <span className="text-green-600 dark:text-green-400 font-semibold">${weekData.winnings.toLocaleString()}</span>
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500">$0</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {weekData.penalty > 0 ? (
                                      <span className="text-red-600 dark:text-red-400 font-semibold">
                                        ${weekData.penalty} ({weekData.penaltyReason?.replaceAll('_', ' ')})
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500">-</span>
                                    )}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-200 dark:bg-slate-600 font-bold">
                                <td colSpan={leagueSettings.backup_picks_enabled ? 4 : 3} className="py-2 px-3 text-right text-gray-800 dark:text-gray-200">TOTALS:</td>
                                <td className="py-2 px-3 text-right text-green-700 dark:text-green-400">
                                  ${player.winnings.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-center text-red-600 dark:text-red-400">
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
