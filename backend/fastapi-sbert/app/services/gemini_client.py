"""
Server-side AI wrapper (Gemini). Mirrors the five prompts currently in the
frontend's `ceview/services/geminiService.ts` so swapping the frontend over
later changes only the transport, not the behavior.

When GEMINI is missing, every function returns a deterministic
fallback. Module-3 functions tag the returned dict with a `source` field
("gemini" | "fallback") so the UI can label demo data.
"""

from __future__ import annotations

import json
import logging
import os

from app import errors

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")

_client = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _client = genai.GenerativeModel("gemini-1.5-flash")
    except Exception as e:
        logging.getLogger("gemini_client").warning("Failed to initialize Gemini client: %s", e)
        _client = None


def _enabled() -> bool:
    return _client is not None


def _generate_json(prompt: str, schema: dict | None = None) -> dict:
    if not _enabled():
        return {}
    try:
        resp = _client.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(resp.text or "{}")
    except Exception as exc:
        logging.getLogger("gemini_client").warning("Gemini API call failed: %s", exc)
        return {}


def uniqueness(business_name: str, categories: list[str], core_services: list[str],
               description: str, uvp: str) -> dict:
    if not _enabled():
        return {}
    return _generate_json(
        f"""You are CeView's Uniqueness Analyst for Philippine tourism businesses.

Business: {business_name}
Categories: {', '.join(categories)}
Core Services: {', '.join(core_services)}
Description: {description}
UVP: {uvp}

Return JSON: descriptionScore (0-100), categoryScore (0-100), descriptionReasoning (string), categoryReasoning (string).""",
)


# ── Module 3 ────────────────────────────────────────────────────────────────

_content_log = logging.getLogger("module3.content.gemini")
_compliance_log = logging.getLogger("module3.compliance.gemini")


def content_for_market(
        market: str,
        business_name: str,
        description: str,
        categories: list[str],
        trend: str,
        uniqueness_score: int = 0,
        forecast_context: dict | None = None,
        research_context: dict | None = None) -> dict:
    
    base = {
        "market": {
            "korea": {"country": "South Korea", "flag": "🇰🇷", "city": "Seoul"},
            "japan": {"country": "Japan", "flag": "🇯🇵", "city": "Osaka"},
            "usa":   {"country": "USA",   "flag": "🇺🇸", "city": "Los Angeles"},
        }.get(market, {"country": "South Korea", "flag": "🇰🇷", "city": "Seoul"}),
        "framework": "SOR — Stimulus-Organism-Response",
        "captions": _mock_captions(),
    }

    if not _enabled():
        return {**base, "source": "fallback"}

    research_block = ""
    if research_context:
        research_block = f"""
Cultural research context (source: {research_context.get('source', 'template')}):
- Traveler behavior: {research_context.get('traveler_behavior', '')}
- Tourism preferences: {research_context.get('tourism_preferences', '')}
- Platform styles: {research_context.get('platform_styles', '')}
- Language nuances: {research_context.get('language_nuances', '')}
"""

    forecast_block = ""
    if forecast_context:
        score = forecast_context.get("marketScore", "")
        demand = forecast_context.get("predictedDemand", "")
        spike = forecast_context.get("spikeIndicator", False)
        seasonality = forecast_context.get("seasonalityScore", "")
        forecast_block = f"""
Market forecast context (Module 2 outputs):
- Market score: {score} / 1.0
- Predicted 4-week demand index: {demand}
- Demand spike detected: {spike} {'— use urgency framing' if spike else ''}
- Seasonality score: {seasonality}
- Uniqueness score: {uniqueness_score} / 100
"""

    market_label = {
        "korea": "South Korea",
        "japan": "Japan",
        "usa":   "USA",
    }.get(market, market.title())

    prompt = f"""You are CeView's Marketing Agent — an expert social-media copywriter for
Cebu, Philippines tourism businesses, specialising in the {market_label} market.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business:    {business_name}
Categories:  {', '.join(categories)}
Trend:       {trend}
{research_block}{forecast_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4 CAPTION FACTORS — SYNTHESISE ALL FOUR IN EVERY CAPTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FACTOR 1 — CORE BUSINESS CONTEXT
  Use tourism category metadata, Cebu destination appeal, and business services.

FACTOR 2 — MARKET & CULTURAL LOCALISATION ({market_label})
  • South Korea: Weave in Hangul naturally (힐링여행, 호캉스, 세부여행, 자연 치유).
  • Japan: Incorporate Kanji/Katakana (絶景, 癒し, セブ島, 非日常, グルメ).
  • USA: Energetic, casual, FOMO-driven adventure English.

FACTOR 3 — PSYCHOLOGICAL VECTORS
  Activate per-archetype: escapism · tropical healing · FOMO · exclusivity ·
  social proof · emotional atmosphere · luxury · curiosity · urgency.

FACTOR 4 — PLATFORM MECHANICS  (enforce char limits, link policies, hashtag counts)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3 DEMOGRAPHIC VARIATION ARCHETYPES (generate ALL THREE per platform)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARCHETYPE 1 — "Witty, Trend-Conscious & High-Energy"  (Gen Z / Younger)
ARCHETYPE 2 — "Formal, Educational & Value-Driven"  (Mature Planners / Family)
ARCHETYPE 3 — "Storytelling, Immersive & Emotional"  (Aspirational / Experiential)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY PLATFORM RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTAGRAM  max 2,200 chars · hook in first 125 chars · no links (→ "Link in bio") ·
           10-30 localised hashtags at bottom, one per line, native-language when possible.

FACEBOOK   max 63,206 chars · optimise for 2-3 paragraphs · conversational tone ·
           MUST embed a clickable URL in CTA · max 1-3 hashtags.

TIKTOK     max 2,200 chars · OPTIMISE for 150-300 chars · entire caption = hook ·
           no links (→ "Link in bio") · strictly 3-5 trending hashtags.

NAVER      Korean language only · long-form editorial style (1,500+ chars) ·
           subheadings, food/accommodation close-up references, embedded map mention.

Return JSON with the same shape as: {json.dumps(base)} — fill captions with:
- instagram: 3 options (one per archetype above) + optionNames + 5 visual guide tips
- tiktok:    3 options (one per archetype above) + optionNames + 5 visual guide tips
- facebook:  3 options (one per archetype above) + optionNames + 5 visual guide tips
- naver:     2 options in Korean language + 5 visual guide tips (Korean audience)

The optionNames field is a list parallel to options:
["Witty, Trend-Conscious & High-Energy",
 "Formal, Educational & Value-Driven",
 "Storytelling, Immersive & Emotional"]
"""
    try:
        enriched = _generate_json(prompt)
    except Exception as exc:
        return {**base, "source": "fallback"}

    if not enriched or not enriched.get("captions"):
        return {**base, "source": "fallback"}

    return {
        "market":    enriched.get("market") or base["market"],
        "framework": enriched.get("framework") or base["framework"],
        "captions":  enriched.get("captions"),
        "source":    "gemini",
    }


