import { useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function useLeagueData({ currentUser, currentLeague, getCurrentTournament }) {
  const [players, setPlayers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [availableGolfers, setAvailableGolfers] = useState([]);
  const [userPicks, setUserPicks] = useState([]);
  const [currentWeekPick, setCurrentWeekPick] = useState({ golfer: '', backup: '' });
  const [picksLoading, setPicksLoading] = useState(true);
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

  const loadUserDataWithTournaments = useCallback(async (tournamentsData) => {
    if (!currentUser || !currentLeague) return;

    setPicksLoading(true);

    const { data: picksData } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('league_id', currentLeague.id);

    const allUserPicks = (picksData?.map(p => p.golfer_name) || []).filter(n => n && n !== 'No Pick');
    setUserPicks(allUserPicks);

    const currentTournament = getCurrentTournament(tournamentsData);
    const currentPick = picksData?.find(p => p.tournament_id === currentTournament?.id);

    if (currentPick) {
      const primary = (currentPick.golfer_name && currentPick.golfer_name !== 'No Pick') ? currentPick.golfer_name : '';
      const backup = currentPick.backup_golfer_name || '';
      setCurrentWeekPick({ golfer: primary, backup: backup });
    } else {
      setCurrentWeekPick({ golfer: '', backup: '' });
    }

    setPicksLoading(false);
  }, [currentUser, currentLeague, getCurrentTournament]);

  const loadData = useCallback(async () => {
    if (!currentLeague) return;
    const leagueId = currentLeague.id;

    try {
      const { data: settingsData } = await supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setLeagueSettings(settingsData);
      }

      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .order('week');

      setTournaments(tournamentsData || []);

      const { data: golfersData } = await supabase
        .from('available_golfers')
        .select('*')
        .eq('active', true);

      setAvailableGolfers(golfersData?.map(g => g.name) || []);

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
          picks:picks(golfer_name, winnings, penalty_amount, penalty_reason, tournament_id, backup_golfer_name, league_id)
        `)
        .in('id', memberIds.length > 0 ? memberIds : ['none']);

      const playersWithWinnings = (usersData || []).map(user => {
        const leaguePicks = user.picks?.filter(p => p.league_id === leagueId) || [];
        const picksByWeek = (tournamentsData || []).map(tournament => {
          const pick = leaguePicks.find(p => p.tournament_id === tournament.id);
          const lockTime = tournament.picks_lock_time ? new Date(tournament.picks_lock_time) : null;
          const isPast = lockTime ? new Date() >= lockTime : tournament.completed;
          return {
            week: tournament.week,
            tournamentName: tournament.name,
            golfer: (pick?.golfer_name && pick.golfer_name !== 'No Pick') ? pick.golfer_name : null,
            backup: pick?.backup_golfer_name || null,
            winnings: pick?.winnings || 0,
            penalty: pick?.penalty_amount || 0,
            penaltyReason: pick?.penalty_reason || null,
            isPast
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
      await loadUserDataWithTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [currentLeague, getCurrentTournament, loadUserDataWithTournaments]);

  return {
    players,
    setPlayers,
    tournaments,
    setTournaments,
    availableGolfers,
    userPicks,
    setUserPicks,
    currentWeekPick,
    setCurrentWeekPick,
    picksLoading,
    leagueSettings,
    setLeagueSettings,
    loadData,
    supabase,
  };
}

// Export supabase for use in App.jsx
export { supabase };
