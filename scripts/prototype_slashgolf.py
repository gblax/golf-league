#!/usr/bin/env python3
"""
Slash Golf (RapidAPI "Live Golf Data") prototype probe.

Throwaway diagnostic — NOT part of the scoring pipeline. Its only job is to
answer the one open question before we commit to migrating off ESPN:

    Does Slash Golf's free tier expose PER-TOURNAMENT prize money per player?

That's the field our whole league runs on (picks pay out a golfer's winnings
for the week — see update_results.py). If it isn't here, we fall back to
Data Golf instead.

What it does:
  1. GET /schedule  -> list this year's PGA events, auto-pick the most recent
     one that has already finished.
  2. GET /leaderboard for that event -> dump the shape, print a couple of full
     player rows, and recursively scan every field for anything money-shaped
     (earn / money / prize / purse / won / winnings).

Run:
    pip install -r scripts/requirements.txt      # requests + python-dotenv (already listed)
    # put RAPIDAPI_KEY=... in scripts/.env  (gitignored), then:
    python scripts/prototype_slashgolf.py
    # optional: target a specific event / tour / season
    TOURN_ID=014 YEAR=2026 ORG_ID=1 python scripts/prototype_slashgolf.py
"""

import os
import json
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

# Look for the key in scripts/.env first (matches the other scripts), then CWD.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY") or os.getenv("X_RAPIDAPI_KEY")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "live-golf-data.p.rapidapi.com")
BASE_URL = f"https://{RAPIDAPI_HOST}"

# orgId 1 = PGA Tour. year defaults to the current season. tournId optional —
# if unset we auto-pick the most recently completed event from the schedule.
ORG_ID = os.getenv("ORG_ID", "1")
YEAR = os.getenv("YEAR", str(datetime.now(timezone.utc).year))
TOURN_ID = os.getenv("TOURN_ID")  # optional override

# Substrings that would identify a prize-money field, whatever it's named.
MONEY_HINTS = ("earn", "money", "prize", "purse", "winning", "won", "payout")


