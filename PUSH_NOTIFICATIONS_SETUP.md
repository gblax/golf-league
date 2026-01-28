# Push Notifications Setup Guide

This guide walks you through setting up PWA push notifications for pick deadline reminders.

## Cost: $0

All components are free:
- **Web Push API**: Free (provided by browsers)
- **VAPID Keys**: Free (self-generated)
- **Supabase Edge Functions**: 500,000 free invocations/month
- **Database Storage**: Minimal (~1KB per user)

---

## Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for web push. Generate them once:

```bash
# Install web-push CLI globally
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

This outputs:
```
Public Key: BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Save both keys!** You'll need them in the next steps.

---

## Step 2: Add Environment Variables

### Local Development (.env)

Add to your `.env` file:

```env
# Existing Supabase variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Add this new variable (use YOUR public key from Step 1)
VITE_VAPID_PUBLIC_KEY=BLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Supabase Secrets (for Edge Function)

In Supabase Dashboard → Settings → Edge Functions → Secrets, add:

| Name | Value |
|------|-------|
| `VAPID_PUBLIC_KEY` | Your public key from Step 1 |
| `VAPID_PRIVATE_KEY` | Your private key from Step 1 |
| `VAPID_EMAIL` | `mailto:your@email.com` |

---

## Step 3: Run Database Migration

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Copy contents from: supabase/migrations/20260128000000_add_push_subscriptions.sql
```

Or if using Supabase CLI:

```bash
supabase db push
```

---

## Step 4: Deploy Edge Function

### Option A: Supabase CLI (Recommended)

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy send-pick-reminders
```

### Option B: Dashboard Upload

1. Go to Supabase Dashboard → Edge Functions
2. Click "New Function"
3. Name it `send-pick-reminders`
4. Copy the code from `supabase/functions/send-pick-reminders/index.ts`

---

## Step 5: Schedule Daily Reminders

Use Supabase's pg_cron extension to schedule the function:

```sql
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule to run daily at noon UTC
SELECT cron.schedule(
  'send-pick-reminders',
  '0 12 * * *',  -- Every day at 12:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/send-pick-reminders',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

**Alternative**: Use an external cron service (cron-job.org, GitHub Actions) to call the Edge Function URL daily.

---

## Step 6: Rebuild and Deploy App

```bash
# Rebuild with new service worker
npm run build

# Deploy to your hosting (Vercel, Netlify, etc.)
```

---

## How It Works

1. **User enables notifications** in Account Settings
2. Browser prompts for permission
3. Subscription saved to `push_subscriptions` table
4. **Daily at noon**, Edge Function runs:
   - Finds tournaments locking in next 24 hours
   - Gets users without picks for those tournaments
   - Sends push notifications to remind them
5. User receives notification even if app is closed
6. Clicking notification opens the app to Picks tab

---

## Testing

### Test Client-Side (Local Notification)

After enabling notifications, the app sends a test notification immediately. You should see:
> "Notifications are working! You'll be reminded before pick deadlines."

### Test Edge Function

```bash
# Call function directly
curl -X POST https://your-project.supabase.co/functions/v1/send-pick-reminders \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## Troubleshooting

### "Push notifications not supported"
- Ensure you're using HTTPS (required for service workers)
- Check browser compatibility: Chrome, Firefox, Safari 16+, Edge

### Notifications not appearing
- Check browser notification settings (system-level)
- Verify VAPID public key matches in `.env` and Supabase secrets
- Check browser console for errors

### Edge Function errors
- Verify all secrets are set in Supabase Dashboard
- Check Edge Function logs in Supabase Dashboard

### Subscription not saving
- Run the database migration (Step 3)
- Check RLS policies allow inserts

---

## Files Added

```
src/pushNotifications.js          # Client-side subscription management
public/sw-push.js                 # Service worker push handlers
vite.config.js                    # Updated to include custom SW
supabase/
  migrations/
    20260128000000_add_push_subscriptions.sql
  functions/
    send-pick-reminders/
      index.ts                    # Edge Function to send notifications
```
