#!/usr/bin/env python3
"""Send push notifications to all subscribed users."""

from golf_common import get_supabase_client, send_web_push


def send_to_all(title, body, url="/", tag="golf-league-notification", notify_type="results"):
    """Send a push notification to subscribed users filtered by preference."""
    supabase = get_supabase_client()
    query = supabase.table("push_subscriptions").select("*")
    if notify_type == "results":
        query = query.eq("notify_results", True)
    elif notify_type == "reminders":
        query = query.eq("notify_reminders", True)
    subscriptions = query.execute().data or []

    payload = {
        "title": title,
        "body": body,
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
        "url": url,
        "tag": tag,
    }

    sent, failed = send_web_push(supabase, subscriptions, payload)
    print(f"  Notifications: {sent} sent, {failed} failed")
    return sent, failed


if __name__ == "__main__":
    import sys
    title = sys.argv[1] if len(sys.argv) > 1 else "Golf League"
    body = sys.argv[2] if len(sys.argv) > 2 else "New update available!"
    send_to_all(title, body)
