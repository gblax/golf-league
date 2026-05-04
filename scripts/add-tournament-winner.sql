-- Record the actual real-world winner of each tournament (the PGA golfer who won),
-- independent of which golfer any league member picked.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS winner_golfer_name TEXT;
