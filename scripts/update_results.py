#!/usr/bin/env python3
"""
Golf League Results Updater

Fetches ESPN's PGA leaderboard JSON API and updates Supabase.
Processes picks across all leagues, applying each league's own penalty settings.

If ESPN's schema drifts or a tournament can't be matched, the commissioner
can override results manually through CommissionerTab in the web app.
"""

import os
import json
import re
import unicodedata
from difflib import SequenceMatcher

import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# ESPN's JSON API endpoints, used by their own apps. Returns structured
# data directly — no LLM parsing needed. The public HTML page sits behind
# a CDN/Akamai bot challenge so we don't bother with an HTML fallback.
#
# Try `/scoreboard` first (ESPN's standard pattern across all sports) and
# fall back to the older `/leaderboard` alias. ESPN has flipped which one
# is canonical at least once, so trying both keeps the Monday cron alive
# through future renames.
ESPN_API_URLS = (
    "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard",
    "https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard",
)

# Name-suffix tokens stripped from the end of a normalized name.
_NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
# Punctuation replaced with a single space during normalization. Covers
# periods, commas, ASCII/typographic quotes, backticks, hyphens, and en/em dashes.
_PUNCT_TO_SPACE = re.compile(r"[\.\,\'\"\`\u2018\u2019\u201C\u201D\-\u2013\u2014]")


def normalize_name(name: str) -> str:
    """
    Normalize a personal or tournament name for robust comparison.

    Steps:
      1. Unicode NFD decompose and drop combining marks (strips accents).
      2. Lowercase.
      3. Replace punctuation (., ,, ', ", `, -, en/em dash) with spaces.
      4. Collapse whitespace to single spaces.
      5. Strip trailing name suffixes (jr, sr, ii, iii, iv, v).
    """
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFD", name)
    stripped_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    lowered = stripped_accents.lower()
    despaced = _PUNCT_TO_SPACE.sub(" ", lowered)
    tokens = despaced.split()
    while tokens and tokens[-1] in _NAME_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


# Generic words that appear in many unrelated tournament names. A shared
# token from this set is NOT enough to call two names the same event —
# otherwise "Myrtle Beach Classic" and "Rocket Classic" match on "classic".
_GENERIC_TOURNAMENT_WORDS = {
    "open", "classic", "championship", "championships", "invitational",
    "challenge", "cup", "tournament", "national", "golf", "pga", "tour",
}


def tournament_names_match(name_a: str, name_b: str) -> bool:
    """Decide whether two tournament names refer to the same event.

    Used as a verification gate: the schedule picks which week to score,
    and this confirms the ESPN event we fetched is actually that
    tournament before we write anything against its picks.

      1. Exact normalized match.
      2. Substring either direction (handles sponsor prefixes like
         "THE CJ CUP Byron Nelson" vs "CJ Cup Byron Nelson").
      3. A shared significant token (>3 chars) that is NOT a generic
         golf-event word — so "byron"/"pebble" count but "classic"/"open"
         alone do not.
    """
    a = normalize_name(name_a)
    b = normalize_name(name_b)
    if not a or not b:
        return False
    if a == b:
        return True
    if a in b or b in a:
        return True
    common = {w for w in (set(a.split()) & set(b.split())) if len(w) > 3}
    return bool(common - _GENERIC_TOURNAMENT_WORDS)


_API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.espn.com",
    "Referer": "https://www.espn.com/",
}


