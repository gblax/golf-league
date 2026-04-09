import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Shield, X } from 'lucide-react';

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
  const [primaryHighlightIndex, setPrimaryHighlightIndex] = useState(0);
  const [backupHighlightIndex, setBackupHighlightIndex] = useState(0);
  const primaryListRef = useRef(null);
  const backupListRef = useRef(null);

  // Reset highlight when the filtered list changes so we never point past the end.
  useEffect(() => {
    setPrimaryHighlightIndex(0);
  }, [filteredPrimaryGolfers]);

  useEffect(() => {
    setBackupHighlightIndex(0);
  }, [filteredBackupGolfers]);

  // Keep the highlighted option scrolled into view as the user arrows through it.
  useEffect(() => {
    const list = primaryListRef.current;
    if (!list) return;
    const el = list.querySelector(`#primary-golfer-option-${primaryHighlightIndex}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [primaryHighlightIndex, showPrimaryDropdown]);

  useEffect(() => {
    const list = backupListRef.current;
    if (!list) return;
    const el = list.querySelector(`#backup-golfer-option-${backupHighlightIndex}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [backupHighlightIndex, showBackupDropdown]);

  const handlePrimaryKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!showPrimaryDropdown) setShowPrimaryDropdown(true);
      if (filteredPrimaryGolfers.length === 0) return;
      e.preventDefault();
      setPrimaryHighlightIndex((i) => (i + 1) % filteredPrimaryGolfers.length);
    } else if (e.key === 'ArrowUp') {
      if (filteredPrimaryGolfers.length === 0) return;
      e.preventDefault();
      setPrimaryHighlightIndex((i) =>
        i <= 0 ? filteredPrimaryGolfers.length - 1 : i - 1,
      );
    } else if (e.key === 'Enter') {
      if (showPrimaryDropdown && primarySearchTerm && filteredPrimaryGolfers.length > 0) {
        e.preventDefault();
        const golfer = filteredPrimaryGolfers[primaryHighlightIndex] || filteredPrimaryGolfers[0];
        setSelectedPlayer(golfer);
        setPrimarySearchTerm('');
        setShowPrimaryDropdown(false);
      }
    } else if (e.key === 'Escape') {
      if (showPrimaryDropdown) {
        e.preventDefault();
        setShowPrimaryDropdown(false);
      }
    }
  };

  const handleBackupKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!showBackupDropdown) setShowBackupDropdown(true);
      if (filteredBackupGolfers.length === 0) return;
      e.preventDefault();
      setBackupHighlightIndex((i) => (i + 1) % filteredBackupGolfers.length);
    } else if (e.key === 'ArrowUp') {
      if (filteredBackupGolfers.length === 0) return;
      e.preventDefault();
      setBackupHighlightIndex((i) =>
        i <= 0 ? filteredBackupGolfers.length - 1 : i - 1,
      );
    } else if (e.key === 'Enter') {
      if (showBackupDropdown && backupSearchTerm && filteredBackupGolfers.length > 0) {
        e.preventDefault();
        const golfer = filteredBackupGolfers[backupHighlightIndex] || filteredBackupGolfers[0];
        setBackupPlayer(golfer);
        setBackupSearchTerm('');
        setShowBackupDropdown(false);
      }
    } else if (e.key === 'Escape') {
      if (showBackupDropdown) {
        e.preventDefault();
        setShowBackupDropdown(false);
      }
    }
  };

  if (picksLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-[3px] border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading picks...</p>
      </div>
    );
  }

  const now = new Date();
  const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
  const isLocked = lockTime && now >= lockTime;

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Week {currentWeek} Pick</h2>
        {timeUntilLock && timeUntilLock !== 'Locked' && (
          <span className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            {timeUntilLock} left
          </span>
        )}
        {timeUntilLock === 'Locked' && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
            Locked
          </span>
        )}
      </div>

      {/* Current Selection Card */}
      {currentWeekPick.golfer ? (
        <div className="mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Current Pick</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{currentWeekPick.golfer}</p>
              {leagueSettings.backup_picks_enabled && currentWeekPick.backup && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Backup: <span className="font-medium text-slate-700 dark:text-slate-300">{currentWeekPick.backup}</span>
                </p>
              )}
            </div>
            <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={28} />
          </div>
        </div>
      ) : (
        <div className="mb-5 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            No pick yet for Week {currentWeek} · <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatPrizePool(currentTournament?.prize_pool)}</span> purse
          </p>
        </div>
      )}

      {/* Primary Pick Search */}
      <div className="mb-4 relative searchable-dropdown">
        <label className="label flex items-center gap-1.5">
          <CheckCircle className="text-emerald-500" size={14} />
          {leagueSettings.backup_picks_enabled ? 'Primary Golfer' : 'Select Golfer'}
        </label>
        <div className="relative">
          <input
            type="text"
            value={selectedPlayer || primarySearchTerm}
            onChange={(e) => {
              setPrimarySearchTerm(e.target.value);
              setSelectedPlayer('');
              setShowPrimaryDropdown(true);
              setPrimaryHighlightIndex(0);
            }}
            onFocus={() => setShowPrimaryDropdown(true)}
            onKeyDown={handlePrimaryKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={showPrimaryDropdown && !!primarySearchTerm}
            aria-controls="primary-golfer-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              showPrimaryDropdown && filteredPrimaryGolfers.length > 0
                ? `primary-golfer-option-${primaryHighlightIndex}`
                : undefined
            }
            placeholder="Search golfers..."
            className="input"
          />
          {selectedPlayer && (
            <button
              onClick={() => { setSelectedPlayer(''); setPrimarySearchTerm(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={16} />
            </button>
          )}
          {showPrimaryDropdown && primarySearchTerm && (
            <div
              ref={primaryListRef}
              id="primary-golfer-listbox"
              role="listbox"
              className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-elevated max-h-60 overflow-y-auto animate-fade-in"
            >
              {filteredPrimaryGolfers.length > 0 ? (
                filteredPrimaryGolfers.map((golfer, idx) => {
                  const isHighlighted = idx === primaryHighlightIndex;
                  return (
                    <button
                      key={idx}
                      id={`primary-golfer-option-${idx}`}
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setPrimaryHighlightIndex(idx)}
                      onClick={() => {
                        setSelectedPlayer(golfer);
                        setPrimarySearchTerm('');
                        setShowPrimaryDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors duration-100 ${
                        isHighlighted
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {golfer}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-2 text-sm text-slate-400 italic">No golfers found</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backup Pick */}
      {leagueSettings.backup_picks_enabled && (
        <div className="mb-5 relative searchable-dropdown">
          <label className="label flex items-center gap-1.5">
            <Shield className="text-amber-500" size={14} />
            Backup Golfer (Optional)
          </label>
          <div className="relative">
            <input
              type="text"
              value={backupPlayer || backupSearchTerm}
              onChange={(e) => {
                setBackupSearchTerm(e.target.value);
                setBackupPlayer('');
                setShowBackupDropdown(true);
                setBackupHighlightIndex(0);
              }}
              onFocus={() => setShowBackupDropdown(true)}
              onKeyDown={handleBackupKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={showBackupDropdown && !!backupSearchTerm}
              aria-controls="backup-golfer-listbox"
              aria-autocomplete="list"
              aria-activedescendant={
                showBackupDropdown && filteredBackupGolfers.length > 0
                  ? `backup-golfer-option-${backupHighlightIndex}`
                  : undefined
              }
              placeholder="Search golfers..."
              className="input"
            />
            {backupPlayer && (
              <button
                onClick={() => { setBackupPlayer(''); setBackupSearchTerm(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={16} />
              </button>
            )}
            {showBackupDropdown && backupSearchTerm && (
              <div
                ref={backupListRef}
                id="backup-golfer-listbox"
                role="listbox"
                className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-elevated max-h-60 overflow-y-auto animate-fade-in"
              >
                {filteredBackupGolfers.length > 0 ? (
                  filteredBackupGolfers.map((golfer, idx) => {
                    const isHighlighted = idx === backupHighlightIndex;
                    return (
                      <button
                        key={idx}
                        id={`backup-golfer-option-${idx}`}
                        role="option"
                        aria-selected={isHighlighted}
                        onMouseEnter={() => setBackupHighlightIndex(idx)}
                        onClick={() => {
                          setBackupPlayer(golfer);
                          setBackupSearchTerm('');
                          setShowBackupDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors duration-100 ${
                          isHighlighted
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {golfer}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-400 italic">No golfers found</p>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            Auto-activates if your primary pick withdraws before the tournament.
          </p>
        </div>
      )}

      {/* Locked Banner */}
      {isLocked && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-700 dark:text-red-400 text-center">
            Picks are locked for this tournament.
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmitPick}
        disabled={!selectedPlayer || isLocked || submittingPick}
        className="btn-primary w-full py-3"
      >
        {isLocked ? 'Picks Locked' : submittingPick ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Submitting...
          </span>
        ) : 'Submit Pick'}
      </button>

      {lockTime && !isLocked && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 text-center">
          Locks {lockTime.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          })}
        </p>
      )}

      {/* Used Golfers */}
      {(() => {
        const currentPick = selectedPlayer || currentWeekPick.golfer;
        const pastPicks = userPicks.filter(p => p && p !== currentPick);
        return pastPicks.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
              Previously Used ({pastPicks.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pastPicks.map((golfer, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs rounded-md"
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
