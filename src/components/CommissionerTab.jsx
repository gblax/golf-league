import React from 'react';
import { Trophy, Shield, Mail, Settings, ChevronDown } from 'lucide-react';

const CommissionerTab = React.memo(function CommissionerTab({
  currentLeague,
  leagueSettings,
  tournaments,
  currentWeek,
  editTournamentId,
  editTournamentPicks,
  editResultsData,
  loadingEditPicks,
  showLeagueSettings,
  showNotification,
  setEditTournamentId,
  setEditResultsData,
  setShowLeagueSettings,
  setLeagueSettings,
  setEditTournamentPicks,
  handleUpdateLeagueSettings,
  handleSaveEditResults,
  loadTournamentPicks,
  getPenaltyAmount,
}) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Commissioner</h2>

      <div className="space-y-6">
        {/* Invite Code */}
        <div className="bg-white dark:bg-slate-700 border border-green-300 dark:border-green-600 rounded-xl p-6 shadow-lg">
          <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-100 mb-3">
            <Mail className="text-green-600 dark:text-green-400" />
            Invite Members
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Share this code with friends so they can join your league.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 p-3 bg-gray-100 dark:bg-slate-600 rounded-xl font-mono text-lg text-center font-bold text-gray-800 dark:text-gray-100 tracking-widest select-all">
              {currentLeague?.invite_code}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentLeague?.invite_code || '');
                showNotification('success', 'Invite code copied!');
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-semibold transition-colors active:scale-95"
            >
              Copy
            </button>
          </div>
        </div>

        {/* League Settings */}
        <div className="bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-600 rounded-xl p-6 shadow-lg">
          <button
            onClick={() => setShowLeagueSettings(!showLeagueSettings)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <Settings className="text-purple-600 dark:text-purple-400" />
              League Settings
            </h3>
            <ChevronDown
              size={20}
              className={`text-gray-500 transition-transform duration-200 ${showLeagueSettings ? 'rotate-180' : ''}`}
            />
          </button>

          {showLeagueSettings && (
            <div className="mt-4 space-y-4">
              {/* Penalty Amounts */}
              <div className="p-4 bg-gray-50 dark:bg-slate-600 rounded-xl space-y-4">
                <p className="font-semibold text-gray-800 dark:text-gray-100">Penalty Amounts</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">No Pick Submitted</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={leagueSettings.no_pick_penalty}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          no_pick_penalty: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Missed Cut</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={leagueSettings.missed_cut_penalty}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          missed_cut_penalty: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Withdrawal</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={leagueSettings.withdrawal_penalty}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          withdrawal_penalty: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Disqualification</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={leagueSettings.dq_penalty}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          dq_penalty: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Buy-In & Payout Settings */}
              <div className="p-4 bg-gray-50 dark:bg-slate-600 rounded-xl space-y-4">
                <p className="font-semibold text-gray-800 dark:text-gray-100">Buy-In & Payout Split</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Season Buy-In</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400">$</span>
                      <input
                        type="number"
                        value={leagueSettings.buy_in_amount}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          buy_in_amount: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">1st Place Payout</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={leagueSettings.payout_first_pct}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          payout_first_pct: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">2nd Place Payout</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={leagueSettings.payout_second_pct}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          payout_second_pct: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">3rd Place Payout</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={leagueSettings.payout_third_pct}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          payout_third_pct: parseInt(e.target.value) || 0
                        })}
                        className="flex-1 p-2 border-2 border-gray-200 dark:border-slate-500 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleUpdateLeagueSettings({
                    no_pick_penalty: leagueSettings.no_pick_penalty,
                    missed_cut_penalty: leagueSettings.missed_cut_penalty,
                    withdrawal_penalty: leagueSettings.withdrawal_penalty,
                    dq_penalty: leagueSettings.dq_penalty,
                    buy_in_amount: leagueSettings.buy_in_amount,
                    payout_first_pct: leagueSettings.payout_first_pct,
                    payout_second_pct: leagueSettings.payout_second_pct,
                    payout_third_pct: leagueSettings.payout_third_pct
                  })}
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors active:scale-95"
                >
                  Save League Settings
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                Changes take effect immediately for new picks and penalties.
              </p>
            </div>
          )}
        </div>

        {/* Manage Tournament Results */}
        <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-6 shadow-lg">
          <h3 className="font-bold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-100 mb-4">
            <Trophy className="text-yellow-500" />
            Manage Tournament Results
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Select Tournament to Edit
            </label>
            <select
              value={editTournamentId || ''}
              onChange={(e) => {
                const newId = e.target.value;
                setEditTournamentId(newId);
                if (newId) {
                  loadTournamentPicks(newId);
                } else {
                  setEditTournamentPicks([]);
                  setEditResultsData({});
                }
              }}
              className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none text-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="">-- Select a tournament --</option>
              {tournaments
                .filter(t => {
                  const lockTime = t.picks_lock_time ? new Date(t.picks_lock_time) : null;
                  return lockTime && new Date() >= lockTime;
                })
                .map(t => (
                <option key={t.id} value={t.id}>
                  Week {t.week}: {t.name} {t.completed ? '✓' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Edit Results Form */}
          {editTournamentId && (
            <div>
              {(() => {
                const selectedTournament = tournaments.find(t => t.id === editTournamentId);
                const now = new Date();
                const lockTime = selectedTournament?.picks_lock_time ? new Date(selectedTournament.picks_lock_time) : null;
                const isPicksLocked = lockTime && now >= lockTime;
                const isCurrentWeekTournament = selectedTournament?.week === currentWeek && !selectedTournament?.completed;

                return (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 p-4 mb-4 rounded-r-xl">
                      <p className="text-blue-800 dark:text-blue-300">
                        <strong>Editing:</strong> {selectedTournament?.name} (Week {selectedTournament?.week})
                      </p>
                      <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">
                        {selectedTournament?.completed
                          ? 'This tournament is marked as completed. You can still edit results.'
                          : isCurrentWeekTournament && !isPicksLocked
                          ? '🔒 Picks are not yet locked. Player picks will be visible after the tournament starts.'
                          : 'This tournament is not yet completed.'}
                      </p>
                    </div>

                    {isCurrentWeekTournament && !isPicksLocked ? (
                      <div className="text-center py-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-300 dark:border-amber-700">
                        <Shield className="text-amber-500 dark:text-amber-400 mx-auto mb-4" size={48} />
                        <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Picks Not Yet Visible</h3>
                        <p className="text-amber-700 dark:text-amber-400">
                          Player picks for this tournament will be visible once picks lock.
                        </p>
                      </div>
                    ) : (
                      <>
                        {loadingEditPicks ? (
                          <div className="text-center py-8">
                            <div className="w-10 h-10 border-4 border-green-600 dark:border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-400">Loading picks...</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {editTournamentPicks.map(user => {
                              const userData = editResultsData[user.id] || {};
                              const hasGolfer = userData.golferName;

                              return (
                                <div key={user.id} className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <p className="font-bold text-lg text-gray-800 dark:text-gray-100">{user.name}</p>
                                      {hasGolfer ? (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                          Golfer: <span className="font-semibold text-gray-800 dark:text-gray-200">{userData.golferName}</span>
                                        </p>
                                      ) : (
                                        <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
                                          ⚠️ No pick submitted
                                        </p>
                                      )}
                                    </div>
                                    {userData.winnings > 0 && (
                                      <div className="text-right">
                                        <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-semibold">
                                          ${parseInt(userData.winnings).toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Winnings ($)
                                      </label>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={userData.winnings || ''}
                                        onChange={(e) => setEditResultsData({
                                          ...editResultsData,
                                          [user.id]: { ...userData, winnings: e.target.value }
                                        })}
                                        className="w-full p-2 border-2 border-gray-200 dark:border-slate-600 rounded-lg focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                        Penalty
                                      </label>
                                      <select
                                        value={userData.penalty || ''}
                                        onChange={(e) => setEditResultsData({
                                          ...editResultsData,
                                          [user.id]: { ...userData, penalty: e.target.value }
                                        })}
                                        className="w-full p-2 border-2 border-gray-200 dark:border-slate-600 rounded-lg focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                      >
                                        <option value="">No penalty</option>
                                        <option value="no_pick">No Pick Submitted (${leagueSettings.no_pick_penalty})</option>
                                        <option value="missed_cut">Missed Cut (${leagueSettings.missed_cut_penalty})</option>
                                        <option value="withdrawal">Withdrawal (${leagueSettings.withdrawal_penalty})</option>
                                        <option value="disqualification">Disqualification (${leagueSettings.dq_penalty})</option>
                                      </select>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleSaveEditResults(user.id)}
                                    className="mt-3 w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-2.5 px-4 rounded-xl font-semibold shadow hover:shadow-lg transition-all"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {!editTournamentId && (
            <div className="text-center py-12 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
              <Trophy className="text-gray-400 dark:text-gray-500 mx-auto mb-4" size={48} />
              <p className="text-gray-600 dark:text-gray-400">Select a tournament above to view and edit results.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CommissionerTab;