def fetch_espn_leaderboard_json() -> dict:
    """Fetch the current PGA Tour leaderboard from ESPN's JSON API.

    Tries each URL in ESPN_API_URLS in order and returns the first that
    yields a parseable leaderboard-shaped payload. Raises with all
    per-URL failures if every candidate fails so the operator can see
    whether ESPN renamed the endpoint again or returned an empty shell.
    """
    errors: list[str] = []
    for url in ESPN_API_URLS:
        print(f"Fetching ESPN leaderboard JSON API: {url}")
        try:
            resp = requests.get(url, headers=_API_HEADERS, timeout=30)
            print(f"  [api] HTTP {resp.status_code}, {len(resp.text)} chars")
            resp.raise_for_status()
        except requests.HTTPError as exc:
            errors.append(f"{url}: HTTP {exc.response.status_code if exc.response else '?'}")
            continue
        except requests.RequestException as exc:
            errors.append(f"{url}: {exc}")
            continue

        body = resp.text
        if len(body) < 1000 or not body.lstrip().startswith("{"):
            errors.append(f"{url}: short/non-JSON body ({len(body)} chars)")
            continue

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            errors.append(f"{url}: invalid JSON ({exc})")
            continue

        if not (payload.get("events") or payload.get("leaderboard") or payload.get("competitions")):
            errors.append(
                f"{url}: parsed but no events/leaderboard/competitions; "
                f"top keys {list(payload.keys())[:10]}"
            )
            continue

        return payload

    raise ValueError(
        "ESPN JSON API: every candidate endpoint failed. "
        "Run with the commissioner override in CommissionerTab to enter "
        "results manually. Diagnostics:\n  - " + "\n  - ".join(errors)
    )


# Substrings that identify a prize-money stat on competitor.statistics[].
# Matched against `name` and `abbreviation` (case-insensitive) because the
# exact label has shifted across endpoints/seasons (`earnings`, `EARN`,
# `winnings`, etc.).
_EARNINGS_KEYWORDS = ("earn", "winning", "money", "prize", "purse")

# Position strings that mean the player isn't earning money. The
# downstream calculate_penalty() also keys off these strings, so the
# parser propagates them verbatim.
_INACTIVE_POSITIONS = {"CUT", "WD", "DQ", "MDF"}


def _parse_money(raw) -> float:
    """Coerce ESPN's earnings field into a float. Accepts numbers or
    strings like '$1,234,567' or '1234567.00'. Returns 0 on failure."""
    if raw is None:
        return 0
    if isinstance(raw, (int, float)):
        return float(raw)
    s = str(raw).strip().replace("$", "").replace(",", "")
    if not s or s in {"-", "--", "E"}:
        return 0
    try:
        return float(s)
    except ValueError:
        return 0


def _competitor_winnings(competitor: dict) -> float:
    """Pull prize money out of an ESPN competitor record.

    ESPN exposes earnings inconsistently across seasons/endpoints. Try
    the most common locations in priority order and return the first
    non-zero match. Returns 0 if nothing usable is found.
    """
    # 1. Top-level convenience field.
    direct = _parse_money(competitor.get("earnings"))
    if direct:
        return direct

    # 2. statistics[] with a name/abbreviation like earnings/EARN/winnings.
    for stat in competitor.get("statistics") or []:
        label = (str(stat.get("name", "")) + " " + str(stat.get("abbreviation", ""))).lower()
        if any(kw in label for kw in _EARNINGS_KEYWORDS):
            val = _parse_money(stat.get("value"))
            if val:
                return val
            val = _parse_money(stat.get("displayValue"))
            if val:
                return val

    return 0


def _competitor_position(competitor: dict) -> str:
    """Extract the displayed leaderboard position (e.g. '1', 'T2',
    'CUT', 'WD'). Returns '' if not found."""
    status = competitor.get("status") or {}
    pos = status.get("position") or {}
    if isinstance(pos, dict):
        return str(pos.get("displayName") or pos.get("name") or "").strip()
    return str(pos).strip()


def _competitor_score(competitor: dict) -> str:
    """Extract the overall to-par score string ('E', '-12', '+3')."""
    score = competitor.get("score")
    if isinstance(score, dict):
        return str(score.get("displayValue") or score.get("value") or "").strip()
    if isinstance(score, (int, float)):
        return f"{score:+d}" if isinstance(score, int) else f"{score:+g}"
    return str(score or "").strip()


def _competitor_status(competitor: dict, position: str) -> str:
    """Map ESPN's status into the four-state vocabulary the rest of the
    pipeline expects: active/cut/withdrawn/disqualified."""
    pos_upper = position.upper()
    if pos_upper == "CUT" or pos_upper == "MDF":
        return "cut"
    if pos_upper == "WD":
        return "withdrawn"
    if pos_upper == "DQ":
        return "disqualified"

    # Fall back to the structured status type if position is empty.
    type_info = ((competitor.get("status") or {}).get("type") or {})
    name = str(type_info.get("name", "")).lower()
    state = str(type_info.get("state", "")).lower()
    if "cut" in name or "cut" in state:
        return "cut"
    if "withdraw" in name or "wd" in state:
        return "withdrawn"
    if "disqual" in name or "dq" in state:
        return "disqualified"
    return "active"


