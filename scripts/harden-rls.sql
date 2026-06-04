-- Security hardening: lock down writes to the shared tournament/golfer tables.
--
-- Run in the Supabase SQL editor. Idempotent. Safe to run after
-- enable-rls-policies.sql and share-tournaments-golfers.sql.
--
-- THE GAP THIS CLOSES
-- share-tournaments-golfers.sql opened tournaments and available_golfers to
-- "any authenticated user can INSERT/UPDATE/DELETE" (WITH CHECK auth.uid() IS
-- NOT NULL) so that shared rows (league_id NULL) were writable. That let any
-- logged-in member corrupt the schedule or golfer list. This restricts those
-- writes to commissioners, while keeping the rows readable to authenticated
-- users. The service-role key used by the backend scripts bypasses RLS, so the
-- Monday scorer and sync_schedule.py are unaffected.

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_golfers ENABLE ROW LEVEL SECURITY;

-- Drop every prior policy on these tables under both naming conventions
-- (enable-rls-policies.sql used descriptive names; share-tournaments-golfers.sql
-- used <table>_<verb>) so we end up with exactly one policy per action.
DROP POLICY IF EXISTS "Members can read tournaments" ON tournaments;
DROP POLICY IF EXISTS "Commissioners can insert tournaments" ON tournaments;
DROP POLICY IF EXISTS "Commissioners can update tournaments" ON tournaments;
DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update" ON tournaments;
DROP POLICY IF EXISTS "tournaments_delete" ON tournaments;

DROP POLICY IF EXISTS "Members can read available golfers" ON available_golfers;
DROP POLICY IF EXISTS "Commissioners can insert available golfers" ON available_golfers;
DROP POLICY IF EXISTS "Commissioners can update available golfers" ON available_golfers;
DROP POLICY IF EXISTS "Commissioners can delete available golfers" ON available_golfers;
DROP POLICY IF EXISTS "available_golfers_select" ON available_golfers;
DROP POLICY IF EXISTS "available_golfers_insert" ON available_golfers;
DROP POLICY IF EXISTS "available_golfers_update" ON available_golfers;
DROP POLICY IF EXISTS "available_golfers_delete" ON available_golfers;

-- A user may write a shared row (league_id NULL) if they are a commissioner of
-- ANY league; a league-scoped row only if they commission THAT league. Shared
-- is the norm in this app, but both cases are handled so the policy is correct
-- either way.
-- tournaments ---------------------------------------------------------------
CREATE POLICY "tournaments_select" ON tournaments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tournaments_write_commissioner" ON tournaments
  FOR ALL
  USING (
    (league_id IS NULL AND EXISTS (
      SELECT 1 FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner'))
    OR league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner')
  )
  WITH CHECK (
    (league_id IS NULL AND EXISTS (
      SELECT 1 FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner'))
    OR league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner')
  );

-- available_golfers ---------------------------------------------------------
CREATE POLICY "available_golfers_select" ON available_golfers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "available_golfers_write_commissioner" ON available_golfers
  FOR ALL
  USING (
    (league_id IS NULL AND EXISTS (
      SELECT 1 FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner'))
    OR league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner')
  )
  WITH CHECK (
    (league_id IS NULL AND EXISTS (
      SELECT 1 FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner'))
    OR league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid() AND role = 'commissioner')
  );

NOTIFY pgrst, 'reload schema';
