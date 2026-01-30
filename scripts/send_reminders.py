#!/usr/bin/env python3
"""Send pick deadline reminders to users who haven't submitted picks."""

import os
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client
from pywebpush import webpush, WebPushException

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_PUBLIC_KEY = os.environ["VAPID_PUBLIC_KEY"]
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_upcoming_tournament():
    """Find the next incomplete tournament."""
    response = supabase.table("tournaments").select("*").eq("completed", False).order("week").limit(1).execute()
    return response.data[0] if response.data else None


def get_users_without_picks(tournament_id):
    """Get user IDs of league members who haven't submitted picks for this tournament."""
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
    tournament_name = tournament.get("name", "this week's tournament")
    print(f"Checking picks for: {tournament_name}")

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
        print("No upcoming tournament found.")