def _event_name(ev: dict) -> str:
    """ESPN event display name, trying the fields that have carried it."""
    return (ev.get("name") or ev.get("shortName") or ev.get("displayName") or "").strip()


def _competitor_count(ev: dict) -> int:
    comps = ev.get("competitions") or []
    return len((comps[0].get("competitors") or [])) if comps else 0


def _event_state(ev: dict) -> tuple[str, bool]:
    """Return (state, completed) for an event. ESPN exposes the play state
    ('pre'/'in'/'post') and a `completed` flag under status.type — on the
    competition first, then the event. A finished tournament reports state
    'post' / completed True."""
    comps = ev.get("competitions") or []
    for src in ((comps[0] if comps else {}), ev):
        type_info = ((src.get("status") or {}).get("type") or {})
        state = str(type_info.get("state", "")).lower()
        if state:
            return state, bool(type_info.get("completed")) or state == "post"
    return "", False


def _select_event(events: list[dict], expected_name: str | None = None) -> dict:
    """Choose which ESPN event to score.

    When expected_name is given (the schedule-driven target), restrict to
    events whose name matches it and prefer a finished one. This is how a
    multi-event week (a signature event running alongside an opposite-field
    event) is disambiguated toward the tournament the league actually
    scheduled, rather than just grabbing the largest field. If nothing
    matches the expected name, fall back to the legacy heuristic so the
    caller's name-verification gate can refuse on the mismatch.

    With no expected_name, keep the legacy behavior: the finished event
    with the largest field, or the largest field overall if none finished.
    """
    if expected_name:
        matching = [ev for ev in events if tournament_names_match(_event_name(ev), expected_name)]
        if matching:
            finished = [ev for ev in matching if _event_state(ev)[1]]
            return max(finished or matching, key=_competitor_count)
    finished = [ev for ev in events if _event_state(ev)[1]]
    return max(finished or events, key=_competitor_count)


