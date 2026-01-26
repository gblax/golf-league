#!/usr/bin/env python3
"""
Golf League Results Updater

Scrapes ESPN PGA leaderboard, uses Gemini to parse it, and updates Supabase.
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


def parse_with_gemini(raw_text: str) -> list[dict]:
    """Use Gemini to parse the raw leaderboard text into structured JSON."""
    print("Parsing with Gemini...")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = f"""Parse this ESPN golf leaderboard text and extract player results as JSON.

Return a JSON array of objects with these fields:
- player_name: string (golfer's full name)
- position: string (e.g., "1", "T2", "CUT", "WD")
- score: string (e.g., "-12", "E", "+3")
- winnings: number (prize money in dollars, 0 if not listed or if they missed cut)
- status: string ("active", "cut", "withdrawn", "disqualified")

Only include players who have results (position/score).
Return ONLY the JSON array, no markdown or explanation.

Leaderboard text:
{raw_text[:15000]}
"""

    response = model.generate_content(prompt)
    response_text = response.text.strip()

    # Clean up response if it has markdown code blocks
    if response_text.startswith("```"):
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]
        response_text = response_text.strip()

    try:
        results = json.loads(response_text)
        print(f"Parsed {len(results)} players from leaderboard")
        return results
    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response: {e}")
        print(f"Response was: {response_text[:500]}")
        raise


def get_supabase_client() -> Client:
    """Create and return Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_tournament_to_update(supabase: Client) -> dict:
    """
    Get the tournament that needs results updated.

    Logic: Find the most recent tournament that:
    1. Has ended (tournament_date + 3 days has passed)
    2. Is not yet marked as completed

    This handles the Monday morning scenario where we want to update
    results for the tournament that just finished over the weekend.
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
    # (this handles the case where script runs mid-tournament)
    return response.data[-1] if response.data else None


def get_picks_for_tournament(supabase: Client, tournament_id: str) -> list[dict]:
    """Get all picks for the current tournament."""
    response = supabase.table("picks").select("*, users(name)").eq("tournament_id", tournament_id).execute()
    return response.data or []


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


def calculate_penalty(status: str, position: str) -> tuple[int, str]:
    """Calculate penalty based on golfer status."""
    if status == "cut" or position == "CUT":
        return 10, "missed_cut"
    elif status == "withdrawn" or position == "WD":
        return 10, "withdrawal"
    elif status == "disqualified" or position == "DQ":
        return 10, "disqualification"
    return 0, None


def update_results(dry_run: bool = True, mark_complete: bool = False):
    """Main function to update tournament results."""
    print("=" * 50)
    print("Golf League Results Updater")
    print("=" * 50)

    # Initialize
    supabase = get_supabase_client()

    # Get tournament to update (most recent ended but not completed)
    tournament = get_tournament_to_update(supabase)
    if not tournament:
        print("No active tournament found!")
        return

    print(f"\nTournament: {tournament['name']} (Week {tournament['week']})")

    # Scrape and parse leaderboard
    raw_text = scrape_espn_leaderboard()
    leaderboard_results = parse_with_gemini(raw_text)

    # Get picks for this tournament
    picks = get_picks_for_tournament(supabase, tournament["id"])
    print(f"\nFound {len(picks)} picks for this tournament")

    # Match picks to results and update
    print("\n" + "-" * 50)
    print("Matching picks to leaderboard results:")
    print("-" * 50)

    updates = []

    for pick in picks:
        golfer_name = pick.get("golfer_name")
        user_name = pick.get("users", {}).get("name", "Unknown User")

        if not golfer_name:
            print(f"  {user_name}: No pick submitted")
            updates.append({
                "pick_id": pick["id"],
                "user": user_name,
                "golfer": None,
                "winnings": 0,
                "penalty": 10,
                "penalty_reason": "no_pick"
            })
            continue

        result = match_golfer_name(golfer_name, leaderboard_results)

        if result:
            winnings = result.get("winnings", 0) or 0
            penalty, penalty_reason = calculate_penalty(result.get("status", ""), result.get("position", ""))

            print(f"  {user_name}: {golfer_name} -> {result['position']} ({result['score']}) = ${winnings:,}")
            if penalty > 0:
                print(f"    ^ Penalty: ${penalty} ({penalty_reason})")

            updates.append({
                "pick_id": pick["id"],
                "user": user_name,
                "golfer": golfer_name,
                "position": result["position"],
                "score": result["score"],
                "winnings": winnings,
                "penalty": penalty,
                "penalty_reason": penalty_reason
            })
        else:
            print(f"  {user_name}: {golfer_name} -> NOT FOUND on leaderboard")
            updates.append({
                "pick_id": pick["id"],
                "user": user_name,
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
