#!/usr/bin/env python3
"""
Shared helpers for the Golf League backend scripts.

Consolidates the three things that were copy-pasted across update_results.py,
send_reminders.py and send_notification.py:
  * Supabase service-role client creation (with the SERVICE_ROLE/SERVICE_KEY
    env aliasing the GitHub Actions workflows use).
  * VAPID / Web Push configuration.
  * The webpush send loop, including expired-subscription (404/410) cleanup.

Heavy third-party imports (``supabase``, ``pywebpush``) are deferred into the
functions that need them, so this module — and anything importing it — can be
imported in a minimal environment (e.g. unit tests) without those packages or
any credentials present.
"""

import json
import os
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()


def parse_utc(raw):
    """Parse a DB date/timestamp value into an aware UTC datetime, or None.

    Accepts the shapes PostgREST hands back ("2026-06-18", "2026-06-18
    07:00:00+00", ISO with Z); a naive value is taken as UTC.
    """
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def days_from_start(tournament, now=None):
    """How many days ``now`` is past a tournament's first-round date (negative
    before it starts), or None when the date is unknown.

    The live-board and field jobs use this to decide whether a Slash Golf
    call is worth making at all. Their target is "the earliest tournament not
    yet scored", which is exactly right during the season but, once the next
    season's schedule is loaded in the autumn, resolves to week 1 of NEXT year
    for months. Every scheduled run would then spend an API call to learn the
    event hasn't started — and on the free tier those calls are the budget the
    real season needs. A tournament far outside its play window is skipped
    before any network access.
    """
    start = parse_utc(tournament.get("tournament_date"))
    if start is None:
        return None
    now = now or datetime.now(timezone.utc)
    return (now - start).total_seconds() / 86400.0


def season_of(tournament):
    """The season a tournament belongs to: the explicit ``season`` column
    (scripts/add-tournament-season.sql), else the year of its first-round
    date. Mirrors seasonOf() in src/utils/seasons.js."""
    season = tournament.get("season")
    if season is not None:
        try:
            return int(season)
        except (TypeError, ValueError):
            pass
    start = parse_utc(tournament.get("tournament_date"))
    return start.year if start else None

SUPABASE_URL = os.environ.get("SUPABASE_URL")
# The workflows pass the service key under both names; accept either.
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SERVICE_KEY")
)

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")

_client = None


def get_supabase_client():
    """Return a cached Supabase service-role client, creating it on first use.

    Lazy so importing this module never requires credentials or the supabase
    package — only actually talking to the database does.
    """
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and a service key (SUPABASE_SERVICE_ROLE_KEY or "
                "SUPABASE_SERVICE_KEY) must be set."
            )
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def send_web_push(supabase, subscriptions, payload):
    """Send one Web Push ``payload`` (a dict) to every subscription, removing
    any that the push service reports as gone (404/410).

    Returns ``(sent, failed)``. Centralizes the loop both notification paths
    used to duplicate verbatim.
    """
    from pywebpush import webpush, WebPushException

    data = json.dumps(payload)
    sent = failed = 0
    expired = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=data,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent += 1
        except WebPushException as exc:
            if exc.response is not None and exc.response.status_code in (404, 410):
                expired.append(sub["id"])
            else:
                print(f"  Push failed for {sub['endpoint'][:60]}...: {exc}")
            failed += 1

    if expired:
        supabase.table("push_subscriptions").delete().in_("id", expired).execute()
        print(f"  Removed {len(expired)} expired subscriptions")

    return sent, failed