def parse_espn_json(payload: dict, expected_name: str | None = None) -> dict:
    """Walk ESPN's JSON payload into the {tournament_name, players[]}
    shape the downstream pipeline expects.

    When expected_name is supplied, the event matching that name is
    preferred (see _select_event) so the parser locks onto the league's
    scheduled tournament in a multi-event week.

    Returned shape:
        {
          "tournament_name": str,
          "players": [
            {"player_name": str, "position": str, "score": str,
             "winnings": float,
             "status": "active"|"cut"|"withdrawn"|"disqualified"},
            ...
          ]
        }

    Defensive about field paths because ESPN's hidden API isn't
    versioned; if a field shifts, we degrade gracefully (empty string,
    0 winnings, status='active') rather than raising. The match-rate
    gate downstream catches catastrophic schema drift.
    """
    print("Parsing ESPN leaderboard JSON...")

    events = payload.get("events") or []
    if not events:
        raise ValueError("ESPN payload has no events[] — nothing to parse.")

    event = _select_event(events, expected_name)
    event_state, event_completed = _event_state(event)
    tournament_name = _event_name(event) or "Unknown"

    competitions = event.get("competitions") or []
    competitors = (competitions[0].get("competitors") if competitions else []) or []

    players: list[dict] = []
    for c in competitors:
        athlete = c.get("athlete") or {}
        player_name = (
            athlete.get("displayName")
            or athlete.get("fullName")
            or athlete.get("name")
            or ""
        ).strip()
        if not player_name:
            continue

        position = _competitor_position(c)
        score = _competitor_score(c)
        status = _competitor_status(c, position)
        # Inactive players don't earn money even if ESPN lists a stale value.
        winnings = 0 if position.upper() in _INACTIVE_POSITIONS else _competitor_winnings(c)

        players.append({
            "player_name": player_name,
            "position": position,
            "score": score,
            "winnings": winnings,
            "status": status,
        })

    print(f"Tournament: {tournament_name}")
    print(f"Event state: {event_state or 'unknown'} (completed={event_completed})")
    print(f"Parsed {len(players)} players from leaderboard")

    if not players:
        raise ValueError(
            f"ESPN payload yielded 0 players for '{tournament_name}'. "
            f"Schema may have changed. Event keys: {list(event.keys())[:10]}; "
            f"competition keys: {list(competitions[0].keys())[:10] if competitions else []}."
        )

    return {
        "tournament_name": tournament_name,
        "players": players,
        "event_state": event_state,
        "event_completed": event_completed,
    }


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_tournament_to_update(supabase: Client) -> dict | None:
    """Pick which tournament a run should score: the most recent one that
    has finished play but isn't marked completed yet.

    This is the schedule-driven selector — the league's own calendar
    decides the target week, NOT whatever event ESPN happens to be
    showing. That keeps each Monday's run pinned to the tournament that
    just ended instead of drifting onto an upcoming or opposite-field
    event via name matching. ESPN is then used only to fetch and verify
    that week's results.

    Tournaments are shared across all leagues. Returns None when nothing
    has both ended and is still pending (e.g. an off week, or everything
    is already scored) — the caller then has nothing to do.
    """
    from datetime import datetime, timedelta, timezone

    response = (
        supabase.table("tournaments")
        .select("*")
        .eq("completed", False)
        .order("week", desc=True)
        .execute()
    )
    if not response.data:
        return None

    now = datetime.now(timezone.utc)

    # Ordered week-DESC, so the first ended-but-incomplete tournament is the
    # most recent one. A tournament starts Thursday and ends Sunday night,
    # so play is over once we're past start + 3 days 23:59.
    for tournament in response.data:
        date_str = tournament.get("tournament_date")
        if not date_str:
            continue
        start = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        end = start + timedelta(days=3, hours=23, minutes=59)
        if now > end:
            return tournament

    return None


def get_picks_for_tournament(supabase: Client, tournament_id: str) -> list[dict]:
    """Get all picks for a tournament across all leagues, inserting 'No Pick' rows for members who didn't submit."""
    # Fetch existing picks
    response = supabase.table("picks").select("*").eq("tournament_id", tournament_id).execute()
    picks = response.data or []

    # Build a set of (user_id, league_id) that already have a pick
    existing = set((p["user_id"], p["league_id"]) for p in picks)

    # Get all league members across all leagues
    members_response = supabase.table("league_members").select("user_id, league_id").execute()
    all_members = members_response.data or []

    # Insert 'No Pick' rows for members missing a pick
    missing = []
    for member in all_members:
        key = (member["user_id"], member["league_id"])
        if key not in existing:
            missing.append({
                "user_id": member["user_id"],
                "league_id": member["league_id"],
                "tournament_id": tournament_id,
                "golfer_name": "No Pick",
                "winnings": 0,
            })

    if missing:
        print(f"  Inserting {len(missing)} 'No Pick' row(s) for members who didn't submit")
        supabase.table("picks").insert(missing).execute()
        # Re-fetch so the new rows are included
        response = supabase.table("picks").select("*").eq("tournament_id", tournament_id).execute()
        picks = response.data or []

    # Fetch user names separately
    user_ids = list(set(p["user_id"] for p in picks if p.get("user_id")))
    users_map = {}
    if user_ids:
        users_response = supabase.table("profiles").select("id, name").in_("id", user_ids).execute()
        for user in (users_response.data or []):
            users_map[user["id"]] = user

    # Attach user info to picks
    for pick in picks:
        pick["user_info"] = users_map.get(pick.get("user_id"), {})

    return picks


def get_all_league_settings(supabase: Client) -> dict:
    """Get settings for all leagues, keyed by league_id."""
    response = supabase.table("league_settings").select("*").execute()
    settings_map = {}
    for settings in (response.data or []):
        settings_map[settings["league_id"]] = settings

    return settings_map


DEFAULT_LEAGUE_SETTINGS = {
    "no_pick_penalty": 10,
    "missed_cut_penalty": 10,
    "withdrawal_penalty": 10,
    "dq_penalty": 10
}


