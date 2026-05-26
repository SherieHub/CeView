"""SerpAPI cultural and tourism trend research for Module 3.1 (FR3.3).

Follows the same singleton + fallback pattern as pytrends_client.py:
  - attempt to import serpapi at module load
  - if unavailable or SERPAPI_KEY missing, all calls return curated static templates
  - templates are market-specific and cover all UC-3.1 step 6 data points:
      traveler_behavior, tourism_preferences, platform_styles, language_nuances
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from app.errors import MOD31_SERP_UNAVAILABLE

logger = logging.getLogger(__name__)

_SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
_serpapi = None

try:
    if _SERPAPI_KEY:
        from serpapi import GoogleSearch  # type: ignore[import]
        _serpapi = GoogleSearch
        logger.info("SerpAPI loaded successfully")
    else:
        logger.info("SERPAPI_KEY not set — using curated cultural templates")
except Exception as exc:
    logger.warning(
        "SerpAPI unavailable — using curated cultural templates",
        extra={"code": MOD31_SERP_UNAVAILABLE, "detail": str(exc)},
    )

# ─── Curated fallback research templates per market ──────────────────────────
# Covers UC-3.1 step 6: traveler behavior, preferences, platform styles,
# language nuances.  Written from Cebu inbound tourism perspective.

_MARKET_TEMPLATES: dict[str, dict] = {
    "korea": {
        "traveler_behavior": (
            "Korean travelers prioritise solo 'healing travel' (힐링여행) and prefer "
            "quiet, uncrowded destinations that offer a break from high-pressure "
            "urban life. They research extensively on Naver Blog and Instagram "
            "before booking, and heavily rely on peer reviews."
        ),
        "tourism_preferences": (
            "Top preferences: private beach access, wellness/spa, local food "
            "experiences, and instagrammable aesthetics. Cultural immersion and "
            "nature-based activities rank higher than nightlife. Clean, minimal "
            "resort settings align with the Korean 'healing' archetype."
        ),
        "platform_styles": (
            "Naver Blog: long-form photo journals with detailed day-by-day itineraries "
            "and embedded maps. Instagram: 4:5 portrait ratio, warm golden filters, "
            "minimal text overlays. TikTok: POV healing travel videos, slow-motion "
            "nature reveals, ambient sound + lo-fi music. Korean subtitle overlays "
            "improve retention on all short-form platforms."
        ),
        "language_nuances": (
            "Effective Korean trigger phrases: 힐링 (healing), 휴식 (rest), 나만의 공간 "
            "(my own space), 소확행 (small but certain happiness). Avoid aggressive "
            "sales language — understated, mood-driven copy outperforms. Formal "
            "politeness (존댓말) expected for brand communications."
        ),
        "primary_platform": "Naver Blog",
        "secondary_platforms": ["Instagram", "TikTok"],
    },
    "japan": {
        "traveler_behavior": (
            "Japanese travelers value meticulous trip planning, safety, cleanliness, "
            "and punctuality. Group and couple travel are common. They respond to "
            "detailed, trustworthy information and prefer brands that demonstrate "
            "cultural respect. Price-quality ratio matters greatly."
        ),
        "tourism_preferences": (
            "Top preferences: nature scenery, cultural experiences, local cuisine, "
            "onsen-style relaxation, and photography spots. Cebu's ocean and island "
            "scenery maps well to the Japanese 'non-daily life' (非日常) travel "
            "motivation. Water activities and resort relaxation perform strongly."
        ),
        "platform_styles": (
            "Facebook: longer posts with multiple photos are standard for Japanese "
            "community groups and brand pages. Instagram: clean, high-quality food "
            "and scenery photography. TikTok growing but Facebook + Instagram remain "
            "primary. Japanese audiences appreciate minimal text with strong imagery."
        ),
        "language_nuances": (
            "Effective Japanese trigger phrases: 絶景 (breathtaking scenery), "
            "非日常 (extraordinary/non-daily), 癒し (healing/soothing), "
            "映え (photogenic/Instagrammable), ゆっくり (at a relaxed pace). "
            "Formal, polite tone (です・ます) expected. Avoid hyperbole — "
            "understated elegance builds trust."
        ),
        "primary_platform": "Facebook",
        "secondary_platforms": ["Instagram", "TikTok"],
    },
    "usa": {
        "traveler_behavior": (
            "US travelers are experience-driven and value authenticity, adventure, "
            "and unique local encounters. They discover destinations via Instagram "
            "Reels and TikTok, are comfortable with aspirational/FOMO-driven "
            "messaging, and respond to clear value propositions and reviews."
        ),
        "tourism_preferences": (
            "Top preferences: adventure activities (diving, island-hopping), "
            "authentic cultural immersion, nightlife, and instagrammable scenery. "
            "Value-for-money is important — emphasising the affordability of "
            "Philippine luxury versus US equivalents is an effective angle."
        ),
        "platform_styles": (
            "Instagram Reels: vertical 9:16, fast cuts, trending audio, strong "
            "hook in first 2 seconds. TikTok: authentic, slightly raw feel — "
            "avoid overly polished content. Facebook: used for trip planning groups "
            "and family travel. Hashtag strategy critical for Reels discoverability."
        ),
        "language_nuances": (
            "Effective US trigger phrases: 'hidden gem', 'off the beaten path', "
            "'bucket list', 'you need to see this'. Direct, punchy copy with "
            "strong CTAs ('Book now', 'Link in bio'). Casual, conversational tone. "
            "English — informal American style. FOMO framing and social proof "
            "(review counts, guest photos) are high converters."
        ),
        "primary_platform": "Instagram Reels",
        "secondary_platforms": ["TikTok", "Facebook"],
    },
}


def research_market(market: str) -> dict:
    """Return cultural and tourism trend context for a target market (FR3.3).

    Attempts a live SerpAPI search when credentials are available.
    Falls back to curated market templates on any failure.

    Returns:
        {
            traveler_behavior: str,
            tourism_preferences: str,
            platform_styles: str,
            language_nuances: str,
            primary_platform: str,
            secondary_platforms: list[str],
            source: "serpapi" | "template",
            researched_at: str,
        }
    """
    template = _MARKET_TEMPLATES.get(market, _MARKET_TEMPLATES["korea"])

    if _serpapi is None or not _SERPAPI_KEY:
        return {**template, "source": "template", "researched_at": _now()}

    try:
        query = f"Cebu Philippines tourism {market} travelers 2024 trends preferences"
        results = _serpapi({"q": query, "api_key": _SERPAPI_KEY, "num": 5}).get_dict()
        snippets = [
            r.get("snippet", "")
            for r in results.get("organic_results", [])[:5]
            if r.get("snippet")
        ]
        live_context = " ".join(snippets)

        if not live_context.strip():
            return {**template, "source": "template", "researched_at": _now()}

        # Merge live snippets into the traveler_behavior field for prompt enrichment
        enriched = {
            **template,
            "traveler_behavior": live_context[:800],  # cap at 800 chars for prompt safety
            "source": "serpapi",
            "researched_at": _now(),
        }
        logger.info("SerpAPI research ok for market=%s snippets=%d", market, len(snippets))
        return enriched

    except Exception as exc:
        logger.warning(
            "SerpAPI research failed for market=%s — using template: %s",
            market, exc,
            extra={"code": MOD31_SERP_UNAVAILABLE},
        )
        return {**template, "source": "template", "researched_at": _now()}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
