-- Add buy-in and payout configuration columns to league_settings
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS buy_in_amount INTEGER DEFAULT 50;
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS payout_first_pct INTEGER DEFAULT 65;
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS payout_second_pct INTEGER DEFAULT 25;
ALTER TABLE league_settings ADD COLUMN IF NOT EXISTS payout_third_pct INTEGER DEFAULT 10;