def update_pick_winnings(supabase: Client, pick_id: str, winnings: int, penalty_amount: int = 0, penalty_reason: str = None):
    """Update winnings for a specific pick."""
    update_data = {"winnings": winnings}
    if penalty_amount > 0:
        update_data["penalty_amount"] = penalty_amount
        update_data["penalty_reason"] = penalty_reason

    supabase.table("picks").update(update_data).eq("id", pick_id).execute()


def mark_tournament_completed(supabase: Client, tournament_id: str):
    """Mark a tournament as completed."""
    supabase.table("tournaments").update({"completed": True}).eq("id", tournament_id).execute()


# Fuzzy-match threshold for SequenceMatcher.ratio() on normalized full strings.
# Tuned high to avoid false positives on common surnames (Kim, Lee, Smith).
FUZZY_MATCH_THRESHOLD = 0.92


def normalize_leaderboard(leaderboard_results: list[dict]) -> list[tuple[str, dict]]:
    """Pre-normalize leaderboard entries once so match_golfer_name can be
    called in a hot loop without repeating the work per pick."""
    return [
        (normalize_name(r.get("player_name", "")), r)
        for r in leaderboard_results
    ]


def match_golfer_name(
    pick_name: str,
    leaderboard_results: list[dict],
    normalized: list[tuple[str, dict]] | None = None,
) -> dict | None:
    """
    Find a golfer in the leaderboard results by robust name matching.

    Tiers (all on normalized strings):
      1. Exact normalized match.
      2. First+last token match, with subset tolerance for middle names
         (handles "Viktor Hovland" ↔ "Viktor J Hovland").
      3. difflib.SequenceMatcher ratio >= FUZZY_MATCH_THRESHOLD, keeping only
         a unique strictly-best winner so common surnames can't collide.

    Callers that match many picks against the same leaderboard should
    precompute `normalized` via normalize_leaderboard() and pass it in.
    """
    pick_norm = normalize_name(pick_name)
    if not pick_norm:
        return None
    pick_tokens = pick_norm.split()
    pick_set = set(pick_tokens)

    if normalized is None:
        normalized = normalize_leaderboard(leaderboard_results)

    # Tier 1: exact normalized match.
    for n, r in normalized:
        if n and n == pick_norm:
            return r

    # Tier 2: first+last match, with middle-name / middle-initial tolerance.
    if len(pick_tokens) >= 2:
        pick_first, pick_last = pick_tokens[0], pick_tokens[-1]
        hits = []
        for n, r in normalized:
            result_tokens = n.split()
            if len(result_tokens) < 2:
                continue
            result_first, result_last = result_tokens[0], result_tokens[-1]
            result_set = set(result_tokens)
            if result_first == pick_first and result_last == pick_last:
                hits.append(r)
            elif (pick_set.issubset(result_set) or result_set.issubset(pick_set)) and (
                result_first == pick_first or result_last == pick_last
            ):
                hits.append(r)
        if len(hits) == 1:
            return hits[0]

    # Tier 3: fuzzy ratio on normalized full strings, with a unique winner.
    scored = [
        (SequenceMatcher(None, pick_norm, n).ratio(), r)
        for n, r in normalized
        if n
    ]
    scored = [s for s in scored if s[0] >= FUZZY_MATCH_THRESHOLD]
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    if len(scored) == 1 or scored[0][0] > scored[1][0]:
        return scored[0][1]
    return None


def calculate_penalty(status: str, position: str, league_settings: dict) -> tuple[int, str]:
    """Calculate penalty based on golfer status using league settings."""
    if status == "cut" or position == "CUT":
        return league_settings.get("missed_cut_penalty", 10), "missed_cut"
    elif status == "withdrawn" or position == "WD":
        return league_settings.get("withdrawal_penalty", 10), "withdrawal"
    elif status == "disqualified" or position == "DQ":
        return league_settings.get("dq_penalty", 10), "disqualification"
    return 0, None


# If fewer than this fraction of real picks (i.e. not "No Pick") resolve to a
# leaderboard entry, the scheduled run refuses to write updates or mark the
# tournament complete. Override via --force.
CATASTROPHIC_MATCH_THRESHOLD = 0.5


