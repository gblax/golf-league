-- Live Leaderboard: one in-event snapshot per tournament.
-- Run this in the Supabase SQL Editor. Idempotent.
--
-- scripts/update_leaderboard.py (service role) writes a single row per
-- tournament holding the latest parsed /leaderboard. The web app reads it so
-- live scores never require the browser to hold the RapidAPI key. Tournaments
-- are shared across leagues, so this snapshot is readable by any authenticated
-- user (same model as the tournaments table); only the backend (service role,
-- which bypasses RLS) writes it.

CREATE TABLE IF NOT EXISTS live_leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  cut_line TEXT,
  event_status TEXT,
  round_status TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_live_leaderboard_tournament_id ON live_leaderboard(tournament_id);

ALTER TABLE live_leaderboard ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user; no write policy, so writes are limited to
-- the service-role backend job (which bypasses RLS).
DROP POLICY IF EXISTS "live_leaderboard_select" ON live_leaderboard;
CREATE POLICY "live_leaderboard_select" ON live_leaderboard
  FOR SELECT USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
