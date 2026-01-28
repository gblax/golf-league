-- Migration: Add push_subscriptions table for PWA push notifications
-- Run this in your Supabase SQL Editor

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own subscription
CREATE POLICY "Users can view own push subscription"
  ON push_subscriptions FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Users can insert their own subscription
CREATE POLICY "Users can insert own push subscription"
  ON push_subscriptions FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own subscription
CREATE POLICY "Users can update own push subscription"
  ON push_subscriptions FOR UPDATE
  USING (true);

-- Policy: Users can delete their own subscription
CREATE POLICY "Users can delete own push subscription"
  ON push_subscriptions FOR DELETE
  USING (true);

-- Comment on table
COMMENT ON TABLE push_subscriptions IS 'Stores Web Push API subscriptions for PWA notifications';
