"""Groq JSON client for the Module 3 content and creative-direction prompts.

Despite the module name, this calls **Groq**, not Google Gemini. The name is
historical; it also appears in error ``stage`` strings and log output that
callers already read, so it is kept rather than renamed.

Uses the OpenAI-compatible Groq API:
  openai.OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
  → client.chat.completions.create(response_format={"type": "json_object"})

When GROQ_API_KEY is missing, ``_enabled()`` is False: the Module 3 functions
raise ``DependencyUnavailable`` and ``_generate_json`` returns ``{}``.
The Module 4 report prompts live in ``report_llm.py`` and reuse ``_generate_json``.
"""

from __future__ import annotations

import json
import logging
import os

from app import errors
from app.config.llm import DEFAULT_GROQ_MODEL, GROQ_BASE_URL
from app.config.markets import (
    CONTENT_FRAMEWORK,
    DEMOGRAPHIC_OPTION_NAMES,
    MARKET_DISPLAY_NAMES,
    market_header,
)
from app.config.platform_guides import PLATFORM_GUIDES
from app.unavailable import DependencyUnavailable

_log = logging.getLogger("gemini_client")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL)

_groq_client = None
if GROQ_API_KEY:
    try:
        from openai import OpenAI  # type: ignore[import]
        _groq_client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url=GROQ_BASE_URL,
        )
        _log.info("Groq API initialised — model=%s", GROQ_MODEL)
    except Exception as _init_exc:
        _log.error("Failed to initialise Groq API: %s", _init_exc)
        _groq_client = None
else:
    _log.warning(
        "GROQ_API_KEY not set — all AI calls will return deterministic fallback data."
    )


def _enabled() -> bool:
    return _groq_client is not None


def _generate_json(prompt: str) -> dict:
    """Call Groq and return the parsed JSON response dict.

    Uses ``response_format={"type": "json_object"}`` so the model returns a
    clean JSON string without markdown fences.  Returns ``{}`` on any failure
    so callers' ``out.get(key, fallback)`` pattern is always safe.
    """
    if not _enabled():
        return {}
    try:
        response = _groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content.strip())
    except Exception as exc:
        _log.warning("Groq API call failed: %s", exc)
        return {}




# ── Module 3 ────────────────────────────────────────────────────────────────

_content_log = logging.getLogger("module3.content.gemini")
_creative_log = logging.getLogger("module3.creative.gemini")


def generate_content(
        market: str,
        business_name: str,
        description: str,
        categories: list[str],
        trend: str,
        uniqueness_score: int = 0,
        forecast_context: dict | None = None,
        research_context: dict | None = None) -> dict:
    """Generate market-localised captions + supplementary outputs (FR3.5, FR3.6).

    NOTE: not currently wired to the HTTP route — POST /internal/content/generate
    goes through the LangGraph agent in agents/creative_director_agent/node.py
    instead. This function has no live caller today; it is kept because the two
    implementations share the DependencyUnavailable contract this task (17)
    established, and a future consolidation of the two generation paths would
    build on this one rather than the agent's. Do not delete it as unused
    without checking node.py's path first.

    Returns: { market: {country, flag, city}, framework, captions: {...}, source }
    Raises DependencyUnavailable instead of returning synthetic data when the
    model is disabled, errors, or returns nothing usable.
    """
    base = {
        "market": dict(market_header(market)),
        "framework": CONTENT_FRAMEWORK,
        "captions": _caption_schema_example(),  # prompt shape only; never returned
    }

    if not _enabled():
        raise DependencyUnavailable(
            code=errors.MOD3_CONTENT_GEMINI_DISABLED,
            message="Content generation is unavailable.",
            dependency="groq",
            cause="GROQ_API_KEY is not set, so the content client is disabled",
            stage="fastapi-sbert/gemini_client.generate_content",
        )

    # FR3.3 — cultural research context block
    research_block = ""
    if research_context:
        research_block = f"""
Cultural research context (source: {research_context.get('source', 'template')}):
- Traveler behavior: {research_context.get('traveler_behavior', '')}
- Tourism preferences: {research_context.get('tourism_preferences', '')}
- Platform styles: {research_context.get('platform_styles', '')}
- Language nuances: {research_context.get('language_nuances', '')}
"""

    # FR3.4 — forecasting context block
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

    market_label = MARKET_DISPLAY_NAMES.get(market, market.title())

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
  Playful, casual, punchy. High emoji density. Viral-format references (POV:,
  trending phrases, rhetorical questions). Vectors: FOMO, urgency, excitement.

