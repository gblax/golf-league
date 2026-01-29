import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, CheckCircle, XCircle, TrendingUp, Bell, Shield, Mail, LogOut, LogIn, ChevronDown, ChevronRight, Sun, Moon, Settings, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to format prize pool
const formatPrizePool = (amount) => {
  if (!amount) return 'TBA';
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  return `$${amount.toLocaleString()}`;
};

const App = () => {
  const [activeTab, setActiveTab] = useState('picks');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [backupPlayer, setBackupPlayer] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [picksLoading, setPicksLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [isSignup, setIsSignup] = useState(false);

  // League state
  const [currentLeague, setCurrentLeague] = useState(null);
  const [userLeagues, setUserLeagues] = useState([]);
  const [userRole, setUserRole] = useState('member');
  const [showLeagueSelect, setShowLeagueSelect] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [leagueAction, setLeagueAction] = useState('select'); // 'select', 'create', 'join'
  const [expandedRows, setExpandedRows] = useState({});
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAddGolfer, setShowAddGolfer] = useState(false);
  const [newGolferName, setNewGolferName] = useState('');
  const [primarySearchTerm, setPrimarySearchTerm] = useState('');
  const [backupSearchTerm, setBackupSearchTerm] = useState('');
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
  const [showBackupDropdown, setShowBackupDropdown] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState('');
  const [lockUrgent, setLockUrgent] = useState(false);
  
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [resultsData, setResultsData] = useState({});
  const [editTournamentId, setEditTournamentId] = useState(null);
  const [editTournamentPicks, setEditTournamentPicks] = useState([]);
  const [editResultsData, setEditResultsData] = useState({});
  const [loadingEditPicks, setLoadingEditPicks] = useState(false);
  const [availableGolfers, setAvailableGolfers] = useState([]);
  const [userPicks, setUserPicks] = useState([]);
  const [currentWeekPick, setCurrentWeekPick] = useState({ golfer: '', backup: '' });
  const [expandedScheduleTournament, setExpandedScheduleTournament] = useState(null);

  // League settings state
  const [leagueSettings, setLeagueSettings] = useState({
    backup_picks_enabled: true,
    no_pick_penalty: 500,
    missed_cut_penalty: 10,
    withdrawal_penalty: 10,
    dq_penalty: 10
  });
  const [showLeagueSettings, setShowLeagueSettings] = useState(false);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear service worker caches for fresh data
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }
      // Check for service worker updates
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
      // Reload data from network
      await loadData();
      showNotification('success', 'App refreshed successfully');
    } catch (err) {
      console.error('Refresh failed:', err);
      showNotification('error', 'Refresh failed. Try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // League helper functions
  const loadUserLeagues = async (userId) => {
    const { data: memberships } = await supabase
      .from('league_members')
      .select('league_id, role, leagues(id, name, invite_code, created_at)')
      .eq('user_id', userId);

    const leagues = memberships?.map(m => ({
      ...m.leagues,
      role: m.role
    })) || [];

    setUserLeagues(leagues);
    return leagues;
  };

  const selectLeague = (league) => {
    setCurrentLeague(league);
    setUserRole(league.role);
    setShowLeagueSelect(false);
    localStorage.setItem('currentLeagueId', league.id);
  };

  const handleCreateLeague = async () => {
    if (!newLeagueName.trim()) {
      showNotification('error', 'Please enter a league name');
      return;
    }

    try {
      const inviteCode = Math.random().toString(36).substring(2, 10);
      const { data: league, error } = await supabase
        .from('leagues')
        .insert([{ name: newLeagueName.trim(), invite_code: inviteCode, created_by: currentUser.id }])
        .select()
        .single();

      if (error) {
        showNotification('error', 'Error creating league: ' + error.message);
        return;
      }

      // Add creator as commissioner
      await supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: currentUser.id, role: 'commissioner' }]);

      // Create default league settings
      await supabase
        .from('league_settings')
        .insert([{
          league_id: league.id,
          backup_picks_enabled: true,
          no_pick_penalty: 500,
          missed_cut_penalty: 10,
          withdrawal_penalty: 10,
          dq_penalty: 10
        }]);

      showNotification('success', `League "${league.name}" created! Invite code: ${inviteCode}`);
      const leagues = await loadUserLeagues(currentUser.id);
      const created = leagues.find(l => l.id === league.id);
      if (created) selectLeague(created);
      setNewLeagueName('');
      setLeagueAction('select');
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleJoinLeague = async () => {
    if (!joinInviteCode.trim()) {
      showNotification('error', 'Please enter an invite code');
      return;
    }

    try {
      // Find the league
      const { data: league, error: findError } = await supabase
        .from('leagues')
        .select('*')
        .eq('invite_code', joinInviteCode.trim())
        .single();

      if (findError || !league) {
        showNotification('error', 'Invalid invite code. Please check and try again.');
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('league_members')
        .select('id')
        .eq('league_id', league.id)
        .eq('user_id', currentUser.id)
        .single();

      if (existing) {
        showNotification('error', 'You are already a member of this league');
        return;
      }

      // Join the league
      const { error: joinError } = await supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: currentUser.id, role: 'member' }]);

      if (joinError) {
        showNotification('error', 'Error joining league: ' + joinError.message);
        return;
      }

      showNotification('success', `Joined "${league.name}"!`);
      const leagues = await loadUserLeagues(currentUser.id);
      const joined = leagues.find(l => l.id === league.id);
      if (joined) selectLeague(joined);
      setJoinInviteCode('');
      setLeagueAction('select');
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  // Toast notification state
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Dark mode state - initialize from localStorage or system preference
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('darkMode');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Restore session on page load and listen for auth changes
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (data) {
          setCurrentUser(data);
          setShowLogin(false);

          // Load leagues and restore selected league
          const leagues = await loadUserLeagues(data.id);
          const savedLeagueId = localStorage.getItem('currentLeagueId');
          const savedLeague = leagues.find(l => l.id === savedLeagueId);

          if (savedLeague) {
            selectLeague(savedLeague);
          } else if (leagues.length === 1) {
            selectLeague(leagues[0]);
          } else if (leagues.length > 0) {
            setShowLeagueSelect(true);
          } else {
            setShowLeagueSelect(true);
          }
        }
      }
      setLoading(false);
    };
    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentLeague(null);
        setUserLeagues([]);
        setShowLogin(true);
        setShowLeagueSelect(false);
        localStorage.removeItem('currentLeagueId');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

