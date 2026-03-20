import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function useLeague({ currentUser, showNotification }) {
  const [currentLeague, setCurrentLeague] = useState(null);
  const [userLeagues, setUserLeagues] = useState([]);
  const [userRole, setUserRole] = useState('member');
  const [showLeagueSelect, setShowLeagueSelect] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [leagueAction, setLeagueAction] = useState('select');
  const [creatingLeague, setCreatingLeague] = useState(false);

  const loadUserLeagues = useCallback(async (userId) => {
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
  }, []);

  const selectLeague = useCallback((league) => {
    setCurrentLeague(league);
    setUserRole(league.role);
    setShowLeagueSelect(false);
    localStorage.setItem('currentLeagueId', league.id);
  }, []);

  const handleCreateLeague = useCallback(async () => {
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
        showNotification('error', 'Error creating league: ' + error.message);
        return;
      }

      await supabase
        .from('league_members')
        .insert([{ league_id: league.id, user_id: currentUser.id, role: 'commissioner' }]);

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
      showNotification('error', error.message);
    } finally {
      setCreatingLeague(false);
    }
  }, [newLeagueName, creatingLeague, currentUser, showNotification, loadUserLeagues, selectLeague]);

  const handleJoinLeague = useCallback(async () => {
    if (!joinInviteCode.trim()) {
      showNotification('error', 'Please enter an invite code');
      return;
    }

    try {
      const { data: league, error: findError } = await supabase
        .from('leagues')
        .select('*')
        .eq('invite_code', joinInviteCode.trim())
        .single();

      if (findError || !league) {
        showNotification('error', 'Invalid invite code. Please check and try again.');
        return;
      }

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
  }, [joinInviteCode, currentUser, showNotification, loadUserLeagues, selectLeague]);

  return {
    currentLeague,
    setCurrentLeague,
    userLeagues,
    setUserLeagues,
    userRole,
    showLeagueSelect,
    setShowLeagueSelect,
    newLeagueName,
    setNewLeagueName,
    joinInviteCode,
    setJoinInviteCode,
    leagueAction,
    setLeagueAction,
    creatingLeague,
    loadUserLeagues,
    selectLeague,
    handleCreateLeague,
    handleJoinLeague,
  };
}