ARCHETYPE 2 — "Formal, Educational & Value-Driven"  (Mature Planners / Family)
  Respectful, authoritative. Concrete facts: services, itinerary, value metrics.
  Minimal emoji (only functional). Vectors: exclusivity, security, value certainty.

ARCHETYPE 3 — "Storytelling, Immersive & Emotional"  (Aspirational / Experiential)
  Cinematic pacing. Sensory vocabulary. Emotional arc:
    tension (burnout/longing) → threshold (discovery) → release (tropical healing).
  Vectors: escapism, tropical healing, emotional atmosphere, luxury.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY PLATFORM RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTAGRAM  max 2,200 chars · hook in first 125 chars · no links (→ "Link in bio") ·
           10-30 localised hashtags at bottom, one per line, native-language when possible.

FACEBOOK   max 63,206 chars · optimise for 2-3 paragraphs · conversational tone ·
           MUST embed a clickable URL in CTA · max 1-3 hashtags.

TIKTOK     max 2,200 chars · OPTIMISE for 150-300 chars · entire caption = hook ·
           no links (→ "Link in bio") · strictly 3-5 trending hashtags.

Return JSON with the same shape as: {json.dumps(base)} — fill captions with:
- instagram: 3 options (one per archetype above) + optionNames + 5 visual guide tips
- tiktok:    3 options (one per archetype above) + optionNames + 5 visual guide tips
- facebook:  3 options (one per archetype above) + optionNames + 5 visual guide tips

The optionNames field is a list parallel to options:
["Witty, Trend-Conscious & High-Energy",
 "Formal, Educational & Value-Driven",
 "Storytelling, Immersive & Emotional"]
"""
    try:
        enriched = _generate_json(prompt)
    except Exception as exc:
        raise DependencyUnavailable(
            code=errors.MOD3_CONTENT_GEMINI_EXCEPTION,
            message="Content generation failed.",
            dependency="groq",
            cause=str(exc),
            stage="fastapi-sbert/gemini_client.generate_content",
        ) from exc

    if not enriched or not enriched.get("captions"):
        raise DependencyUnavailable(
            code=errors.MOD3_CONTENT_GEMINI_EMPTY,
            message="Content generation returned no captions.",
            dependency="groq",
            cause=f"model returned {'an empty body' if not enriched else 'no captions key'}",
            stage="fastapi-sbert/gemini_client.generate_content",
        )

    _content_log.info("Groq content ok market=%s", market)
    return {
        "market":    enriched.get("market") or base["market"],
        "framework": enriched.get("framework") or base["framework"],
        "captions":  enriched.get("captions"),
        "source":    "groq",
    }


def _caption_schema_example() -> dict:
    """The JSON shape the caption prompt asks the model to fill.

    Types, not sample copy. This used to hold finished captions and doubled as the
    fallback payload — which meant a disabled model returned a prompt example to
    the operator as if it were generated content. The fallback is gone (Task 17);
    this survives only to show the model the shape it must return.
    """
    per_platform = {
        "options": ["<string>", "<string>", "<string>"],
        "optionNames": DEMOGRAPHIC_OPTION_NAMES,
        "guide": ["<string>", "<string>", "<string>", "<string>", "<string>"],
    }
    return {
        "instagram": dict(per_platform),
        "tiktok": dict(per_platform),
        "facebook": dict(per_platform),
    }


def get_platform_guides(market: str) -> dict[str, list[str]]:
    """Return curated visual direction guides per platform for a given market.

    Used by content.py when routing caption generation through the LangGraph agent
    so that visual guides remain available without a second LLM call.

    Returns: { "instagram": [...], "tiktok": [...], "facebook": [...] }
    """
    guides = PLATFORM_GUIDES.get(market, PLATFORM_GUIDES["korea"])
    # Copies, so a caller that edits its lists cannot change the shared table.
    return {platform: list(tips) for platform, tips in guides.items()}


def generate_creative_direction(
        market: str,
        business_name: str,
        categories: list[str],
        approved_captions: list[str],
        uniqueness_score: int,
        forecast_context: dict) -> dict:
    """Generate visual direction, shot lists, lighting, moodboard, platform recs (FR3.13-FR3.16).

    Returns: { visualGuide, shots, moodboard, platformRecommendations, source }
    """
    # Platform priority per market (FR3.16)
    platform_map = {
        "korea": {"primary": "Naver Blog", "secondary": ["Instagram", "TikTok"]},
        "japan": {"primary": "Facebook & Instagram", "secondary": ["TikTok"]},
        "usa":   {"primary": "Instagram Reels", "secondary": ["TikTok", "Facebook"]},
    }
    platforms = platform_map.get(market, platform_map["korea"])

    if not _enabled():
        raise DependencyUnavailable(
            code=errors.MOD3_CREATIVE_GEMINI_DISABLED,
            message="Creative direction is unavailable.",
            dependency="groq",
            cause="GROQ_API_KEY is not set, so the creative client is disabled",
            stage="fastapi-sbert/gemini_client.generate_creative_direction",
        )

    captions_block = "\n".join(f"- {c}" for c in (approved_captions or [])[:3])
    forecast_hint = ""
    if forecast_context:
        score = forecast_context.get("marketScore", "")
        spike = forecast_context.get("spikeIndicator", False)
        forecast_hint = (
            f"\nMarket score: {score}. "
            f"{'Demand spike detected — recommend urgency framing.' if spike else ''}"
        )

    prompt = f"""You are CeView's Creative Director Agent generating visual direction for a Cebu
