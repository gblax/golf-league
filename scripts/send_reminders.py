#!/usr/bin/env python3
"""Send pick deadline reminders to users who haven't submitted picks."""

import os
import json
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client
from pywebpush import webpush, WebPushException

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")

# Don't fire a reminder earlier than this many hours before a tournament's
# pick deadline. The cron runs ~6h before the Thursday lock, so a generous
# window catches the intended week while excluding NEXT week's lock (~7 days
# out). It also means a delayed/late cron run that fires AFTER the lock won't
# jump ahead and prematurely nudge for the following week — it simply finds
# no in-window tournament and sends nothing.
REMINDER_LOOKAHEAD_HOURS = 96

_supabase = None


def get_client():
    """Lazily create the Supabase client so this module can be imported
    (e.g. by tests) without the service credentials being set."""
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and a service key must be set")
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


def _parse_lock_time(raw):
    """Parse a picks_lock_time value into an aware UTC datetime, or None."""
    if not raw:
        return None
    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def select_reminder_tournament(tournaments, now=None):
    """Choose the tournament a pick reminder should target.

    Picks the soonest tournament whose pick deadline (picks_lock_time) is
    still in the FUTURE and within REMINDER_LOOKAHEAD_HOURS. A reminder is a
    last nudge before picks lock, so a tournament that has already locked
    must never be selected — otherwise we tell people to submit a pick for a
    week that's closed (and often already played).

    This is the fix for the "reminded after it locked" bug. The old logic
    took the earliest `completed=False` row and ignored picks_lock_time, so:
      * a past, locked week that wasn't marked complete (e.g. the Monday
        results run refused to write because ESPN wasn't final) lingered as
        the "upcoming" tournament and got reminded the following Wednesday;
      * a late cron run that fired after the lock still reminded for the
        now-locked week.
    Matching the frontend, which hard-locks submission at now >= lock time,
    a tournament is only a valid reminder target while now < lock time.

    Rows missing a picks_lock_time fall back to earliest incomplete by week
    so a misconfigured season still gets a best-effort reminder.
    """
    now = now or datetime.now(timezone.utc)
    horizon = now + timedelta(hours=REMINDER_LOOKAHEAD_HOURS)

    upcoming = []
    no_lock_incomplete = []
    for t in tournaments:
        lock = _parse_lock_time(t.get("picks_lock_time"))
        if lock is None:
            if not t.get("completed"):
                no_lock_incomplete.append(t)
            continue
        # Still open (now < lock) and imminent (lock <= horizon).
        if now < lock <= horizon:
            upcoming.append((lock, t))

    if upcoming:
        upcoming.sort(key=lambda x: x[0])
        return upcoming[0][1]

    no_lock_incomplete.sort(key=lambda t: t.get("week", 0))
    return no_lock_incomplete[0] if no_lock_incomplete else None


def get_upcoming_tournament():
    """Find the tournament an upcoming-pick reminder should target."""
    supabase = get_client()
    response = supabase.table("tournaments").select("*").execute()
    return select_reminder_tournament(response.data or [])


def get_users_without_picks(tournament_id):
    """Get user IDs of league members who haven't submitted picks for this tournament."""
    supabase = get_client()
    # Get all picks for this tournament
    picks_response = supabase.table("picks").select("user_id, league_id").eq("tournament_id", tournament_id).execute()
    picks = picks_response.data or []

    # Build set of (user_id, league_id) that already have picks
    picked = set((p["user_id"], p["league_id"]) for p in picks)

    # Get all league memberships
    members_response = supabase.table("league_members").select("user_id, league_id").execute()
    members = members_response.data or []

    # Find members who haven't picked
    missing = []
    for m in members:
        if (m["user_id"], m["league_id"]) not in picked:
            missing.append(m["user_id"])

    return list(set(missing))  # dedupe across leagues


def send_reminders(tournament):
    """Send pick deadline reminders to users who haven't submitted picks."""
    supabase = get_client()
    tournament_name = tournament.get("name", "this week's tournament")
    lock = _parse_lock_time(tournament.get("picks_lock_time"))
    print(f"Checking picks for: {tournament_name} (Week {tournament.get('week')})")
    print(f"  Pick deadline: {lock.isoformat() if lock else 'unknown'} | now: {datetime.now(timezone.utc).isoformat()}")

    missing_user_ids = get_users_without_picks(tournament["id"])
    if not missing_user_ids:
        print("All users have submitted picks. No reminders needed.")
        return

    print(f"Found {len(missing_user_ids)} user(s) without picks")

    # Get push subscriptions for those users (only where reminders enabled)
    subs_response = supabase.table("push_subscriptions") \
        .select("*") \
        .in_("user_id", missing_user_ids) \
        .eq("notify_reminders", True) \
        .execute()
    subscriptions = subs_response.data or []

    if not subscriptions:
        print("No subscriptions with reminders enabled for missing users.")
        return

    payload = json.dumps({
        "title": "Pick Reminder",
        "body": f"Don't forget to submit your pick for {tournament_name}!",
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
        "url": "/",
        "tag": "pick-reminder",
    })

    sent = 0
    failed = 0
    expired = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": {
                "p256dh": sub["p256dh"],
                "auth": sub["auth"],
            },
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent += 1
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                expired.append(sub["id"])
            else:
                print(f"  Push failed for {sub['endpoint'][:60]}...: {e}")
            failed += 1

    if expired:
        supabase.table("push_subscriptions").delete().in_("id", expired).execute()
        print(f"  Removed {len(expired)} expired subscriptions")

    print(f"  Reminders: {sent} sent, {failed} failed")


if __name__ == "__main__":
    tournament = get_upcoming_tournament()
    if tournament:
        send_reminders(tournament)
    else:
        print("No upcoming tournament with an open pick deadline. No reminders sent.")
