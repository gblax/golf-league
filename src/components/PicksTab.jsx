import React from 'react';
import { CheckCircle, Shield } from 'lucide-react';

const PicksTab = React.memo(function PicksTab({
  currentWeek,
  currentTournament,
  currentWeekPick,
  selectedPlayer,
  backupPlayer,
  primarySearchTerm,
  backupSearchTerm,
  showPrimaryDropdown,
  showBackupDropdown,
  timeUntilLock,
  leagueSettings,
  userPicks,
  filteredPrimaryGolfers,
  filteredBackupGolfers,
  picksLoading,
  formatPrizePool,
  setSelectedPlayer,
  setBackupPlayer,
  setPrimarySearchTerm,
  setBackupSearchTerm,
  setShowPrimaryDropdown,
  setShowBackupDropdown,
  handleSubmitPick,
  submittingPick,
}) {
  if (picksLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-green-600 dark:border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-xl font-semibold text-gray-600 dark:text-gray-400">Loading your picks...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Submit Your Pick</h2>
        {timeUntilLock && timeUntilLock !== 'Locked' && (
          <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-4 py-2 rounded-xl">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              ⏰ Picks lock in: <span className="font-bold">{timeUntilLock}</span>
            </p>
          </div>
        )}
        {timeUntilLock === 'Locked' && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-4 py-2 rounded-xl">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              🔒 Picks are locked
            </p>
          </div>
        )}
      </div>

      {/* Current Selection - Prominent at top */}
      {currentWeekPick.golfer && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-blue-100 text-sm font-medium">Week {currentWeek} Selection</p>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                  {formatPrizePool(currentTournament?.prize_pool)} purse
                </span>
              </div>
              <p className="text-white text-xl font-bold">{currentWeekPick.golfer}</p>
              {leagueSettings.backup_picks_enabled && currentWeekPick.backup && (
                <p className="text-blue-200 text-sm mt-1">
                  Backup: <span className="font-semibold text-white">{currentWeekPick.backup}</span>
                </p>
              )}
            </div>
            <CheckCircle className="text-white/80" size={40} />
          </div>
        </div>
      )}

      {/* No selection prompt */}
      {!currentWeekPick.golfer && (
        <div className="mb-6 p-4 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-slate-700 dark:to-slate-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No pick selected yet for Week {currentWeek}
            </p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatPrizePool(currentTournament?.prize_pool)} purse this week
            </p>
          </div>
        </div>
      )}

      {/* Primary Pick */}
      <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 relative searchable-dropdown">
        <label className="block font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
          <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
          Pick for Week {currentWeek}:
        </label>
        <div className="relative">
          <input
            type="text"
            value={selectedPlayer || primarySearchTerm}
            onChange={(e) => {
              setPrimarySearchTerm(e.target.value);
              setSelectedPlayer('');
              setShowPrimaryDropdown(true);
            }}
            onFocus={() => setShowPrimaryDropdown(true)}
            placeholder="Start typing to search golfers..."
            className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
          />
          {showPrimaryDropdown && primarySearchTerm && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {filteredPrimaryGolfers.length > 0 ? (
                filteredPrimaryGolfers.map((golfer, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedPlayer(golfer);
                      setPrimarySearchTerm('');
                      setShowPrimaryDropdown(false);
                    }}
                    className="p-3 hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer border-b border-gray-200 dark:border-slate-600 last:border-b-0 text-gray-800 dark:text-gray-200"
                  >
                    {golfer}
                  </div>
                ))
              ) : (
                <div className="p-3 text-gray-500 dark:text-gray-400 italic">No golfers found</div>
              )}
            </div>
          )}
        </div>
        {selectedPlayer && (
          <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-between">
            <span className="font-semibold text-green-800 dark:text-green-300">✓ Selected: {selectedPlayer}</span>
            <button
              onClick={() => {
                setSelectedPlayer('');
                setPrimarySearchTerm('');
              }}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          <strong>Note:</strong> You can only make picks for the current tournament. Future week picks will open on Monday after the current tournament ends.
        </p>
      </div>

      {/* Backup Pick - only show if enabled in settings */}
      {leagueSettings.backup_picks_enabled && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 relative searchable-dropdown">
          <label className="block font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
            <Shield className="text-amber-600 dark:text-amber-400" size={20} />
            Backup Pick (Optional but Recommended)
          </label>
          <div className="relative">
            <input
              type="text"
              value={backupPlayer || backupSearchTerm}
              onChange={(e) => {
                setBackupSearchTerm(e.target.value);
                setBackupPlayer('');
                setShowBackupDropdown(true);
              }}
              onFocus={() => setShowBackupDropdown(true)}
              placeholder="Start typing to search golfers..."
              className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-amber-500 dark:focus:border-amber-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            />
            {showBackupDropdown && backupSearchTerm && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {filteredBackupGolfers.length > 0 ? (
                  filteredBackupGolfers.map((golfer, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setBackupPlayer(golfer);
                        setBackupSearchTerm('');
                        setShowBackupDropdown(false);
                      }}
                      className="p-3 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer border-b border-gray-200 dark:border-slate-600 last:border-b-0 text-gray-800 dark:text-gray-200"
                    >
                      {golfer}
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-gray-500 dark:text-gray-400 italic">No golfers found</div>
                )}
              </div>
            )}
          </div>
          {backupPlayer && (
            <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-between">
              <span className="font-semibold text-amber-800 dark:text-amber-300">✓ Selected: {backupPlayer}</span>
              <button
                onClick={() => {
                  setBackupPlayer('');
                  setBackupSearchTerm('');
                }}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            <strong>Note:</strong> Auto-activates if your primary withdraws before the tournament. Each golfer can only be used once per season.
          </p>
        </div>
      )}

      {(() => {
        const now = new Date();
        const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
        const tournamentStartTime = currentTournament?.tournament_date ? new Date(currentTournament.tournament_date) : null;
        const isLocked = lockTime && now >= lockTime;
        const tournamentStarted = tournamentStartTime && now >= tournamentStartTime;

        return (
          <>
            {isLocked && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-xl">
                <p className="text-red-800 dark:text-red-300 font-semibold text-center">
                  {tournamentStarted ? (
                    <>🔒 Picks are locked! This tournament has already started.</>
                  ) : (
                    <>🔒 Picks are locked! The next week will open on Monday after this tournament ends.</>
                  )}
                </p>
              </div>
            )}

            <button
              onClick={handleSubmitPick}
              disabled={!selectedPlayer || isLocked || submittingPick}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-500 dark:disabled:from-slate-600 dark:disabled:to-slate-700 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:scale-95 disabled:transform-none disabled:active:scale-100 transition-all duration-150"
            >
              {isLocked ? 'Picks Locked' : submittingPick ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : 'Submit Pick'}
            </button>

            {lockTime && !isLocked && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                Picks lock at {lockTime.toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </p>
            )}
          </>
        );
      })()}

      {/* Used Golfers Section - exclude current week's pick */}
      {(() => {
        const currentPick = selectedPlayer || currentWeekPick.golfer;
        const pastPicks = userPicks.filter(p => p && p !== currentPick);
        return pastPicks.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Golfers Used in Prior Weeks ({pastPicks.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {pastPicks.map((golfer, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-1 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 text-xs rounded-full"
                >
                  {golfer}
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
});

export default PicksTab;
