import React from 'react';
import { CheckCircle, ChevronDown } from 'lucide-react';

const ScheduleTab = React.memo(function ScheduleTab({
  tournaments,
  currentWeek,
  players,
  currentUser,
  leagueSettings,
  expandedScheduleTournament,
  setExpandedScheduleTournament,
  formatPrizePool,
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Schedule</h2>
      <div className="space-y-2">
        {tournaments.map((tournament) => {
          const isCurrent = tournament.week === currentWeek;
          const isCompleted = tournament.completed || tournament.week < currentWeek;
          const isExpanded = expandedScheduleTournament === tournament.id;

          return (
            <div key={tournament.id}>
              <div
                onClick={() => isCompleted && setExpandedScheduleTournament(
                  isExpanded ? null : tournament.id
                )}
                className={`p-3 sm:p-4 rounded-xl border transition-colors ${
                  isCompleted ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'cursor-default'
                } ${
                  isCurrent
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
                    : isCompleted
                    ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                } ${isExpanded ? 'rounded-b-none' : ''}`}
              >
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">{tournament.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold tabular-nums ${
                        tournament.prize_pool
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }`}>
                        {formatPrizePool(tournament.prize_pool)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Wk {tournament.week} &middot; {new Date(tournament.tournament_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    {(tournament.course || tournament.location) && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {tournament.course}{tournament.course && tournament.location && ' · '}{tournament.location}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isCurrent ? (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white">
                        Current
                      </span>
                    ) : isCompleted ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-emerald-500 dark:text-emerald-400" />
                        <span className="text-xs text-slate-400 dark:text-slate-500">Done</span>
                        <ChevronDown
                          size={16}
                          className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded tournament results */}
              {isExpanded && isCompleted && (
                <div className="border border-t-0 border-slate-200 dark:border-slate-800 rounded-b-xl bg-white dark:bg-slate-900 p-4">
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
                    Week {tournament.week} Results
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="text-left py-2 px-2 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Player</th>
                          <th className="text-left py-2 px-2 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pick</th>
                          <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Won</th>
                          <th className="text-center py-2 px-2 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Penalty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players
                          .map(player => {
                            const weekData = player.picksByWeek?.find(w => w.week === tournament.week);
                            return { ...player, weekData };
                          })
                          .sort((a, b) => (b.weekData?.winnings || 0) - (a.weekData?.winnings || 0))
                          .map((player, idx) => (
                            <tr key={player.id} className={`border-b border-slate-100 dark:border-slate-800 ${
                              player.id === currentUser?.id ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''
                            }`}>
                              <td className="py-2 px-2 text-xs text-slate-900 dark:text-white font-medium">
                                {player.name}
                                {player.id === currentUser?.id && <span className="ml-1 text-emerald-600 dark:text-emerald-400 text-[10px]">(you)</span>}
                              </td>
                              <td className="py-2 px-2 text-xs">
                                {player.weekData?.golfer ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">{player.weekData.golfer}</span>
                                ) : (
                                  <span className="text-red-500 dark:text-red-400">No pick</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right text-xs tabular-nums font-medium text-slate-900 dark:text-white">
                                ${(player.weekData?.winnings || 0).toLocaleString()}
                              </td>
                              <td className="py-2 px-2 text-center text-xs">
                                {player.weekData?.penalty > 0 ? (
                                  <span className="text-red-500 dark:text-red-400">
                                    ${player.weekData.penalty}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ScheduleTab;
