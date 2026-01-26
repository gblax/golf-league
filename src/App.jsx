import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, CheckCircle, XCircle, TrendingUp, Bell, Shield, Mail, LogOut, LogIn, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [activeTab, setActiveTab] = useState('picks');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [backupPlayer, setBackupPlayer] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [picksLoading, setPicksLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(!localStorage.getItem('currentUserId'));
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [resultsData, setResultsData] = useState({});
  const [availableGolfers, setAvailableGolfers] = useState([]);
  const [userPicks, setUserPicks] = useState([]);
  const [currentWeekPick, setCurrentWeekPick] = useState({ golfer: '', backup: '' });

  // Restore session on page load
  useEffect(() => {
    const loadSession = async () => {
      const userId = localStorage.getItem('currentUserId');
      if (userId) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (data) {
          setCurrentUser(data);
          setShowLogin(false);
        }
      }
      setLoading(false);
    };
    loadSession();
  }, []);

// Load initial data
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Update dropdowns when data loads
  useEffect(() => {
    if (currentWeekPick.golfer) {
      setSelectedPlayer(currentWeekPick.golfer);
      setBackupPlayer(currentWeekPick.backup || '');
    }
  }, [currentWeekPick]);

const loadData = async () => {
    try {
      // Load tournaments FIRST
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .order('week');
      
      setTournaments(tournamentsData || []);
      
      // Load available golfers
      const { data: golfersData } = await supabase
        .from('available_golfers')
        .select('*')
        .eq('active', true);
      
      setAvailableGolfers(golfersData?.map(g => g.name) || []);
      
      // Load all users for standings
      const { data: usersData } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          picks:picks(golfer_name, winnings, penalty_amount, penalty_reason, tournament_id, backup_golfer_name)
        `);
      
// Calculate standings with detailed pick history
const playersWithWinnings = (usersData || []).map(user => {
  const picksByWeek = (tournamentsData || []).map(tournament => {
    const pick = user.picks?.find(p => p.tournament_id === tournament.id);
    return {
      week: tournament.week,
      tournamentName: tournament.name,
      golfer: pick?.golfer_name || null,
      backup: pick?.backup_golfer_name || null,
      winnings: pick?.winnings || 0,
      penalty: pick?.penalty_amount || 0,
      penaltyReason: pick?.penalty_reason || null
    };
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    winnings: user.picks?.reduce((sum, pick) => sum + (pick.winnings || 0), 0) || 0,
    penalties: user.picks?.reduce((sum, pick) => sum + (pick.penalty_amount || 0), 0) || 0,
    picks: user.picks?.map(p => p.golfer_name) || [],
    picksByWeek: picksByWeek,
    currentPick: user.picks?.find(p => p.tournament_id === getCurrentTournament(tournamentsData)?.id) || { golfer_name: '', backup_golfer_name: '' }
  };
});
      
      setPlayers(playersWithWinnings);
      
      // NOW load user data AFTER tournaments are set
      await loadUserDataWithTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadUserDataWithTournaments = async (tournamentsData) => {
    if (!currentUser) return;
    
    setPicksLoading(true);
    
    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', currentUser.id);
    
    console.log('All picks data:', picksData);
    
    const allUserPicks = picksData?.map(p => p.golfer_name) || [];
    setUserPicks(allUserPicks);
    
    const currentTournament = getCurrentTournament(tournamentsData);
    console.log('Current tournament:', currentTournament);
    
    const currentPick = picksData?.find(p => p.tournament_id === currentTournament?.id);
    console.log('Current week pick found:', currentPick);
    
    if (currentPick) {
      const primary = currentPick.golfer_name || '';
      const backup = currentPick.backup_golfer_name || '';
      
      console.log('Setting primary:', primary, 'backup:', backup);
      
      setSelectedPlayer(primary);
      setBackupPlayer(backup);
      setCurrentWeekPick({ 
        golfer: primary, 
        backup: backup 
      });
    } else {
      console.log('No pick found for current week - resetting');
      setSelectedPlayer('');
      setBackupPlayer('');
      setCurrentWeekPick({ golfer: '', backup: '' });
    }
    
    setPicksLoading(false);
  };

const loadUserData = async () => {
    if (!currentUser) return;
    
    setPicksLoading(true);
    
    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', currentUser.id);
    
    console.log('All picks data:', picksData);
    
    const allUserPicks = picksData?.map(p => p.golfer_name) || [];
    setUserPicks(allUserPicks);
    
    const currentTournament = getCurrentTournament();
    console.log('Current tournament:', currentTournament);
    
    const currentPick = picksData?.find(p => p.tournament_id === currentTournament?.id);
    console.log('Current week pick found:', currentPick);
    
    if (currentPick) {
      const primary = currentPick.golfer_name || '';
      const backup = currentPick.backup_golfer_name || '';
      
      console.log('Setting primary:', primary, 'backup:', backup);
      
      // Set all three states together
      setSelectedPlayer(primary);
      setBackupPlayer(backup);
      setCurrentWeekPick({ 
        golfer: primary, 
        backup: backup 
      });
    } else {
      console.log('No pick found for current week - resetting');
      // Reset selections if no pick for current week
      setSelectedPlayer('');
      setBackupPlayer('');
      setCurrentWeekPick({ golfer: '', backup: '' });
    }
    
    setPicksLoading(false);
  };

  const getCurrentTournament = (tournamentsList) => {
    const list = tournamentsList || tournaments;
    return list.find(t => !t.completed) || list[list.length - 1];
  };

  const currentWeek = getCurrentTournament()?.week || 1;

  const handleLogin = async () => {
    try {
      if (isSignup) {
        // Simple signup
        const { data, error } = await supabase
          .from('users')
          .insert([{ email: loginEmail, name: signupName, password_hash: loginPassword }])
          .select()
          .single();
        
        if (error) {
          alert('Signup failed: ' + error.message);
          return;
        }
        setCurrentUser(data);
        localStorage.setItem('currentUserId', data.id);
      } else {
        // Simple login
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', loginEmail)
          .eq('password_hash', loginPassword)
          .single();
        
        if (error || !data) {
          alert('Invalid email or password');
          return;
        }
        setCurrentUser(data);
        localStorage.setItem('currentUserId', data.id);
      }
      
      setShowLogin(false);
    } catch (error) {
      alert('Login error: ' + error.message);
    }
  };

const handleSaveResults = async (playerId) => {
    try {
      const tournamentId = currentTournament.id;
      const playerData = resultsData[playerId] || {};
      const winnings = playerData.winnings || 0;
      const penaltyType = playerData.penalty || '';
      
      // Update the pick with winnings
      const { error: pickError } = await supabase
        .from('picks')
        .update({
          winnings: parseInt(winnings) || 0,
          penalty_amount: penaltyType ? 10 : 0,
          penalty_reason: penaltyType || null
        })
        .eq('user_id', playerId)
        .eq('tournament_id', tournamentId);
      
      if (pickError) {
        alert('Error saving results: ' + pickError.message);
        return;
      }
      
      // If there's a penalty, add it to the penalties table
      if (penaltyType) {
        await supabase
          .from('penalties')
          .upsert({
            user_id: playerId,
            tournament_id: tournamentId,
            penalty_type: penaltyType,
            amount: 10
          }, { onConflict: 'user_id,tournament_id' });
      }
      
      alert('Results saved successfully!');
      loadData(); // Reload to show updated standings
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  
const handleSubmitPick = async () => {
    if (!selectedPlayer) {
      alert('Please select a primary golfer');
      return;
    }
    
    if (backupPlayer && backupPlayer === selectedPlayer) {
      alert('Backup golfer must be different from primary pick');
      return;
    }
  
    const currentTournament = getCurrentTournament();
    
    // Check if picks are locked
    const now = new Date();
    const lockTime = new Date(currentTournament.picks_lock_time);
    
    if (now >= lockTime) {
      alert('Picks are locked! The tournament has already started.');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('picks')
        .upsert({
          user_id: currentUser.id,
          tournament_id: currentTournament.id,
          golfer_name: selectedPlayer,
          backup_golfer_name: backupPlayer || null,
          winnings: 0
        }, { onConflict: 'user_id,tournament_id' });
      
      if (error) {
        alert('Error submitting pick: ' + error.message);
        return;
      }
      
      alert(`Pick submitted!\nPrimary: ${selectedPlayer}${backupPlayer ? `\nBackup: ${backupPlayer}` : ''}`);
      loadData();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const sendEmailReminder = () => {
    alert('Email reminder feature coming soon! This will send automated emails to players who haven\'t submitted picks.');
  };

  const toggleRowExpansion = (playerId) => {
    setExpandedRows(prev => ({
      ...prev,
      [playerId]: !prev[playerId]
    }));
  };

const availableForPick = availableGolfers.filter(g => 
  !userPicks.includes(g) || g === selectedPlayer || g === backupPlayer
);
const sortedStandings = [...players].sort((a, b) => b.winnings - a.winnings);
  const currentTournament = getCurrentTournament();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-2xl font-bold text-green-700">Loading...</div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Trophy className="text-yellow-500 mx-auto mb-4" size={60} />
            <h1 className="text-3xl font-bold text-green-800">Golf One and Done</h1>
            <p className="text-gray-600 mt-2">{isSignup ? 'Create Account' : 'Sign In'}</p>
          </div>
          
          <div className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  placeholder="Your name"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                placeholder="Password"
              />
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              {isSignup ? 'Create Account' : 'Sign In'}
            </button>
            
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="w-full text-blue-600 hover:text-blue-800 text-sm"
            >
              {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-green-800 flex items-center gap-3">
                <Trophy className="text-yellow-500" size={40} />
                Golf One and Done League
              </h1>
              <p className="text-gray-600 mt-2">Week {currentWeek} - {currentTournament?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Playing as</p>
              <p className="text-xl font-bold text-green-700">{currentUser?.name}</p>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Bell size={16} />
                Settings
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('currentUserId');
                  setCurrentUser(null);
                  setShowLogin(true);
                }}
                className="mt-1 text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Mail className="text-blue-600" />
                Email Notification Settings
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="w-5 h-5 text-green-600"
                  />
                  <span className="text-gray-700">
                    Send me email reminders the night before picks are due
                  </span>
                </label>
                <p className="text-sm text-gray-500 ml-8">
                  Reminder emails will be sent at 8:00 PM the day before the deadline
                </p>
                <div className="ml-8 mt-2">
                  <p className="text-sm font-semibold text-gray-700">Your email: {currentUser?.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('picks')}
              className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
                activeTab === 'picks' 
                  ? 'border-b-4 border-green-600 text-green-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircle size={20} />
              Make Pick
            </button>
            <button
              onClick={() => setActiveTab('standings')}
              className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
                activeTab === 'standings' 
                  ? 'border-b-4 border-green-600 text-green-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp size={20} />
              Standings
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
                activeTab === 'schedule' 
                  ? 'border-b-4 border-green-600 text-green-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar size={20} />
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
                activeTab === 'admin' 
                  ? 'border-b-4 border-green-600 text-green-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bell size={20} />
              Admin
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex-1 py-4 px-6 font-semibold flex items-center justify-center gap-2 ${
                activeTab === 'results' 
                  ? 'border-b-4 border-green-600 text-green-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Trophy size={20} />
              Results
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
{activeTab === 'picks' && (
              picksLoading ? (
                <div className="text-center py-12">
                  <div className="text-xl font-semibold text-gray-600">Loading your picks...</div>
                </div>
              ) : (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Submit Your Pick</h2>
                {/* Current Week Only Warning */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                  <p className="text-yellow-800">
                    <strong>Note:</strong> You can only make picks for the current tournament. 
                    Future week picks will open on Monday after the current tournament ends.
                  </p>
                </div>
                {/* Backup Pick Explanation */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Shield className="text-blue-600 mt-1" size={24} />
                    <div>
                      <p className="font-semibold text-blue-800 mb-1">Backup Pick Feature</p>
                      <p className="text-blue-700 text-sm">
                        Select a backup golfer in case your primary pick withdraws before the tournament starts. 
                        Your backup will automatically be used only if your primary pick withdraws. 
                        Remember: You can only use each golfer once per season!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold text-gray-700 mb-3">Your Previous Picks:</h3>
                  <div className="flex flex-wrap gap-2">
                    {userPicks.map((pick, idx) => (
                      <span key={idx} className="bg-gray-200 px-4 py-2 rounded-full text-sm text-gray-700">
                        {pick}
                      </span>
                    ))}
                    {userPicks.length === 0 && (
                      <span className="text-gray-500 italic">No picks yet</span>
                    )}
                  </div>
                </div>

                {/* Primary Pick */}
                <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <label className="block font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="text-green-600" size={20} />
                    Primary Pick for Week {currentWeek}:
                  </label>
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  >
                    <option value="">-- Choose your primary golfer --</option>
                    {availableForPick.map((golfer, idx) => (
                      <option key={idx} value={golfer}>{golfer}</option>
                    ))}
                  </select>
                </div>

                {/* Backup Pick */}
                <div className="mb-6 p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                  <label className="block font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Shield className="text-amber-600" size={20} />
                    Backup Pick (Optional but Recommended):
                  </label>
                  <select
                    value={backupPlayer}
                    onChange={(e) => setBackupPlayer(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">-- Choose a backup golfer --</option>
                    {availableForPick.filter(g => g !== selectedPlayer).map((golfer, idx) => (
                      <option key={idx} value={golfer}>{golfer}</option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-600 mt-2">
                    Your backup will only be used if {selectedPlayer || 'your primary pick'} withdraws before the tournament
                  </p>
                </div>

{(() => {
                  const now = new Date();
                  const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                  const isLocked = lockTime && now >= lockTime;
                  
                  return (
                    <>
                      {isLocked && (
                        <div className="mb-4 p-4 bg-red-50 border-2 border-red-400 rounded-lg">
                          <p className="text-red-800 font-semibold text-center">
                            🔒 Picks are locked! This tournament has already started.
                          </p>
                        </div>
                      )}
                      
                      <button
                        onClick={handleSubmitPick}
                        disabled={!selectedPlayer || isLocked}
                        className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLocked ? 'Picks Locked' : 'Submit Pick'}
                      </button>
                      
                      {lockTime && !isLocked && (
                        <p className="mt-2 text-sm text-gray-600 text-center">
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

                {selectedPlayer && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                    <h4 className="font-semibold mb-2">Your Current Selection:</h4>
                    <p className="text-gray-700">
                      <strong>Primary:</strong> {selectedPlayer}
                    </p>
                    {backupPlayer && (
                      <p className="text-gray-700">
                        <strong>Backup:</strong> {backupPlayer}
                      </p>
                    )}
                  </div>
                )}
              </div>
              )
            )}

            {activeTab === 'results' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Enter Tournament Results</h2>
                
                {(() => {
                  const now = new Date();
                  const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                  const isLocked = lockTime && now >= lockTime;
                  
                  if (!isLocked) {
                    return (
                      <div className="text-center py-12">
                        <p className="text-gray-600">Results can only be entered after the tournament starts (picks are locked).</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                        <p className="text-blue-800">
                          <strong>Current Tournament:</strong> {currentTournament?.name} (Week {currentWeek})
                        </p>
                        <p className="text-blue-700 text-sm mt-1">
                          Enter winnings and penalties for each player below.
                        </p>
                      </div>
                      
{players.filter(p => p.currentPick?.golfer_name).map(player => (
                        <div key={player.id} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-bold text-lg">{player.name}</p>
                              <p className="text-sm text-gray-600">
                                Golfer: {player.currentPick.golfer_name}
                                {player.currentPick.backup_golfer_name && ` (Backup: ${player.currentPick.backup_golfer_name})`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Winnings ($)
                              </label>
                              <input
                                type="number"
                                placeholder="0"
                                value={resultsData[player.id]?.winnings || ''}
                                onChange={(e) => setResultsData({
                                  ...resultsData,
                                  [player.id]: { ...resultsData[player.id], winnings: e.target.value }
                                })}
                                className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Penalty
                              </label>
                              <select 
                                value={resultsData[player.id]?.penalty || ''}
                                onChange={(e) => setResultsData({
                                  ...resultsData,
                                  [player.id]: { ...resultsData[player.id], penalty: e.target.value }
                                })}
                                className="w-full p-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                              >
                                <option value="">No penalty</option>
                                <option value="missed_cut">Missed Cut ($10)</option>
                                <option value="withdrawal">Withdrawal ($10)</option>
                                <option value="disqualification">Disqualification ($10)</option>
                              </select>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleSaveResults(player.id)}
                            className="mt-3 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Save Results
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'standings' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">League Standings</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-3 px-4 text-left font-semibold text-gray-700">Rank</th>
                        <th className="py-3 px-4 text-left font-semibold text-gray-700">Player</th>
                        <th className="py-3 px-4 text-center font-semibold text-gray-700">Total Winnings</th>
                        <th className="py-3 px-4 text-center font-semibold text-gray-700">Total Penalties</th>
                        <th className="py-3 px-4 text-center font-semibold text-gray-700">This Week</th>
                        <th className="py-3 px-4 text-center font-semibold text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStandings.map((player, idx) => (
                        <React.Fragment key={player.id}>
                          <tr 
                            className={`border-b hover:bg-gray-50 ${player.id === currentUser?.id ? 'bg-green-50 font-semibold' : ''}`}
                          >
                            <td className="py-3 px-4">
                              {idx === 0 && <Trophy className="inline text-yellow-500 mr-2" size={20} />}
                              {idx + 1}
                            </td>
                            <td className="py-3 px-4">{player.name}</td>
                            <td className="py-3 px-4 text-center">${player.winnings.toLocaleString()}</td>
                            <td className="py-3 px-4 text-center text-red-600 font-semibold">
                              {player.penalties > 0 ? `$${player.penalties}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {(() => {
                                const now = new Date();
                                const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                                const isLocked = lockTime && now >= lockTime;
                                const isCurrentUser = player.id === currentUser?.id;
                                
                                // Current user can always see their own pick
                                if (isCurrentUser) {
                                  return player.currentPick?.golfer_name ? (
                                    <div>
                                      <div className="text-green-700">{player.currentPick.golfer_name}</div>
                                      {player.currentPick.backup_golfer_name && (
                                        <div className="text-xs text-gray-500">Backup: {player.currentPick.backup_golfer_name}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-red-500">Not submitted</span>
                                  );
                                }
                                
                                // Other users - hide if NOT locked yet
                                if (!isLocked) {
                                  return player.currentPick?.golfer_name ? (
                                    <span className="text-gray-500">🔒 Hidden</span>
                                  ) : (
                                    <span className="text-red-500">Not submitted</span>
                                  );
                                }
                                
                                // Locked - show everyone's picks
                                return player.currentPick?.golfer_name ? (
                                  <div>
                                    <div className="text-green-700">{player.currentPick.golfer_name}</div>
                                    {player.currentPick.backup_golfer_name && (
                                      <div className="text-xs text-gray-500">Backup: {player.currentPick.backup_golfer_name}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-red-500">Not submitted</span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => toggleRowExpansion(player.id)}
                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
                              >
                                {expandedRows[player.id] ? (
                                  <>
                                    <ChevronDown size={20} />
                                    <span className="text-sm">Hide</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight size={20} />
                                    <span className="text-sm">Details</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                          
                          {/* Expanded weekly results row */}
                          {expandedRows[player.id] && (
                            <tr className="bg-gray-50">
                              <td colSpan="6" className="py-4 px-4">
                                <div className="max-w-5xl mx-auto">
                                  <h4 className="font-bold text-gray-800 mb-3">Week-by-Week Results for {player.name}</h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-gray-200">
                                          <th className="py-2 px-3 text-left">Week</th>
                                          <th className="py-2 px-3 text-left">Tournament</th>
                                          <th className="py-2 px-3 text-left">Golfer</th>
                                          <th className="py-2 px-3 text-left">Backup</th>
                                          <th className="py-2 px-3 text-right">Winnings</th>
                                          <th className="py-2 px-3 text-center">Penalty</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {player.picksByWeek.map((weekData, weekIdx) => (
                                          <tr key={weekIdx} className="border-b border-gray-300">
                                            <td className="py-2 px-3 font-semibold">{weekData.week}</td>
                                            <td className="py-2 px-3 text-gray-700">{weekData.tournamentName}</td>
                                            <td className="py-2 px-3">
                                              {weekData.golfer ? (
                                                <span className="text-green-700 font-medium">{weekData.golfer}</span>
                                              ) : (
                                                <span className="text-gray-400 italic">No pick</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              {weekData.backup ? (
                                                <span className="text-amber-600 text-xs">{weekData.backup}</span>
                                              ) : (
                                                <span className="text-gray-300">-</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              {weekData.winnings > 0 ? (
                                                <span className="text-green-600 font-semibold">${weekData.winnings.toLocaleString()}</span>
                                              ) : (
                                                <span className="text-gray-400">$0</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {weekData.penalty > 0 ? (
                                                <span className="text-red-600 font-semibold">
                                                  ${weekData.penalty} ({weekData.penaltyReason?.replace('_', ' ')})
                                                </span>
                                              ) : (
                                                <span className="text-gray-400">-</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-gray-200 font-bold">
                                          <td colSpan="4" className="py-2 px-3 text-right">TOTALS:</td>
                                          <td className="py-2 px-3 text-right text-green-700">
                                            ${player.winnings.toLocaleString()}
                                          </td>
                                          <td className="py-2 px-3 text-center text-red-600">
                                            {player.penalties > 0 ? `$${player.penalties}` : '-'}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Tournament Schedule</h2>
                <div className="space-y-3">
                  {tournaments.map((tournament) => (
                    <div 
                      key={tournament.id}
                      className={`p-4 rounded-lg border-2 ${
                        tournament.week === currentWeek 
                          ? 'border-green-500 bg-green-50' 
                          : tournament.completed 
                          ? 'border-gray-300 bg-gray-50' 
                          : 'border-blue-300 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg">{tournament.name}</h3>
                          <p className="text-sm text-gray-600">Week {tournament.week} - {new Date(tournament.tournament_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          {tournament.completed ? (
                            <span className="flex items-center gap-2 text-gray-600">
                              <CheckCircle size={20} className="text-green-600" />
                              Completed
                            </span>
                          ) : tournament.week === currentWeek ? (
                            <span className="bg-green-600 text-white px-4 py-2 rounded-full font-semibold">
                              Current Week
                            </span>
                          ) : (
                            <span className="text-blue-600 font-semibold">Upcoming</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Admin Panel</h2>
                
                <div className="space-y-6">
                  {/* Email Reminders Section */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Mail className="text-blue-600" />
                      Email Notifications
                    </h3>
                    
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>Automatic Reminders:</strong> Emails are automatically sent at 8:00 PM the night before picks are due
                      </p>
                      <p className="text-sm text-gray-700">
                        Only players who haven't submitted their picks will receive reminders
                      </p>
                    </div>

                    <button
                      onClick={sendEmailReminder}
                      className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Bell size={18} />
                      Send Manual Reminder Now
                    </button>
                  </div>

                  {/* Pick Status Overview */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
                    <h3 className="font-bold text-lg mb-4">Week {currentWeek} Pick Status</h3>
                    <div className="space-y-2">
                      {players.map(player => {
                        const now = new Date();
                        const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                        const isLocked = lockTime && now >= lockTime;
                        
                        return (
                          <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                            <div>
                              <p className="font-semibold">{player.name}</p>
                              <p className="text-sm text-gray-600">{player.email}</p>
                            </div>
                            <div className="text-right">
                              {player.currentPick?.golfer_name ? (
                                isLocked ? (
                                  <div>
                                    <CheckCircle className="inline text-green-600 mr-2" size={20} />
                                    <span className="text-green-700 font-semibold">Submitted</span>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {player.currentPick.golfer_name}
                                      {player.currentPick.backup_golfer_name && ` (Backup: ${player.currentPick.backup_golfer_name})`}
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <CheckCircle className="inline text-green-600 mr-2" size={20} />
                                    <span className="text-green-700 font-semibold">Submitted (Hidden)</span>
                                  </div>
                                )
                              ) : (
                                <div>
                                  <XCircle className="inline text-red-600 mr-2" size={20} />
                                  <span className="text-red-700 font-semibold">Pending</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
