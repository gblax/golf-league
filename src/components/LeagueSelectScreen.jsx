import React from 'react';
import { Trophy, ChevronRight, LogOut, Sun, Moon } from 'lucide-react';
import NotificationToast from './NotificationToast';

const LeagueSelectScreen = React.memo(function LeagueSelectScreen({
  notification,
  darkMode,
  setDarkMode,
  currentUser,
  userLeagues,
  leagueAction,
  setLeagueAction,
  newLeagueName,
  setNewLeagueName,
  joinInviteCode,
  setJoinInviteCode,
  creatingLeague,
  selectLeague,
  handleCreateLeague,
  handleJoinLeague,
  onSignOut,
}) {
  const leagueActionIds = userLeagues.length > 0
    ? ['select', 'join', 'create']
    : ['join', 'create'];
  const visibleLeagueAction = userLeagues.length === 0 && leagueAction === 'select'
    ? 'join'
    : leagueAction;
  const handleLeagueTabKeyDown = (event, actionId) => {
    const currentIndex = leagueActionIds.indexOf(actionId);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % leagueActionIds.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + leagueActionIds.length) % leagueActionIds.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = leagueActionIds.length - 1;
    else return;

    event.preventDefault();
    const nextAction = leagueActionIds[nextIndex];
    setLeagueAction(nextAction);
    requestAnimationFrame(() => document.getElementById(`league-action-${nextAction}`)?.focus());
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-300">
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-right))] p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-soft text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150"
        aria-label="Toggle dark mode"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <NotificationToast notification={notification} />

      <div className="card p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-600 dark:bg-emerald-500 rounded-2xl mb-3">
            <Trophy className="text-white" size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Golf One and Done</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Welcome, {currentUser?.name}</p>
        </div>

        {/* First-run guidance for brand-new users with no leagues yet */}
        {userLeagues.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5 px-2">
            You're all set! Join a league with an invite code from your commissioner, or create your own and invite friends.
          </p>
        )}

        {/* League selection tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6" role="tablist" aria-label="League actions">
          {userLeagues.length > 0 && (
            <button
              id="league-action-select"
              onClick={() => setLeagueAction('select')}
              onKeyDown={(event) => handleLeagueTabKeyDown(event, 'select')}
              role="tab"
              aria-selected={visibleLeagueAction === 'select'}
              aria-controls="league-action-panel"
              tabIndex={visibleLeagueAction === 'select' ? 0 : -1}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${visibleLeagueAction === 'select' ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
              My Leagues
            </button>
          )}
          <button
            id="league-action-join"
            onClick={() => setLeagueAction('join')}
            onKeyDown={(event) => handleLeagueTabKeyDown(event, 'join')}
            role="tab"
            aria-selected={visibleLeagueAction === 'join'}
            aria-controls="league-action-panel"
            tabIndex={visibleLeagueAction === 'join' ? 0 : -1}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${visibleLeagueAction === 'join' ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Join League
          </button>
          <button
            id="league-action-create"
            onClick={() => setLeagueAction('create')}
            onKeyDown={(event) => handleLeagueTabKeyDown(event, 'create')}
            role="tab"
            aria-selected={visibleLeagueAction === 'create'}
            aria-controls="league-action-panel"
            tabIndex={visibleLeagueAction === 'create' ? 0 : -1}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${visibleLeagueAction === 'create' ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Create League
          </button>
        </div>

        {/* Select existing league */}
        {visibleLeagueAction === 'select' && userLeagues.length > 0 && (
          <div id="league-action-panel" role="tabpanel" aria-labelledby="league-action-select" className="space-y-3">
            {userLeagues.map(league => (
              <button
                key={league.id}
                onClick={() => selectLeague(league)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 rounded-xl text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{league.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {league.role === 'commissioner' ? 'Commissioner' : 'Member'}
                    </p>
                  </div>
                  <ChevronRight className="text-slate-400" size={20} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Join a league */}
        {visibleLeagueAction === 'join' && (
          <div id="league-action-panel" role="tabpanel" aria-labelledby="league-action-join" className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Enter the invite code from your league commissioner to join an existing league.
            </p>
            <div>
              <label htmlFor="league-invite-code" className="label">Invite Code</label>
              <input
                id="league-invite-code"
                type="text"
                value={joinInviteCode}
                onChange={(e) => setJoinInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinLeague()}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                className="input"
                placeholder="e.g. a1b2c3d4"
              />
            </div>
            <button
              onClick={handleJoinLeague}
              className="btn-primary btn-lg w-full"
            >
              Join League
            </button>
          </div>
        )}

        {/* Create a league */}
        {visibleLeagueAction === 'create' && (
          <div id="league-action-panel" role="tabpanel" aria-labelledby="league-action-create" className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create a new league and invite your friends with a unique invite code.
            </p>
            <div>
              <label htmlFor="league-name" className="label">League Name</label>
              <input
                id="league-name"
                type="text"
                value={newLeagueName}
                onChange={(e) => setNewLeagueName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLeague()}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="go"
                className="input"
                placeholder="e.g. Weekend Warriors Golf"
              />
            </div>
            <button
              onClick={handleCreateLeague}
              disabled={creatingLeague}
              className="btn-primary btn-lg w-full"
            >
              {creatingLeague ? 'Creating...' : 'Create League'}
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onSignOut}
            className="w-full text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
});

export default LeagueSelectScreen;
