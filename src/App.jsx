import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Trophy, Users, Calendar, CheckCircle, TrendingUp, Bell, Shield, LogOut, ChevronRight, Sun, Moon, RefreshCw, Menu } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import PicksTab from './components/PicksTab';
import StandingsTab from './components/StandingsTab';
import ScheduleTab from './components/ScheduleTab';
import LeagueInfoTab from './components/LeagueInfoTab';
import CommissionerTab from './components/CommissionerTab';
import LoginScreen from './components/LoginScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import LeagueSelectScreen from './components/LeagueSelectScreen';
import NotificationSettingsModal from './components/NotificationSettingsModal';
import AccountSettingsModal from './components/AccountSettingsModal';
import NotificationToast from './components/NotificationToast';
import Spinner from './components/Spinner';
import { indexLiveLeaderboard, normalizeName } from './utils/liveLeaderboard';
import { friendlyError } from './utils/errors';

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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // League state
  const [currentLeague, setCurrentLeague] = useState(null);
  const [userLeagues, setUserLeagues] = useState([]);
  const [userRole, setUserRole] = useState('member');
  const [showLeagueSelect, setShowLeagueSelect] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [leagueAction, setLeagueAction] = useState('select'); // 'select', 'create', 'join'
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAddGolfer, setShowAddGolfer] = useState(false);
  const [newGolferName, setNewGolferName] = useState('');
  const [primarySearchTerm, setPrimarySearchTerm] = useState('');
  const [backupSearchTerm, setBackupSearchTerm] = useState('');
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
  const [showBackupDropdown, setShowBackupDropdown] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState('');
  const [lockUrgent, setLockUrgent] = useState(false);
  const [lockTimeLabel, setLockTimeLabel] = useState('');

  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [resultsData, setResultsData] = useState({});
  // Live leaderboard snapshot + weekly field/golfer-id lookups (Phases 1 & 2)
  const [liveLeaderboard, setLiveLeaderboard] = useState(null);
  const [tournamentField, setTournamentField] = useState([]);
  const [golferIdByName, setGolferIdByName] = useState({});
  const [editTournamentId, setEditTournamentId] = useState(null);
  const [editTournamentPicks, setEditTournamentPicks] = useState([]);
  const [editResultsData, setEditResultsData] = useState({});
  const [editTournamentWinner, setEditTournamentWinner] = useState('');
  const [savingTournamentWinner, setSavingTournamentWinner] = useState(false);
  const [loadingEditPicks, setLoadingEditPicks] = useState(false);
  const [availableGolfers, setAvailableGolfers] = useState([]);
  const [userPicks, setUserPicks] = useState([]);
  const [currentWeekPick, setCurrentWeekPick] = useState({ golfer: '', backup: '' });
  const [expandedScheduleTournament, setExpandedScheduleTournament] = useState(null);
  const [submittingPick, setSubmittingPick] = useState(false);

  // League settings state
  const [leagueSettings, setLeagueSettings] = useState({
    backup_picks_enabled: false,
    no_pick_penalty: 10,
    missed_cut_penalty: 10,
    withdrawal_penalty: 10,
    dq_penalty: 10,
    buy_in_amount: 50,
    payout_first_pct: 65,
    payout_second_pct: 25,
    payout_third_pct: 10
  });
  const [showLeagueSettings, setShowLeagueSettings] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);

  // Push notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [notifyResults, setNotifyResults] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);

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
      .select('league_id, role')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      setUserLeagues([]);
      return [];
    }

    const leagueIds = memberships.map(m => m.league_id);
    const { data: leaguesData } = await supabase
      .from('leagues')
      .select('id, name, invite_code, created_at')
      .in('id', leagueIds);

    const leagues = (leaguesData || []).map(league => ({
      ...league,
      role: memberships.find(m => m.league_id === league.id)?.role || 'member'
    }));

    setUserLeagues(leagues);
    return leagues;
  };

  const selectLeague = (league) => {
    setCurrentLeague(league);
    setUserRole(league.role);
    setShowLeagueSelect(false);
    localStorage.setItem('currentLeagueId', league.id);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('currentLeagueId');
  };

  const handleCreateLeague = async () => {
    if (!newLeagueName.trim()) {
      showNotification('error', 'Please enter a league name');
      return;
    }
    if (creatingLeague) return;
    setCreatingLeague(true);

    try {
      const inviteCode = Math.random().toString(36).substring(2, 10);
      const { data: league, error } = await supabase
        .from('leagues')
        .insert([{ name: newLeagueName.trim(), invite_code: inviteCode, created_by: currentUser.id }])
        .select()
        .single();

      if (error) {
        showNotification('error', friendlyError(error, 'Could not create the league. Please try again.'));
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
          backup_picks_enabled: false,
          no_pick_penalty: 10,
          missed_cut_penalty: 10,
          withdrawal_penalty: 10,
          dq_penalty: 10,
          buy_in_amount: 50,
          payout_first_pct: 65,
          payout_second_pct: 25,
          payout_third_pct: 10
        }]);

      showNotification('success', `League "${league.name}" created! Invite code: ${inviteCode}`);
      const leagues = await loadUserLeagues(currentUser.id);
      const created = leagues.find(l => l.id === league.id);
      if (created) selectLeague(created);
      setNewLeagueName('');
      setLeagueAction('select');
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not create the league. Please try again.'));
    } finally {
      setCreatingLeague(false);
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
        .maybeSingle();

      if (existing) {
        showNotification('error', 'You are already a member of this league');
        return;
      }

      // Join the league
      const { error: joinError } = await supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: currentUser.id, role: 'member' }]);

      if (joinError) {
        showNotification('error', friendlyError(joinError, 'Could not join the league. Please try again.'));
        return;
      }

      showNotification('success', `Joined "${league.name}"!`);
      const leagues = await loadUserLeagues(currentUser.id);
      const joined = leagues.find(l => l.id === league.id);
      if (joined) selectLeague(joined);
      setJoinInviteCode('');
      setLeagueAction('select');
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not join the league. Please try again.'));
    }
  };

  // Toast notification state
  const [notification, setNotification] = useState(null);
  const notificationTimerRef = useRef(null);

  const showNotification = (type, message) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setNotification({ type, message });
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimerRef.current = null;
    }, 4000);
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

  // Check push notification support
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setPushSupported(supported);
    if (supported) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Check existing push subscription when user logs in
  useEffect(() => {
    if (!currentUser || !pushSupported) return;
    const checkSub = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id, notify_results, notify_reminders')
            .eq('user_id', currentUser.id)
            .eq('endpoint', sub.endpoint)
            .maybeSingle();
          setPushSubscribed(!!data);
          if (data) {
            setNotifyResults(data.notify_results !== false);
            setNotifyReminders(data.notify_reminders !== false);
          }
        } else {
          setPushSubscribed(false);
        }
      } catch { setPushSubscribed(false); }
    };
    checkSub();
  }, [currentUser, pushSupported]);

  const handlePushSubscribe = async () => {
    if (!pushSupported || !currentUser) return;
    setPushLoading(true);
    try {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        showNotification('error', 'Push notifications not configured');
        setPushLoading(false);
        return;
      }
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') {
        showNotification('error', 'Notification permission denied');
        setPushLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey
      });
      const subJson = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: currentUser.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      }, { onConflict: 'user_id,endpoint' });
      if (error) throw error;
      setPushSubscribed(true);
      showNotification('success', 'Push notifications enabled!');
    } catch (err) {
      console.error('Push subscribe error:', err);
      showNotification('error', 'Failed to enable notifications');
    }
    setPushLoading(false);
  };

  const handlePushUnsubscribe = async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('user_id', currentUser.id).eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      showNotification('success', 'Push notifications disabled');
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      showNotification('error', 'Failed to disable notifications');
    }
    setPushLoading(false);
  };

  const handleToggleNotifyPref = async (pref, value) => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub || !currentUser) return;
      await supabase.from('push_subscriptions')
        .update({ [pref]: value })
        .eq('user_id', currentUser.id)
        .eq('endpoint', sub.endpoint);
      if (pref === 'notify_results') setNotifyResults(value);
      if (pref === 'notify_reminders') setNotifyReminders(value);
    } catch (err) {
      console.error('Toggle pref error:', err);
    }
  };

  // Restore session on page load and listen for auth changes
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

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
          } else {
            setShowLeagueSelect(true);
          }
        }
      }
      setLoading(false);
    };
    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
        setShowLogin(false);
      } else if (event === 'SIGNED_OUT') {
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
      if (!event.target.closest('.profile-menu')) {
        setShowProfileMenu(false);
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
      const activeTournament = getCurrentTournament(tournaments);

      if (!activeTournament?.picks_lock_time) {
        setTimeUntilLock('');
        setLockTimeLabel('');
        return;
      }

      const lockTime = new Date(activeTournament.picks_lock_time);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[lockTime.getDay()];
      const hours12 = lockTime.getHours() % 12 || 12;
      const mins = String(lockTime.getMinutes()).padStart(2, '0');
      const ampm = lockTime.getHours() >= 12 ? 'PM' : 'AM';
      setLockTimeLabel(`Locks ${dayName} ${hours12}:${mins} ${ampm} ET`);

      const diff = lockTime - now;

      if (diff <= 0) {
        setTimeUntilLock('Locked');
        // Show when picks reopen (next tournament's lock time = next deadline)
        const activeIdx = tournaments.indexOf(activeTournament);
        const nextTournament = activeIdx >= 0 ? tournaments[activeIdx + 1] : null;
        if (nextTournament?.picks_lock_time) {
          const nextLock = new Date(nextTournament.picks_lock_time);
          const nextDayName = dayNames[nextLock.getDay()];
          const nextHours12 = nextLock.getHours() % 12 || 12;
          const nextMins = String(nextLock.getMinutes()).padStart(2, '0');
          const nextAmpm = nextLock.getHours() >= 12 ? 'PM' : 'AM';
          setLockTimeLabel(`Picks reopen Mon 5:00 AM ET · Next lock ${nextDayName} ${nextHours12}:${nextMins} ${nextAmpm} ET`);
        } else {
          setLockTimeLabel('');
        }
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

const loadData = async (opts = {}) => {
    if (!currentLeague) return;
    const leagueId = currentLeague.id;

    try {
      // Load league settings
      const { data: settingsData } = await supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setLeagueSettings(settingsData);
      }

      // Load tournaments (shared across all leagues)
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .order('week');

      setTournaments(tournamentsData || []);

      // Load available golfers (shared across all leagues)
      const { data: golfersData } = await supabase
        .from('available_golfers')
        .select('*')
        .eq('active', true);

      setAvailableGolfers(golfersData?.map(g => g.name) || []);

      // Name -> Slash Golf golfer_id, so a pick made through the app carries an
      // ID for exact Monday scoring (keyed by normalized name for robustness).
      const idByName = {};
      (golfersData || []).forEach(g => {
        if (g.golfer_id) idByName[normalizeName(g.name)] = g.golfer_id;
      });
      setGolferIdByName(idByName);

      // Load league members with their picks for standings
      const { data: memberData } = await supabase
        .from('league_members')
        .select('user_id, role')
        .eq('league_id', leagueId);

      const memberIds = memberData?.map(m => m.user_id) || [];

      const { data: usersData } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          picks:picks(golfer_name, golfer_id, winnings, penalty_amount, penalty_reason, tournament_id, backup_golfer_name, league_id)
        `)
        .in('id', memberIds.length > 0 ? memberIds : ['none']);
      
// Calculate standings with detailed pick history (filtered to current league)
const playersWithWinnings = (usersData || []).map(user => {
  const leaguePicks = user.picks?.filter(p => p.league_id === leagueId) || [];
  const picksByWeek = (tournamentsData || []).map(tournament => {
    const pick = leaguePicks.find(p => p.tournament_id === tournament.id);
    const lockTime = tournament.picks_lock_time ? new Date(tournament.picks_lock_time) : null;
    const isPast = lockTime ? new Date() >= lockTime : tournament.completed;
    const golfer = (pick?.golfer_name && pick.golfer_name !== 'No Pick') ? pick.golfer_name : null;
    const winnerGolfer = tournament.winner_golfer_name || null;
    return {
      week: tournament.week,
      tournamentName: tournament.name,
      golfer,
      backup: pick?.backup_golfer_name || null,
      winnings: pick?.winnings || 0,
      penalty: pick?.penalty_amount || 0,
      penaltyReason: pick?.penalty_reason || null,
      isPast,
      tournamentWinner: winnerGolfer,
      pickedWinner: !!golfer && !!winnerGolfer && golfer === winnerGolfer,
    };
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    winnings: leaguePicks.reduce((sum, pick) => sum + (pick.winnings || 0), 0),
    penalties: leaguePicks.reduce((sum, pick) => sum + (pick.penalty_amount || 0), 0),
    picks: leaguePicks.map(p => p.golfer_name).filter(n => n && n !== 'No Pick'),
    picksByWeek: picksByWeek,
    currentPick: leaguePicks.find(p => p.tournament_id === getCurrentTournament(tournamentsData)?.id) || { golfer_name: '', backup_golfer_name: '' }
  };
});
      
      setPlayers(playersWithWinnings);

      // Live leaderboard snapshot + weekly field for the active tournament.
      // Both are shared across leagues (keyed by tournament), written by the
      // backend; the browser only reads them.
      const activeTournament = getCurrentTournament(tournamentsData);
      if (activeTournament) {
        const { data: liveData } = await supabase
          .from('live_leaderboard')
          .select('*')
          .eq('tournament_id', activeTournament.id)
          .maybeSingle();
        setLiveLeaderboard(liveData || null);

        const { data: fieldData } = await supabase
          .from('tournament_field')
          .select('golfer_id, golfer_name')
          .eq('tournament_id', activeTournament.id);
        setTournamentField(fieldData || []);
      } else {
        setLiveLeaderboard(null);
        setTournamentField([]);
      }

      // NOW load user data AFTER tournaments are set
      await loadUserDataWithTournaments(tournamentsData, opts);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadUserDataWithTournaments = async (tournamentsData, opts = {}) => {
    if (!currentUser || !currentLeague) return;

    // On a post-write reconcile we already show the pick optimistically, so skip
    // the loading state to avoid a spinner flicker over the confirmed card.
    if (!opts.preservePick) setPicksLoading(true);

    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('league_id', currentLeague.id);

    const allUserPicks = (picksData?.map(p => p.golfer_name) || []).filter(n => n && n !== 'No Pick');
    // When reconciling after a write, union so a stale read can't drop the
    // golfer we just optimistically added to the "previously used" set.
    if (opts.preservePick) {
      setUserPicks(prev => Array.from(new Set([...prev, ...allUserPicks])));
    } else {
      setUserPicks(allUserPicks);
    }

    const currentTournament = getCurrentTournament(tournamentsData);

    const currentPick = picksData?.find(p => p.tournament_id === currentTournament?.id);

    if (currentPick) {
      const primary = (currentPick.golfer_name && currentPick.golfer_name !== 'No Pick') ? currentPick.golfer_name : '';
      const backup = currentPick.backup_golfer_name || '';

      setSelectedPlayer(primary);
      setBackupPlayer(backup);
      setCurrentWeekPick({
        golfer: primary,
        backup: backup
      });
    } else if (!opts.preservePick) {
      // Only clear on a genuine fresh load (initial load / league switch). After
      // a submit we keep the optimistic pick rather than trust a stale "no pick".
      setSelectedPlayer('');
      setBackupPlayer('');
      setCurrentWeekPick({ golfer: '', backup: '' });
    }

    if (!opts.preservePick) setPicksLoading(false);
  };

  const getCurrentTournament = (tournamentsList) => {
    const list = tournamentsList || tournaments;
    const now = new Date();

    // Find the first tournament that hasn't fully concluded.
    // A tournament's "active window" ends on the Monday after the lock time.
    // Picks lock Thursday morning; the tournament runs Thu–Sun. We stay on
    // this tournament until the following Monday at 5 AM ET so results can
    // be reviewed before the UI advances to the next week.
    const activeTournament = list.find(t => {
      const anchor = t.picks_lock_time || t.tournament_date;
      if (anchor) {
        const anchorDate = new Date(anchor);
        // Find the next Monday after the anchor date
        const dayOfWeek = anchorDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 4=Thu
        const daysUntilMonday = (8 - dayOfWeek) % 7 || 7; // days from anchor to next Monday
        const windowEnd = new Date(anchorDate);
        windowEnd.setUTCDate(windowEnd.getUTCDate() + daysUntilMonday);
        windowEnd.setUTCHours(10, 0, 0, 0); // Monday 10:00 UTC = Monday 5 AM ET
        if (now > windowEnd) return false;
        return true;
      }
      return !t.completed;
    });

    return activeTournament || list[list.length - 1];
  };

  const currentTournamentMemo = useMemo(() => getCurrentTournament(), [tournaments]);
  const currentWeek = currentTournamentMemo?.week || 1;

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      showNotification('error', 'Email and password are required');
      return;
    }
    if (isSignup && !signupName.trim()) {
      showNotification('error', 'Name is required');
      return;
    }
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      if (isSignup) {
        // Supabase Auth signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: loginEmail.trim(),
          password: loginPassword,
        });

        if (authError) {
          showNotification('error', friendlyError(authError, 'Could not create your account. Please try again.'));
          return;
        }

        if (!authData.user) {
          showNotification('error', 'Signup failed. Please try again.');
          return;
        }

        // Create matching row in users table
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .insert([{ id: authData.user.id, email: loginEmail.trim(), name: signupName.trim() }])
          .select()
          .maybeSingle();

        if (userError) {
          showNotification('error', friendlyError(userError, 'Could not finish setting up your account. Please try again.'));
          return;
        }

        setCurrentUser(userData);
        setShowLogin(false);

        // New user — show league create/join
        setShowLeagueSelect(true);
      } else {
        // Supabase Auth login
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginEmail.trim(),
          password: loginPassword,
        });

        if (authError) {
          showNotification('error', 'Invalid email or password');
          return;
        }

        // Fetch user profile from users table
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

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
      showNotification('error', friendlyError(error, 'Could not sign in. Please try again.'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      showNotification('error', 'Please enter your email address first');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) {
        showNotification('error', friendlyError(error, 'Could not send the reset email. Please try again.'));
      } else {
        showNotification('success', 'Password reset email sent! Check your inbox.');
        setShowForgotPassword(false);
      }
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not send the reset email. Please try again.'));
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showNotification('error', 'Password must be at least 6 characters');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showNotification('error', friendlyError(error, 'Could not update your password. Please try again.'));
      } else {
        showNotification('success', 'Password updated successfully!');
        setShowResetPassword(false);
        setNewPassword('');
      }
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not update your password. Please try again.'));
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
          showNotification('error', friendlyError(authError, 'Could not update your email address.'));
          return;
        }
      }

      // Update name (and email) in users table
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName,
          email: editEmail
        })
        .eq('id', currentUser.id);

      if (error) {
        showNotification('error', friendlyError(error, 'Could not update your profile. Please try again.'));
        return;
      }

      setCurrentUser({ ...currentUser, name: editName, email: editEmail });
      showNotification('success', editEmail !== currentUser.email
        ? 'Profile updated! Check your new email to confirm the change.'
        : 'Profile updated successfully!');
      setShowAccountSettings(false);
      loadData();
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not update your profile. Please try again.'));
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
        showNotification('error', friendlyError(error, 'Could not update your password. Please try again.'));
        return;
      }

      showNotification('success', 'Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not update your password. Please try again.'));
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
    if (newGolferName.trim().length > 50) {
      showNotification('error', 'Golfer name must be 50 characters or less');
      return;
    }

    try {
      const { error } = await supabase
        .from('available_golfers')
        .insert([{ name: newGolferName.trim(), active: true }]);
      
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          showNotification('error', 'This golfer already exists in the list');
        } else {
          showNotification('error', friendlyError(error, 'Could not add the golfer. Please try again.'));
        }
        return;
      }
      
      showNotification('success', `Added ${newGolferName} to golfer list`);
      setNewGolferName('');
      setShowAddGolfer(false);
      loadData(); // Reload to update available golfers
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not add the golfer. Please try again.'));
    }
  };

  const handleUpdateLeagueSettings = async (newSettings) => {
    // Validate payout percentages don't exceed 100%
    const payoutTotal = (newSettings.payout_first_pct || 0) + (newSettings.payout_second_pct || 0) + (newSettings.payout_third_pct || 0);
    if (payoutTotal > 100) {
      showNotification('error', `Payout percentages total ${payoutTotal}% — must not exceed 100%`);
      return;
    }

    try {
      const { error } = await supabase
        .from('league_settings')
        .update({
          ...newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('league_id', currentLeague.id);

      if (error) {
        showNotification('error', friendlyError(error, 'Could not save settings. Please try again.'));
        return;
      }

      setLeagueSettings({ ...leagueSettings, ...newSettings });
      showNotification('success', 'Settings saved');
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not save settings. Please try again.'));
    }
  };

const handleSaveResults = async (playerId) => {
    try {
      const tournamentId = currentTournament.id;
      const playerData = resultsData[playerId] || {};
      const winnings = playerData.winnings || 0;
      const penaltyType = playerData.penalty || '';
      
      const player = players.find(p => p.id === playerId);
      const hasSubmittedPick = player?.currentPick?.golfer_name && player.currentPick.golfer_name !== 'No Pick';
      
      // If player didn't submit a pick, create a record with just penalties
      if (!hasSubmittedPick) {
        if (!penaltyType) {
          showNotification('error', 'Please select a penalty for players who did not submit a pick');
          return;
        }
        
        const { error: pickError } = await supabase
          .from('picks')
          .upsert({
            user_id: playerId,
            tournament_id: tournamentId,
            league_id: currentLeague.id,
            golfer_name: 'No Pick',
            backup_golfer_name: null,
            winnings: 0,
            penalty_amount: getPenaltyAmount(penaltyType),
            penalty_reason: penaltyType
          }, { onConflict: 'user_id,tournament_id,league_id' });

        if (pickError) {
          showNotification('error', friendlyError(pickError, 'Could not save the penalty. Please try again.'));
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
          }, { onConflict: 'user_id,tournament_id,league_id' });
        
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
        .eq('tournament_id', tournamentId)
        .eq('league_id', currentLeague.id);
      
      if (pickError) {
        showNotification('error', friendlyError(pickError, 'Could not save the results. Please try again.'));
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
          }, { onConflict: 'user_id,tournament_id,league_id' });
      }

      showNotification('success', 'Results saved');
      loadData(); // Reload to show updated standings
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not save the results. Please try again.'));
    }
  };

  const loadTournamentPicks = async (tournamentId) => {
    if (!tournamentId) {
      setEditTournamentPicks([]);
      setEditResultsData({});
      setEditTournamentWinner('');
      return;
    }

    const selected = tournaments.find(t => t.id === tournamentId);
    setEditTournamentWinner(selected?.winner_golfer_name || '');
    setLoadingEditPicks(true);
    try {
      // Get all picks for this tournament (scoped to league)
      const { data: picks, error } = await supabase
        .from('picks')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('league_id', currentLeague.id);

      if (error) throw error;

      // Get league members
      const { data: members } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', currentLeague.id);

      // Fetch user info for all member user IDs
      const memberUserIds = members?.map(m => m.user_id).filter(Boolean) || [];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', memberUserIds);

      const allUsers = (usersData || []).sort((a, b) => a.name.localeCompare(b.name));

      // Attach user info to picks
      const usersMap = {};
      allUsers.forEach(u => { usersMap[u.id] = u; });
      picks?.forEach(pick => {
        pick.users = usersMap[pick.user_id] || null;
      });

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
            golferName: (user.pick.golfer_name && user.pick.golfer_name !== 'No Pick') ? user.pick.golfer_name : '',
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

  const handleMarkTournamentComplete = async (tournamentId) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) {
      showNotification('error', 'Tournament not found');
      return;
    }

    const confirmed = window.confirm(
      `Mark "${tournament.name}" (Week ${tournament.week}) as complete?\n\n` +
      `Use this only when the automated results script didn't mark it complete. ` +
      `Make sure all picks have winnings/penalties entered first.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ completed: true })
        .eq('id', tournamentId);

      if (error) throw error;

      showNotification('success', `Tournament marked as complete`);
      loadData();
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not mark the tournament complete.'));
    }
  };

  const handleSaveTournamentWinner = async (tournamentId, name) => {
    const trimmed = (name || '').trim();
    setSavingTournamentWinner(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ winner_golfer_name: trimmed || null })
        .eq('id', tournamentId);
      if (error) throw error;
      showNotification('success', trimmed ? 'Winning golfer saved' : 'Winning golfer cleared');
      loadData();
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not save the winning golfer.'));
    } finally {
      setSavingTournamentWinner(false);
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
            golfer_name: 'No Pick',
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
          }, { onConflict: 'user_id,tournament_id,league_id' });
      } else {
        // Remove penalty if cleared
        await supabase
          .from('penalties')
          .delete()
          .eq('user_id', userId)
          .eq('tournament_id', editTournamentId)
          .eq('league_id', currentLeague.id);
      }

      showNotification('success', 'Results updated');
      loadTournamentPicks(editTournamentId); // Reload picks
      loadData(); // Reload standings
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not save the results. Please try again.'));
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

    if (submittingPick) return;
    setSubmittingPick(true);

    try {
      const { data, error } = await supabase
        .from('picks')
        .upsert({
          user_id: currentUser.id,
          tournament_id: currentTournament.id,
          league_id: currentLeague.id,
          golfer_name: selectedPlayer,
          golfer_id: fieldIdByName[normalizeName(selectedPlayer)] || golferIdByName[normalizeName(selectedPlayer)] || null,
          backup_golfer_name: leagueSettings.backup_picks_enabled ? (backupPlayer || null) : null,
          winnings: 0
        }, { onConflict: 'user_id,tournament_id,league_id' });

      if (error) {
        showNotification('error', friendlyError(error, 'Could not submit your pick. Please try again.'));
        return;
      }

      // Optimistically lock in the user's own pick right away. The card used to
      // depend entirely on the loadData() refetch below, which on a slow network
      // can be served stale from the service-worker cache (missing the row we
      // just wrote) — leaving the pick "unsaved" until a manual refresh.
      const backupForState = leagueSettings.backup_picks_enabled ? (backupPlayer || '') : '';
      setCurrentWeekPick({ golfer: selectedPlayer, backup: backupForState });
      setUserPicks(prev => (prev.includes(selectedPlayer) ? prev : [...prev, selectedPlayer]));

      showNotification('success', `Pick submitted: ${selectedPlayer}${leagueSettings.backup_picks_enabled && backupPlayer ? ` (Backup: ${backupPlayer})` : ''}`);
      // Reconcile standings/field/etc. in the background, but don't let a
      // possibly-stale read overwrite the pick we just confirmed.
      loadData({ preservePick: true });
    } catch (error) {
      showNotification('error', friendlyError(error, 'Could not submit your pick. Please try again.'));
    } finally {
      setSubmittingPick(false);
    }
  };


  const toggleRowExpansion = useCallback((playerId) => {
    setExpandedRows(prev => ({
      ...prev,
      [playerId]: !prev[playerId]
    }));
  }, []);

  const availableForPick = useMemo(() =>
    availableGolfers.filter(g =>
      !userPicks.includes(g) || g === selectedPlayer || g === backupPlayer
    ), [availableGolfers, userPicks, selectedPlayer, backupPlayer]);

  const filteredPrimaryGolfers = useMemo(() =>
    availableForPick
      .filter(g => g.toLowerCase().includes(primarySearchTerm.toLowerCase()))
      .slice(0, 50),
    [availableForPick, primarySearchTerm]);

  const filteredBackupGolfers = useMemo(() =>
    availableForPick
      .filter(g => g !== selectedPlayer)
      .filter(g => g.toLowerCase().includes(backupSearchTerm.toLowerCase()))
      .slice(0, 50),
    [availableForPick, backupSearchTerm, selectedPlayer]);

  const sortedStandings = useMemo(() =>
    [...players].sort((a, b) => b.winnings - a.winnings || a.name.localeCompare(b.name)),
    [players]);

  // Live leaderboard lookups (Phase 1)
  const liveIndex = useMemo(() => indexLiveLeaderboard(liveLeaderboard), [liveLeaderboard]);

  const liveMembers = useMemo(() =>
    sortedStandings
      .filter(p => p.currentPick?.golfer_name && p.currentPick.golfer_name !== 'No Pick')
      .map(p => ({
        id: p.id,
        name: p.name,
        golferName: p.currentPick.golfer_name,
        golferId: p.currentPick.golfer_id || null,
      })),
    [sortedStandings]);

  // Weekly field lookups (Phase 2). Empty until the field is synced mid-week.
  const fieldNames = useMemo(() =>
    new Set((tournamentField || []).map(f => normalizeName(f.golfer_name)).filter(Boolean)),
    [tournamentField]);

  const fieldIdByName = useMemo(() => {
    const m = {};
    (tournamentField || []).forEach(f => { if (f.golfer_id) m[normalizeName(f.golfer_name)] = f.golfer_id; });
    return m;
  }, [tournamentField]);

  const currentTournament = currentTournamentMemo;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="xl" />
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (showResetPassword) {
    return (
      <ResetPasswordScreen
        notification={notification}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        handleResetPassword={handleResetPassword}
      />
    );
  }

  if (showLogin) {
    return (
      <LoginScreen
        notification={notification}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        signupName={signupName}
        setSignupName={setSignupName}
        isSignup={isSignup}
        setIsSignup={setIsSignup}
        showForgotPassword={showForgotPassword}
        setShowForgotPassword={setShowForgotPassword}
        loginLoading={loginLoading}
        handleLogin={handleLogin}
        handleForgotPassword={handleForgotPassword}
      />
    );
  }

  // League selection/creation screen
  if (showLeagueSelect || !currentLeague) {
    return (
      <LeagueSelectScreen
        notification={notification}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentUser={currentUser}
        userLeagues={userLeagues}
        leagueAction={leagueAction}
        setLeagueAction={setLeagueAction}
        newLeagueName={newLeagueName}
        setNewLeagueName={setNewLeagueName}
        joinInviteCode={joinInviteCode}
        setJoinInviteCode={setJoinInviteCode}
        creatingLeague={creatingLeague}
        selectLeague={selectLeague}
        handleCreateLeague={handleCreateLeague}
        handleJoinLeague={handleJoinLeague}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Toast Notification */}
      <NotificationToast notification={notification} onDismiss={() => setNotification(null)} />
      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        {/* Header */}
        <div className="card p-4 sm:p-6 mb-4 sm:mb-5">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-600 dark:bg-emerald-500 rounded-lg shrink-0">
                  <Trophy className="text-white" size={18} />
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{currentLeague?.name || 'Golf One and Done'}</h1>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">Wk {currentWeek} · {currentTournament?.name}</span>
                <span className="badge bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  {formatPrizePool(currentTournament?.prize_pool)}
                </span>
                {timeUntilLock && (
                  <>
                    {timeUntilLock === 'Locked' ? (
                      <span className="badge bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                        Locked
                      </span>
                    ) : (
                      <span className={`badge border ${lockUrgent ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}>
                        {timeUntilLock}
                      </span>
                    )}
                    {lockTimeLabel && (
                      <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500">{lockTimeLabel}</span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <div className="text-right hidden sm:block mr-2">
                <p className="text-xs text-slate-400 dark:text-slate-500">Playing as</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{currentUser?.name}</p>
              </div>
                <div className="relative profile-menu">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors duration-150"
                    aria-haspopup="true"
                    aria-expanded={showProfileMenu}
                    aria-label="Menu"
                  >
                    <Menu size={18} />
                  </button>
                  {showProfileMenu && (
                    <>
                      {/* Backdrop - mobile */}
                      <div
                        className="sm:hidden fixed inset-0 bg-black/40 z-40 animate-modal-fade-in"
                        onClick={() => setShowProfileMenu(false)}
                      />
                      {/* Menu dropdown */}
                      <div className="fixed sm:absolute inset-x-4 sm:inset-x-auto top-auto sm:top-full bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-auto sm:right-0 sm:mt-2 w-auto sm:w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-xl shadow-modal sm:shadow-elevated z-50 overflow-hidden animate-scale-in">
                        <div className="p-1.5 sm:p-1">
                          <p className="sm:hidden px-3 pt-2 pb-1 text-xs font-medium text-slate-400 dark:text-slate-500">{currentUser?.name}</p>
                          {[
                            { icon: Users, label: 'Account', action: () => { openAccountSettings(); setShowProfileMenu(false); } },
                            { icon: Bell, label: 'Notifications', action: () => { setShowSettings(!showSettings); setShowProfileMenu(false); } },
                            { icon: ChevronRight, label: userLeagues.length > 1 ? 'Switch League' : 'Join / Create League', action: () => { setCurrentLeague(null); setShowLeagueSelect(true); setShowProfileMenu(false); } },
                          ].map(item => (
                            <button
                              key={item.label}
                              onClick={item.action}
                              className="w-full text-left px-3 py-2.5 sm:py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2.5 transition-colors duration-150"
                            >
                              <item.icon size={16} className="text-slate-400" />
                              {item.label}
                            </button>
                          ))}
                          <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                          <button
                            onClick={handleSignOut}
                            className="w-full text-left px-3 py-2.5 sm:py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg flex items-center gap-2.5 transition-colors duration-150"
                          >
                            <LogOut size={16} />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors duration-150 disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors duration-150"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>

          {/* Notification Settings Modal */}
          {showSettings && (
            <NotificationSettingsModal
              onClose={() => setShowSettings(false)}
              pushSupported={pushSupported}
              pushPermission={pushPermission}
              pushSubscribed={pushSubscribed}
              pushLoading={pushLoading}
              notifyResults={notifyResults}
              notifyReminders={notifyReminders}
              handlePushSubscribe={handlePushSubscribe}
              handlePushUnsubscribe={handlePushUnsubscribe}
              handleToggleNotifyPref={handleToggleNotifyPref}
            />
          )}

          {/* Account Settings Modal */}
          {showAccountSettings && (
            <AccountSettingsModal
              editName={editName}
              setEditName={setEditName}
              editEmail={editEmail}
              setEditEmail={setEditEmail}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              onClose={() => setShowAccountSettings(false)}
              handleUpdateProfile={handleUpdateProfile}
              handleChangePassword={handleChangePassword}
            />
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="card mb-4 sm:mb-5 overflow-hidden">
          <div className="flex p-1.5 gap-1 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
            {[
              { id: 'picks', icon: CheckCircle, label: 'Pick' },
              { id: 'standings', icon: TrendingUp, label: 'Standings' },
              { id: 'schedule', icon: Calendar, label: 'Schedule' },
              { id: 'admin', icon: Users, label: 'League' },
              ...(userRole === 'commissioner' ? [{ id: 'results', icon: Shield, label: 'Admin' }] : []),
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 sm:py-2.5 px-1 sm:px-4 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-lg transition-all duration-150 active:scale-95 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-soft'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-3 sm:p-5">
            {activeTab === 'picks' && (
              <PicksTab
                currentWeek={currentWeek}
                currentTournament={currentTournament}
                currentWeekPick={currentWeekPick}
                selectedPlayer={selectedPlayer}
                backupPlayer={backupPlayer}
                primarySearchTerm={primarySearchTerm}
                backupSearchTerm={backupSearchTerm}
                showPrimaryDropdown={showPrimaryDropdown}
                showBackupDropdown={showBackupDropdown}
                timeUntilLock={timeUntilLock}
                leagueSettings={leagueSettings}
                userPicks={userPicks}
                filteredPrimaryGolfers={filteredPrimaryGolfers}
                filteredBackupGolfers={filteredBackupGolfers}
                picksLoading={picksLoading}
                formatPrizePool={formatPrizePool}
                setSelectedPlayer={setSelectedPlayer}
                setBackupPlayer={setBackupPlayer}
                setPrimarySearchTerm={setPrimarySearchTerm}
                setBackupSearchTerm={setBackupSearchTerm}
                setShowPrimaryDropdown={setShowPrimaryDropdown}
                setShowBackupDropdown={setShowBackupDropdown}
                handleSubmitPick={handleSubmitPick}
                submittingPick={submittingPick}
                liveIndex={liveIndex}
                liveMembers={liveMembers}
                currentUserName={currentUser?.name}
                fieldNames={fieldNames}
                fieldLoaded={tournamentField.length > 0}
                fieldCount={tournamentField.length}
              />
            )}

            {activeTab === 'results' && (
              <CommissionerTab
                currentLeague={currentLeague}
                leagueSettings={leagueSettings}
                tournaments={tournaments}
                currentWeek={currentWeek}
                editTournamentId={editTournamentId}
                editTournamentPicks={editTournamentPicks}
                editResultsData={editResultsData}
                editTournamentWinner={editTournamentWinner}
                savingTournamentWinner={savingTournamentWinner}
                availableGolfers={availableGolfers}
                loadingEditPicks={loadingEditPicks}
                showLeagueSettings={showLeagueSettings}
                showNotification={showNotification}
                setEditTournamentId={setEditTournamentId}
                setEditResultsData={setEditResultsData}
                setEditTournamentWinner={setEditTournamentWinner}
                setShowLeagueSettings={setShowLeagueSettings}
                setLeagueSettings={setLeagueSettings}
                setEditTournamentPicks={setEditTournamentPicks}
                handleUpdateLeagueSettings={handleUpdateLeagueSettings}
                handleSaveEditResults={handleSaveEditResults}
                handleSaveTournamentWinner={handleSaveTournamentWinner}
                handleMarkTournamentComplete={handleMarkTournamentComplete}
                loadTournamentPicks={loadTournamentPicks}
                getPenaltyAmount={getPenaltyAmount}
              />
            )}

            {activeTab === 'standings' && (
              <StandingsTab
                sortedStandings={sortedStandings}
                currentUser={currentUser}
                currentWeek={currentWeek}
                currentTournament={currentTournament}
                leagueSettings={leagueSettings}
                expandedRows={expandedRows}
                toggleRowExpansion={toggleRowExpansion}
                liveIndex={liveIndex}
              />
            )}

            {activeTab === 'schedule' && (
              <ScheduleTab
                tournaments={tournaments}
                currentWeek={currentWeek}
                players={players}
                currentUser={currentUser}
                leagueSettings={leagueSettings}
                expandedScheduleTournament={expandedScheduleTournament}
                setExpandedScheduleTournament={setExpandedScheduleTournament}
                formatPrizePool={formatPrizePool}
              />
            )}

            {activeTab === 'admin' && (
              <LeagueInfoTab
                leagueSettings={leagueSettings}
                players={players}
                currentUser={currentUser}
                currentWeek={currentWeek}
                currentTournament={currentTournament}
                tournaments={tournaments}
                availableGolfers={availableGolfers}
                showAddGolfer={showAddGolfer}
                newGolferName={newGolferName}
                setShowAddGolfer={setShowAddGolfer}
                setNewGolferName={setNewGolferName}
                handleAddGolfer={handleAddGolfer}
              />
            )}          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