// Load initial data when user and league are set
  useEffect(() => {
    if (currentUser && currentLeague) {
      loadData();
    }
  }, [currentUser, currentLeague]);

  // Update dropdowns when data loads
  useEffect(() => {
    if (currentWeekPick.golfer) {
      setSelectedPlayer(currentWeekPick.golfer);
      setBackupPlayer(currentWeekPick.backup || '');
    }
  }, [currentWeekPick]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.searchable-dropdown')) {
        setShowPrimaryDropdown(false);
        setShowBackupDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Countdown timer for picks lock
  useEffect(() => {
    const updateCountdown = () => {
      if (!tournaments || tournaments.length === 0) {
        setTimeUntilLock('');
        return;
      }

      // Use same logic as getCurrentTournament to find the active tournament
      const now = new Date();
      const activeTournament = tournaments.find(t => {
        if (t.completed) return false;
        if (t.tournament_date) {
          const tournamentEnd = new Date(t.tournament_date);
          tournamentEnd.setDate(tournamentEnd.getDate() + 3);
          tournamentEnd.setHours(23, 59, 59, 999);
          if (now > tournamentEnd) return false;
        }
        return true;
      }) || tournaments[tournaments.length - 1];

      if (!activeTournament?.picks_lock_time) {
        setTimeUntilLock('');
        return;
      }

      const lockTime = new Date(activeTournament.picks_lock_time);
      const diff = lockTime - now;

      if (diff <= 0) {
        setTimeUntilLock('Locked');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      const isUrgent = days === 0 && hours < 10;
      if (days > 0) {
        setTimeUntilLock(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeUntilLock(`${hours}h ${minutes}m`);
      } else {
        setTimeUntilLock(`${minutes}m`);
      }
      setLockUrgent(isUrgent);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [tournaments]);

const loadData = async () => {
    if (!currentLeague) return;
    const leagueId = currentLeague.id;

    try {
      // Load league settings
      const { data: settingsData } = await supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .limit(1)
        .single();

      if (settingsData) {
        setLeagueSettings(settingsData);
      }

      // Load tournaments FIRST
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('league_id', leagueId)
        .order('week');

      setTournaments(tournamentsData || []);

      // Load available golfers
      const { data: golfersData } = await supabase
        .from('available_golfers')
        .select('*')
        .eq('league_id', leagueId)
        .eq('active', true);

      setAvailableGolfers(golfersData?.map(g => g.name) || []);

      // Load league members with their picks for standings
      const { data: memberData } = await supabase
        .from('league_members')
        .select('user_id, role')
        .eq('league_id', leagueId);

      const memberIds = memberData?.map(m => m.user_id) || [];

      const { data: usersData } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          picks:picks(golfer_name, winnings, penalty_amount, penalty_reason, tournament_id, backup_golfer_name, league_id)
        `)
        .in('id', memberIds.length > 0 ? memberIds : ['none']);
      
// Calculate standings with detailed pick history (filtered to current league)
const playersWithWinnings = (usersData || []).map(user => {
  const leaguePicks = user.picks?.filter(p => p.league_id === leagueId) || [];
  const picksByWeek = (tournamentsData || []).map(tournament => {
    const pick = leaguePicks.find(p => p.tournament_id === tournament.id);
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
    winnings: leaguePicks.reduce((sum, pick) => sum + (pick.winnings || 0), 0),
    penalties: leaguePicks.reduce((sum, pick) => sum + (pick.penalty_amount || 0), 0),
    picks: leaguePicks.map(p => p.golfer_name),
    picksByWeek: picksByWeek,
    currentPick: leaguePicks.find(p => p.tournament_id === getCurrentTournament(tournamentsData)?.id) || { golfer_name: '', backup_golfer_name: '' }
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
    if (!currentUser || !currentLeague) return;

    setPicksLoading(true);

    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('league_id', currentLeague.id);
    
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
    if (!currentUser || !currentLeague) return;

    setPicksLoading(true);

    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('league_id', currentLeague.id);
    
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
    const now = new Date();

    // Find the first tournament that:
    // 1. Is not marked completed AND
    // 2. Has not ended yet (tournament_date + 4 days covers the full weekend)
    // This ensures picks unlock on Monday after a tournament ends
    const activeTournament = list.find(t => {
      if (t.completed) return false;

      // If tournament_date exists, check if we're past the tournament weekend
      if (t.tournament_date) {
        const tournamentEnd = new Date(t.tournament_date);
        tournamentEnd.setDate(tournamentEnd.getDate() + 3); // Tournament ends Sunday (start + 3 days)
        tournamentEnd.setHours(23, 59, 59, 999); // End of Sunday

        // If we're past the tournament weekend, skip to next
        if (now > tournamentEnd) return false;
      }

      return true;
    });

    return activeTournament || list[list.length - 1];
  };

  const currentWeek = getCurrentTournament()?.week || 1;

  const handleLogin = async () => {
    try {
      if (isSignup) {
        // Supabase Auth signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: loginEmail,
          password: loginPassword,
        });

        if (authError) {
          showNotification('error', 'Signup failed: ' + authError.message);
          return;
        }

        if (!authData.user) {
          showNotification('error', 'Signup failed. Please try again.');
          return;
        }

        // Create matching row in users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert([{ id: authData.user.id, email: loginEmail, name: signupName }])
          .select()
          .single();

        if (userError) {
          showNotification('error', 'Error creating profile: ' + userError.message);
          return;
        }

        setCurrentUser(userData);
        setShowLogin(false);

        // New user — show league create/join
        setShowLeagueSelect(true);
      } else {
        // Supabase Auth login
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (authError) {
          showNotification('error', 'Invalid email or password');
          return;
        }

        // Fetch user profile from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (userError || !userData) {
          showNotification('error', 'Account not found. Please sign up.');
          await supabase.auth.signOut();
          return;
        }

        setCurrentUser(userData);
        setShowLogin(false);

        // Load leagues for the user
        const leagues = await loadUserLeagues(userData.id);
        const savedLeagueId = localStorage.getItem('currentLeagueId');
        const savedLeague = leagues.find(l => l.id === savedLeagueId);

        if (savedLeague) {
          selectLeague(savedLeague);
        } else if (leagues.length === 1) {
          selectLeague(leagues[0]);
        } else {
          setShowLeagueSelect(true);
        }
      }
    } catch (error) {
      showNotification('error', 'Login error: ' + error.message);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName || !editEmail) {
      showNotification('error', 'Name and email are required');
      return;
    }

    try {
      // If email changed, update it in Supabase Auth
      if (editEmail !== currentUser.email) {
        const { error: authError } = await supabase.auth.updateUser({ email: editEmail });
        if (authError) {
          showNotification('error', 'Error updating email: ' + authError.message);
          return;
        }
      }

      // Update name (and email) in users table
      const { error } = await supabase
        .from('users')
        .update({
          name: editName,
          email: editEmail
        })
        .eq('id', currentUser.id);

      if (error) {
        showNotification('error', 'Error updating profile: ' + error.message);
        return;
      }

      setCurrentUser({ ...currentUser, name: editName, email: editEmail });
      showNotification('success', editEmail !== currentUser.email
        ? 'Profile updated! Check your new email to confirm the change.'
        : 'Profile updated successfully!');
      setShowAccountSettings(false);
      loadData();
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showNotification('error', 'New password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification('error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showNotification('error', 'Password must be at least 6 characters');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        showNotification('error', 'Error updating password: ' + error.message);
        return;
      }

      showNotification('success', 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const openAccountSettings = () => {
    setEditName(currentUser.name);
    setEditEmail(currentUser.email);
    setShowAccountSettings(true);
  };

  // Helper to get penalty amount based on type
  const getPenaltyAmount = (penaltyType) => {
    if (!penaltyType) return 0;
    switch (penaltyType) {
      case 'no_pick': return leagueSettings.no_pick_penalty || 0;
      case 'missed_cut': return leagueSettings.missed_cut_penalty || 0;
      case 'withdrawal': return leagueSettings.withdrawal_penalty || 0;
      case 'disqualification': return leagueSettings.dq_penalty || 0;
      default: return 0;
    }
  };

  const handleAddGolfer = async () => {
    if (!newGolferName.trim()) {
      showNotification('error', 'Please enter a golfer name');
      return;
    }

    try {
      const { error } = await supabase
        .from('available_golfers')
        .insert([{ name: newGolferName.trim(), active: true, league_id: currentLeague.id }]);
      
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          showNotification('error', 'This golfer already exists in the list');
        } else {
          showNotification('error', 'Error adding golfer: ' + error.message);
        }
        return;
      }
      
      showNotification('success', `Added ${newGolferName} to golfer list`);
      setNewGolferName('');
      setShowAddGolfer(false);
      loadData(); // Reload to update available golfers
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleUpdateLeagueSettings = async (newSettings) => {
    try {
      const { error } = await supabase
        .from('league_settings')
        .update({
          ...newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('league_id', currentLeague.id);

      if (error) {
        showNotification('error', 'Error saving settings: ' + error.message);
        return;
      }

      setLeagueSettings({ ...leagueSettings, ...newSettings });
      showNotification('success', 'Settings saved');
    } catch (error) {
      showNotification('error', error.message);
    }
  };

const handleSaveResults = async (playerId) => {
    try {
      const tournamentId = currentTournament.id;
      const playerData = resultsData[playerId] || {};
      const winnings = playerData.winnings || 0;
      const penaltyType = playerData.penalty || '';
      
      const player = players.find(p => p.id === playerId);
      const hasSubmittedPick = player?.currentPick?.golfer_name;
      
      // If player didn't submit a pick, create a record with just penalties
      if (!hasSubmittedPick) {
        if (!penaltyType) {
          showNotification('error', 'Please select a penalty for players who did not submit a pick');
          return;
        }
        
        const { error: pickError } = await supabase
          .from('picks')
          .insert({
            user_id: playerId,
            tournament_id: tournamentId,
            league_id: currentLeague.id,
            golfer_name: null,
            backup_golfer_name: null,
            winnings: 0,
            penalty_amount: getPenaltyAmount(penaltyType),
            penalty_reason: penaltyType
          });

        if (pickError) {
          showNotification('error', 'Error saving penalty: ' + pickError.message);
          return;
        }

        // Add to penalties table
        await supabase
          .from('penalties')
          .upsert({
            user_id: playerId,
            tournament_id: tournamentId,
            league_id: currentLeague.id,
            penalty_type: penaltyType,
            amount: getPenaltyAmount(penaltyType)
          }, { onConflict: 'user_id,tournament_id' });
        
        showNotification('success', 'Penalty saved');
        loadData();
        return;
      }
      
      // Update existing pick with winnings/penalties
      const { error: pickError } = await supabase
        .from('picks')
        .update({
          winnings: parseInt(winnings) || 0,
          penalty_amount: getPenaltyAmount(penaltyType),
          penalty_reason: penaltyType || null
        })
        .eq('user_id', playerId)
        .eq('tournament_id', tournamentId);
      
      if (pickError) {
        showNotification('error', 'Error saving results: ' + pickError.message);
        return;
      }
      
      // If there's a penalty, add it to the penalties table
      if (penaltyType) {
        await supabase
          .from('penalties')
          .upsert({
            user_id: playerId,
            tournament_id: tournamentId,
            league_id: currentLeague.id,
            penalty_type: penaltyType,
            amount: getPenaltyAmount(penaltyType)
          }, { onConflict: 'user_id,tournament_id' });
      }

      showNotification('success', 'Results saved');
      loadData(); // Reload to show updated standings
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const loadTournamentPicks = async (tournamentId) => {
    if (!tournamentId) {
      setEditTournamentPicks([]);
      setEditResultsData({});
      return;
    }

    setLoadingEditPicks(true);
    try {
      // Get all picks for this tournament with user info (scoped to league)
      const { data: picks, error } = await supabase
        .from('picks')
        .select('*, users(id, name)')
        .eq('tournament_id', tournamentId)
        .eq('league_id', currentLeague.id);

      if (error) throw error;

      // Get league members to show those without picks too
      const { data: members } = await supabase
        .from('league_members')
        .select('user_id, users(id, name)')
        .eq('league_id', currentLeague.id);

      const allUsers = members?.map(m => m.users).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)) || [];

      // Create a map of existing picks
      const picksMap = {};
      picks?.forEach(pick => {
        picksMap[pick.user_id] = pick;
      });

      // Build combined list - all users with their pick data (if any)
      const combinedData = allUsers?.map(user => ({
        ...user,
        pick: picksMap[user.id] || null
      })) || [];

      setEditTournamentPicks(combinedData);

      // Pre-populate edit form with existing values
      const initialEditData = {};
      combinedData.forEach(user => {
        if (user.pick) {
          initialEditData[user.id] = {
            pickId: user.pick.id,
            golferName: user.pick.golfer_name || '',
            winnings: user.pick.winnings || 0,
            penalty: user.pick.penalty_reason || ''
          };
        } else {
          initialEditData[user.id] = {
            pickId: null,
            golferName: '',
            winnings: 0,
            penalty: ''
          };
        }
      });
      setEditResultsData(initialEditData);
    } catch (error) {
      console.error('Error loading tournament picks:', error);
    } finally {
      setLoadingEditPicks(false);
    }
  };

  const handleSaveEditResults = async (userId) => {
    const tournament = tournaments.find(t => t.id === editTournamentId);
    const userData = editResultsData[userId];
    if (!userData) return;

    try {
      const updateData = {
        winnings: parseInt(userData.winnings) || 0,
        penalty_amount: getPenaltyAmount(userData.penalty),
        penalty_reason: userData.penalty || null
      };

      if (userData.pickId) {
        // Update existing pick
        const { error } = await supabase
          .from('picks')
          .update(updateData)
          .eq('id', userData.pickId);

        if (error) throw error;
      } else {
        // Create new pick record for user who didn't submit
        const { error } = await supabase
          .from('picks')
          .insert({
            user_id: userId,
            tournament_id: editTournamentId,
            league_id: currentLeague.id,
            golfer_name: null,
            ...updateData
          });

        if (error) throw error;
      }

      // Update penalties table
      if (userData.penalty) {
        await supabase
          .from('penalties')
          .upsert({
            user_id: userId,
            tournament_id: editTournamentId,
            league_id: currentLeague.id,
            penalty_type: userData.penalty,
            amount: getPenaltyAmount(userData.penalty)
          }, { onConflict: 'user_id,tournament_id' });
      } else {
        // Remove penalty if cleared
        await supabase
          .from('penalties')
          .delete()
          .eq('user_id', userId)
          .eq('tournament_id', editTournamentId);
      }

      showNotification('success', 'Results updated');
      loadTournamentPicks(editTournamentId); // Reload picks
      loadData(); // Reload standings
    } catch (error) {
      showNotification('error', 'Error saving: ' + error.message);
    }
  };

const handleSubmitPick = async () => {
    if (!selectedPlayer) {
      showNotification('error', 'Please select a primary golfer');
      return;
    }
    
    if (backupPlayer && backupPlayer === selectedPlayer) {
      showNotification('error', 'Backup golfer must be different from primary pick');
      return;
    }
  
    const currentTournament = getCurrentTournament();
    
    // Check if picks are locked
    const now = new Date();
    const lockTime = new Date(currentTournament.picks_lock_time);
    
    if (now >= lockTime) {
      showNotification('error', 'Picks are locked! The tournament has already started.');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('picks')
        .upsert({
          user_id: currentUser.id,
          tournament_id: currentTournament.id,
          league_id: currentLeague.id,
          golfer_name: selectedPlayer,
          backup_golfer_name: leagueSettings.backup_picks_enabled ? (backupPlayer || null) : null,
          winnings: 0
        }, { onConflict: 'user_id,tournament_id' });
      
      if (error) {
        showNotification('error', 'Error submitting pick: ' + error.message);
        return;
      }
      
      showNotification('success', `Pick submitted: ${selectedPlayer}${leagueSettings.backup_picks_enabled && backupPlayer ? ` (Backup: ${backupPlayer})` : ''}`);
      loadData();
    } catch (error) {
      showNotification('error', error.message);
    }
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

  // Filter golfers based on search term
  const filterGolfers = (searchTerm, excludePlayer = null) => {
    return availableForPick
      .filter(g => excludePlayer ? g !== excludePlayer : true)
      .filter(g => g.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 50); // Limit to 50 results for performance
  };

  const filteredPrimaryGolfers = filterGolfers(primarySearchTerm);
  const filteredBackupGolfers = filterGolfers(backupSearchTerm, selectedPlayer);

  const sortedStandings = [...players].sort((a, b) => b.winnings - a.winnings);
  const currentTournament = getCurrentTournament();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-green-600 dark:border-green-400 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-2xl font-bold text-green-700 dark:text-green-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6 transition-colors duration-300">
        {/* Dark mode toggle for login page */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="fixed top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-700 shadow-lg hover:shadow-xl transition-all duration-200 text-gray-600 dark:text-yellow-400"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-100 dark:border-slate-700 transition-colors duration-300">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full mb-4 shadow-lg">
              <Trophy className="text-white" size={40} />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">Golf One and Done</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">{isSignup ? 'Create Account' : 'Welcome Back'}</p>
          </div>

          <div className="space-y-5">
            {isSignup && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="w-full p-3.5 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full p-3.5 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-3.5 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                placeholder="Password"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              {isSignup ? 'Create Account' : 'Sign In'}
            </button>

            <button
              onClick={() => setIsSignup(!isSignup)}
              className="w-full text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium transition-colors"
            >
              {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // League selection/creation screen
  if (showLeagueSelect || !currentLeague) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6 transition-colors duration-300">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="fixed top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-700 shadow-lg hover:shadow-xl transition-all duration-200 text-gray-600 dark:text-yellow-400"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {notification && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
            notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {notification.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-100 dark:border-slate-700 transition-colors duration-300">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full mb-4 shadow-lg">
              <Trophy className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">Golf One and Done</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Welcome, {currentUser?.name}</p>
          </div>

          {/* League selection tabs */}
          <div className="flex border-b border-gray-200 dark:border-slate-600 mb-6">
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
                  className="w-full p-4 bg-gray-50 dark:bg-slate-700 hover:bg-green-50 dark:hover:bg-green-900/20 border-2 border-gray-200 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500 rounded-xl text-left transition-all"
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
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Invite Code</label>
                <input
                  type="text"
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinLeague()}
                  className="w-full p-3.5 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  placeholder="e.g. a1b2c3d4"
                />
              </div>
              <button
                onClick={handleJoinLeague}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
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
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">League Name</label>
                <input
                  type="text"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateLeague()}
                  className="w-full p-3.5 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  placeholder="e.g. Weekend Warriors Golf"
                />
              </div>
              <button
                onClick={handleCreateLeague}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
              >
                Create League
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-600">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                localStorage.removeItem('currentLeagueId');
              }}
              className="w-full text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 transition-colors duration-300">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in ${
          notification.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <XCircle size={20} />
          )}
          <span className="font-medium">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 hover:opacity-70 transition-opacity"
          >
            ×
          </button>
        </div>
      )}
      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-slate-900/50 p-4 sm:p-8 mb-4 sm:mb-6 border border-gray-100 dark:border-slate-700 transition-colors duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <h1 className="text-2xl sm:text-4xl font-bold flex items-center gap-2 sm:gap-3">
                <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl shadow-lg">
                  <Trophy className="text-white" size={28} />
                </div>
                <span className="leading-tight bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">{currentLeague?.name || 'Golf One and Done'}</span>
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-medium">Week {currentWeek} - {currentTournament?.name}</p>
                  <span className="text-xs sm:text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-bold border border-green-200 dark:border-green-800">
                    {formatPrizePool(currentTournament?.prize_pool)}
                  </span>
                </div>
                {timeUntilLock && timeUntilLock !== 'Locked' && (
                  <span className={`text-xs sm:text-sm px-3 py-1.5 rounded-full font-semibold w-fit border ${lockUrgent ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 animate-pulse' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}>
                    ⏰ {timeUntilLock} until lock
                  </span>
                )}
              </div>
            </div>
            <div className="w-full sm:w-auto flex items-start justify-between sm:block">
              <div className="text-left sm:text-right">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Playing as</p>
                <p className="text-lg sm:text-xl font-bold text-green-700 dark:text-green-400">{currentUser?.name}</p>
                <div className="flex flex-col items-start sm:items-end gap-1.5 mt-2">
                  <button
                    onClick={openAccountSettings}
                    className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Users size={14} />
                    Account
                  </button>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Bell size={14} />
                    Notifications
                  </button>
                  {userLeagues.length > 1 && (
                    <button
                      onClick={() => {
                        setCurrentLeague(null);
                        setShowLeagueSelect(true);
                      }}
                      className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1.5 transition-colors"
                    >
                      <ChevronDown size={14} />
                      Switch League
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      localStorage.removeItem('currentLeagueId');
                    }}
                    className="text-xs sm:text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1.5 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
              {/* Refresh and dark mode toggles */}
              <div className="flex gap-2 ml-auto sm:ml-0 sm:absolute sm:top-4 sm:right-4">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-400 transition-all duration-200 disabled:opacity-50"
                  aria-label="Refresh app"
                >
                  <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-yellow-400 transition-all duration-200"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Settings Panel - Future Features */}
          {showSettings && (
            <div className="mt-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl p-6 border border-gray-200 dark:border-slate-600 transition-colors">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <Bell className="text-green-600 dark:text-green-400" />
                Notification Settings
              </h3>
              <div className="space-y-3">
                <p className="text-gray-600 dark:text-gray-400">
                  Notification preferences coming soon! In the future, you'll be able to customize how you receive updates about the league.
                </p>
              </div>
            </div>
          )}

          {/* Account Settings Modal */}
          {showAccountSettings && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-slate-700 transition-colors">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      <Users className="text-green-600 dark:text-green-400" size={28} />
                      Account Settings
                    </h2>
                    <button
                      onClick={() => setShowAccountSettings(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <XCircle size={28} />
                    </button>
                  </div>

                  {/* Profile Information Section */}
                  <div className="mb-8 pb-6 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-200">Profile Information</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                          placeholder="Your name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                          placeholder="your@email.com"
                        />
                      </div>

                      <button
                        onClick={handleUpdateProfile}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-2.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                      >
                        Save Profile Changes
                      </button>
                    </div>
                  </div>

                  {/* Change Password Section */}
                  <div>
                    <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-200">Change Password</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                          placeholder="Enter new password (min 6 characters)"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-green-500 dark:focus:border-green-400 focus:outline-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white transition-colors"
                          placeholder="Confirm new password"
                        />
                      </div>

                      <button
                        onClick={handleChangePassword}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowAccountSettings(false)}
                      className="w-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 py-2.5 px-6 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg dark:shadow-slate-900/50 mb-6 border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="flex border-b border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('picks')}
              className={`flex-1 py-4 px-2 sm:px-6 font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all duration-200 active:scale-95 ${
                activeTab === 'picks'
                  ? 'border-b-4 border-green-500 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <CheckCircle size={20} />
              <span className="hidden sm:inline text-base">Pick</span>
            </button>
            <button
              onClick={() => setActiveTab('standings')}
              className={`flex-1 py-4 px-2 sm:px-6 font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all duration-200 active:scale-95 ${
                activeTab === 'standings'
                  ? 'border-b-4 border-green-500 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <TrendingUp size={20} />
              <span className="hidden sm:inline text-base">Standings</span>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 py-4 px-2 sm:px-6 font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all duration-200 active:scale-95 ${
                activeTab === 'schedule'
                  ? 'border-b-4 border-green-500 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Calendar size={20} />
              <span className="hidden sm:inline text-base">Schedule</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-4 px-2 sm:px-6 font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all duration-200 active:scale-95 ${
                activeTab === 'admin'
                  ? 'border-b-4 border-green-500 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Users size={20} />
              <span className="hidden sm:inline text-base">League Info</span>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex-1 py-4 px-2 sm:px-6 font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-all duration-200 active:scale-95 ${
                activeTab === 'results'
                  ? 'border-b-4 border-green-500 text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Shield size={20} />
              <span className="hidden sm:inline text-base">Commissioner</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3 sm:p-6">
{activeTab === 'picks' && (
              picksLoading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-green-600 dark:border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-xl font-semibold text-gray-600 dark:text-gray-400">Loading your picks...</div>
                </div>
              ) : (
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
                        disabled={!selectedPlayer || isLocked}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-500 dark:disabled:from-slate-600 dark:disabled:to-slate-700 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:scale-95 disabled:transform-none disabled:active:scale-100 transition-all duration-150"
                      >
                        {isLocked ? 'Picks Locked' : 'Submit Pick'}
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
              )
            )}

            {activeTab === 'results' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Commissioner</h2>

                {userRole !== 'commissioner' ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
                    <Shield className="text-gray-400 dark:text-gray-500 mx-auto mb-4" size={64} />
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">Commissioner Only</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Only the league commissioner can change league rules and manage tournament results.
                    </p>
                  </div>
                ) : (
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
                          {/* Backup Picks Toggle */}
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-600 rounded-xl">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-100">Backup Picks</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Allow players to select a backup golfer in case their primary withdraws
                              </p>
                            </div>
                            <button
                              onClick={() => handleUpdateLeagueSettings({
                                backup_picks_enabled: !leagueSettings.backup_picks_enabled
                              })}
                              className={`relative w-14 h-8 rounded-full transition-colors duration-200 flex-shrink-0 ${
                                leagueSettings.backup_picks_enabled
                                  ? 'bg-green-500'
                                  : 'bg-gray-300 dark:bg-slate-500'
                              }`}
                            >
                              <span
                                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-all duration-200 ${
                                  leagueSettings.backup_picks_enabled ? 'translate-x-6' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {/* Penalty Amounts */}
                          <div className="p-4 bg-gray-50 dark:bg-slate-600 rounded-xl space-y-4">
                            <p className="font-semibold text-gray-800 dark:text-gray-100">Penalty Amounts</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  No Pick Submitted
                                </label>
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
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  Missed Cut
                                </label>
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
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  Withdrawal
                                </label>
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
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  Disqualification
                                </label>
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

                            <button
                              onClick={() => handleUpdateLeagueSettings({
                                no_pick_penalty: leagueSettings.no_pick_penalty,
                                missed_cut_penalty: leagueSettings.missed_cut_penalty,
                                withdrawal_penalty: leagueSettings.withdrawal_penalty,
                                dq_penalty: leagueSettings.dq_penalty
                              })}
                              className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors active:scale-95"
                            >
                              Save Penalty Settings
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
                            // Only show tournaments where picks are locked (tournament has started)
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
                )}
              </div>
            )}

            {activeTab === 'standings' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">League Standings</h2>
                <div className="overflow-x-auto -mx-3 px-3 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-slate-700">
                        <th className="py-2 sm:py-3 px-1 sm:px-4 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm rounded-tl-lg">#</th>
                        <th className="py-2 sm:py-3 px-1 sm:px-4 text-left font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Player</th>
                        <th className="py-2 sm:py-3 px-1 sm:px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Won</th>
                        <th className="py-2 sm:py-3 px-1 sm:px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Pen.</th>
                        <th className="py-2 sm:py-3 px-1 sm:px-4 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">Pick</th>
                        <th className="py-2 sm:py-3 px-1 sm:px-2 text-center font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm rounded-tr-lg"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStandings.map((player, idx) => (
                        <React.Fragment key={player.id}>
                          <tr
                            className={`border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${player.id === currentUser?.id ? 'bg-green-50 dark:bg-green-900/20 font-semibold' : ''}`}
                          >
                            <td className="py-2 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                              {idx === 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <span className="text-base sm:text-lg">🥇</span>
                                  <span className="hidden sm:inline font-bold text-yellow-600 dark:text-yellow-400">1</span>
                                </span>
                              ) : idx === 1 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <span className="text-base sm:text-lg">🥈</span>
                                  <span className="hidden sm:inline font-semibold text-gray-500 dark:text-gray-400">2</span>
                                </span>
                              ) : idx === 2 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <span className="text-base sm:text-lg">🥉</span>
                                  <span className="hidden sm:inline font-semibold text-amber-700 dark:text-amber-500">3</span>
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm text-gray-800 dark:text-gray-200">{player.name}</td>
                            <td className="py-2 sm:py-3 px-1 sm:px-4 text-center text-xs sm:text-sm text-gray-800 dark:text-gray-200">${player.winnings.toLocaleString()}</td>
                            <td className="py-2 sm:py-3 px-1 sm:px-4 text-center text-red-600 dark:text-red-400 font-semibold text-xs sm:text-sm">
                              {player.penalties > 0 ? `$${player.penalties}` : '-'}
                            </td>
                            <td className="py-2 sm:py-3 px-1 sm:px-4 text-center text-xs sm:text-sm">
                              {(() => {
                                const now = new Date();
                                const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                                const isLocked = lockTime && now >= lockTime;
                                const isCurrentUser = player.id === currentUser?.id;

                                // Current user can always see their own pick
                                if (isCurrentUser) {
                                  return player.currentPick?.golfer_name ? (
                                    <div>
                                      <div className="text-green-700 dark:text-green-400 truncate max-w-[80px] sm:max-w-none">{player.currentPick.golfer_name}</div>
                                      {leagueSettings.backup_picks_enabled && player.currentPick.backup_golfer_name && (
                                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Backup: {player.currentPick.backup_golfer_name}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-red-500 dark:text-red-400 text-[10px] sm:text-sm">No pick</span>
                                  );
                                }

                                // Other users - hide if NOT locked yet
                                if (!isLocked) {
                                  return player.currentPick?.golfer_name ? (
                                    <span className="text-gray-500 dark:text-gray-400">🔒</span>
                                  ) : (
                                    <span className="text-red-500 dark:text-red-400 text-[10px] sm:text-sm">No pick</span>
                                  );
                                }

                                // Locked - show everyone's picks
                                return player.currentPick?.golfer_name ? (
                                  <div>
                                    <div className="text-green-700 dark:text-green-400 truncate max-w-[80px] sm:max-w-none">{player.currentPick.golfer_name}</div>
                                    {leagueSettings.backup_picks_enabled && player.currentPick.backup_golfer_name && (
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Backup: {player.currentPick.backup_golfer_name}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-red-500 dark:text-red-400 text-[10px] sm:text-sm">No pick</span>
                                );
                              })()}
                            </td>
                            <td className="py-2 sm:py-3 px-1 sm:px-2 text-center">
                              <button
                                onClick={() => toggleRowExpansion(player.id)}
                                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-0.5 mx-auto text-xs sm:text-sm transition-all active:scale-95"
                              >
                                {expandedRows[player.id] ? (
                                  <>
                                    <ChevronDown size={16} />
                                    <span className="hidden sm:inline">Hide</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight size={16} />
                                    <span className="hidden sm:inline">Details</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded weekly results row */}
                          {expandedRows[player.id] && (
                            <tr className="bg-gray-50 dark:bg-slate-700/50">
                              <td colSpan="6" className="py-4 px-4">
                                <div className="max-w-5xl mx-auto">
                                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">Week-by-Week Results for {player.name}</h4>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-gray-200 dark:bg-slate-600">
                                          <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Week</th>
                                          <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Tournament</th>
                                          <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Golfer</th>
                                          {leagueSettings.backup_picks_enabled && (
                                            <th className="py-2 px-3 text-left text-gray-800 dark:text-gray-200">Backup</th>
                                          )}
                                          <th className="py-2 px-3 text-right text-gray-800 dark:text-gray-200">Winnings</th>
                                          <th className="py-2 px-3 text-center text-gray-800 dark:text-gray-200">Penalty</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {player.picksByWeek.map((weekData, weekIdx) => {
                                          // Check if this is the current week and if picks should be hidden
                                          const isCurrentWeekRow = weekData.week === currentWeek;
                                          const isViewingOwnPicks = player.id === currentUser?.id;
                                          const now = new Date();
                                          const lockTime = currentTournament?.picks_lock_time ? new Date(currentTournament.picks_lock_time) : null;
                                          const isLocked = lockTime && now >= lockTime;
                                          const shouldHidePick = isCurrentWeekRow && !isViewingOwnPicks && !isLocked;

                                          return (
                                          <tr key={weekIdx} className="border-b border-gray-300 dark:border-slate-600">
                                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">{weekData.week}</td>
                                            <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{weekData.tournamentName}</td>
                                            <td className="py-2 px-3">
                                              {shouldHidePick ? (
                                                weekData.golfer ? (
                                                  <span className="text-gray-500 dark:text-gray-400">🔒 Hidden</span>
                                                ) : (
                                                  <span className="text-gray-400 dark:text-gray-500 italic">No pick</span>
                                                )
                                              ) : weekData.golfer ? (
                                                <span className="text-green-700 dark:text-green-400 font-medium">{weekData.golfer}</span>
                                              ) : (
                                                <span className="text-gray-400 dark:text-gray-500 italic">No pick</span>
                                              )}
                                            </td>
                                            {leagueSettings.backup_picks_enabled && (
                                              <td className="py-2 px-3">
                                                {shouldHidePick ? (
                                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                                ) : weekData.backup ? (
                                                  <span className="text-amber-600 dark:text-amber-400 text-xs">{weekData.backup}</span>
                                                ) : (
                                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                                )}
                                              </td>
                                            )}
                                            <td className="py-2 px-3 text-right">
                                              {weekData.winnings > 0 ? (
                                                <span className="text-green-600 dark:text-green-400 font-semibold">${weekData.winnings.toLocaleString()}</span>
                                              ) : (
                                                <span className="text-gray-400 dark:text-gray-500">$0</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              {weekData.penalty > 0 ? (
                                                <span className="text-red-600 dark:text-red-400 font-semibold">
                                                  ${weekData.penalty} ({weekData.penaltyReason?.replace('_', ' ')})
                                                </span>
                                              ) : (
                                                <span className="text-gray-400 dark:text-gray-500">-</span>
                                              )}
                                            </td>
                                          </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-gray-200 dark:bg-slate-600 font-bold">
                                          <td colSpan={leagueSettings.backup_picks_enabled ? 4 : 3} className="py-2 px-3 text-right text-gray-800 dark:text-gray-200">TOTALS:</td>
                                          <td className="py-2 px-3 text-right text-green-700 dark:text-green-400">
                                            ${player.winnings.toLocaleString()}
                                          </td>
                                          <td className="py-2 px-3 text-center text-red-600 dark:text-red-400">
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
                <div className="text-center mt-2 sm:hidden">
                  <p className="text-xs text-gray-500 dark:text-gray-400">← Swipe to see more →</p>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Tournament Schedule</h2>
                <div className="space-y-3">
                  {tournaments.map((tournament) => (
                    <div key={tournament.id}>
                      <div
                        onClick={() => tournament.completed && setExpandedScheduleTournament(
                          expandedScheduleTournament === tournament.id ? null : tournament.id
                        )}
                        className={`p-3 sm:p-4 rounded-xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                          tournament.completed ? 'cursor-pointer' : 'cursor-default'
                        } ${
                          tournament.week === currentWeek
                            ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20 shadow-sm'
                            : tournament.completed
                            ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50'
                            : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                        } ${expandedScheduleTournament === tournament.id ? 'rounded-b-none' : ''}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-base sm:text-lg text-gray-800 dark:text-gray-100">{tournament.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                tournament.prize_pool
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                                  : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                              }`}>
                                {formatPrizePool(tournament.prize_pool)}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Week {tournament.week} - {new Date(tournament.tournament_date).toLocaleDateString()}</p>
                            {(tournament.course || tournament.location) && (
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                {tournament.course}{tournament.course && tournament.location && ' • '}{tournament.location}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {tournament.completed ? (
                              <>
                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                                  <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                                  <span className="text-xs sm:text-sm">Completed</span>
                                </span>
                                <ChevronDown
                                  size={20}
                                  className={`text-gray-400 transition-transform ${expandedScheduleTournament === tournament.id ? 'rotate-180' : ''}`}
                                />
                              </>
                            ) : tournament.week === currentWeek ? (
                              <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold text-xs sm:text-sm inline-block shadow-lg animate-pulse-gentle">
                                Current Week
                              </span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm">Upcoming</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded tournament results */}
                      {expandedScheduleTournament === tournament.id && tournament.completed && (
                        <div className="border border-t-0 border-gray-200 dark:border-slate-600 rounded-b-xl bg-white dark:bg-slate-800 p-4">
                          <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Week {tournament.week} Results</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-slate-600">
                                  <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Player</th>
                                  <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400">Pick</th>
                                  <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400">Won</th>
                                  <th className="text-center py-2 px-2 text-gray-600 dark:text-gray-400">Penalty</th>
                                </tr>
                              </thead>
                              <tbody>
                                {players
                                  .map(player => {
                                    const weekData = player.picksByWeek?.find(w => w.week === tournament.week);
                                    return { ...player, weekData };
                                  })
                                  .sort((a, b) => (b.weekData?.winnings || 0) - (a.weekData?.winnings || 0))
                                  .map(player => (
                                    <tr key={player.id} className={`border-b border-gray-100 dark:border-slate-700 ${player.id === currentUser?.id ? 'bg-green-50 dark:bg-green-900/30 font-semibold' : ''}`}>
                                      <td className="py-2 px-2 text-gray-800 dark:text-gray-200">
                                        {player.name}
                                        {player.id === currentUser?.id && <span className="ml-1 text-green-600 dark:text-green-400 text-xs">(you)</span>}
                                      </td>
                                      <td className="py-2 px-2">
                                        {player.weekData?.golfer ? (
                                          <span className="text-green-700 dark:text-green-400">{player.weekData.golfer}</span>
                                        ) : (
                                          <span className="text-red-500 dark:text-red-400 text-xs">No pick</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-right text-gray-800 dark:text-gray-200">
                                        ${(player.weekData?.winnings || 0).toLocaleString()}
                                      </td>
                                      <td className="py-2 px-2 text-center">
                                        {player.weekData?.penalty > 0 ? (
                                          <span className="text-red-600 dark:text-red-400 text-xs">
                                            ${player.weekData.penalty} ({player.weekData.penaltyReason?.replace('_', ' ') || 'penalty'})
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
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
                      const buyIn = 50;
                      const numPlayers = players.length;
                      const totalPenalties = players.reduce((sum, p) => sum + (p.penalties || 0), 0);
                      const totalPot = (numPlayers * buyIn) + totalPenalties;
                      const firstPlace = Math.round(totalPot * 0.65);
                      const secondPlace = Math.round(totalPot * 0.25);
                      const thirdPlace = Math.round(totalPot * 0.10);

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
                              <p className="text-sm text-gray-600 dark:text-gray-400">1st Place (65%)</p>
                              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">${firstPlace}</p>
                            </div>
                            <div className="bg-gray-100 dark:bg-slate-600 border border-gray-400 dark:border-slate-500 p-4 rounded-xl text-center">
                              <div className="text-3xl mb-1">🥈</div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">2nd Place (25%)</p>
                              <p className="text-xl font-bold text-gray-600 dark:text-gray-300">${secondPlace}</p>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-400 dark:border-orange-600 p-4 rounded-xl text-center">
                              <div className="text-3xl mb-1">🥉</div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">3rd Place (10%)</p>
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
                            onKeyPress={(e) => e.key === 'Enter' && handleAddGolfer()}
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
                          <li>• Season buy-in: <strong>$50</strong></li>
                          <li>• Penalties added to prize pool</li>
                        </ul>
                      </div>

                      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                        <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Pick Deadlines</h4>
                        <ul className="text-sm text-amber-900 dark:text-amber-300 space-y-1">
                          <li>• Picks lock when the tournament begins (typically Thursday morning)</li>
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
                          <li>• <strong>1st Place:</strong> 65% of total pot</li>
                          <li>• <strong>2nd Place:</strong> 25% of total pot</li>
                          <li>• <strong>3rd Place:</strong> 10% of total pot</li>
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
                              {player.currentPick?.golfer_name ? (
                                isLocked ? (
                                  <div>
                                    <CheckCircle className="inline text-green-600 dark:text-green-400 mr-2" size={20} />
                                    <span className="text-green-700 dark:text-green-400 font-semibold">Submitted</span>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      {player.currentPick.golfer_name}
                                      {leagueSettings.backup_picks_enabled && player.currentPick.backup_golfer_name && ` (Backup: ${player.currentPick.backup_golfer_name})`}
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <CheckCircle className="inline text-green-600 dark:text-green-400 mr-2" size={20} />
                                    <span className="text-green-700 dark:text-green-400 font-semibold">Submitted (Hidden)</span>
                                  </div>
                                )
                              ) : (
                                <div>
                                  <XCircle className="inline text-red-600 dark:text-red-400 mr-2" size={20} />
                                  <span className="text-red-700 dark:text-red-400 font-semibold">Pending</span>
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
