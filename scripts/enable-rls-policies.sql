-- Enable RLS and add policies for all tables
-- Run this in the Supabase SQL Editor with a service_role connection.
--
-- These policies allow authenticated users to access their own data
-- through the anon/public API key. Without these policies, RLS blocks
-- all queries and Supabase returns 500 "Database error querying schema".

-- ============================================================
-- PROFILES (formerly "users", renamed to avoid auth.users conflict)
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- LEAGUES
-- ============================================================
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

-- Members can read leagues they belong to
CREATE POLICY "Members can read their leagues"
  ON leagues FOR SELECT
  USING (
    id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- Any authenticated user can create a league
CREATE POLICY "Authenticated users can create leagues"
  ON leagues FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Commissioners can update their league
CREATE POLICY "Commissioners can update their league"
  ON leagues FOR UPDATE
  USING (
    id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- ============================================================
-- LEAGUE_MEMBERS
-- ============================================================
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- Members can see other members in their leagues
CREATE POLICY "Members can read league members"
  ON league_members FOR SELECT
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- Users can join a league (insert themselves)
CREATE POLICY "Users can join leagues"
  ON league_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Commissioners can update members in their league
CREATE POLICY "Commissioners can update league members"
  ON league_members FOR UPDATE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- Commissioners can remove members from their league
CREATE POLICY "Commissioners can delete league members"
  ON league_members FOR DELETE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- ============================================================
-- LEAGUE_SETTINGS
-- ============================================================
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read league settings"
  ON league_settings FOR SELECT
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Commissioners can insert league settings"
  ON league_settings FOR INSERT
  WITH CHECK (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

CREATE POLICY "Commissioners can update league settings"
  ON league_settings FOR UPDATE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- ============================================================
-- TOURNAMENTS
-- ============================================================
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read tournaments"
  ON tournaments FOR SELECT
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Commissioners can insert tournaments"
  ON tournaments FOR INSERT
  WITH CHECK (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

CREATE POLICY "Commissioners can update tournaments"
  ON tournaments FOR UPDATE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- ============================================================
-- AVAILABLE_GOLFERS
-- ============================================================
ALTER TABLE available_golfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read available golfers"
  ON available_golfers FOR SELECT
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Commissioners can insert available golfers"
  ON available_golfers FOR INSERT
  WITH CHECK (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

CREATE POLICY "Commissioners can update available golfers"
  ON available_golfers FOR UPDATE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

CREATE POLICY "Commissioners can delete available golfers"
  ON available_golfers FOR DELETE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- ============================================================
-- PICKS
-- ============================================================
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

-- Members can see all picks in their league (needed for standings/leaderboard)
CREATE POLICY "Members can read league picks"
  ON picks FOR SELECT
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- Users can insert their own picks
CREATE POLICY "Users can insert own picks"
  ON picks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- Users can update their own picks
CREATE POLICY "Users can update own picks"
  ON picks FOR UPDATE
  USING (auth.uid() = user_id);

-- Commissioners can update any pick in their league (for results/penalties)
CREATE POLICY "Commissioners can update league picks"
  ON picks FOR UPDATE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- Commissioners can insert picks for any member (penalties)
CREATE POLICY "Commissioners can insert league picks"
  ON picks FOR INSERT
  WITH CHECK (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

-- ============================================================
-- PENALTIES
-- ============================================================
ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read league penalties"
  ON penalties FOR SELECT
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Commissioners can insert penalties"
  ON penalties FOR INSERT
  WITH CHECK (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

CREATE POLICY "Commissioners can update penalties"
  ON penalties FOR UPDATE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );

CREATE POLICY "Commissioners can delete penalties"
  ON penalties FOR DELETE
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role = 'commissioner'
    )
  );
