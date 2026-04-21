#!/usr/bin/env python3
"""
Golf League Results Updater

Scrapes ESPN PGA leaderboard, uses Gemini to parse it, and updates Supabase.
Processes picks across all leagues, applying each league's own penalty settings.
"""

import os
import json
import re
import unicodedata
from difflib import SequenceMatcher

import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

ESPN_LEADERBOARD_URL = "https://www.espn.com/golf/leaderboard"
GEMINI_MODEL = "gemini-2.0-flash"

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


def scrape_espn_leaderboard() -> str:
    """Scrape the ESPN golf leaderboard page and return raw text."""
    print("Scraping ESPN leaderboard...")

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    response = requests.get(ESPN_LEADERBOARD_URL, headers=headers)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header"]):
        element.decompose()

    # Get text content
    text = soup.get_text(separator="\n", strip=True)

    # Clean up excessive whitespace
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    cleaned_text = "\n".join(lines)

    print(f"Scraped {len(cleaned_text)} characters of text")
    return cleaned_text


def parse_with_gemini(raw_text: str) -> dict:
    """Use Gemini to parse the raw leaderboard text into structured JSON."""
    import time

    print(f"Parsing with Gemini (model: {GEMINI_MODEL})...")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    prompt = f"""Parse this ESPN golf leaderboard text and extract tournament info and player results as JSON.

Return a JSON object with these fields:
- tournament_name: string (the name of the tournament, e.g., "The American Express", "Farmers Insurance Open")
- players: array of objects with:
  - player_name: string (golfer's full name)
  - position: string (e.g., "1", "T2", "CUT", "WD")
  - score: string (e.g., "-12", "E", "+3")
  - winnings: number (prize money in dollars, 0 if not listed or if they missed cut)
  - status: string ("active", "cut", "withdrawn", "disqualified")

Only include players who have results (position/score).
Return ONLY the JSON object, no markdown or explanation.

Leaderboard text:
{raw_text[:15000]}
"""

    # Retry with exponential backoff for rate limits
    max_retries = 5
    response_text = None

    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)

            # Check if response has valid content
            if not response.candidates:
                print(f"No candidates in response. Retrying...")
                time.sleep(10)
                continue

            candidate = response.candidates[0]
            if candidate.finish_reason != 1:  # 1 = STOP (normal)
                print(f"Response blocked or incomplete. Finish reason: {candidate.finish_reason}")
                if hasattr(candidate, 'safety_ratings'):
                    print(f"Safety ratings: {candidate.safety_ratings}")
                time.sleep(10)
                continue

            # Try to get text from parts
            if candidate.content and candidate.content.parts:
                response_text = candidate.content.parts[0].text.strip()
                break
            else:
                print("No content parts in response. Retrying...")
                time.sleep(10)
                continue

        except Exception as e:
            if "429" in str(e) or "ResourceExhausted" in str(e):
                # Exponential backoff: 60s, 120s, 240s, 480s, 900s
                wait_times = [60, 120, 240, 480, 900]
                wait_time = wait_times[attempt]
                if attempt < max_retries - 1:
                    print(f"Rate limited (429 ResourceExhausted). Waiting {wait_time}s before retry {attempt + 2}/{max_retries}...")
                    time.sleep(wait_time)
                else:
                    print(f"Rate limited after {max_retries} attempts (waited {sum(wait_times[:attempt])}s total). Giving up.")
            elif "response.text" in str(e) or "Invalid operation" in str(e):
                print(f"Empty response from Gemini. Retrying in 10s...")
                time.sleep(10)
            else:
                raise

            if attempt == max_retries - 1:
                raise

    if not response_text:
        raise ValueError("Failed to get valid response from Gemini after retries")

    # Clean up response if it has markdown code blocks
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
        response_text = response_text.strip()

    try:
        result = json.loads(response_text)
        tournament_name = result.get("tournament_name", "Unknown")
        players = result.get("players", [])
        print(f"Tournament: {tournament_name}")
        print(f"Parsed {len(players)} players from leaderboard")
        if not players:
            raise ValueError(
                f"Gemini returned 0 players for tournament '{tournament_name}'. "
                f"This usually means the ESPN page layout changed or the model "
                f"returned a malformed response. Raw response (truncated): "
                f"{response_text[:500]}"
            )
        return {"tournament_name": tournament_name, "players": players}
    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response: {e}")
        print(f"Scraped text length: {len(raw_text)} chars")
        print(f"Scraped text (first 300 chars): {raw_text[:300]}")
        print(f"Response was: {response_text[:500]}")
        raise


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def find_tournament_by_name(supabase: Client, espn_tournament_name: str) -> dict:
    """
    Find a tournament in the database by matching the ESPN tournament name.
    Tournaments are shared across all leagues.
    Uses normalize_name() for accent/punctuation-insensitive comparison.
    """
    response = supabase.table("tournaments").select("*").order("week", desc=True).execute()

    if not response.data:
        return None

    espn_norm = normalize_name(espn_tournament_name)
    espn_tokens = set(espn_norm.split())

    # Normalize each tournament once; reused across all tiers.
    candidates = [
        (normalize_name(t.get("name", "")), t)
        for t in response.data
    ]

    # Tier 1: exact normalized match.
    for db_norm, t in candidates:
        if db_norm and db_norm == espn_norm:
            print(f"  [tournament] exact normalized match: '{t.get('name')}'")
            return t

    # Tier 2: substring match in either direction.
    for db_norm, t in candidates:
        if db_norm and (espn_norm in db_norm or db_norm in espn_norm):
            print(f"  [tournament] substring match: '{t.get('name')}'")
            return t

    # Tier 3: significant-token intersection (>3 chars excludes "the", "open", etc.).
    for db_norm, t in candidates:
        significant_common = [w for w in (espn_tokens & set(db_norm.split())) if len(w) > 3]
        if significant_common:
            print(f"  [tournament] keyword match on {significant_common}: '{t.get('name')}'")
            return t

    return None


