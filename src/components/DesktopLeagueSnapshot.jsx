import React from 'react';
import { AlertCircle, CalendarDays, CheckCircle, ChevronRight, Trophy } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import { formatWinnings } from '../utils/money';

const DesktopLeagueSnapshot = React.memo(function DesktopLeagueSnapshot({
  sortedStandings,
  currentUser,
  currentWeek,
  currentWeekPick,
  tournaments,
  playerColors,
  formatPrizePool,
  onGoToStandings,
  onGoToSchedule,
}) {
  const currentPlayerIndex = sortedStandings.findIndex(player => player.id === currentUser?.id);
  const currentPlayer = currentPlayerIndex >= 0 ? sortedStandings[currentPlayerIndex] : null;
  const playerAhead = currentPlayerIndex > 0 ? sortedStandings[currentPlayerIndex - 1] : null;
  const nextTournament = tournaments
    .filter(tournament => tournament.week > currentWeek)
    .sort((a, b) => a.week - b.week)[0];
  const gapToNext = currentPlayer && playerAhead
    ? Math.max(0, (playerAhead.winnings || 0) - (currentPlayer.winnings || 0))
    : 0;

  return (
    <aside className="hidden xl:block space-y-4" aria-label="League snapshot">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide">Your position</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              {currentPlayerIndex >= 0 ? `#${currentPlayerIndex + 1}` : '—'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
            <Trophy size={20} className="text-emerald-600 dark:text-emerald-300" />
          </div>
        </div>
        {currentPlayer && (
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
            {formatWinnings(currentPlayer.winnings)}
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          {currentPlayerIndex === 0
            ? 'You are leading the league.'
            : playerAhead
              ? `${formatWinnings(gapToNext)} behind ${playerAhead.name}.`
              : 'Standings update after results are posted.'}
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Standings</h3>
          <button
            type="button"
            onClick={onGoToStandings}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white"
          >
            View all
            <ChevronRight size={14} />
          </button>
        </div>
        <ol className="px-2 pb-2">
          {sortedStandings.slice(0, 5).map((player, index) => (
            <li
              key={player.id}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg ${
                player.id === currentUser?.id ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''
              }`}
            >
              <span className="w-4 text-[10px] font-semibold text-slate-500 dark:text-slate-300 tabular-nums">{index + 1}</span>
              <PlayerAvatar name={player.name} color={playerColors[player.id]} size="xs" />
              <span className={`min-w-0 flex-1 text-xs truncate ${
                player.id === currentUser?.id
                  ? 'font-bold text-slate-900 dark:text-white'
                  : 'font-medium text-slate-700 dark:text-slate-200'
              }`}>
                {player.name}
              </span>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {formatWinnings(player.winnings)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className={`card p-4 border ${
        currentWeekPick?.golfer
          ? 'border-emerald-200 dark:border-emerald-800'
          : 'border-amber-200 dark:border-amber-800'
      }`}>
        <div className="flex items-start gap-2.5">
          {currentWeekPick?.golfer ? (
            <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-300 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={18} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              {currentWeekPick?.golfer ? 'Pick submitted' : 'Pick still needed'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5 truncate">
              {currentWeekPick?.golfer || `Week ${currentWeek} is open.`}
            </p>
          </div>
        </div>
      </div>

      {nextTournament && (
        <button
          type="button"
          onClick={onGoToSchedule}
          className="card p-4 w-full text-left hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
        >
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-2">
            <CalendarDays size={15} />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Next up</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{nextTournament.name}</p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-slate-500 dark:text-slate-300">
              Week {nextTournament.week}
            </p>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {formatPrizePool(nextTournament.prize_pool)}
            </span>
          </div>
        </button>
      )}
    </aside>
  );
});

export default DesktopLeagueSnapshot;
