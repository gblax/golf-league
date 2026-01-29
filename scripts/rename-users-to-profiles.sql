-- Rename public.users to public.profiles
-- This fixes the PostgREST 500 "Database error querying schema" caused by
-- the naming conflict between public.users and auth.users.
--
-- Run this in the Supabase SQL Editor.

-- 1. Drop existing RLS policies on the users table
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON users', r.policyname);
  END LOOP;
END $$;

-- 2. Rename the table
ALTER TABLE users RENAME TO profiles;

-- 3. Re-create RLS policies on the renamed table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
