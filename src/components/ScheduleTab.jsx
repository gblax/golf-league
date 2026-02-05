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
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Tournament Schedule</h2>
      <div className="space-y-3">
        {tournaments.map((tournament) => (
          <div key={tournament.id}>
            <div
              onClick={() => tournament.completed && setExpandedScheduleTournament(
                expandedScheduleTournament === tournament.id ? null : tournament.id
              )}
              className={`p-3 sm:p-4 rounded-xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                tournament.completed ? 'cursor-pointer' : 'cursor-default'
              } ${
                tournament.week === currentWeek
                  ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20 shadow-sm'
                  : tournament.completed
                  ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50'
                  : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
              } ${expandedScheduleTournament === tournament.id ? 'rounded-b-none' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100">{tournament.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      tournament.prize_pool
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatPrizePool(tournament.prize_pool)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Week {tournament.week} - {new Date(tournament.tournament_date).toLocaleDateString()}</p>
                  {(tournament.course || tournament.location) && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {tournament.course}{tournament.course && tournament.location && ' • '}{tournament.location}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {tournament.week === currentWeek ? (
                    <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-sm inline-block shadow-lg animate-pulse-gentle">
                      Current Week
                    </span>
                  ) : tournament.completed || tournament.week < currentWeek ? (
                    <>
                      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                        <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                        <span className="text-xs sm:text-sm">Completed</span>
                      </span>
                      <ChevronDown
                        size={20}
                        className={`text-gray-400 transition-transform ${expandedScheduleTournament === tournament.id ? 'rotate-180' : ''}`}
                      />
                    </>
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm">Upcoming</span>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded tournament results */}
            {expandedScheduleTournament === tournament.id && tournament.completed && (
              <div className="border border-t-0 border-gray-200 dark:border-slate-600 rounded-b-xl bg-white dark:bg-slate-800 p-4">
                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Week {tournament.week} Results</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-600">
                        <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Player</th>
                        <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Pick</th>
                        <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">Won</th>
                        <th className="text-center py-2 px-2 text-gray-600 dark:text-gray-400">Penalty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players
                        .map(player => {
                          const weekData = player.picksByWeek?.find(w => w.week === tournament.week);
                          return { ...player, weekData };
                        })
                        .sort((a, b) => (b.weekData?.winnings || 0) - (a.weekData?.winnings || 0))
                        .map(player => (
                          <tr key={player.id} className={`border-b border-gray-100 dark:border-slate-700 ${player.id === currentUser?.id ? 'bg-green-50 dark:bg-green-900/30 font-semibold' : ''}`}>
                            <td className="py-2 px-2 text-gray-800 dark:text-gray-200">
                              {player.name}
                              {player.id === currentUser?.id && <span className="ml-1 text-green-600 dark:text-green-400 text-xs">(you)</span>}
                            </td>
                            <td className="py-2 px-2">
                              {player.weekData?.golfer ? (
                                <span className="text-green-700 dark:text-green-400">{player.weekData.golfer}</span>
                              ) : (
                                <span className="text-red-500 dark:text-red-400 text-xs">No pick</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right text-gray-800 dark:text-gray-200">
                              ${(player.weekData?.winnings || 0).toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {player.weekData?.penalty > 0 ? (
                                <span className="text-red-600 dark:text-red-400 text-xs">
                                  ${player.weekData.penalty} ({player.weekData.penaltyReason?.replace('_', ' ') || 'penalty'})
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
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
        ))}
      </div>
    </div>
  );
});

export default ScheduleTab;
