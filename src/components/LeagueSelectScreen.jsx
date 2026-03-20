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
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-300">
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-4 right-4 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-soft text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150"
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

        {/* League selection tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
          {userLeagues.length > 0 && (
            <button
              onClick={() => setLeagueAction('select')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${leagueAction === 'select' ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
            >
              My Leagues
            </button>
          )}
          <button
            onClick={() => setLeagueAction('join')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${leagueAction === 'join' ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Join League
          </button>
          <button
            onClick={() => setLeagueAction('create')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${leagueAction === 'create' ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Create League
          </button>
        </div>

        {/* Select existing league */}
        {leagueAction === 'select' && userLeagues.length > 0 && (
          <div className="space-y-3">
            {userLeagues.map(league => (
              <button
                key={league.id}
                onClick={() => selectLeague(league)}
                className="w-full p-4 bg-gray-50 dark:bg-slate-700 hover:bg-green-50 dark:hover:bg-green-900/20 border-2 border-slate-200 dark:border-slate-700 hover:border-green-400 dark:hover:border-green-500 rounded-xl text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100">{league.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {league.role === 'commissioner' ? 'Commissioner' : 'Member'}
                    </p>
                  </div>
                  <ChevronRight className="text-gray-400" size={20} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Join a league */}
        {leagueAction === 'join' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter the invite code from your league commissioner to join an existing league.
            </p>
            <div>
              <label className="label">Invite Code</label>
              <input
                type="text"
                value={joinInviteCode}
                onChange={(e) => setJoinInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinLeague()}
                className="input"
                placeholder="e.g. a1b2c3d4"
              />
            </div>
            <button
              onClick={handleJoinLeague}
              className="w-full btn-primary w-full py-3"
            >
              Join League
            </button>
          </div>
        )}

        {/* Create a league */}
        {leagueAction === 'create' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create a new league and invite your friends with a unique invite code.
            </p>
            <div>
              <label className="label">League Name</label>
              <input
                type="text"
                value={newLeagueName}
                onChange={(e) => setNewLeagueName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLeague()}
                className="input"
                placeholder="e.g. Weekend Warriors Golf"
              />
            </div>
            <button
              onClick={handleCreateLeague}
              disabled={creatingLeague}
              className="w-full btn-primary w-full py-3"
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
