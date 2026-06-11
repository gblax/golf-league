import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Flag, Shield, X } from 'lucide-react';
import EmptyState from './EmptyState';
import LiveLeaderboard from './LiveLeaderboard';
import Spinner from './Spinner';
import WeekRecapCard from './WeekRecapCard';
import { isOutStatus, lookupLive, normalizeName, outLabel } from '../utils/liveLeaderboard';
import { formatWinnings } from '../utils/money';

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
  lockUrgent,
  lockTimeLabel,
  leagueSettings,
  userPicks,
  pickHistory,
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
  // Live leaderboard (Phase 1)
  liveIndex,
  liveMembers,
  playerColors,
  currentUserId,
  // Weekly field backstop (Phase 2)
  fieldNames,
  fieldLoaded,
  fieldCount,
  // Monday recap of the last completed tournament
  weekRecap,
  leagueId,
}) {
  const [primaryHighlightIndex, setPrimaryHighlightIndex] = useState(0);
  const [backupHighlightIndex, setBackupHighlightIndex] = useState(0);
  const primaryListRef = useRef(null);
  const backupListRef = useRef(null);

  // "Pick at your own risk" acknowledgement for an off-field golfer (Phase 2).
  // Reset whenever the primary selection changes so each off-field pick is
  // confirmed deliberately.
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  useEffect(() => {
    setAcknowledgedRisk(false);
  }, [selectedPlayer]);

  // One-shot success ping on the pick card when the saved pick changes (the
  // optimistic update on submit). Changes that arrive at the end of a loading
  // cycle are the initial fetch / a league switch, not a submission — only a
  // submit mutates the pick with no picksLoading transition around it.
  const [flashPick, setFlashPick] = useState(false);
  const prevPickRef = useRef(currentWeekPick.golfer);
  const prevLoadingRef = useRef(picksLoading);
  useEffect(() => {
    const prev = prevPickRef.current;
    const wasLoading = prevLoadingRef.current;
    prevPickRef.current = currentWeekPick.golfer;
    prevLoadingRef.current = picksLoading;
    if (!wasLoading && !picksLoading && currentWeekPick.golfer && prev !== currentWeekPick.golfer) {
      setFlashPick(true);
      const t = setTimeout(() => setFlashPick(false), 900);
      return () => clearTimeout(t);
    }
  }, [currentWeekPick.golfer, picksLoading]);

  // Keep a focused search input (and its dropdown) visible above the
  // on-screen keyboard on phones.
  const scrollInputIntoView = (e) => {
    const el = e.target;
    setTimeout(() => el.scrollIntoView({ block: 'center' }), 150);
  };

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
      if (showPrimaryDropdown && filteredPrimaryGolfers.length > 0) {
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
      if (showBackupDropdown && filteredBackupGolfers.length > 0) {
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
    // Skeleton mirrors the tab's real layout (header row, pick card, search
    // field, submit button) so content doesn't jump when it loads.
    return (
      <div className="max-w-xl mx-auto" aria-busy="true">
        <div className="flex items-center justify-between mb-5">
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-6 w-20" />
        </div>
        <div className="skeleton h-24 w-full mb-5 rounded-xl" />
        <div className="skeleton h-3.5 w-28 mb-2" />
        <div className="skeleton h-11 w-full mb-5 rounded-xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <p className="sr-only">Loading picks...</p>
      </div>
    );
  }

  const now = new Date();
  const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
  const isLocked = lockTime && now >= lockTime;

  // Field backstop (Phase 2): the field is advisory and only firms up mid-week,
  // so it's a soft gate. When it's known we tag golfers and warn on off-field
  // picks; when it isn't, picks are unrestricted (a banner sets expectations).
  const fieldKnown = !!fieldLoaded && !!fieldNames && fieldNames.size > 0;
  const inField = (name) => fieldKnown && fieldNames.has(normalizeName(name));
  const selectedNotInField = !!selectedPlayer && fieldKnown && !inField(selectedPlayer);
  const submitBlockedByRisk = selectedNotInField && !acknowledgedRisk;

  // Season scorecard — each spent golfer with the week used and what they
  // earned. Shared by pick mode and watch mode.
  const seasonScorecard = (() => {
    const currentPick = selectedPlayer || currentWeekPick.golfer;
    const pastPicks = userPicks.filter(p => p && p !== currentPick);
    if (pastPicks.length === 0) return null;

    const historyByGolfer = {};
    (pickHistory || []).forEach(w => { if (w.golfer) historyByGolfer[w.golfer] = w; });
    const sorted = [...pastPicks].sort((a, b) => {
      const wa = historyByGolfer[a]?.week ?? Infinity;
      const wb = historyByGolfer[b]?.week ?? Infinity;
      return wa - wb || a.localeCompare(b);
    });

    return (
      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
          Season Scorecard ({sorted.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((golfer, idx) => {
            const info = historyByGolfer[golfer];
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs rounded-md"
              >
                {info && (
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tabular-nums">Wk {info.week}</span>
                )}
                <span className="text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-600">{golfer}</span>
                {info && (
                  info.winnings > 0 ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatWinnings(info.winnings)}</span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 tabular-nums">$0</span>
                  )
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  })();

  // ---- Watch mode (Thu–Sun, after lock) ----
  // A locked form isn't information. Lead with the user's golfer and the live
  // leaderboard; the pick form returns when picks reopen on Monday.
  if (isLocked) {
    const myLiveRow = (liveMembers || []).find(m => m.id === currentUserId) || null;
    const myLive = liveIndex && !liveIndex.isEmpty && myLiveRow ? lookupLive(liveIndex, myLiveRow) : null;
    const myOut = myLive && isOutStatus(myLive.status);

    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Week {currentWeek}</h2>
          <span className="badge bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
            Locked
          </span>
        </div>

        {currentWeekPick.golfer ? (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Your golfer</p>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{currentWeekPick.golfer}</p>
                {leagueSettings.backup_picks_enabled && currentWeekPick.backup && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Backup: <span className="font-medium text-slate-700 dark:text-slate-300">{currentWeekPick.backup}</span>
                  </p>
                )}
              </div>
              {myLive ? (
                myOut ? (
                  <span className="shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
                    {outLabel(myLive.status)}
                  </span>
                ) : (
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{myLive.position || '—'}</p>
                    <p className={`text-sm font-semibold mt-1 ${String(myLive.score || '').startsWith('-') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {myLive.score || ''}
                      {myLive.thru && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {myLive.thru === 'F' ? ' · F' : ` · thru ${myLive.thru}`}
                        </span>
                      )}
                    </p>
                  </div>
                )
              ) : (
                <p className="shrink-0 max-w-[45%] text-[11px] text-slate-400 dark:text-slate-500 text-right">
                  Scores post after each round wraps up
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              No pick this week — the no-pick penalty applies.
            </p>
          </div>
        )}

        {liveIndex && !liveIndex.isEmpty ? (
          <LiveLeaderboard
            index={liveIndex}
            members={liveMembers}
            tournamentName={currentTournament?.name}
            currentUserId={currentUserId}
            playerColors={playerColors}
          />
        ) : (
          <EmptyState
            icon={Flag}
            title="Golfers are on the course"
            caption="Scores update once a day, after each round ends — check back tonight for round one results."
          />
        )}

        {lockTimeLabel && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 text-center">{lockTimeLabel}</p>
        )}

        {seasonScorecard}
      </div>
    );
  }

  // ---- Pick mode (before lock) ----
  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Week {currentWeek} Pick</h2>
        {timeUntilLock && timeUntilLock !== 'Locked' && (
          lockUrgent && !currentWeekPick.golfer ? (
            <span className="badge bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 animate-pulse">
              No pick — {timeUntilLock} left
            </span>
          ) : (
            <span className="badge bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              {timeUntilLock} left
            </span>
          )
        )}
      </div>

      {/* One-time recap of the last completed tournament (pick mode only —
          during a locked weekend last week's results are old news) */}
      {weekRecap && (
        <WeekRecapCard
          recap={weekRecap}
          storageKey={`odg-recap-${leagueId}-${weekRecap.tournamentId}`}
        />
      )}

      {/* Field status banner (Phase 2) */}
      {fieldKnown ? (
        <div className="mb-4 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{fieldCount}</span> golfers confirmed in this week's field. Golfers outside the field are flagged below.
          </p>
        </div>
      ) : (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>This week's field isn't confirmed yet. You can pick now <span className="font-semibold">at your own risk</span> — anyone who ends up not playing takes the no-pick penalty.</span>
          </p>
        </div>
      )}

      {/* Current Selection Card */}
      {currentWeekPick.golfer ? (
        <div className={`mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 ${flashPick ? 'animate-flash-success' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Current Pick</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{currentWeekPick.golfer}</p>
              {leagueSettings.backup_picks_enabled && currentWeekPick.backup && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Backup: <span className="font-medium text-slate-700 dark:text-slate-300">{currentWeekPick.backup}</span>
                </p>
              )}
              {fieldKnown && !inField(currentWeekPick.golfer) && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} className="shrink-0" />
                  Not in this week's confirmed field
                </p>
              )}
            </div>
            <CheckCircle className="text-emerald-500 dark:text-emerald-400" size={28} />
          </div>
        </div>
      ) : (
        <div className="mb-5 p-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center">
          <Flag className="mx-auto mb-2 text-emerald-500 dark:text-emerald-400" size={22} aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">No pick yet for Week {currentWeek}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatPrizePool(currentTournament?.prize_pool)}</span> purse — search below to lock in your golfer.
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
            onFocus={(e) => { setShowPrimaryDropdown(true); scrollInputIntoView(e); }}
            onKeyDown={handlePrimaryKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            inputMode="search"
            enterKeyHint="search"
            role="combobox"
            aria-expanded={showPrimaryDropdown}
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
          {/* Renders on focus even with an empty query so the field can be
              browsed by tapping, not just searched by typing. */}
          {showPrimaryDropdown && (
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
                      <span className="flex items-center justify-between gap-2">
                        <span>{golfer}</span>
                        {fieldKnown && (
                          inField(golfer) ? (
                            <span className="shrink-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">in field</span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">not in field</span>
                          )
                        )}
                      </span>
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
              onFocus={(e) => { setShowBackupDropdown(true); scrollInputIntoView(e); }}
              onKeyDown={handleBackupKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={showBackupDropdown}
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
            {showBackupDropdown && (
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

      {/* Off-field warning + at-your-own-risk acknowledgement (Phase 2) */}
      {selectedNotInField && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2 mb-2.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span><span className="font-semibold">{selectedPlayer}</span> isn't in this week's confirmed field. If they don't tee off you'll take the no-pick penalty.</span>
          </p>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledgedRisk}
              onChange={(e) => setAcknowledgedRisk(e.target.checked)}
              className="w-4 h-4 rounded border-amber-300 dark:border-amber-700 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Submit anyway — at my own risk</span>
          </label>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmitPick}
        disabled={!selectedPlayer || submittingPick || submitBlockedByRisk}
        className="btn-primary btn-lg w-full"
      >
        {submittingPick ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner size="sm" className="border-current" />
            Locking in...
          </span>
        ) : 'Lock It In'}
      </button>

      {lockTime && (
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

      {seasonScorecard}

      {/* Live leaderboard (Phase 1) — renders only when a snapshot exists */}
      {liveIndex && !liveIndex.isEmpty && (
        <div className="mt-6">
          <LiveLeaderboard
            index={liveIndex}
            members={liveMembers}
            tournamentName={currentTournament?.name}
            currentUserId={currentUserId}
            playerColors={playerColors}
          />
        </div>
      )}
    </div>
  );
});

export default PicksTab;