def get_tournament_to_update(supabase: Client) -> dict:
    """
    Get the tournament that needs results updated.
    Tournaments are shared across all leagues.
    """
    from datetime import datetime, timedelta

    # Get all incomplete tournaments
    response = supabase.table("tournaments").select("*").eq("completed", False).order("week", desc=True).execute()

    if not response.data:
        # Fallback: get the most recent tournament overall
        response = supabase.table("tournaments").select("*").order("week", desc=True).limit(1).execute()
        return response.data[0] if response.data else None

    now = datetime.now()

    # Find the most recent tournament that has ended
    for tournament in response.data:
        if tournament.get("tournament_date"):
            # Tournament ends Sunday night (start date + 3 days)
            tournament_date = datetime.fromisoformat(tournament["tournament_date"].replace("Z", "+00:00"))
            tournament_end = tournament_date + timedelta(days=3, hours=23, minutes=59)

            # Remove timezone info for comparison if needed
            if tournament_end.tzinfo:
                tournament_end = tournament_end.replace(tzinfo=None)

            # If tournament has ended, this is the one we want to update
            if now > tournament_end:
                return tournament

    # If no ended tournament found, return the earliest incomplete one
    return response.data[-1] if response.data else None


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

    # Scrape and parse leaderboard FIRST to get tournament name
    raw_text = scrape_espn_leaderboard()
    parsed_data = parse_with_gemini(raw_text)

    espn_tournament_name = parsed_data["tournament_name"]
    leaderboard_results = parsed_data["players"]

    print(f"\n[tournament] ESPN raw name:  '{espn_tournament_name}'")
    print(f"[tournament] ESPN normalized: '{normalize_name(espn_tournament_name)}'")

    # Find matching tournament in database by name
    tournament = find_tournament_by_name(supabase, espn_tournament_name)

    if not tournament:
        print(f"\nCould not find tournament '{espn_tournament_name}' in database!")
        print("Please make sure the tournament name in your database matches ESPN.")
        # Dump DB tournament names (normalized) to aid diagnosis.
        try:
            all_tournaments = supabase.table("tournaments").select("name,week").order("week", desc=True).limit(10).execute()
            print("Recent DB tournaments (normalized):")
            for t in (all_tournaments.data or []):
                print(f"  - week {t.get('week')}: '{t.get('name')}' -> '{normalize_name(t.get('name', ''))}'")
        except Exception as exc:
            print(f"  (failed to list tournaments: {exc})")
        return

    print(f"[tournament] DB name:         '{tournament['name']}' (Week {tournament['week']})")
    print(f"[tournament] DB normalized:   '{normalize_name(tournament['name'])}'")

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
