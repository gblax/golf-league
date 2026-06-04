-- DEVELOPMENT ONLY -- DO NOT RUN IN PRODUCTION.
--
-- Disables RLS on all tables so the anon key can read/write everything. This
-- removes ALL access control; anyone with the public anon key can read every
-- user's data. Use only against a throwaway/dev database when debugging a
-- 500 "Database error querying schema". For any real deployment use
-- enable-rls-policies.sql + harden-rls.sql instead.

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE available_golfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE picks DISABLE ROW LEVEL SECURITY;
ALTER TABLE penalties DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
