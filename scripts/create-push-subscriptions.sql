-- Push Notifications: Create push_subscriptions table
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select" ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert" ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete" ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
