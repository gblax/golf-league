-- Slash Golf integration: stable IDs for exact-join scoring.
--
-- Run in the Supabase SQL editor. Idempotent.
--
-- These columns let the scoring pipeline match a pick to a leaderboard entry
-- by Slash Golf playerId instead of fuzzy name matching, and map a tournament
-- onto its Slash Golf event without a name lookup at score time.

-- The Slash Golf tournId for a tournament (e.g. "021"). Populated by
-- scripts/sync_schedule.py; if absent, update_results.py falls back to a
-- one-time /schedule name match.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS slashgolf_tourn_id TEXT;

-- The Slash Golf playerId a pick refers to. Written by the app when a pick is
-- submitted (selected from available_golfers). Nullable for legacy picks,
-- which fall back to a deterministic normalized-name match.
ALTER TABLE picks ADD COLUMN IF NOT EXISTS golfer_id TEXT;

-- The Slash Golf playerId for a selectable golfer, so the pick UI can store an
-- ID alongside the display name. Populated by scripts/sync_golfers.py.
ALTER TABLE available_golfers ADD COLUMN IF NOT EXISTS golfer_id TEXT;

-- Speed up the by-id lookups the scorer and pick flow do.
CREATE INDEX IF NOT EXISTS idx_picks_golfer_id ON picks(golfer_id);
CREATE INDEX IF NOT EXISTS idx_available_golfers_golfer_id ON available_golfers(golfer_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_slashgolf_tourn_id ON tournaments(slashgolf_tourn_id);
