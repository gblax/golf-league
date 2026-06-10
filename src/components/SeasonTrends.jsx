import React from 'react';
import { buildPlayerColors } from '../utils/playerColors';

// Season trend charts (Phase 3). Hand-rolled SVG so the PWA bundle stays lean —
// no charting library. Reads the same picksByWeek data the standings already
// load: cumulative winnings per player, plus the current user's week-by-week
// winnings. Winnings drive the standings; penalties are tracked separately and
// are not netted against winnings here.
//
// Line colors come from the shared per-player identity palette
// (utils/playerColors), so each player's chart color matches their avatar in
// the standings and live leaderboard. The current user is emphasized by
// stroke weight, an end dot, and a bold legend entry.

function compactMoney(n) {
  const v = Math.round(n);
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${v < 0 ? '-' : ''}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${v < 0 ? '-' : ''}$${Math.round(abs / 1000)}k`;
  return `${v < 0 ? '-' : ''}$${abs}`;
}

const SeasonTrends = React.memo(function SeasonTrends({ standings, currentUser, playerColors }) {
  const colorById = React.useMemo(
    () => playerColors || buildPlayerColors(standings),
    [playerColors, standings]
  );
  // Weeks that actually have posted results (isPast), as ordered x categories.
  const weeks = React.useMemo(() => {
    const s = new Set();
    standings.forEach((p) => (p.picksByWeek || []).forEach((w) => { if (w.isPast) s.add(w.week); }));
    return [...s].sort((a, b) => a - b);
  }, [standings]);

  // Cumulative winnings series per player across those weeks.
  const series = React.useMemo(() => {
    return standings.map((p) => {
      const byWeek = {};
      (p.picksByWeek || []).forEach((w) => { byWeek[w.week] = w.winnings || 0; });
      let cum = 0;
      const points = weeks.map((wk) => { cum += byWeek[wk] || 0; return cum; });
      return { id: p.id, name: p.name, points, final: cum, isUser: p.id === currentUser?.id };
    });
  }, [standings, weeks, currentUser]);

  if (weeks.length === 0) {
    return (
      <div className="card p-5 text-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">Charts appear once weekly results are posted.</p>
      </div>
    );
  }

  // ---- Cumulative line chart geometry ----
  const W = 720, H = 300, padL = 52, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const allVals = series.flatMap((s) => s.points);
  const yMax = Math.max(0, ...allVals);
  const yMin = Math.min(0, ...allVals);
  const ySpan = yMax - yMin || 1;
  const xFor = (i) => (weeks.length === 1 ? padL + plotW / 2 : padL + (i / (weeks.length - 1)) * plotW);
  const yFor = (v) => padT + (1 - (v - yMin) / ySpan) * plotH;

  const zeroY = yFor(0);

  // ---- Current user's week-by-week winnings (personal bars) ----
  const me = standings.find((p) => p.id === currentUser?.id);
  const myWeekly = weeks.map((wk) => {
    const w = (me?.picksByWeek || []).find((x) => x.week === wk);
    return { week: wk, winnings: w ? (w.winnings || 0) : 0 };
  });
  const myMax = Math.max(1, ...myWeekly.map((d) => d.winnings));

  // Legend ordered by current standing (final cumulative desc).
  const legend = [...series].sort((a, b) => b.final - a.final);

  return (
    <div className="space-y-4">
      {/* Cumulative net winnings */}
      <div className="card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Cumulative Winnings</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Season winnings total through each week.</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cumulative winnings by week">
          {/* y reference lines: top, zero, bottom */}
          {[yMax, 0, yMin].filter((v, i, arr) => arr.indexOf(v) === i).map((v) => (
            <g key={v}>
              <line x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)}
                stroke="currentColor" strokeOpacity={v === 0 ? 0.25 : 0.1} className="text-slate-400" />
              <text x={padL - 6} y={yFor(v) + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-500" fontSize="10">
                {compactMoney(v)}
              </text>
            </g>
          ))}
          {/* x labels: first and last week (and middle if room) */}
          {weeks.map((wk, i) => {
            const show = i === 0 || i === weeks.length - 1 || (weeks.length > 4 && i === Math.floor((weeks.length - 1) / 2));
            return show ? (
              <text key={wk} x={xFor(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize="10">
                Wk {wk}
              </text>
            ) : null;
          })}
          {/* one polyline per player (user drawn last/on top) */}
          {[...series].sort((a) => (a.isUser ? 1 : -1)).map((s) => {
            const pts = s.points.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');
            return (
              <polyline
                key={s.id}
                points={pts}
                fill="none"
                stroke={colorById[s.id]}
                strokeWidth={s.isUser ? 3 : 1.5}
                strokeOpacity={s.isUser ? 1 : 0.7}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
          {/* end dot for the current user */}
          {series.filter((s) => s.isUser && s.points.length).map((s) => (
            <circle key={s.id} cx={xFor(s.points.length - 1)} cy={yFor(s.points[s.points.length - 1])} r={3.5} fill={colorById[s.id]} />
          ))}
        </svg>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
          {legend.map((s) => (
            <span key={s.id} className={`inline-flex items-center gap-1.5 text-[11px] ${s.isUser ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorById[s.id] }} />
              {s.name}{s.isUser ? ' (you)' : ''}
              <span className="tabular-nums text-slate-400 dark:text-slate-500">{compactMoney(s.final)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Your week-by-week net */}
      {me && (
        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Your Week-by-Week Winnings</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{me.name}'s winnings each week.</p>
          <div className="flex items-end gap-1.5 h-32">
            {myWeekly.map((d) => {
              const h = Math.round((d.winnings / myMax) * 100);
              return (
                <div key={d.week} className="flex-1 flex flex-col items-center justify-end h-full group" title={`Wk ${d.week}: ${compactMoney(d.winnings)}`}>
                  <div
                    className="w-full rounded-t bg-emerald-500 dark:bg-emerald-400"
                    style={{ height: `${Math.max(2, h)}%` }}
                  />
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 tabular-nums">{d.week}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default SeasonTrends;
