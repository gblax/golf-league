#!/usr/bin/env python3
"""Send push notifications to all subscribed users."""

import os
import json
from dotenv import load_dotenv
from supabase import create_client
from pywebpush import webpush, WebPushException

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_PUBLIC_KEY = os.environ["VAPID_PUBLIC_KEY"]
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def send_to_all(title, body, url="/", tag="golf-league-notification"):
    """Send a push notification to all subscribed users."""
    result = supabase.table("push_subscriptions").select("*").execute()
    subscriptions = result.data or []

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
        "url": url,
        "tag": tag,
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

    # Clean up expired subscriptions
    if expired:
        supabase.table("push_subscriptions").delete().in_("id", expired).execute()
        print(f"  Removed {len(expired)} expired subscriptions")

    print(f"  Notifications: {sent} sent, {failed} failed")
    return sent, failed


if __name__ == "__main__":
    import sys
    title = sys.argv[1] if len(sys.argv) > 1 else "Golf League"
    body = sys.argv[2] if len(sys.argv) > 2 else "New update available!"
    send_to_all(title, body)