tourism business targeting the {market} market.

Business: {business_name}
Categories: {', '.join(categories)}
Uniqueness score: {uniqueness_score}/100
Approved promotional captions:
{captions_block}{forecast_hint}

Primary platform: {platforms['primary']}
Secondary platforms: {', '.join(platforms['secondary'])}

Generate destination-specific creative direction. Return JSON with exactly:
- visualGuide: array of 4-5 strings — image composition guidelines, framing, subject emphasis, environmental focus (FR3.13)
- shots: array of 3-4 objects with {{label, description, lighting}} — shot list and short-form video sequences (FR3.14)
- moodboard: object with {{palette (string describing color/tone), references (array of 2-3 style references)}} — visual tone, lighting style, emotional atmosphere, cinematic style (FR3.15)
- platformRecommendations: object with platform names as keys and recommendation strings as values — tailored to {platforms['primary']} and secondary platforms (FR3.16)
"""

    try:
        out = _generate_json(prompt)
    except Exception as exc:
        _creative_log.exception(
            "Gemini creative direction failed for market=%s: %s", market, exc,
            extra={"code": errors.MOD3_CREATIVE_GEMINI_EXCEPTION},
        )
        raise DependencyUnavailable(
            code=errors.MOD3_CREATIVE_GEMINI_EXCEPTION,
            message="Creative direction is unavailable.",
            dependency="groq",
            cause=str(exc),
            stage="fastapi-sbert/gemini_client.generate_creative_direction",
        ) from exc

    if not out or not all(out.get(k) for k in
                          ("visualGuide", "shots", "moodboard", "platformRecommendations")):
        _creative_log.warning(
            "Gemini returned an incomplete creative payload for market=%s", market,
            extra={"code": errors.MOD3_CREATIVE_GEMINI_EMPTY},
        )
        raise DependencyUnavailable(
            code=errors.MOD3_CREATIVE_GEMINI_EMPTY,
            message="Creative direction is unavailable.",
            dependency="groq",
            cause="the creative model returned no usable structure",
            stage="fastapi-sbert/gemini_client.generate_creative_direction",
        )

    _creative_log.info("Groq creative direction ok market=%s", market)
    return {
        "visualGuide":             out["visualGuide"],
        "shots":                   out["shots"],
        "moodboard":               out["moodboard"],
        "platformRecommendations": out["platformRecommendations"],
        "source": "groq",
    }