def _headers() -> dict:
    return {"x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST}


def _get(path: str, params: dict) -> dict:
    """GET a Slash Golf endpoint, with diagnostics that distinguish the three
    failure modes we actually care about: blocked outbound (network policy),
    bad/again key (401/403), and rate limit (429)."""
    url = f"{BASE_URL}{path}"
    pretty = "&".join(f"{k}={v}" for k, v in params.items())
    print(f"\n→ GET {path}?{pretty}")
    try:
        resp = requests.get(url, headers=_headers(), params=params, timeout=30)
    except requests.RequestException as exc:
        raise SystemExit(
            f"✗ Network error reaching {RAPIDAPI_HOST}: {exc}\n"
            "  If this is a connection/timeout error, this remote environment's\n"
            "  network policy may be blocking outbound calls to rapidapi.com.\n"
            "  Allow *.p.rapidapi.com (or run the prototype locally)."
        )
    print(f"  HTTP {resp.status_code}, {len(resp.text)} chars")
    if resp.status_code in (401, 403):
        raise SystemExit(
            f"✗ {resp.status_code} from RapidAPI — key missing/invalid or you're not\n"
            "  subscribed to the Live Golf Data API. Subscribe (free Basic plan) and\n"
            f"  double-check RAPIDAPI_KEY. Body: {resp.text[:300]}"
        )
    if resp.status_code == 429:
        raise SystemExit("✗ 429 rate-limited — free tier is 20 req/day. Wait and retry.")
    resp.raise_for_status()
    return resp.json()


def _num(v):
    """Unwrap MongoDB-extended-JSON scalars Slash Golf sometimes returns, e.g.
    {'$numberInt': '5'}, {'$numberLong': '...'}, {'$date': {...}}. Returns the
    raw value otherwise."""
    if isinstance(v, dict):
        for k in ("$numberInt", "$numberLong", "$numberDouble", "$numberDecimal"):
            if k in v:
                return v[k]
        if "$date" in v:
            return _num(v["$date"])
    return v


def _epoch_ms(date_field):
    """Best-effort epoch-millis out of a schedule date field, across the
    formats Slash Golf has used (extended-JSON long, ISO string, int)."""
    raw = _num(date_field)
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        pass
    try:
        s = str(raw).replace("Z", "+00:00")
        return int(datetime.fromisoformat(s).timestamp() * 1000)
    except ValueError:
        return None


def pick_recent_completed(schedule: list) -> dict | None:
    """Choose the most recent event whose end date is already in the past."""
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    dated = []
    for ev in schedule:
        d = ev.get("date") or {}
        end_ms = _epoch_ms(d.get("end") or d.get("start") or ev.get("date"))
        if end_ms is not None:
            dated.append((end_ms, ev))
    finished = [(ms, ev) for ms, ev in dated if ms <= now_ms]
    if finished:
        return max(finished, key=lambda t: t[0])[1]
    # Couldn't date anything — fall back to the last list entry (schedules are
    # usually chronological) so we still have something to probe.
    return schedule[-1] if schedule else None


def scan_for_money(obj, path="") -> list:
    """Recursively collect (json_path, key, sample_value) for every field whose
    name looks money-related. This is the actual deliverable."""
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            here = f"{path}.{k}" if path else k
            if any(h in k.lower() for h in MONEY_HINTS) and not isinstance(v, (dict, list)):
                found.append((here, k, v))
            found.extend(scan_for_money(v, here))
    elif isinstance(obj, list) and obj:
        found.extend(scan_for_money(obj[0], f"{path}[0]"))  # representative element
    return found


def main():
    if not RAPIDAPI_KEY:
        raise SystemExit(
            "✗ No RAPIDAPI_KEY found.\n"
            "  Add a line  RAPIDAPI_KEY=your_key_here  to scripts/.env (gitignored),\n"
            "  or export it in your shell, then re-run."
        )

    print("=" * 64)
    print("Slash Golf free-tier probe — looking for per-tournament prize money")
    print("=" * 64)

    # 1. Resolve which tournament to inspect.
    tourn_id, year = TOURN_ID, YEAR
    if not tourn_id:
        sched = _get("/schedule", {"orgId": ORG_ID, "year": year})
        rows = sched.get("schedule") or sched.get("tournaments") or []
        print(f"  schedule returned {len(rows)} events for {year}")
        ev = pick_recent_completed(rows)
        if not ev:
            raise SystemExit(
                "✗ Schedule was empty/unrecognized. Inspect the raw payload below and\n"
                "  re-run with TOURN_ID=<id> YEAR=<year> to target an event directly.\n"
                + json.dumps(sched, indent=2)[:1500]
            )
        tourn_id = _num(ev.get("tournId") or ev.get("id"))
        print(f"  auto-picked most recent finished event: "
              f"{ev.get('name')!r}  (tournId={tourn_id}, year={year})")

    # 2. Pull that leaderboard and dissect it.
    lb = _get("/leaderboard", {"orgId": ORG_ID, "tournId": tourn_id, "year": year})

    print("\n" + "-" * 64)
    print("TOP-LEVEL KEYS:", list(lb.keys()))
    print("status:", _num(lb.get("status")), "| roundStatus:", lb.get("roundStatus"))

    rows = lb.get("leaderboardRows") or lb.get("leaderboard") or lb.get("players") or []
    print(f"player rows: {len(rows)}")
    if not rows:
        print("⚠ No player rows — full payload follows so we can adjust field paths:")
        print(json.dumps(lb, indent=2)[:2000])
        return

    print("\nFIELDS PRESENT ON A PLAYER ROW:")
    print(" ", sorted(rows[0].keys()))

    print("\nFIRST 2 PLAYER ROWS (verbatim):")
    print(json.dumps(rows[:2], indent=2)[:2500])

    # 3. The verdict.
    print("\n" + "=" * 64)
    money = scan_for_money(lb)
    if money:
        print("✓ MONEY-SHAPED FIELDS FOUND:")
        for jp, key, val in money:
            print(f"    {jp} = {val!r}")
        print("\n→ Per-tournament prize money appears available. Slash Golf is viable;\n"
              "  next step is wiring parse_slashgolf_json() into update_results.py.")
    else:
        print("✗ NO money-shaped field anywhere in the leaderboard payload.")
        print("  Slash Golf's leaderboard may not carry prize money. Before ruling it\n"
              "  out, check for a separate endpoint (e.g. /points, /earnings); otherwise\n"
              "  Data Golf (explicit event-level earnings) is the fallback.")
    print("=" * 64)


if __name__ == "__main__":
    main()
