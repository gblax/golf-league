-- Tournament Field: the weekly entry list, used as a pick backstop (Phase 2).
-- Run this in the Supabase SQL Editor. Idempotent.
--
-- scripts/sync_field.py (service role) replaces these rows mid-week from Slash
-- Golf once tee times post. The pick screen reads them to tag golfers as in/out
-- of the field and to warn on off-field picks — advisory only, because the
-- field doesn't firm up until Tue/Wed. Shared across leagues (keyed by
-- tournament), readable by any authenticated user; written only by the backend.

CREATE TABLE IF NOT EXISTS tournament_field (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  golfer_id TEXT,
  golfer_name TEXT NOT NULL,
  status TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, golfer_name)
);

CREATE INDEX IF NOT EXISTS idx_tournament_field_tournament_id ON tournament_field(tournament_id);

ALTER TABLE tournament_field ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournament_field_select" ON tournament_field;
CREATE POLICY "tournament_field_select" ON tournament_field
  FOR SELECT USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
