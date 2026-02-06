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
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Commissioner</h2>

      <div className="space-y-4">
        {/* Invite Code */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Mail className="text-emerald-500" size={16} />
            Invite Members
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Share this code with friends to join your league.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl font-mono text-base text-center font-bold text-slate-900 dark:text-white tracking-widest select-all border border-slate-200 dark:border-slate-700">
              {currentLeague?.invite_code}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentLeague?.invite_code || '');
                showNotification('success', 'Invite code copied!');
              }}
              className="btn-primary py-2.5"
            >
              Copy
            </button>
          </div>
        </div>

        {/* League Settings */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowLeagueSettings(!showLeagueSettings)}
            className="w-full flex items-center justify-between p-5"
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="text-slate-400" size={16} />
              League Settings
            </h3>
            <ChevronDown
              size={16}
              className={`text-slate-400 transition-transform duration-200 ${showLeagueSettings ? 'rotate-180' : ''}`}
            />
          </button>

          {showLeagueSettings && (
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              {/* Penalty Amounts */}
              <div>
                <p className="label">Penalty Amounts</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'No Pick Submitted', key: 'no_pick_penalty' },
                    { label: 'Missed Cut', key: 'missed_cut_penalty' },
                    { label: 'Withdrawal', key: 'withdrawal_penalty' },
                    { label: 'Disqualification', key: 'dq_penalty' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">$</span>
                        <input
                          type="number"
                          value={leagueSettings[key]}
                          onChange={(e) => setLeagueSettings({
                            ...leagueSettings,
                            [key]: parseInt(e.target.value) || 0
                          })}
                          className="input"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buy-In & Payout Settings */}
              <div>
                <p className="label">Buy-In & Payout Split</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Season Buy-In</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">$</span>
                      <input
                        type="number"
                        value={leagueSettings.buy_in_amount}
                        onChange={(e) => setLeagueSettings({
                          ...leagueSettings,
                          buy_in_amount: parseInt(e.target.value) || 0
                        })}
                        className="input"
                      />
                    </div>
                  </div>
                  {[
                    { label: '1st Place', key: 'payout_first_pct' },
                    { label: '2nd Place', key: 'payout_second_pct' },
                    { label: '3rd Place', key: 'payout_third_pct' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={leagueSettings[key]}
                          onChange={(e) => setLeagueSettings({
                            ...leagueSettings,
                            [key]: parseInt(e.target.value) || 0
                          })}
                          className="input"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
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
                className="btn-primary w-full sm:w-auto"
              >
                Save Settings
              </button>

              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Changes take effect immediately for new picks and penalties.
              </p>
            </div>
          )}
        </div>

        {/* Manage Tournament Results */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="text-amber-500" size={16} />
            Manage Results
          </h3>

          <div className="mb-4">
            <label className="label">Select Tournament</label>
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
              className="input"
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
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                        Editing: {selectedTournament?.name} (Week {selectedTournament?.week})
                      </p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">
                        {selectedTournament?.completed
                          ? 'Completed. You can still edit results.'
                          : isCurrentWeekTournament && !isPicksLocked
                          ? 'Picks are not yet locked.'
                          : 'Not yet completed.'}
                      </p>
                    </div>

                    {isCurrentWeekTournament && !isPicksLocked ? (
                      <div className="text-center py-10 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                        <Shield className="text-amber-400 mx-auto mb-3" size={32} />
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Picks Not Yet Visible</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Picks will show once the lock time passes.
                        </p>
                      </div>
                    ) : (
                      <>
                        {loadingEditPicks ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-8 h-8 border-[3px] border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Loading picks...</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {editTournamentPicks.map(user => {
                              const userData = editResultsData[user.id] || {};
                              const hasGolfer = userData.golferName;

                              return (
                                <div key={user.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
                                      {hasGolfer ? (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                          Pick: <span className="font-medium text-emerald-700 dark:text-emerald-400">{userData.golferName}</span>
                                        </p>
                                      ) : (
                                        <p className="text-xs text-red-500 dark:text-red-400 font-medium mt-0.5">
                                          No pick submitted
                                        </p>
                                      )}
                                    </div>
                                    {userData.winnings > 0 && (
                                      <span className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                                        ${parseInt(userData.winnings).toLocaleString()}
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="label">Winnings ($)</label>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={userData.winnings || ''}
                                        onChange={(e) => setEditResultsData({
                                          ...editResultsData,
                                          [user.id]: { ...userData, winnings: e.target.value }
                                        })}
                                        className="input"
                                      />
                                    </div>

                                    <div>
                                      <label className="label">Penalty</label>
                                      <select
                                        value={userData.penalty || ''}
                                        onChange={(e) => setEditResultsData({
                                          ...editResultsData,
                                          [user.id]: { ...userData, penalty: e.target.value }
                                        })}
                                        className="input"
                                      >
                                        <option value="">No penalty</option>
                                        <option value="no_pick">No Pick (${leagueSettings.no_pick_penalty})</option>
                                        <option value="missed_cut">Missed Cut (${leagueSettings.missed_cut_penalty})</option>
                                        <option value="withdrawal">Withdrawal (${leagueSettings.withdrawal_penalty})</option>
                                        <option value="disqualification">DQ (${leagueSettings.dq_penalty})</option>
                                      </select>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleSaveEditResults(user.id)}
                                    className="btn-primary w-full mt-3"
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
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <Trophy className="text-slate-300 dark:text-slate-600 mx-auto mb-2" size={32} />
              <p className="text-xs text-slate-400 dark:text-slate-500">Select a tournament above to edit results.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CommissionerTab;
