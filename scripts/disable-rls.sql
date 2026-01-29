-- Quick fix: Disable RLS on all tables
-- Run this in the Supabase SQL Editor if you're getting
-- 500 "Database error querying schema" errors.
--
-- This removes RLS entirely so the anon key can access all data.
-- For a production app, use enable-rls-policies.sql instead.

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE available_golfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE picks DISABLE ROW LEVEL SECURITY;
ALTER TABLE penalties DISABLE ROW LEVEL SECURITY;
