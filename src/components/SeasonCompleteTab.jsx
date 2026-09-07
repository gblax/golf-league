import React from 'react';
import { Archive, ChevronRight, Crown, Flag, Medal, Sparkles, Trophy, Users } from 'lucide-react';
import EmptyState from './EmptyState';
import PlayerAvatar from './PlayerAvatar';
import { formatWinnings } from '../utils/money';
import { buildSeasonSummary } from '../utils/seasonSummary';

// Same deterministic particle layout as the Monday recap card, so the
// celebration renders identically every visit and collapses under the global
// reduced-motion rule.
const CONFETTI_COLORS = ['#bd9c47', '#2b8049', '#0ea5e9', '#ec4899', '#8b5cf6', '#f97316'];
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 11 + 2) % 100}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${(i % 6) * 0.1}s`,
}));

const ORDINALS = ['1st', '2nd', '3rd'];

function PayoutChip({ amount, pct, tone = 'amber' }) {
  if (!amount) return null;
  const tones = {
    amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
  };
  return (
    <span className={`badge border ${tones[tone]}`}>
      ${amount.toLocaleString()}
      {pct != null && <span className="font-medium opacity-70">· {pct}%</span>}
    </span>
  );
}

// One podium step (2nd / 3rd) under the champion hero.
function PodiumCard({ place, player, payout, pct, isYou, color }) {
  if (!player) {
    return (
      <div className="card p-4 border-dashed">
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wide">{ORDINALS[place]}</p>
        <p className="text-sm text-slate-400 dark:text-slate-400 mt-2">—</p>
      </div>
    );
  }
  // Payout sits on its own line under the name: two of these share a row on
  // phones, so a chip in the header wrapped and squeezed the name.
  return (
    <div className={`card p-4 ${isYou ? 'border-emerald-300 dark:border-emerald-700' : ''}`}>
      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide inline-flex items-center gap-1">
        <Medal size={12} className={place === 1 ? 'text-slate-400' : 'text-orange-500 dark:text-orange-400'} />
        {ORDINALS[place]}
      </p>
      <div className="flex items-center gap-2.5 mt-2.5 min-w-0">
        <PlayerAvatar name={player.name} color={color} size="lg" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
            {player.name}
            {isYou && <span className="ml-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">(you)</span>}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300 tabular-nums mt-0.5">{formatWinnings(player.winnings)}</p>
        </div>
      </div>
      {payout > 0 && (
        <div className="mt-3 whitespace-nowrap">
          <PayoutChip amount={payout} pct={pct} tone="slate" />
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, primary, secondary, value }) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide inline-flex items-center gap-1.5">
        <Icon size={12} className="text-emerald-600 dark:text-emerald-400" />
        {label}
      </p>
      <p className="text-sm font-bold text-slate-900 dark:text-white mt-2 truncate">{primary}</p>
      {secondary && <p className="text-xs text-slate-500 dark:text-slate-300 truncate mt-0.5">{secondary}</p>}
      {value && <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">{value}</p>}
    </div>
  );
}

// The league landing page once a season is over (every tournament scored and
// marked complete), and the view for browsing a past season's archive. Leads
// with the champion and the final podium — the thing everyone opens the app
// to see in September — then the full table, a few season superlatives, the
// viewer's own season, and what happens next.
const SeasonCompleteTab = React.memo(function SeasonCompleteTab({
  season,
  seasonComplete,
  isArchive,
  sortedStandings,
  tournaments,
  currentUser,
  playerColors = {},
  payouts,
  isCommissioner,
  onGoToStandings,
  onGoToAdmin,
}) {
  const summary = React.useMemo(
    () => buildSeasonSummary({ standings: sortedStandings, tournaments, currentUserId: currentUser?.id }),
    [sortedStandings, tournaments, currentUser],
  );
  const { champion, championTied, podium, winCounts, bestWeek, mostWinners, topGolfer, me } = summary;
  const amounts = payouts?.amounts || [0, 0, 0];
  const pcts = payouts?.pcts || [];
  const seasonLabel = season ? `${season} Season` : 'Season';
  const isYou = (p) => !!p && p.id === currentUser?.id;

  if (!sortedStandings || sortedStandings.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <EmptyState icon={Trophy} title={`${seasonLabel} complete`} caption="No members in this league yet." />
      </div>
    );
  }

  const celebrate = !!me?.isChampion && seasonComplete;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ---- Champion hero ---- */}
      <section
        className="relative overflow-hidden rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 via-white to-emerald-50 dark:from-amber-950/40 dark:via-slate-900 dark:to-emerald-950/30 p-5 sm:p-7 shadow-card"
        aria-label={seasonComplete ? `${seasonLabel} champion` : `${seasonLabel} leader`}
      >
        {celebrate && (
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
        <Trophy
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -bottom-8 w-24 h-24 sm:w-36 sm:h-36 sm:-right-8 sm:-bottom-10 text-amber-400/15 dark:text-amber-300/10 fill-current"
        />

        <div className="relative">
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider inline-flex items-center gap-1.5">
            <Crown size={13} className="fill-amber-400/40" />
            {seasonLabel} {seasonComplete ? 'Champion' : 'Leader'}
          </p>

          {champion ? (
            <>
              <div className="flex items-center gap-4 mt-3 min-w-0">
                <PlayerAvatar name={champion.name} color={playerColors[champion.id]} size="xl" className="ring-4 ring-amber-300/60 dark:ring-amber-700/50" />
                <div className="min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {champion.name}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
                    <span className="font-semibold text-slate-900 dark:text-white">{formatWinnings(champion.winnings)}</span>
                    {' '}in season winnings
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {seasonComplete && amounts[0] > 0 && (
                  <span className="badge border bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                    Takes home ${amounts[0].toLocaleString()}
                    {pcts[0] != null && <span className="font-medium opacity-70">· {pcts[0]}% of the pot</span>}
                  </span>
                )}
                {winCounts[champion.id] > 0 && (
                  <span className="badge border bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700">
                    <Trophy size={11} className="text-amber-500 fill-amber-400/40" />
                    {winCounts[champion.id]} tournament {winCounts[champion.id] === 1 ? 'winner' : 'winners'} called
                  </span>
                )}
                {championTied && (
                  <span className="badge border bg-white/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                    Tied on winnings — commissioner breaks the tie
                  </span>
                )}
              </div>

              {celebrate && (
                <p className="mt-4 text-sm font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5">
                  <Sparkles size={15} />
                  That&rsquo;s you. Congratulations, champ.
                </p>
              )}
              {!seasonComplete && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                  Final results are still pending, so the trophy isn&rsquo;t engraved yet.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No winnings were recorded this season.</p>
          )}
        </div>
      </section>

      {/* ---- Podium: 2nd and 3rd ---- */}
      {podium.length > 1 && (
        <div className="grid grid-cols-2 gap-3">
          <PodiumCard place={1} player={podium[1]} payout={seasonComplete ? amounts[1] : 0} pct={pcts[1]} isYou={isYou(podium[1])} color={playerColors[podium[1]?.id]} />
          <PodiumCard place={2} player={podium[2]} payout={seasonComplete ? amounts[2] : 0} pct={pcts[2]} isYou={isYou(podium[2])} color={playerColors[podium[2]?.id]} />
        </div>
      )}

      {/* ---- Final standings ---- */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
            <Users size={15} className="text-emerald-600 dark:text-emerald-400" />
            {seasonComplete ? 'Final Standings' : 'Standings'}
          </h3>
          <button
            type="button"
            onClick={onGoToStandings}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-white"
          >
            Week-by-week
            <ChevronRight size={14} />
          </button>
        </div>
        <ol className="px-2 pb-2">
          {sortedStandings.map((player, index) => (
            <li
              key={player.id}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${isYou(player) ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}`}
            >
              <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-[11px] font-bold tabular-nums shrink-0 ${
                index === 0
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                  : index === 1
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    : index === 2
                      ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {index + 1}
              </span>
              <PlayerAvatar name={player.name} color={playerColors[player.id]} size="sm" />
              <span className={`min-w-0 flex-1 text-sm truncate ${isYou(player) ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-800 dark:text-slate-100'}`}>
                {player.name}
                {winCounts[player.id] > 0 && (
                  <span
                    className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 align-middle"
                    title={`Picked ${winCounts[player.id]} tournament ${winCounts[player.id] === 1 ? 'winner' : 'winners'}`}
                  >
                    <Trophy size={10} className="fill-amber-400/40" />
                    {winCounts[player.id]}
                  </span>
                )}
              </span>
              {player.penalties > 0 && (
                <span className="text-[11px] text-red-500 dark:text-red-400 tabular-nums hidden sm:inline">-${player.penalties}</span>
              )}
              <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                {formatWinnings(player.winnings)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Season superlatives ---- */}
      {(bestWeek || mostWinners || topGolfer) && (
        <div className="grid sm:grid-cols-3 gap-3">
          {bestWeek && (
            <StatTile
              icon={Sparkles}
              label="Biggest week"
              primary={bestWeek.name}
              secondary={`${bestWeek.golfer} · Wk ${bestWeek.week}`}
              value={formatWinnings(bestWeek.winnings)}
            />
          )}
          {mostWinners && (
            <StatTile
              icon={Trophy}
              label="Most winners called"
              primary={mostWinners.name}
              secondary={`${mostWinners.count} tournament ${mostWinners.count === 1 ? 'winner' : 'winners'}`}
            />
          )}
          {topGolfer && (
            <StatTile
              icon={Flag}
              label="League MVP golfer"
              primary={topGolfer.golfer}
              secondary={`${topGolfer.picks} ${topGolfer.picks === 1 ? 'pick' : 'picks'} league-wide`}
              value={formatWinnings(topGolfer.winnings)}
            />
          )}
        </div>
      )}

      {/* ---- Your season ---- */}
      {me && (
        <section className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Your season</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Finish</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">#{me.rank}<span className="text-xs font-medium text-slate-400 dark:text-slate-400"> / {summary.memberCount}</span></p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Winnings</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">{formatWinnings(me.winnings)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Winners called</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">{me.winnersCalled}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide">Penalties</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${me.penalties > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                {me.penalties > 0 ? `-$${me.penalties}` : '$0'}
              </p>
            </div>
          </div>
          {me.bestWeek && me.bestWeek.winnings > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-3">
              Best pick: <span className="font-semibold text-slate-800 dark:text-slate-100">{me.bestWeek.golfer}</span>
              {' '}at the {me.bestWeek.tournamentName} (Wk {me.bestWeek.week}) —{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatWinnings(me.bestWeek.winnings)}</span>
            </p>
          )}
        </section>
      )}

      {/* ---- What's next ---- */}
      <section className="card p-4">
        {isArchive ? (
          <div className="flex items-start gap-2.5">
            <Archive size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">You&rsquo;re browsing the {seasonLabel.toLowerCase()} archive</p>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                Switch seasons from the header to get back to the current one.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Flag size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {seasonComplete ? 'See you at the 19th hole 🍻' : 'Final results pending'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                  {seasonComplete
                    ? `${summary.weeks} weeks in the books. Next season opens for picks as soon as the ${season ? season + 1 : 'new'} schedule is loaded — every golfer is fair game again.`
                    : 'The last week hasn’t been marked complete yet. Standings update once it is.'}
                </p>
              </div>
            </div>
            {isCommissioner && (
              <button type="button" onClick={onGoToAdmin} className="btn-secondary btn-sm shrink-0">
                {seasonComplete ? 'Set up next season' : 'Finish scoring'}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
});

export default SeasonCompleteTab;