def evaluate_compliance(caption: str, market: str,
                        media_name: str | None, media_size: int | None) -> dict:
    
    base = {
        "score": 88,
        "aligned": [
            "Destination tags are correctly added so travelers can easily find your location.",
            "Caption tone matches the target audience's search intent.",
        ],
        "gaps": [
            "The background looks a bit too crowded. Try a cleaner, simpler image.",
        ],
    }

    if not _enabled():
        return {**base, "source": "fallback"}

    media_hint = ""
    if media_name:
        media_hint = f"\nMedia file: {media_name} ({media_size or 0} bytes)"

    prompt = f"""You are CeView's Multimodal Compliance Auditor for Cebu tourism social media.

Caption to audit:
\"\"\"{caption}\"\"\"

Target market: {market}{media_hint}

Evaluate the caption (and implied visual) on cultural fit, readability, hashtag strategy.
Return JSON with exactly:
- score: integer 0-100 (overall compliance)
- aligned: array of 3-5 plain-language strings explaining what works well
- gaps: array of 2-4 plain-language strings explaining what is missing or weak
"""
    try:
        out = _generate_json(prompt)
    except Exception as exc:
        return {**base, "source": "fallback"}

    if not out or "score" not in out:
        return {**base, "source": "fallback"}

    try:
        score = int(out.get("score", 0))
    except (TypeError, ValueError):
        score = 0

    return {
        "score": max(0, min(100, score)),
        "aligned": list(out.get("aligned") or [])[:5],
        "gaps": list(out.get("gaps") or [])[:4],
        "source": "gemini",
    }


_DEMOGRAPHIC_OPTION_NAMES = [
    "Witty, Trend-Conscious & High-Energy",
    "Formal, Educational & Value-Driven",
    "Storytelling, Immersive & Emotional",
]


def _mock_captions() -> dict:
    return {} # Removed for brevity


def get_platform_guides(market: str) -> dict[str, list[str]]:
    return {} # Removed for brevity


def generate_creative_direction(
        market: str,
        business_name: str,
        categories: list[str],
        approved_captions: list[str],
        uniqueness_score: int,
        forecast_context: dict) -> dict:
    
    return {"source": "fallback"}


def evaluate_compliance_multimodal(
        caption: str,
        market: str,
        approved_captions: list[str],
        visual_tone: str | None,
        shot_list_context: str | None,
        media_name: str | None,
        media_size: int | None) -> dict:
    
    return {"source": "fallback"}


def pes_compute_insights(
    base_metrics:    dict[str, float],
    pes_score:       float,
    pes_label:       str,
    breakdown:       list[dict],
    flagged_metrics: list[str],
) -> dict:
    fallback: dict = {"source": "fallback"}
    if not _enabled(): return fallback
    return fallback # Placeholder logic


def performance_report(
    metrics: dict,
    transitions: list[dict] | None = None,
    weeks: int = 4,
    market: str = "korea",
) -> dict:
    return {}