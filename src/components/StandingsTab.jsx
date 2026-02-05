import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
      <div className="overflow-x-auto -mx-3 px-3 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="bg-gray-100 dark:bg-slate-700">
              <th className="py-2 sm:py-3 px-1 sm:px-4 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm rounded-tl-lg">#</th>
              <th className="py-2 sm:py-3 px-1 sm:px-4 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Player</th>
              <th className="py-2 sm:py-3 px-1 sm:px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Won</th>
              <th className="py-2 sm:py-3 px-1 sm:px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Pen.</th>
              <th className="py-2 sm:py-3 px-1 sm:px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Pick</th>
              <th className="py-2 sm:py-3 px-1 sm:px-2 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm rounded-tr-lg"></th>
            </tr>
          </thead>
          <tbody>
            {sortedStandings.map((player, idx) => (
              <React.Fragment key={player.id}>
                <tr
                  className={`border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${player.id === currentUser?.id ? 'bg-green-50 dark:bg-green-900/20 font-semibold' : ''}`}
                >
                  <td className="py-2 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                    {idx === 0 ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-base sm:text-lg">🥇</span>
                        <span className="hidden sm:inline font-bold text-yellow-600 dark:text-yellow-400">1</span>
                      </span>
                    ) : idx === 1 ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-base sm:text-lg">🥈</span>
                        <span className="hidden sm:inline font-semibold text-gray-500 dark:text-gray-400">2</span>
                      </span>
                    ) : idx === 2 ? (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-base sm:text-lg">🥉</span>
                        <span className="hidden sm:inline font-semibold text-amber-700 dark:text-amber-500">3</span>
                      </span>
                    ) : (
                      idx + 1
                    )}
                  </td>
                  <td className="py-2 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm text-gray-800 dark:text-gray-200">{player.name}</td>
                  <td className="py-2 sm:py-3 px-1 sm:px-4 text-center text-xs sm:text-sm text-gray-800 dark:text-gray-200">${player.winnings.toLocaleString()}</td>
                  <td className="py-2 sm:py-3 px-1 sm:px-4 text-center text-red-600 dark:text-red-400 font-semibold text-xs sm:text-sm">
                    {player.penalties > 0 ? `$${player.penalties}` : '-'}
                  </td>
                  <td className="py-2 sm:py-3 px-1 sm:px-4 text-center text-xs sm:text-sm">
                    {(() => {
                      const now = new Date();
                      const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                      const isLocked = lockTime && now >= lockTime;
                      const isCurrentUser = player.id === currentUser?.id;

                      if (isCurrentUser) {
                        const pickName = player.currentPick?.golfer_name;
                        const hasRealPick = pickName && pickName !== 'No Pick';
                        return hasRealPick ? (
                          <div>
                            <div className="text-green-700 dark:text-green-400 truncate max-w-[80px] sm:max-w-none">{pickName}</div>
                            {leagueSettings.backup_picks_enabled && player.currentPick.backup_golfer_name && (
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Backup: {player.currentPick.backup_golfer_name}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-500 dark:text-red-400 text-[10px] sm:text-sm">No pick</span>
                        );
                      }

                      if (!isLocked) {
                        const otherPickName = player.currentPick?.golfer_name;
                        const otherHasReal = otherPickName && otherPickName !== 'No Pick';
                        return otherHasReal ? (
                          <span className="text-gray-500 dark:text-gray-400">🔒</span>
                        ) : (
                          <span className="text-red-500 dark:text-red-400 text-[10px] sm:text-sm">No pick</span>
                        );
                      }

                      {
                        const lockedPickName = player.currentPick?.golfer_name;
                        const lockedHasReal = lockedPickName && lockedPickName !== 'No Pick';
                        return lockedHasReal ? (
                          <div>
                            <div className="text-green-700 dark:text-green-400 truncate max-w-[80px] sm:max-w-none">{lockedPickName}</div>
                            {leagueSettings.backup_picks_enabled && player.currentPick.backup_golfer_name && (
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Backup: {player.currentPick.backup_golfer_name}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-500 dark:text-red-400 text-[10px] sm:text-sm">No pick</span>
                        );
                      }
                    })()}
                  </td>
                  <td className="py-2 sm:py-3 px-1 sm:px-2 text-center">
                    <button
                      onClick={() => toggleRowExpansion(player.id)}
                      className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-0.5 mx-auto text-xs sm:text-sm transition-all active:scale-95"
                    >
                      {expandedRows[player.id] ? (
                        <>
                          <ChevronDown size={16} />
                          <span className="hidden sm:inline">Hide</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight size={16} />
                          <span className="hidden sm:inline">Details</span>
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
                                        ${weekData.penalty} ({weekData.penaltyReason?.replace('_', ' ')})
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
      <div className="text-center mt-2 sm:hidden">
        <p className="text-xs text-gray-500 dark:text-gray-400">← Swipe to see more →</p>
      </div>
    </div>
  );
});

export default StandingsTab;
