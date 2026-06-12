#!/usr/bin/env python3
"""
Slash Golf (RapidAPI "Live Golf Data") client + parsers.

This is the data source that replaced ESPN's unofficial leaderboard scrape.
Slash Golf returns structured, versioned JSON, and crucially exposes a stable
per-player ``playerId``. That lets the scoring pipeline match a pick to a
leaderboard entry by ID — an exact join — instead of the old fuzzy
name-matching that needed a "catastrophic match rate" safety gate to survive
ESPN schema drift.

Endpoints used (orgId 1 = PGA Tour):
  GET /schedule    ?orgId&year                 -> season schedule (names, dates, courses, purses, tournIds)
  GET /leaderboard ?orgId&tournId&year         -> per-player position/score/status (no prize money)
  GET /earnings    ?orgId&tournId&year         -> per-player prize money, keyed by playerId

Prize money lives ONLY on /earnings, not /leaderboard, so a full result needs
both calls joined on playerId.

Pure module: depends only on ``requests`` + the standard library, so it can be
unit-tested against fixtures and imported without database or VAPID
credentials. Network access only happens inside the ``fetch_*`` helpers.
"""

import os
import re
import unicodedata

import requests

RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "live-golf-data.p.rapidapi.com")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY") or os.getenv("X_RAPIDAPI_KEY")
# orgId 1 = PGA Tour. Centralized so a future Korn Ferry / DP World expansion
# is a parameter change, not a code change.
DEFAULT_ORG_ID = os.getenv("ORG_ID", "1")


# ---------------------------------------------------------------------------
# MongoDB extended-JSON unwrapping
#
# Slash Golf serializes numbers and dates as Mongo extended JSON, e.g.
#   {"$numberInt": "5"}, {"$numberLong": "1780245840000"},
#   {"$date": {"$numberLong": "..."}}.
# Every scalar we read from a payload goes through unwrap() first.
# ---------------------------------------------------------------------------
def unwrap(value):
    """Return the scalar inside a Mongo extended-JSON wrapper, else ``value``."""
    if isinstance(value, dict):
        for key in ("$numberInt", "$numberLong", "$numberDouble", "$numberDecimal"):
            if key in value:
                return value[key]
        if "$date" in value:
            return unwrap(value["$date"])
    return value


def to_float(value, default=0.0):
    """Coerce an (optionally wrapped) value to float, ``default`` on failure."""
    raw = unwrap(value)
    if raw is None:
        return default
    try:
        return float(str(raw).replace("$", "").replace(",", ""))
    except (TypeError, ValueError):
        return default


def to_int(value, default=None):
    """Coerce an (optionally wrapped) value to int, ``default`` on failure."""
    raw = unwrap(value)
    if raw is None:
        return default
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return default


