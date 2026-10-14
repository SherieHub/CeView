"""Market lookups shared by the Module 3 content routes and the Module 4 report prompt.

Each table used to be written out separately in the router or service that
needed it. Keep the values here so the copies cannot drift apart.
"""
from __future__ import annotations

# Option names for the three caption variations, in archetype order.
DEMOGRAPHIC_OPTION_NAMES: list[str] = [
    "Witty, Trend-Conscious & High-Energy",   # Archetype 1 — Gen Z / Younger
    "Formal, Educational & Value-Driven",     # Archetype 2 — Mature Planners / Family
    "Storytelling, Immersive & Emotional",    # Archetype 3 — Aspirational / Experiential
]

CONTENT_FRAMEWORK = "SOR — Stimulus-Organism-Response"

DEFAULT_MARKET = "korea"

MARKET_HEADERS: dict[str, dict[str, str]] = {
    "korea": {"country": "South Korea", "flag": "🇰🇷", "city": "Seoul"},
    "japan": {"country": "Japan",       "flag": "🇯🇵", "city": "Osaka"},
    "usa":   {"country": "USA",         "flag": "🇺🇸", "city": "Los Angeles"},
}

MARKET_DISPLAY_NAMES: dict[str, str] = {
    "korea": "South Korea",
    "japan": "Japan",
    "usa":   "USA",
}

# Platform the Module 4 report recommends per market (channel analysis, not
# fabricated output — spec D6). Accepts both full names and ISO-style codes.
REPORT_PLATFORM_BY_MARKET: dict[str, str] = {
    "korea":     "Naver Blog",
    "kr":        "Naver Blog",
    "japan":     "Facebook + Instagram",
    "jp":        "Facebook + Instagram",
    "usa":       "Instagram Reels",
    "us":        "Instagram Reels",
    "australia": "Instagram Reels",
    "global":    "Instagram Reels",
}


def market_header(market: str) -> dict[str, str]:
    """Header for ``market``, defaulting to the Korea header for unknown keys."""
    return MARKET_HEADERS.get(market, MARKET_HEADERS[DEFAULT_MARKET])
