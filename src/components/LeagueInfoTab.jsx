import React from 'react';
import { Trophy, Users, Calendar, CheckCircle, XCircle, Shield } from 'lucide-react';

const LeagueInfoTab = React.memo(function LeagueInfoTab({
  leagueSettings,
  players,
  currentUser,
  currentWeek,
  currentTournament,
  tournaments,
  availableGolfers,
  showAddGolfer,
  newGolferName,
  setShowAddGolfer,
  setNewGolferName,
  handleAddGolfer,
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">League Info</h2>

      <div className="space-y-4">
        {/* Prize Pool Calculator */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="text-amber-500" size={16} />
            Prize Pool & Payouts
          </h3>

          {(() => {
            const buyIn = leagueSettings.buy_in_amount ?? 50;
            const pctFirst = leagueSettings.payout_first_pct ?? 65;
            const pctSecond = leagueSettings.payout_second_pct ?? 25;
            const pctThird = leagueSettings.payout_third_pct ?? 10;
            const numPlayers = players.length;
            const totalPenalties = players.reduce((sum, p) => sum + (p.penalties || 0), 0);
            const totalPot = (numPlayers * buyIn) + totalPenalties;
            const firstPlace = Math.round(totalPot * pctFirst / 100);
            const secondPlace = Math.round(totalPot * pctSecond / 100);
            const thirdPlace = Math.round(totalPot * pctThird / 100);

            return (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Players</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">{numPlayers}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Buy-ins</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">${numPlayers * buyIn}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Penalties</p>
                    <p className="text-xl font-bold text-red-500 dark:text-red-400 tabular-nums mt-0.5">${totalPenalties}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl text-center border border-emerald-200 dark:border-emerald-800">
                    <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Pot</p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">${totalPot}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">1st ({pctFirst}%)</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">${firstPlace}</p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">2nd ({pctSecond}%)</p>
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-300 tabular-nums mt-0.5">${secondPlace}</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">3rd ({pctThird}%)</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums mt-0.5">${thirdPlace}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Golfer Management */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="text-emerald-500" size={16} />
            Golfer Management
          </h3>

          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{availableGolfers.length}</span> golfers available. Add new golfers who aren't in the master list (rookies, sponsor exemptions, etc.)
            </p>
          </div>

          {!showAddGolfer ? (
            <button
              onClick={() => setShowAddGolfer(true)}
              className="btn-primary"
            >
              <Users size={16} />
              Add Golfer
            </button>
          ) : (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
              <p className="label">Add New Golfer</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={50}
                  value={newGolferName}
                  onChange={(e) => setNewGolferName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGolfer()}
                  placeholder="e.g., Tiger Woods"
                  className="input flex-1"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddGolfer} className="btn-primary flex-1 sm:flex-none">
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddGolfer(false); setNewGolferName(''); }}
                    className="btn-secondary flex-1 sm:flex-none"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Season Progress */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar className="text-blue-500" size={16} />
            Season Progress
          </h3>
          {(() => {
            const completedWeeks = tournaments.filter(t => t.completed).length;
            const totalWeeks = tournaments.length;
            const progressPercent = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;

            return (
              <div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span>{completedWeeks} of {totalWeeks} weeks</span>
                  <span className="tabular-nums font-medium">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 dark:bg-emerald-400 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  {totalWeeks - completedWeeks} weeks remaining
                </p>
              </div>
            );
          })()}
        </div>

        {/* League Rules */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="text-blue-500" size={16} />
            League Rules
          </h3>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Buy-In & Fees</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <li>Season buy-in: <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">${leagueSettings.buy_in_amount ?? 50}</span></li>
                <li>Penalties added to prize pool</li>
              </ul>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Pick Deadlines</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <li>Picks lock on Thursdays at 2:00 AM ET</li>
                <li>Each golfer can only be used <span className="font-semibold text-slate-800 dark:text-slate-200">once per season</span></li>
                {leagueSettings.backup_picks_enabled && (
                  <li>Backup picks activate automatically if primary withdraws</li>
                )}
                <li>New week opens Monday after tournament ends</li>
              </ul>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Penalties</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <li>No Pick: <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">${leagueSettings.no_pick_penalty}</span></li>
                <li>Missed Cut: <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">${leagueSettings.missed_cut_penalty}</span></li>
                <li>Withdrawal: <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">${leagueSettings.withdrawal_penalty}</span></li>
                <li>Disqualification: <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">${leagueSettings.dq_penalty}</span></li>
              </ul>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Payouts</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <li>1st: <span className="font-semibold text-slate-800 dark:text-slate-200">{leagueSettings.payout_first_pct ?? 65}%</span> &middot; 2nd: <span className="font-semibold text-slate-800 dark:text-slate-200">{leagueSettings.payout_second_pct ?? 25}%</span> &middot; 3rd: <span className="font-semibold text-slate-800 dark:text-slate-200">{leagueSettings.payout_third_pct ?? 10}%</span></li>
                <li>Final standings based on total season winnings</li>
              </ul>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">How Winnings Work</p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <li>Your golfer's official PGA Tour prize money = your weekly earnings</li>
                <li>Season winner = highest total prize money</li>
              </ul>
            </div>
          </div>
        </div>

        {/* League Members */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="text-emerald-500" size={16} />
            Members ({players.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {players.map(player => (
              <div key={player.id} className={`p-2.5 rounded-xl text-center border ${
                player.id === currentUser?.id
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-800 border-transparent'
              }`}>
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{player.name}</p>
                {player.penalties > 0 && (
                  <p className="text-[10px] text-red-500 dark:text-red-400 tabular-nums mt-0.5">-${player.penalties}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pick Status Overview */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Week {currentWeek} Pick Status</h3>
          <div className="space-y-1.5">
            {players.map(player => {
              const now = new Date();
              const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
              const isLocked = lockTime && now >= lockTime;

              return (
                <div key={player.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs font-medium text-slate-900 dark:text-white">{player.name}</p>
                  <div>
                    {(() => {
                      const infoPickName = player.currentPick?.golfer_name;
                      const infoHasReal = infoPickName && infoPickName !== 'No Pick';
                      if (infoHasReal) {
                        return isLocked ? (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={14} />
                            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{infoPickName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={14} />
                            <span className="text-xs text-slate-400 dark:text-slate-500">Submitted</span>
                          </div>
                        );
                      }
                      return isLocked ? (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="text-red-400 dark:text-red-400" size={14} />
                          <span className="text-xs text-red-500 dark:text-red-400 font-medium">No Pick</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="text-slate-300 dark:text-slate-600" size={14} />
                          <span className="text-xs text-slate-400 dark:text-slate-500">Pending</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

export default LeagueInfoTab;
