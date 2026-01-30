-- Multi-League Migration
-- This migration adds support for multiple leagues.
--
-- Steps:
-- 1. Create leagues and league_members tables
-- 2. Add league_id to all existing tables
-- 3. Create a default league and backfill existing data
-- 4. Add foreign key constraints and indexes
-- 5. Remove is_admin from users (replaced by league_members.role)

-- 1. Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create league_members table
CREATE TABLE IF NOT EXISTS league_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('commissioner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

-- 3. Add league_id to existing tables
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE picks ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE available_golfers ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;
ALTER TABLE penalties ADD COLUMN IF NOT EXISTS league_id UUID REFERENCES leagues(id) ON DELETE CASCADE;

-- 4. Create a default league and backfill existing data
-- Run this in a transaction to ensure consistency
DO $$
DECLARE
  default_league_id UUID;
  admin_user_id UUID;
BEGIN
  -- Find the existing admin user
    SELECT id INTO admin_user_id FROM profiles WHERE is_admin = true LIMIT 1;

  -- Create the default league
  INSERT INTO leagues (name, invite_code, created_by)
  VALUES ('Golf One and Done', substr(md5(random()::text), 1, 8), admin_user_id)
  RETURNING id INTO default_league_id;

  -- Add all existing users as league members
  INSERT INTO league_members (league_id, user_id, role)
  SELECT
    default_league_id,
    id,
    CASE WHEN is_admin = true THEN 'commissioner' ELSE 'member' END
  FROM profiles;

  -- Backfill league_id on all existing rows
  UPDATE tournaments SET league_id = default_league_id WHERE league_id IS NULL;
  UPDATE picks SET league_id = default_league_id WHERE league_id IS NULL;
  UPDATE league_settings SET league_id = default_league_id WHERE league_id IS NULL;
  UPDATE available_golfers SET league_id = default_league_id WHERE league_id IS NULL;
  UPDATE penalties SET league_id = default_league_id WHERE league_id IS NULL;
END $$;

-- 5. Make league_id NOT NULL now that all rows are backfilled
ALTER TABLE tournaments ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE picks ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE league_settings ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE available_golfers ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE penalties ALTER COLUMN league_id SET NOT NULL;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_league_id ON tournaments(league_id);
CREATE INDEX IF NOT EXISTS idx_picks_league_id ON picks(league_id);
CREATE INDEX IF NOT EXISTS idx_league_settings_league_id ON league_settings(league_id);
CREATE INDEX IF NOT EXISTS idx_available_golfers_league_id ON available_golfers(league_id);
CREATE INDEX IF NOT EXISTS idx_penalties_league_id ON penalties(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON league_members(user_id);

-- 7. Add unique constraint on league_settings per league (one settings row per league)
-- (only if there isn't already a constraint)
ALTER TABLE league_settings ADD CONSTRAINT league_settings_league_id_unique UNIQUE (league_id);

-- 8. Update picks unique constraint to include league_id
-- Drop old constraint and create new one
-- Note: Adjust the constraint name if yours differs
-- ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_user_id_tournament_id_key;
-- ALTER TABLE picks ADD CONSTRAINT picks_user_id_tournament_id_league_id_key UNIQUE (user_id, tournament_id, league_id);

-- 9. Optionally remove is_admin column (can be done later once app is fully migrated)
-- ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
