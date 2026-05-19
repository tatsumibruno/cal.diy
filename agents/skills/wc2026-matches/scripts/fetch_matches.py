#!/usr/bin/env python3
"""Fetch FIFA World Cup 2026 fixtures and filter by a team.

Usage:
    python fetch_matches.py --team Brazil --out matches-brazil.json
    python fetch_matches.py --team BRA --out matches-brazil.json
    python fetch_matches.py --team Brazil --source ./wc2026-matches.json --out out.json

The team filter matches against the home/away `name` (case-insensitive substring)
or the 3-letter `code` (exact, case-insensitive). The output is a JSON array in
the same shape as the upstream feed so downstream renderers can consume it
unchanged.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

FIFA_API = (
    "https://api.fifa.com/api/v3/calendar/matches"
    "?idCompetition=17&idSeason=285023&count=500&language=en"
)


def fetch_from_fifa(url: str = FIFA_API) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": "wc2026-matches-skill/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return [normalize(m) for m in payload.get("Results", [])]


def normalize(m: dict) -> dict:
    """Map FIFA's verbose match object to the slim shape used in the repo."""
    home = m.get("Home") or {}
    away = m.get("Away") or {}
    stadium = m.get("Stadium") or {}
    return {
        "matchId": str(m.get("IdMatch") or m.get("matchId") or ""),
        "matchDay": m.get("MatchDay"),
        "stage": (m.get("StageName") or [{}])[0].get("Description") if isinstance(m.get("StageName"), list) else m.get("stage"),
        "group": (m.get("GroupName") or [{}])[0].get("Description") if isinstance(m.get("GroupName"), list) else m.get("group"),
        "dateUtc": m.get("Date") or m.get("dateUtc"),
        "dateLocal": m.get("LocalDate") or m.get("dateLocal"),
        "home": {
            "name": (home.get("TeamName") or [{}])[0].get("Description") if isinstance(home.get("TeamName"), list) else home.get("name"),
            "code": home.get("Abbreviation") or home.get("code"),
            "country": home.get("IdCountry") or home.get("country"),
        },
        "away": {
            "name": (away.get("TeamName") or [{}])[0].get("Description") if isinstance(away.get("TeamName"), list) else away.get("name"),
            "code": away.get("Abbreviation") or away.get("code"),
            "country": away.get("IdCountry") or away.get("country"),
        },
        "venue": {
            "stadium": (stadium.get("Name") or [{}])[0].get("Description") if isinstance(stadium.get("Name"), list) else stadium.get("stadium"),
            "city": (stadium.get("CityName") or [{}])[0].get("Description") if isinstance(stadium.get("CityName"), list) else stadium.get("city"),
            "country": stadium.get("IdCountry") or stadium.get("country"),
        },
    }


def load_local(path: Path) -> list[dict]:
    return json.loads(path.read_text())


def team_matches(match: dict, team: str) -> bool:
    needle = team.strip().lower()
    for side in ("home", "away"):
        info = match.get(side) or {}
        name = (info.get("name") or "").lower()
        code = (info.get("code") or "").lower()
        if needle == code or (needle and needle in name):
            return True
    return False


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--team", required=True, help="Team name or 3-letter code (e.g. Brazil / BRA)")
    p.add_argument("--out", required=True, help="Output JSON path")
    p.add_argument(
        "--source",
        help="Local JSON file to use instead of the FIFA API (useful offline or when the API is rate-limited)",
    )
    p.add_argument("--api", default=FIFA_API, help="Override the FIFA API URL")
    args = p.parse_args()

    if args.source:
        matches = load_local(Path(args.source))
    else:
        try:
            matches = fetch_from_fifa(args.api)
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"FIFA API fetch failed: {e}", file=sys.stderr)
            return 2

    filtered = [m for m in matches if team_matches(m, args.team)]
    filtered.sort(key=lambda m: m.get("dateUtc") or "")

    Path(args.out).write_text(json.dumps(filtered, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(filtered)} matches for '{args.team}' → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
