-- Make tournaments and available_golfers shared across all leagues
-- Run this in the Supabase SQL Editor.
--
-- These tables no longer need league_id scoping since their data
-- is shared across all leagues. Picks, penalties, and settings
-- remain league-scoped.

-- Make league_id nullable on shared tables
ALTER TABLE tournaments ALTER COLUMN league_id DROP NOT NULL;
ALTER TABLE available_golfers ALTER COLUMN league_id DROP NOT NULL;

-- Update RLS policies to allow all authenticated users to read these
DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update" ON tournaments;
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "available_golfers_select" ON available_golfers;
DROP POLICY IF EXISTS "available_golfers_insert" ON available_golfers;
DROP POLICY IF EXISTS "available_golfers_update" ON available_golfers;
DROP POLICY IF EXISTS "available_golfers_delete" ON available_golfers;
CREATE POLICY "available_golfers_select" ON available_golfers FOR SELECT USING (true);
CREATE POLICY "available_golfers_insert" ON available_golfers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "available_golfers_update" ON available_golfers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "available_golfers_delete" ON available_golfers FOR DELETE USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
