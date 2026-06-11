-- Per-tournament venue timezone (IANA name), so a tee-time-derived pick
-- deadline can be computed correctly for overseas/non-Eastern events
-- (e.g. The Open at Royal Birkdale is UTC+1; a bare "6:35am" tee time means
-- nothing without knowing the course's timezone).
--
-- Applied to the One And Done League project on 2026-06-11 (migration
-- `add_tee_timezone`), kept here as the record per scripts/*.sql convention.
-- Data-only change: nothing in the app or scripts reads this column yet.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS tee_timezone text NOT NULL DEFAULT 'America/New_York';

-- Explicit per-event values, matched on week + exact name so a mismatch
-- harmlessly leaves the America/New_York default in place.
-- Venue notes: America/Phoenix (no DST in Arizona); Europe/London for the two
-- UK events; America/Toronto for the Canadian Open.
UPDATE tournaments t
SET tee_timezone = v.tz
FROM (VALUES
  (1,  'Sony Open',                      'Pacific/Honolulu'),
  (2,  'The American Express',           'America/Los_Angeles'),
  (3,  'Farmers Insurance Open',         'America/Los_Angeles'),
  (4,  'WM Phoenix Open',                'America/Phoenix'),
  (5,  'AT&T Pebble Beach Pro-Am',       'America/Los_Angeles'),
  (6,  'The Genesis Invitational',       'America/Los_Angeles'),
  (7,  'Cognizant Classic',              'America/New_York'),
  (8,  'Arnold Palmer Invitational',     'America/New_York'),
  (9,  'THE PLAYERS Championship',       'America/New_York'),
  (10, 'Valspar Championship',           'America/New_York'),
  (11, 'Texas Children''s Houston Open', 'America/Chicago'),
  (12, 'Valero Texas Open',              'America/Chicago'),
  (13, 'Masters Tournament',             'America/New_York'),
  (14, 'RBC Heritage',                   'America/New_York'),
  (15, 'Zurich Classic of New Orleans',  'America/Chicago'),
  (16, 'Cadillac Championship',          'America/New_York'),
  (17, 'Truist Championship',            'America/New_York'),
  (18, 'PGA Championship',               'America/New_York'),
  (19, 'CJ Cup Byron Nelson',            'America/Chicago'),
  (20, 'Charles Schwab Challenge',       'America/Chicago'),
  (21, 'The Memorial Tournament',        'America/New_York'),
  (22, 'RBC Canadian Open',              'America/Toronto'),
  (23, 'US Open',                        'America/New_York'),
  (24, 'Travelers Championship',         'America/New_York'),
  (25, 'John Deere Classic',             'America/Chicago'),
  (26, 'Genesis Scottish Open',          'Europe/London'),
  (27, 'The Open Championship',          'Europe/London'),
  (28, '3M Open',                        'America/Chicago'),
  (29, 'Rocket Classic',                 'America/New_York'),
  (30, 'Wyndham Championship',           'America/New_York'),
  (31, 'FedEx St. Jude Championship',    'America/Chicago'),
  (32, 'BMW Championship',               'America/Chicago')
) AS v(week, name, tz)
WHERE t.week = v.week AND t.name = v.name;

-- Backfill the one tournament missing venue info.
UPDATE tournaments
SET course = 'Detroit Golf Club', location = 'Detroit, MI'
WHERE week = 29 AND name = 'Rocket Classic' AND course IS NULL AND location IS NULL;
