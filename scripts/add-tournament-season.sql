-- Season scoping for tournaments, so the app and the pipeline can tell one
-- season's schedule from the next instead of treating "everything in the
-- table" as the current season.
--
-- Before this there was no season entity at all: standings, the
-- one-golfer-once rule and the pick screen read EVERY pick/tournament in the
-- league, so loading the 2027 schedule into the same database would have
-- mixed two seasons together (known-issues.md, "Season rollover is manual and
-- unspecified"). With `season` present the frontend scopes everything to one
-- season — the newest one is the active season, older ones browse as
-- read-only archives — and sync_schedule.py --create stamps new events.
--
-- Applied to the One And Done League project on 2026-09-07 as tracked
-- migration `add_tournament_season`. Idempotent; safe to re-run.

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS season integer;

-- Backfill from the first-round date. The PGA Tour's FedExCup season runs
-- January–August, so calendar year == season for every event we play.
UPDATE tournaments
SET season = EXTRACT(YEAR FROM tournament_date)::integer
WHERE season IS NULL;

-- Default new rows from their date so any insert path (the schedule sync,
-- the SQL editor, a future in-app form) gets a season without having to know
-- about the column. A column DEFAULT can't reference another column, hence
-- the trigger. Empty search_path per Supabase's function lint; the body only
-- touches NEW and built-ins.
CREATE OR REPLACE FUNCTION tournaments_default_season()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.season IS NULL AND NEW.tournament_date IS NOT NULL THEN
    NEW.season := EXTRACT(YEAR FROM NEW.tournament_date)::integer;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournaments_default_season ON tournaments;
CREATE TRIGGER tournaments_default_season
  BEFORE INSERT ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION tournaments_default_season();

-- Every row has a season now (backfill + trigger), so lock that in.
ALTER TABLE tournaments ALTER COLUMN season SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_season ON tournaments (season);

NOTIFY pgrst, 'reload schema';
