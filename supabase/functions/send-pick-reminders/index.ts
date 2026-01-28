/**
 * Supabase Edge Function: Send Pick Deadline Reminders
 *
 * This function checks for upcoming tournament deadlines and sends
 * push notifications to users who haven't made their picks yet.
 *
 * Schedule this to run daily via Supabase Cron (pg_cron) or external scheduler.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Web Push library for Deno
import webpush from 'https://esm.sh/web-push@3.6.6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get VAPID keys from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'mailto:admin@example.com'

    // Configure web-push with VAPID
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

    // Find tournaments locking in the next 24 hours
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const { data: upcomingTournaments, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, picks_lock_time')
      .gte('picks_lock_time', now.toISOString())
      .lte('picks_lock_time', tomorrow.toISOString())
      .eq('completed', false)

    if (tournamentError) throw tournamentError

    if (!upcomingTournaments || upcomingTournaments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No upcoming deadlines', notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let notificationsSent = 0

    for (const tournament of upcomingTournaments) {
      // Get all users with push subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh_key, auth_key')

      if (subError) throw subError

      // Get users who already made picks for this tournament
      const { data: existingPicks, error: picksError } = await supabase
        .from('picks')
        .select('user_id')
        .eq('tournament_id', tournament.id)

      if (picksError) throw picksError

      const usersWithPicks = new Set(existingPicks?.map(p => p.user_id) || [])

      // Send notifications to users without picks
      for (const sub of subscriptions || []) {
        if (usersWithPicks.has(sub.user_id)) continue

        const lockTime = new Date(tournament.picks_lock_time)
        const hoursUntilLock = Math.round((lockTime.getTime() - now.getTime()) / (1000 * 60 * 60))

        const payload = JSON.stringify({
          title: 'Pick Deadline Reminder',
          body: `${tournament.name} picks lock in ${hoursUntilLock} hours! Don't forget to make your pick.`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `pick-reminder-${tournament.id}`,
          url: '/?tab=picks',
          requireInteraction: true
        })

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        }

        try {
          await webpush.sendNotification(pushSubscription, payload)
          notificationsSent++
        } catch (pushError: any) {
          console.error(`Failed to send to user ${sub.user_id}:`, pushError.message)

          // If subscription is expired/invalid, remove it
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', sub.user_id)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Pick reminders sent',
        notificationsSent,
        tournamentsChecked: upcomingTournaments.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending pick reminders:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
