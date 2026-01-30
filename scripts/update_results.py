#!/usr/bin/env python3
"""
Golf League Results Updater

Scrapes ESPN PGA leaderboard, uses Gemini to parse it, and updates Supabase.
Processes picks across all leagues, applying each league's own penalty settings.
"""

import os
import json
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

    print("Parsing with Gemini...")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3-flash-preview")

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
    max_retries = 3
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
                wait_time = 30 * (attempt + 1)  # 30s, 60s, 90s
                print(f"Rate limited. Waiting {wait_time}s before retry {attempt + 2}/{max_retries}...")
                time.sleep(wait_time)
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
        return {"tournament_name": tournament_name, "players": players}
    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response: {e}")
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
    """
    # Get all tournaments
    response = supabase.table("tournaments").select("*").order("week", desc=True).execute()

    if not response.data:
        return None

    espn_name_lower = espn_tournament_name.lower().strip()

    # Try exact match first
    for tournament in response.data:
        db_name_lower = tournament.get("name", "").lower().strip()
        if espn_name_lower == db_name_lower:
            return tournament

    # Try partial match (ESPN name contains DB name or vice versa)
    for tournament in response.data:
        db_name_lower = tournament.get("name", "").lower().strip()
        if espn_name_lower in db_name_lower or db_name_lower in espn_name_lower:
            return tournament

    # Try matching key words
    espn_words = set(espn_name_lower.split())
    for tournament in response.data:
        db_name_lower = tournament.get("name", "").lower().strip()
        db_words = set(db_name_lower.split())
        # If they share at least 2 significant words, consider it a match
        common_words = espn_words & db_words
        # Filter out common words like "the", "open", etc.
        significant_common = [w for w in common_words if len(w) > 3]
        if len(significant_common) >= 1:
            return tournament

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


def match_golfer_name(pick_name: str, leaderboard_results: list[dict]) -> dict | None:
    """Find a golfer in the leaderboard results by name matching."""
    pick_name_lower = pick_name.lower().strip()

    for result in leaderboard_results:
        result_name_lower = result["player_name"].lower().strip()

        # Exact match
        if pick_name_lower == result_name_lower:
            return result

        # Partial match (last name)
        pick_parts = pick_name_lower.split()
        result_parts = result_name_lower.split()

        if pick_parts and result_parts:
            # Match on last name
            if pick_parts[-1] == result_parts[-1]:
                return result

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


def update_results(dry_run: bool = True, mark_complete: bool = False):
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

    print(f"\nESPN Tournament: {espn_tournament_name}")

    # Find matching tournament in database by name
    tournament = find_tournament_by_name(supabase, espn_tournament_name)

    if not tournament:
        print(f"Could not find tournament '{espn_tournament_name}' in database!")
        print("Please make sure the tournament name in your database matches ESPN.")
        return

    print(f"Matched to: {tournament['name']} (Week {tournament['week']})")

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

            result = match_golfer_name(golfer_name, leaderboard_results)

            if result:
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

    if dry_run:
        print("Running in DRY RUN mode (no database changes)")
        print("Use --apply flag to actually update the database")
        print("Use --apply --complete to also mark tournament as completed\n")

    update_results(dry_run=dry_run, mark_complete=mark_complete)