def update_results(dry_run: bool = True, mark_complete: bool = False, force: bool = False):
    """Main function to update tournament results across all leagues."""
    print("=" * 50)
    print("Golf League Results Updater")
    print("=" * 50)

    # Initialize
    supabase = get_supabase_client()

    # Load all league settings
    all_league_settings = get_all_league_settings(supabase)
    print(f"Loaded settings for {len(all_league_settings)} league(s)")

    # Decide which week to score from OUR schedule, not from whatever event
    # ESPN happens to be showing. The most recent ended-but-incomplete
    # tournament is the one this run should post; ESPN is used only to fetch
    # and verify its results below.
    tournament = get_tournament_to_update(supabase)
    if not tournament:
        print("\nNo ended, incomplete tournament to score right now. Nothing to do.")
        print("(Every ended tournament is already marked completed, or the next")
        print("one hasn't finished yet.)")
        return

    print(f"\n[tournament] Target from schedule: '{tournament['name']}' (Week {tournament['week']})")
    print(f"[tournament] Target normalized:    '{normalize_name(tournament['name'])}'")

    # Fetch the leaderboard and lock onto the event matching our target week.
    payload = fetch_espn_leaderboard_json()
    parsed_data = parse_espn_json(payload, expected_name=tournament["name"])

    espn_tournament_name = parsed_data["tournament_name"]
    leaderboard_results = parsed_data["players"]
    event_completed = parsed_data.get("event_completed")
    event_state = parsed_data.get("event_state") or "unknown"

    print(f"\n[tournament] ESPN raw name:  '{espn_tournament_name}'")
    print(f"[tournament] ESPN normalized: '{normalize_name(espn_tournament_name)}'")
    print(f"[tournament] ESPN event state: '{event_state}' (completed={event_completed})")

    # Verification gate: the ESPN event we parsed must actually be the
    # tournament we set out to score. Schedule-first selection means ESPN
    # only fetches and confirms — it never chooses the week. If ESPN is
    # showing a different event (off week, opposite-field event, or this
    # week's results aren't posted yet), refuse rather than score the wrong
    # field against this week's picks.
    if not tournament_names_match(espn_tournament_name, tournament["name"]) and not force:
        print("\n" + "!" * 60)
        print("ESPN EVENT DOES NOT MATCH THE SCHEDULED TOURNAMENT.")
        print(f"  Scheduled: '{tournament['name']}' (Week {tournament['week']})")
        print(f"  ESPN shows: '{espn_tournament_name}'")
        print("ESPN may not have posted this week's results yet, or it's showing")
        print("a different/opposite-field event. Refusing to apply updates or mark")
        print("complete. Re-run once ESPN shows this tournament, or enter results")
        print("manually via CommissionerTab. Use --force to override this guard.")
        print("!" * 60)
        return

    # Safety gate: only score a tournament whose ESPN event has finished.
    # On a Monday the scoreboard can roll to the upcoming event ('pre') or
    # one still in progress ('in'); its field is listed but unplayed, so
    # scoring it zeroes out every pick and (with --complete) marks the week
    # done with no results. That is the recurring "ran but added no scores"
    # failure. Refuse unless the event reports finished.
    if not event_completed and not force:
        print("\n" + "!" * 60)
        print(f"ESPN EVENT NOT FINISHED (state='{event_state}').")
        print("The leaderboard holds no final results yet, so scoring now would")
        print("zero out every pick. Refusing to apply updates or mark complete.")
        print("Re-run once the tournament finalizes, or enter results manually")
        print("via CommissionerTab. Use --force to override this guard.")
        print("!" * 60)
        return

    # Safety gate: a completed tournament always pays prize money. If the
    # entire parsed field shows $0 earnings, the payload isn't carrying
    # results (slim/alternate endpoint, or an event ESPN hasn't settled).
    # Writing it would post all-$0 scores, so refuse rather than corrupt
    # the week.
    total_field_winnings = sum((p.get("winnings") or 0) for p in leaderboard_results)
    if total_field_winnings <= 0 and not force:
        print("\n" + "!" * 60)
        print("ESPN LEADERBOARD HAS $0 EARNINGS ACROSS THE ENTIRE FIELD.")
        print("A finished tournament always has prize money, so this payload")
        print("is not final results. Refusing to apply updates or mark complete.")
        print("Re-run once ESPN settles the results, or enter them manually via")
        print("CommissionerTab. Use --force to override this guard.")
        print("!" * 60)
        return

    print(f"[tournament] Verified ESPN event matches Week {tournament['week']}.")

    # Pre-normalize the leaderboard once so per-pick matching is O(L) instead of O(L*P).
    normalized_leaderboard = normalize_leaderboard(leaderboard_results)

    # Get all picks for this tournament across all leagues
    picks = get_picks_for_tournament(supabase, tournament["id"])
    print(f"\nFound {len(picks)} picks across all leagues for this tournament")

    # Group picks by league for per-league penalty settings
    picks_by_league = {}
    for pick in picks:
        league_id = pick.get("league_id", "unknown")
        if league_id not in picks_by_league:
            picks_by_league[league_id] = []
        picks_by_league[league_id].append(pick)

    # Match picks to results and update
    updates = []
    matched_count = 0
    unmatched_count = 0
    unmatched_names: list[str] = []

    for league_id, league_picks in picks_by_league.items():
        league_settings = all_league_settings.get(league_id, DEFAULT_LEAGUE_SETTINGS)

        print(f"\n{'─' * 50}")
        print(f"League: {league_id}")
        print(f"  Settings: no_pick=${league_settings.get('no_pick_penalty', 500)}, "
              f"missed_cut=${league_settings.get('missed_cut_penalty', 10)}, "
              f"wd=${league_settings.get('withdrawal_penalty', 10)}, "
              f"dq=${league_settings.get('dq_penalty', 10)}")
        print(f"{'─' * 50}")

        for pick in league_picks:
            golfer_name = pick.get("golfer_name")
            user_name = pick.get("user_info", {}).get("name", "Unknown User")

            if not golfer_name or golfer_name == "No Pick":
                # Check if commissioner already entered a penalty manually
                existing_penalty = pick.get("penalty_amount", 0) or 0
                existing_reason = pick.get("penalty_reason")

                if existing_penalty > 0 and existing_reason:
                    print(f"  {user_name}: No pick submitted (PRESERVING existing penalty: ${existing_penalty} - {existing_reason})")
                    updates.append({
                        "pick_id": pick["id"],
                        "user": user_name,
                        "league_id": league_id,
                        "golfer": None,
                        "winnings": 0,
                        "penalty": existing_penalty,
                        "penalty_reason": existing_reason,
                        "preserved": True
                    })
                else:
                    no_pick_penalty = league_settings.get("no_pick_penalty", 500)
                    print(f"  {user_name}: No pick submitted (penalty: ${no_pick_penalty})")
                    updates.append({
                        "pick_id": pick["id"],
                        "user": user_name,
                        "league_id": league_id,
                        "golfer": None,
                        "winnings": 0,
                        "penalty": no_pick_penalty,
                        "penalty_reason": "no_pick"
                    })
                continue

            result = match_golfer_name(golfer_name, leaderboard_results, normalized=normalized_leaderboard)

            if result:
                matched_count += 1
                winnings = result.get("winnings", 0) or 0

                # Check if commissioner already entered a penalty manually
                existing_penalty = pick.get("penalty_amount", 0) or 0
                existing_reason = pick.get("penalty_reason")

                if existing_penalty > 0 and existing_reason:
                    # Preserve manually-entered penalty
                    penalty = existing_penalty
                    penalty_reason = existing_reason
                    print(f"  {user_name}: {golfer_name} -> {result['position']} ({result['score']}) = ${winnings:,}")
                    print(f"    ^ PRESERVING existing penalty: ${penalty} ({penalty_reason})")
                else:
                    # Calculate penalty from leaderboard status
                    penalty, penalty_reason = calculate_penalty(result.get("status", ""), result.get("position", ""), league_settings)
                    print(f"  {user_name}: {golfer_name} -> {result['position']} ({result['score']}) = ${winnings:,}")
                    if penalty > 0:
                        print(f"    ^ Penalty: ${penalty} ({penalty_reason})")

                updates.append({
                    "pick_id": pick["id"],
                    "user": user_name,
                    "league_id": league_id,
                    "golfer": golfer_name,
                    "position": result["position"],
                    "score": result["score"],
                    "winnings": winnings,
                    "penalty": penalty,
                    "penalty_reason": penalty_reason,
                    "preserved": existing_penalty > 0 and existing_reason is not None
                })
            else:
                unmatched_count += 1
                unmatched_names.append(golfer_name)
                print(f"  {user_name}: {golfer_name} -> NOT FOUND on leaderboard")
                updates.append({
                    "pick_id": pick["id"],
                    "user": user_name,
                    "league_id": league_id,
                    "golfer": golfer_name,
                    "winnings": 0,
                    "penalty": 0,
                    "penalty_reason": None,
                    "error": "not_found"
                })

    # Summary
    print("\n" + "=" * 50)
    print("Summary:")
    print("=" * 50)

    for update in updates:
        status = f"${update['winnings']:,}"
        if update.get("penalty", 0) > 0:
            status += f" (penalty: ${update['penalty']})"
            if update.get("preserved"):
                status += " [PRESERVED]"
        if update.get("error"):
            status += f" [ERROR: {update['error']}]"
        print(f"  {update['user']}: {update.get('golfer', 'No pick')} = {status}")

    # Match-rate report + catastrophic-failure safety gate.
    total_real_picks = matched_count + unmatched_count
    match_rate = (matched_count / total_real_picks) if total_real_picks else 1.0
    print("\n" + "=" * 50)
    print(f"Match rate: {matched_count}/{total_real_picks} ({match_rate:.0%})")
    print("=" * 50)

    if unmatched_names:
        print(f"\nUnmatched picks ({len(unmatched_names)}):")
        for name in unmatched_names:
            print(f"  - '{name}' (normalized: '{normalize_name(name)}')")
        print("\nLeaderboard sample (first 20, normalized):")
        for r in leaderboard_results[:20]:
            raw = r.get("player_name", "")
            print(f"  - '{raw}' -> '{normalize_name(raw)}'")

    if total_real_picks > 0 and match_rate < CATASTROPHIC_MATCH_THRESHOLD and not force:
        print("\n" + "!" * 60)
        print(f"CATASTROPHIC MATCH FAILURE: only {match_rate:.0%} of picks matched.")
        print("Refusing to apply updates or mark tournament completed.")
        print("Inspect the diagnostics above, then re-run with --force to override.")
        print("!" * 60)
        return

    if dry_run:
        print("\n[DRY RUN] No changes made to database.")
        print("Run with --apply to update the database.")
        print("Run with --apply --complete to also mark tournament as completed.")
    else:
        print("\nApplying updates to database...")
        for update in updates:
            if not update.get("error"):
                update_pick_winnings(
                    supabase,
                    update["pick_id"],
                    update["winnings"],
                    update.get("penalty", 0),
                    update.get("penalty_reason")
                )
        print("Results updated!")

        # Send push notifications
        try:
            from send_notification import send_to_all
            send_to_all(
                title=f"Results: {tournament['name']}",
                body=f"Week {tournament['week']} results have been posted!",
                url="/",
                tag=f"results-week-{tournament['week']}"
            )
        except Exception as e:
            print(f"  Push notifications skipped: {e}")

        if mark_complete:
            print(f"Marking tournament '{tournament['name']}' as completed...")
            mark_tournament_completed(supabase, tournament["id"])
            print("Tournament marked as completed!")

        print("Done!")


if __name__ == "__main__":
    import sys

    dry_run = "--apply" not in sys.argv
    mark_complete = "--complete" in sys.argv
    force = "--force" in sys.argv

    if dry_run:
        print("Running in DRY RUN mode (no database changes)")
        print("Use --apply flag to actually update the database")
        print("Use --apply --complete to also mark tournament as completed")
        print("Use --force to override the catastrophic-match-rate safety gate\n")

    update_results(dry_run=dry_run, mark_complete=mark_complete, force=force)