def to_epoch_ms(value):
    """Best-effort epoch-millis from a Slash Golf date field, across the
    formats it has used (extended-JSON long, ISO string, int)."""
    raw = unwrap(value)
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        pass
    try:
        from datetime import datetime
        return int(datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Name normalization (shared with schedule-sync name mapping)
#
# Kept from the ESPN era because mapping our existing DB tournaments onto API
# events — and a defensive name fallback for picks made before golfer_id
# existed — both still rely on it. The fragile *fuzzy* matcher is gone; this
# is deterministic normalization only.
# ---------------------------------------------------------------------------
_NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
_PUNCT_TO_SPACE = re.compile(r"[\.\,\'\"\`‘’“”\-–—]")


def normalize_name(name):
    """Normalize a personal/tournament name for robust comparison:
    strip accents, lowercase, punctuation -> space, collapse whitespace,
    drop trailing name suffixes (jr/sr/ii/...)."""
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFD", name)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    despaced = _PUNCT_TO_SPACE.sub(" ", stripped.lower())
    tokens = despaced.split()
    while tokens and tokens[-1] in _NAME_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


_GENERIC_TOURNAMENT_WORDS = {
    "open", "classic", "championship", "championships", "invitational",
    "challenge", "cup", "tournament", "national", "golf", "pga", "tour",
}


def tournament_names_match(name_a, name_b):
    """Whether two tournament names refer to the same event. Used by the
    schedule sync to map a DB tournament onto its Slash Golf schedule row.

      1. Exact normalized match.
      2. Substring either direction (sponsor prefixes).
      3. A shared significant token (>3 chars) that is NOT a generic
         golf-event word ("byron"/"pebble" count; "classic"/"open" don't).
    """
    a, b = normalize_name(name_a), normalize_name(name_b)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    common = {w for w in (set(a.split()) & set(b.split())) if len(w) > 3}
    return bool(common - _GENERIC_TOURNAMENT_WORDS)


# ---------------------------------------------------------------------------
# Leaderboard parsing
# ---------------------------------------------------------------------------
# Slash Golf per-row ``status`` -> the four-state vocabulary the scoring
# pipeline and penalty logic expect.
_STATUS_MAP = {
    "complete": "active",
    "active": "active",
    "cut": "cut",
    "wd": "withdrawn",
    "withdrawn": "withdrawn",
    "dq": "disqualified",
    "disqualified": "disqualified",
}

# Positions that mean a player earns no money even if a stale value appears.
_INACTIVE_POSITIONS = {"CUT", "WD", "DQ", "MDF"}
_INACTIVE_STATUSES = {"cut", "withdrawn", "disqualified"}


def _player_status(raw_status, position):
    """Map a Slash Golf row's status (with position as a fallback signal)
    onto active/cut/withdrawn/disqualified."""
    status = str(unwrap(raw_status) or "").strip().lower()
    if status in _STATUS_MAP:
        return _STATUS_MAP[status]
    pos = str(position or "").strip().upper()
    if pos in ("CUT", "MDF"):
        return "cut"
    if pos == "WD":
        return "withdrawn"
    if pos == "DQ":
        return "disqualified"
    return "active"


def _full_name(row):
    first = str(row.get("firstName", "") or "").strip()
    last = str(row.get("lastName", "") or "").strip()
    return (first + " " + last).strip()


def is_event_official(leaderboard_json):
    """A finished, final leaderboard reports top-level status 'Official'
    (roundStatus echoes it). Anything else — 'In Progress', 'Suspended',
    'Open', or absent — means results aren't final."""
    status = str(unwrap(leaderboard_json.get("status")) or "").strip().lower()
    round_status = str(leaderboard_json.get("roundStatus") or "").strip().lower()
    return status == "official" or round_status == "official"


def earnings_by_player(earnings_json):
    """Build {playerId: prize_money_float} from a /earnings payload."""
    out = {}
    for row in (earnings_json or {}).get("leaderboard", []) or []:
        pid = str(unwrap(row.get("playerId")) or "").strip()
        if pid:
            out[pid] = to_float(row.get("earnings"))
    return out


def parse_leaderboard(leaderboard_json, earnings_json=None, tournament_name=None):
    """Combine a /leaderboard payload (and optional /earnings) into the shape
    the scoring pipeline consumes.

    The leaderboard does not carry the event name, so ``tournament_name`` is
    passed through from the caller (our schedule is the source of truth).

    Returns::

        {
          "tournament_name": str | None,
          "players": [
            {"player_id": str, "player_name": str, "position": str,
             "score": str, "winnings": float,
             "status": "active"|"cut"|"withdrawn"|"disqualified"},
            ...
          ],
          "event_completed": bool,     # status == "Official"
          "event_status": str,         # raw top-level status
          "winner_player_id": str | None,
          "winner_name": str | None,
        }
    """
    rows = leaderboard_json.get("leaderboardRows") or []
    earnings = earnings_by_player(earnings_json) if earnings_json else {}

    players = []
    winner_name = None
    winner_player_id = None
    for row in rows:
        player_id = str(unwrap(row.get("playerId")) or "").strip()
        name = _full_name(row)
        if not player_id and not name:
            continue
        position = str(row.get("position", "") or "").strip()
        score = str(row.get("total", "") or "").strip()
        status = _player_status(row.get("status"), position)

        # Inactive players earn nothing, regardless of a stray earnings value.
        if position.upper() in _INACTIVE_POSITIONS or status in _INACTIVE_STATUSES:
            winnings = 0.0
        else:
            winnings = earnings.get(player_id, 0.0)

        # The outright leader (position "1", not "T1") is the tournament winner.
        if position == "1" and status == "active" and winner_name is None:
            winner_name = name
            winner_player_id = player_id

        players.append({
            "player_id": player_id,
            "player_name": name,
            "position": position,
            "score": score,
            "winnings": winnings,
            "status": status,
        })

    return {
        "tournament_name": tournament_name,
        "players": players,
        "event_completed": is_event_official(leaderboard_json),
        "event_status": str(unwrap(leaderboard_json.get("status")) or "").strip(),
        "winner_player_id": winner_player_id,
        "winner_name": winner_name,
    }


# ---------------------------------------------------------------------------
# Live leaderboard parsing
#
# The same /leaderboard endpoint the Monday scorer uses, but read mid-event to
# drive the app's live board. Crucially this needs NO /earnings call — prize
# money only finalizes after the event — so a live refresh is a single request.
# ---------------------------------------------------------------------------
def _cut_line(leaderboard_json):
    """The projected/actual cut score (e.g. '-2') from a leaderboard payload."""
    cut_lines = leaderboard_json.get("cutLines") or []
    if cut_lines:
        score = str(cut_lines[0].get("cutScore", "") or "").strip()
        return score or None
    return None


def _row_thru(row):
    """Holes played in the current round ('F' when finished), if the payload
    carries it. Field name has varied, so a couple of candidates are tried.
    'F*' (finished after a back-nine start) is folded into 'F' — the app
    doesn't care which tee a finished round began on."""
    raw = unwrap(row.get("thru"))
    if raw is None:
        raw = unwrap(row.get("holesPlayed"))
    if raw is None:
        return None
    value = str(raw).strip()
    if value.upper() == "F*":
        return "F"
    return value or None


def parse_live_leaderboard(leaderboard_json, tournament_name=None):
    """Parse an in-progress (or just-finished) leaderboard into the compact
    shape the app's live board reads.

    Returns::

        {
          "tournament_name": str | None,
          "players": [{"player_id", "player_name", "position", "score",
                       "status", "thru", "round"}],
          "cut_line": str | None,
          "event_status": str,      # raw top-level status ('In Progress'...)
          "round_status": str,
          "event_completed": bool,  # status == 'Official'
          "updated_ms": int | None, # payload's own last-updated stamp, if any
        }

    Positions/scores are kept as the strings Slash Golf returns ('T4', '-7',
    'E', 'CUT'); the app renders them verbatim. No earnings are joined here.
    """
    players = []
    for row in leaderboard_json.get("leaderboardRows") or []:
        player_id = str(unwrap(row.get("playerId")) or "").strip()
        name = _full_name(row)
        if not player_id and not name:
            continue
        position = str(row.get("position", "") or "").strip()
        players.append({
            "player_id": player_id,
            "player_name": name,
            "position": position,
            "score": str(row.get("total", "") or "").strip(),
            "status": _player_status(row.get("status"), position),
            "thru": _row_thru(row),
            "round": to_int(row.get("currentRound") or row.get("round")),
        })

    return {
        "tournament_name": tournament_name,
        "players": players,
        "cut_line": _cut_line(leaderboard_json),
        "event_status": str(unwrap(leaderboard_json.get("status")) or "").strip(),
        "round_status": str(unwrap(leaderboard_json.get("roundStatus")) or "").strip(),
        "event_completed": is_event_official(leaderboard_json),
        "updated_ms": to_epoch_ms(leaderboard_json.get("lastUpdated")),
    }


# ---------------------------------------------------------------------------
# Schedule parsing
# ---------------------------------------------------------------------------
def parse_schedule(schedule_json):
    """Normalize a /schedule payload into a list of plain dicts::

        {"tourn_id", "name", "week_number", "start_ms", "end_ms",
         "purse", "winners_share", "course", "location", "format"}

    ``week_number`` is the PGA calendar week (date.weekNumber), distinct from a
    league's own sequential ``week``. Field paths are read defensively;
    anything missing comes back as None/0. Note Slash Golf's /schedule does not
    carry course/location — those stay None (a /tournament detail call would be
    needed, which the sync deliberately avoids to conserve the rate budget).
    """
    rows = schedule_json.get("schedule") or schedule_json.get("tournaments") or []
    events = []
    for ev in rows:
        date = ev.get("date") or {}
        events.append({
            "tourn_id": str(unwrap(ev.get("tournId") or ev.get("id")) or "").strip(),
            "name": str(ev.get("name", "") or "").strip(),
            "week_number": to_int(date.get("weekNumber") or ev.get("weekNumber")),
            "start_ms": to_epoch_ms(date.get("start") or ev.get("date")),
            "end_ms": to_epoch_ms(date.get("end") or date.get("start") or ev.get("date")),
            "purse": to_float(ev.get("purse")),
            "winners_share": to_float(ev.get("winnersShare")),
            "course": str(ev.get("courseName") or ev.get("course") or "").strip() or None,
            "location": str(ev.get("location") or "").strip() or None,
            "format": str(ev.get("format") or "").strip() or None,
        })
    return events


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------
def _headers():
    if not RAPIDAPI_KEY:
        raise RuntimeError(
            "RAPIDAPI_KEY (or X_RAPIDAPI_KEY) must be set to call Slash Golf. "
            "Add it to scripts/.env locally or as a GitHub Actions secret."
        )
    return {"x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST}


def _get(path, params):
    """GET a Slash Golf endpoint, raising informative errors that distinguish
    a sandbox egress block from a real RapidAPI rejection or a rate limit."""
    url = f"https://{RAPIDAPI_HOST}{path}"
    resp = requests.get(url, headers=_headers(), params=params, timeout=30)
    # A managed environment's network proxy returns a plain "Host not in
    # allowlist" 403 before the request leaves the container; the key is
    # never tested in that case.
    if "allowlist" in resp.text.lower():
        raise RuntimeError(
            f"Slash Golf call to {RAPIDAPI_HOST} was blocked by this "
            f"environment's network allowlist (status {resp.status_code}); the "
            "API key was never tested. Allow *.p.rapidapi.com or run locally."
        )
    if resp.status_code in (401, 403):
        raise RuntimeError(
            f"Slash Golf returned {resp.status_code}: key missing/invalid or "
            f"not subscribed to Live Golf Data. Body: {resp.text[:200]}"
        )
    if resp.status_code == 429:
        raise RuntimeError("Slash Golf rate-limited (429). Free tier is 20 req/day.")
    resp.raise_for_status()
    return resp.json()


def fetch_schedule(year, org_id=DEFAULT_ORG_ID):
    return _get("/schedule", {"orgId": org_id, "year": year})


def fetch_leaderboard(tourn_id, year, org_id=DEFAULT_ORG_ID):
    return _get("/leaderboard", {"orgId": org_id, "tournId": tourn_id, "year": year})


def fetch_earnings(tourn_id, year, org_id=DEFAULT_ORG_ID):
    return _get("/earnings", {"orgId": org_id, "tournId": tourn_id, "year": year})


def get_tournament_results(tourn_id, year, org_id=DEFAULT_ORG_ID, tournament_name=None):
    """High-level: fetch leaderboard + earnings for an event and return the
    parsed scoring shape. Two API calls (leaderboard, earnings)."""
    leaderboard = fetch_leaderboard(tourn_id, year, org_id)
    earnings = fetch_earnings(tourn_id, year, org_id)
    return parse_leaderboard(leaderboard, earnings, tournament_name=tournament_name)


def get_live_leaderboard(tourn_id, year, org_id=DEFAULT_ORG_ID, tournament_name=None):
    """High-level: fetch ONLY the leaderboard for an event and return the live
    parsed shape. One API call (no earnings) — for the in-event live board."""
    leaderboard = fetch_leaderboard(tourn_id, year, org_id)
    return parse_live_leaderboard(leaderboard, tournament_name=tournament_name)


def fetch_field(tourn_id, year, org_id=DEFAULT_ORG_ID):
    """The tournament field/entry list. Slash Golf surfaces entrants through the
    leaderboard endpoint once tee times are posted (typically Tue/Wed); before
    that the rows are empty. Returns the parsed live shape; callers treat an
    empty player list as 'field not confirmed yet'."""
    leaderboard = fetch_leaderboard(tourn_id, year, org_id)
    return parse_live_leaderboard(leaderboard)
