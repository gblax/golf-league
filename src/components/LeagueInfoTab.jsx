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
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">League Info</h2>

      <div className="space-y-6">
        {/* Prize Pool Calculator */}
        <div className="bg-white dark:bg-slate-700 border border-green-500 dark:border-green-400 rounded-xl p-6 shadow-lg">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <Trophy className="text-yellow-500" />
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-slate-600 p-4 rounded-xl text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Players</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{numPlayers}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-600 p-4 rounded-xl text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Buy-ins</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">${numPlayers * buyIn}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Penalties</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">${totalPenalties}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl text-center border border-green-500 dark:border-green-400">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Pot</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalPot}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 p-4 rounded-xl text-center">
                    <div className="text-3xl mb-1">🥇</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">1st Place ({pctFirst}%)</p>
                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">${firstPlace}</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-slate-600 border border-gray-400 dark:border-slate-500 p-4 rounded-xl text-center">
                    <div className="text-3xl mb-1">🥈</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">2nd Place ({pctSecond}%)</p>
                    <p className="text-xl font-bold text-gray-600 dark:text-gray-300">${secondPlace}</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-400 dark:border-orange-600 p-4 rounded-xl text-center">
                    <div className="text-3xl mb-1">🥉</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">3rd Place ({pctThird}%)</p>
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">${thirdPlace}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Golfer Management */}
        <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <Users className="text-green-600 dark:text-green-400" />
            Golfer Management
          </h3>

          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              <strong>Current Golfers:</strong> {availableGolfers.length} players available
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Add new golfers who aren't in the master list (rookies, sponsor exemptions, etc.)
            </p>
          </div>

          {!showAddGolfer ? (
            <button
              onClick={() => setShowAddGolfer(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-2.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Users size={18} />
              Add New Golfer
            </button>
          ) : (
            <div className="border border-green-200 dark:border-green-800 rounded-xl p-4 bg-green-50 dark:bg-green-900/20">
              <h4 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Add New Golfer</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newGolferName}
                  onChange={(e) => setNewGolferName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGolfer()}
                  placeholder="Enter golfer name (e.g., Tiger Woods)"
                  className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-600 rounded-lg focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={handleAddGolfer}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors active:scale-95"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddGolfer(false);
                      setNewGolferName('');
                    }}
                    className="flex-1 sm:flex-none bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Tip: Use proper capitalization (e.g., "Jon Rahm" not "jon rahm")
              </p>
            </div>
          )}
        </div>

        {/* Season Progress */}
        <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <Calendar className="text-blue-600 dark:text-blue-400" />
            Season Progress
          </h3>
          {(() => {
            const completedWeeks = tournaments.filter(t => t.completed).length;
            const totalWeeks = tournaments.length;
            const progressPercent = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;

            return (
              <div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>{completedWeeks} of {totalWeeks} weeks completed</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {totalWeeks - completedWeeks} weeks remaining
                </p>
              </div>
            );
          })()}
        </div>

        {/* League Rules */}
        <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <Shield className="text-blue-600 dark:text-blue-400" />
            League Rules
          </h3>

          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Buy-In & Fees</h4>
              <ul className="text-sm text-blue-900 dark:text-blue-300 space-y-1">
                <li>• Season buy-in: <strong>${leagueSettings.buy_in_amount ?? 50}</strong></li>
                <li>• Penalties added to prize pool</li>
              </ul>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Pick Deadlines</h4>
              <ul className="text-sm text-amber-900 dark:text-amber-300 space-y-1">
                <li>• Picks lock on Thursdays at 2:00 AM ET</li>
                <li>• Each golfer can only be used <strong>once per season</strong></li>
                {leagueSettings.backup_picks_enabled && (
                  <li>• Backup picks activate automatically if primary withdraws before tournament start</li>
                )}
                <li>• New week picks open Monday after current tournament ends</li>
              </ul>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
              <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Penalties</h4>
              <ul className="text-sm text-red-900 dark:text-red-300 space-y-1">
                <li>• <strong>No Pick Submitted:</strong> ${leagueSettings.no_pick_penalty} penalty</li>
                <li>• <strong>Missed Cut:</strong> ${leagueSettings.missed_cut_penalty} penalty</li>
                <li>• <strong>Withdrawal:</strong> ${leagueSettings.withdrawal_penalty} penalty {!leagueSettings.backup_picks_enabled && '(pre-tournament or during)'}</li>
                <li>• <strong>Disqualification:</strong> ${leagueSettings.dq_penalty} penalty</li>
              </ul>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Payout Structure</h4>
              <ul className="text-sm text-green-900 dark:text-green-300 space-y-1">
                <li>• <strong>1st Place:</strong> {leagueSettings.payout_first_pct ?? 65}% of total pot</li>
                <li>• <strong>2nd Place:</strong> {leagueSettings.payout_second_pct ?? 25}% of total pot</li>
                <li>• <strong>3rd Place:</strong> {leagueSettings.payout_third_pct ?? 10}% of total pot</li>
                <li>• Final standings based on total season winnings</li>
              </ul>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
              <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">How Winnings Work</h4>
              <ul className="text-sm text-purple-900 dark:text-purple-300 space-y-1">
                <li>• Your golfer's official PGA Tour prize money counts as your weekly earnings</li>
                <li>• Season winner = highest total prize money accumulated</li>
              </ul>
            </div>
          </div>
        </div>

        {/* League Members */}
        <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <Users className="text-green-600 dark:text-green-400" />
            League Members ({players.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {players.map(player => (
              <div key={player.id} className="bg-gray-50 dark:bg-slate-600 p-3 rounded-xl text-center">
                <p className="font-semibold text-gray-800 dark:text-gray-100">{player.name}</p>
                {player.penalties > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">Penalties: ${player.penalties}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pick Status Overview */}
        <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-100">Week {currentWeek} Pick Status</h3>
          <div className="space-y-2">
            {players.map(player => {
              const now = new Date();
              const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
              const isLocked = lockTime && now >= lockTime;

              return (
                <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-600 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{player.name}</p>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const infoPickName = player.currentPick?.golfer_name;
                      const infoHasReal = infoPickName && infoPickName !== 'No Pick';
                      if (infoHasReal) {
                        return isLocked ? (
                          <div>
                            <CheckCircle className="inline text-green-600 dark:text-green-400 mr-2" size={20} />
                            <span className="text-green-700 dark:text-green-400 font-semibold">Submitted</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {infoPickName}
                              {leagueSettings.backup_picks_enabled && player.currentPick.backup_golfer_name && ` (Backup: ${player.currentPick.backup_golfer_name})`}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <CheckCircle className="inline text-green-600 dark:text-green-400 mr-2" size={20} />
                            <span className="text-green-700 dark:text-green-400 font-semibold">Submitted (Hidden)</span>
                          </div>
                        );
                      }
                      return isLocked ? (
                        <div>
                          <XCircle className="inline text-red-600 dark:text-red-400 mr-2" size={20} />
                          <span className="text-red-700 dark:text-red-400 font-semibold">No Pick</span>
                        </div>
                      ) : (
                        <div>
                          <XCircle className="inline text-red-600 dark:text-red-400 mr-2" size={20} />
                          <span className="text-red-700 dark:text-red-400 font-semibold">Pending</span>
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
