#!/usr/bin/env python3
"""Send pick deadline reminders to users who haven't submitted picks."""

from datetime import datetime, timedelta, timezone

from golf_common import get_supabase_client, send_web_push

# Don't fire a reminder earlier than this many hours before a tournament's
# pick deadline. The crons run the day before the Thursday lock, so a generous
# window catches the intended week while excluding NEXT week's lock (~7 days
# out). It also means a delayed/late cron run that fires AFTER the lock won't
# jump ahead and prematurely nudge for the following week — it simply finds
# no in-window tournament and sends nothing.
REMINDER_LOOKAHEAD_HOURS = 96


def _parse_lock_time(raw):
    """Parse a picks_lock_time value into an aware UTC datetime, or None."""
    if not raw:
        return None
    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _pick_deadline(t):
    """The effective 'picks lock' instant for a tournament, or None.

    Prefer the explicit ``picks_lock_time``. When that's missing, fall back to
    ``tournament_date`` (first-round tee-off) — the schedule sync defaults the
    lock to exactly that, and you can't submit a pick once play has started, so
    it's a safe deadline proxy. If neither is known we return None and the
    tournament is skipped: without a deadline we cannot tell whether a reminder
    would be on time or days late, and a late one is worse than none.
    """
    return _parse_lock_time(t.get("picks_lock_time")) or _parse_lock_time(
        t.get("tournament_date")
    )


def select_reminder_tournament(tournaments, now=None):
    """Choose the tournament a pick reminder should target.

    Picks the soonest tournament whose pick deadline is still in the FUTURE and
    within REMINDER_LOOKAHEAD_HOURS. A reminder is a last nudge before picks
    lock, so a tournament that has already locked must never be selected —
    otherwise we tell people to submit a pick for a week that's closed (and
    often already played).

    This is the fix for the "reminded after it locked" bug. The old logic took
    the earliest ``completed=False`` row and ignored timing whenever a row had
    no ``picks_lock_time``, so:
      * a past, locked week that wasn't marked complete (e.g. the Monday
        results run refused to write because results weren't final) lingered as
        the "upcoming" tournament and got reminded days late;
      * a late cron run that fired after the lock still reminded for the
        now-locked week.
    Matching the frontend, which hard-locks submission at now >= lock time, a
    tournament is only a valid reminder target while now < deadline. The
    deadline is the explicit lock or, failing that, first-round tee-off — but
    it is ALWAYS subject to the same future+horizon window, so a missing lock
    time can no longer route around the "don't nudge for a closed week" rule.
    """
    now = now or datetime.now(timezone.utc)
    horizon = now + timedelta(hours=REMINDER_LOOKAHEAD_HOURS)

    upcoming = []
    for t in tournaments:
        if t.get("completed"):
            continue
        deadline = _pick_deadline(t)
        if deadline is None:
            continue
        # Still open (now < deadline) and imminent (deadline <= horizon).
        if now < deadline <= horizon:
            upcoming.append((deadline, t))

    if not upcoming:
        return None
    upcoming.sort(key=lambda x: x[0])
    return upcoming[0][1]


def get_upcoming_tournament():
    """Find the tournament an upcoming-pick reminder should target."""
    supabase = get_supabase_client()
    response = supabase.table("tournaments").select("*").execute()
    return select_reminder_tournament(response.data or [])


def get_users_without_picks(tournament_id):
    """Get user IDs of league members who haven't submitted picks for this tournament."""
    supabase = get_supabase_client()
    picks = supabase.table("picks").select("user_id, league_id").eq("tournament_id", tournament_id).execute().data or []
    picked = set((p["user_id"], p["league_id"]) for p in picks)

    members = supabase.table("league_members").select("user_id, league_id").execute().data or []
    missing = [m["user_id"] for m in members if (m["user_id"], m["league_id"]) not in picked]
    return list(set(missing))  # dedupe across leagues


def send_reminders(tournament):
    """Send pick deadline reminders to users who haven't submitted picks."""
    supabase = get_supabase_client()
    tournament_name = tournament.get("name", "this week's tournament")
    deadline = _pick_deadline(tournament)
    print(f"Checking picks for: {tournament_name} (Week {tournament.get('week')})")
    print(f"  Pick deadline: {deadline.isoformat() if deadline else 'unknown'} | now: {datetime.now(timezone.utc).isoformat()}")

    missing_user_ids = get_users_without_picks(tournament["id"])
    if not missing_user_ids:
        print("All users have submitted picks. No reminders needed.")
        return

    print(f"Found {len(missing_user_ids)} user(s) without picks")

    subscriptions = (
        supabase.table("push_subscriptions")
        .select("*")
        .in_("user_id", missing_user_ids)
        .eq("notify_reminders", True)
        .execute()
        .data
        or []
    )
    if not subscriptions:
        print("No subscriptions with reminders enabled for missing users.")
        return

    payload = {
        "title": "Pick Reminder",
        "body": f"Don't forget to submit your pick for {tournament_name}!",
        "icon": "/icon-192.png",
        "badge": "/icon-192.png",
        "url": "/",
        "tag": "pick-reminder",
    }
    sent, failed = send_web_push(supabase, subscriptions, payload)
    print(f"  Reminders: {sent} sent, {failed} failed")


if __name__ == "__main__":
    tournament = get_upcoming_tournament()
    if tournament:
        send_reminders(tournament)
    else:
        print("No upcoming tournament with an open pick deadline. No reminders sent.")
