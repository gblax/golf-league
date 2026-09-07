import React from 'react';
import { CalendarDays, CheckCircle, ChevronDown, Flag, History, Trophy } from 'lucide-react';

const VIEW_OPTIONS = [
  { id: 'current', label: 'This Week', icon: Flag },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { id: 'completed', label: 'Completed', icon: History },
];

const ScheduleTab = React.memo(function ScheduleTab({
  tournaments,
  currentWeek,
  // Off-season: there is no "this week" — the last event is done like all the
  // others, so open on Completed and don't badge anything as Current.
  seasonComplete = false,
  players,
  currentUser,
  expandedScheduleTournament,
  setExpandedScheduleTournament,
  formatPrizePool,
  onGoToPick,
}) {
  const [scheduleView, setScheduleView] = React.useState(seasonComplete ? 'completed' : 'current');

  const groupedTournaments = React.useMemo(() => {
    const current = seasonComplete
      ? []
      : tournaments
        .filter(tournament => tournament.week === currentWeek)
        .sort((a, b) => a.week - b.week);
    const upcoming = tournaments
      .filter(tournament => tournament.week > currentWeek && !tournament.completed)
      .sort((a, b) => a.week - b.week);
    const completed = tournaments
      .filter(tournament => (seasonComplete || tournament.week !== currentWeek) && (tournament.completed || tournament.week < currentWeek))
      .sort((a, b) => b.week - a.week);

    return { current, upcoming, completed };
  }, [tournaments, currentWeek, seasonComplete]);

  const visibleTournaments = groupedTournaments[scheduleView] || [];
  const handleScheduleTabKeyDown = (event, viewId) => {
    const currentIndex = VIEW_OPTIONS.findIndex(option => option.id === viewId);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % VIEW_OPTIONS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = VIEW_OPTIONS.length - 1;
    else return;

    event.preventDefault();
    const nextView = VIEW_OPTIONS[nextIndex];
    setScheduleView(nextView.id);
    setExpandedScheduleTournament(null);
    requestAnimationFrame(() => document.getElementById(`schedule-view-${nextView.id}`)?.focus());
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Schedule</h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
            {seasonComplete
              ? 'Season complete — revisit any week’s results.'
              : 'Start with this week, then look ahead or revisit results.'}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-300 tabular-nums">
          {visibleTournaments.length} {visibleTournaments.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div
        className="grid grid-cols-3 gap-1 p-1 mb-4 rounded-xl bg-slate-100 dark:bg-slate-800"
        role="tablist"
        aria-label="Schedule views"
      >
        {VIEW_OPTIONS.map(option => {
          const Icon = option.icon;
          const isSelected = scheduleView === option.id;
          const count = groupedTournaments[option.id].length;

          return (
            <button
              key={option.id}
              id={`schedule-view-${option.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="schedule-view-panel"
              tabIndex={isSelected ? 0 : -1}
              onKeyDown={(event) => handleScheduleTabKeyDown(event, option.id)}
              onClick={() => {
                setScheduleView(option.id);
                setExpandedScheduleTournament(null);
              }}
              className={`min-w-0 px-2 py-2 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-soft'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{option.label}</span>
              <span className={`hidden sm:inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-md text-[10px] tabular-nums ${
                isSelected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="schedule-view-panel"
        role="tabpanel"
        aria-labelledby={`schedule-view-${scheduleView}`}
        className="space-y-2"
      >
        {visibleTournaments.length === 0 ? (
          <div className="card p-8 text-center">
            <CalendarDays size={28} className="mx-auto text-slate-300 dark:text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              No {scheduleView} tournaments
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
              {seasonComplete && scheduleView !== 'completed'
                ? 'The season is over — every event is under Completed.'
                : 'Choose another schedule view.'}
            </p>
          </div>
        ) : visibleTournaments.map((tournament) => {
          const isCurrent = !seasonComplete && tournament.week === currentWeek;
          const isCompleted = tournament.completed || tournament.week < currentWeek;
          const isExpanded = expandedScheduleTournament === tournament.id;
          const winnerGolfer = tournament.winner_golfer_name || null;
          const lockTime = tournament.picks_lock_time ? new Date(tournament.picks_lock_time) : null;

          return (
            <div key={tournament.id}>
              <button
                type="button"
                onClick={() => setExpandedScheduleTournament(
                  isExpanded ? null : tournament.id
                )}
                aria-expanded={isExpanded}
                aria-controls={`schedule-tournament-${tournament.id}`}
                className={`w-full text-left p-3 sm:p-4 rounded-xl border cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  isCurrent
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                } ${isExpanded ? 'rounded-b-none' : ''}`}
              >
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">{tournament.name}</h3>
                      <span className={`badge ${
                        tournament.prize_pool
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
                      }`}>
                        {formatPrizePool(tournament.prize_pool)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                      Wk {tournament.week} &middot; {new Date(tournament.tournament_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    {(tournament.course || tournament.location) && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                        {tournament.course}{tournament.course && tournament.location && ' · '}{tournament.location}
                      </p>
                    )}
                    {isCompleted && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        <Trophy size={11} className="fill-amber-400/40" />
                        {winnerGolfer ? (
                          <span className="truncate">
                            Won by <span className="font-semibold">{winnerGolfer}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-300 font-normal italic">
                            Winner not yet recorded
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isCurrent ? (
                      <span className="badge bg-emerald-600 dark:bg-emerald-500 text-white">
                        Current
                      </span>
                    ) : isCompleted ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-emerald-500 dark:text-emerald-300" />
                        <span className="text-xs text-slate-500 dark:text-slate-300">Done</span>
                      </div>
                    ) : (
                      <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                        Upcoming
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 dark:text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div
                  id={`schedule-tournament-${tournament.id}`}
                  className="border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-xl bg-white dark:bg-slate-900 p-4"
                >
                  {isCompleted ? (
                    <>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-3">
                        Week {tournament.week} Results
                      </p>
                      <div className="relative">
                        <div className="sm:hidden pointer-events-none absolute inset-y-0 right-0 w-6 z-10 bg-gradient-to-l from-white dark:from-slate-900" aria-hidden="true" />
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left py-2 px-2 text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Player</th>
                                <th className="text-left py-2 px-2 text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Pick</th>
                                <th className="text-right py-2 px-2 text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Won</th>
                                <th className="text-center py-2 px-2 text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Penalty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {players
                                .map(player => {
                                  const weekData = player.picksByWeek?.find(w => w.week === tournament.week);
                                  return { ...player, weekData };
                                })
                                .sort((a, b) => (b.weekData?.winnings || 0) - (a.weekData?.winnings || 0))
                                .map((player, idx) => {
                                  const pickedWinner = !!winnerGolfer && player.weekData?.golfer === winnerGolfer;
                                  return (
                                    <tr key={player.id} className={`border-b border-slate-100 dark:border-slate-800 ${
                                      pickedWinner
                                        ? 'bg-amber-50 dark:bg-amber-950/20'
                                        : player.id === currentUser?.id
                                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                          : idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''
                                    }`}>
                                      <td className="py-2 px-2 text-xs text-slate-900 dark:text-white font-medium">
                                        <span className="inline-flex items-center gap-1">
                                          {pickedWinner && (
                                            <Trophy
                                              size={12}
                                              className="text-amber-600 dark:text-amber-300 fill-amber-400/40"
                                              aria-label={`Picked the tournament winner: ${winnerGolfer}`}
                                            />
                                          )}
                                          {player.name}
                                          {player.id === currentUser?.id && <span className="ml-1 text-emerald-600 dark:text-emerald-300 text-[10px]">(you)</span>}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-xs">
                                        {player.weekData?.golfer ? (
                                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">{player.weekData.golfer}</span>
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
                                          <span className="text-slate-400 dark:text-slate-400">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {isCurrent ? 'This tournament is open now' : 'Plan ahead'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                          {lockTime
                            ? `Picks lock ${lockTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
                            : 'The pick deadline will appear when it is available.'}
                        </p>
                      </div>
                      {isCurrent && (
                        <button type="button" onClick={onGoToPick} className="btn-primary btn-sm shrink-0">
                          Open This Week&apos;s Pick
                        </button>
                      )}
                    </div>
                  )}
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
