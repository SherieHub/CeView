"""
Server-side AI wrapper (Groq). Mirrors the five prompts currently in the
frontend's `ceview/services/geminiService.ts` so swapping the frontend over
later changes only the transport, not the behavior.

When GROQ_API_KEY is missing, every function returns a deterministic
fallback. Module-3 functions tag the returned dict with a `source` field
("groq" | "fallback") so the UI can label demo data.

Uses the OpenAI-compatible Groq API:
  openai.OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
  → client.chat.completions.create(response_format={"type": "json_object"})
"""

from __future__ import annotations

import json
import logging
import os

from app import errors
from app.unavailable import DependencyUnavailable

_log = logging.getLogger("gemini_client")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

_groq_client = None
if GROQ_API_KEY:
    try:
        from openai import OpenAI  # type: ignore[import]
        _groq_client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
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
        "market": {
            "korea": {"country": "South Korea", "flag": "🇰🇷", "city": "Seoul"},
            "japan": {"country": "Japan", "flag": "🇯🇵", "city": "Osaka"},
            "usa":   {"country": "USA",   "flag": "🇺🇸", "city": "Los Angeles"},
        }.get(market, {"country": "South Korea", "flag": "🇰🇷", "city": "Seoul"}),
        "framework": "SOR — Stimulus-Organism-Response",
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


_DEMOGRAPHIC_OPTION_NAMES = [
    "Witty, Trend-Conscious & High-Energy",
    "Formal, Educational & Value-Driven",
    "Storytelling, Immersive & Emotional",
]


def _caption_schema_example() -> dict:
    """The JSON shape the caption prompt asks the model to fill.

    Types, not sample copy. This used to hold finished captions and doubled as the
    fallback payload — which meant a disabled model returned a prompt example to
    the operator as if it were generated content. The fallback is gone (Task 17);
    this survives only to show the model the shape it must return.
    """
    per_platform = {
        "options": ["<string>", "<string>", "<string>"],
        "optionNames": _DEMOGRAPHIC_OPTION_NAMES,
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
    so that visual guides remain available without a second Gemini call.

    Returns: { "instagram": [...], "tiktok": [...], "facebook": [...] }
    """
    _guides: dict[str, dict[str, list[str]]] = {
        "korea": {
            "instagram": [
                "Aesthetic mood shot — open balcony doors, morning sunlight on tropical fruits beside a plunge pool.",
                "Apply warm, low-contrast golden filters (LUT: 'Mango Sunrise').",
                "Recommended ratio: 4:5 portrait — maximizes feed real-estate on Korean Instagram feeds.",
                "Soft vignette, no text overlay. Let the image breathe.",
                "Cultural nuance: avoid showing other guests — solo 'me-space' framing resonates with Korean healing-travel archetype.",
            ],
            "tiktok": [
                "Slow-motion first-person POV tracking shot — start tight on a local delicacy.",
                "Pan smoothly upward to reveal a crisp ocean panorama — the 'reveal' moment is the hook.",
                "Keep ambient sound prominent; sync video rhythm to chill lo-fi acoustic track.",
                "Duration target: 18–27 seconds — optimal for Korean TikTok algorithm retention window.",
                "Add Korean subtitle overlay at bottom third. Font: rounded sans, white with soft shadow.",
            ],
            "facebook": [
                "Wide establishing shot of coastline at golden hour — captures the 'breath of relief' emotional entry point.",
                "Include a human element (silhouette, hands holding coffee) to trigger empathy and projection.",
                "Facebook favors horizontal 16:9 frame for organic reach; include destination tag overlay.",
                "Use warm, slightly desaturated tones — not oversaturated tropical clichés.",
                "CTA text: 'Plan your escape →' — drives link-click micro-conversion on Facebook.",
            ],
        },
        "japan": {
            "instagram": [
                "Minimalist composition — single subject (a bowl of tropical fruit, a zen garden corner) with ocean behind.",
                "Cool-to-neutral colour grading; avoid oversaturation. Japanese Instagram prefers 'wabi-sabi' aesthetics.",
                "Aspect ratio: 1:1 square for Japanese feed preference.",
                "Add subtle texture overlay (paper grain) to evoke premium editorial feel.",
                "Include one culturally relevant prop — a Japanese straw hat, folded fan, or travel journal.",
            ],
            "tiktok": [
                "Slow, deliberate camera movement — Japanese TikTok users respond to calm, cinematic pacing.",
                "Natural ambient sound (waves, birds, breeze) — no loud electronic music.",
                "Duration: 30–45 seconds — longer than Korean TikTok; Japanese audiences prefer narrative depth.",
                "Subtitle overlay in Japanese katakana/kanji. Clean, minimal font.",
                "End with a peaceful still frame of the ocean — 'ichi-go ichi-e' (once-in-a-lifetime moment) framing.",
            ],
            "facebook": [
                "Clean 16:9 horizontal hero image — resorts, nature paths, cultural sites.",
                "Japanese Facebook users are older; prioritize information density over emotion.",
                "Include pricing anchor or package summary as image overlay text.",
                "Use cool, authoritative colour palette — blues and greens over warm gold.",
                "CTA: 'View full itinerary →' — Japanese audiences want complete information before deciding.",
            ],
        },
        "usa": {
            "instagram": [
                "High-saturation lifestyle shot — vibrant turquoise water, colourful tropical flowers.",
                "Human-in-frame required — US Instagram audiences respond to people, not just scenery.",
                "Stories-first vertical 9:16 format — US Instagram Stories outperform feed for US audiences.",
                "Text overlay with key benefit ('₱ Stronger Than You Think') increases swipe-up engagement.",
                "Use bright, travel-magazine colour grading — bold and aspirational.",
            ],
            "tiktok": [
                "Fast-cut editing — 3–5 clips in the first 3 seconds to capture the US TikTok scroll reflex.",
                "Trending audio from the US Billboard chart or viral sound — check TikTok Creative Center weekly.",
                "Add trending text template ('POV:', 'Tell me you're in Cebu') in the caption and on-screen.",
                "Duration: 15–30 seconds — US TikTok has the shortest average attention window.",
                "End with a strong CTA card: 'Link in bio for the full package deal 🌊'.",
            ],
            "facebook": [
                "Facebook Ad-style creative — bold headline overlay, single value statement, strong CTA button.",
                "US Facebook audiences skew 35+; use 'adventure + comfort' framing (bucket list + luxury).",
                "Horizontal 1.91:1 ratio for Feed; 1:1 for Marketplace.",
                "Use social proof element: '500+ American travellers visited this month'.",
                "CTA: 'Book Now' or 'Get the Deal' — US audiences respond to direct, benefit-led language.",
            ],
        },
    }
    return _guides.get(market, _guides["korea"])


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


_creative_log = logging.getLogger("module3.creative.gemini")


def pes_compute_insights(
    base_metrics: dict,
    pes_score: float,
    pes_label: str,
    breakdown: list[dict],
    flagged_metrics: list[str],
) -> dict:
    """Generate AI prescriptive insights for UC-4.3 (pes_compute endpoint).

    Returns: { weakest_funnel_stage, recommendations, executive_summary, source }
    Falls back to rule-based output if Groq is unavailable.
    """
    if not _enabled():
        return {}

    breakdown_text = "\n".join(
        f"  - {b['metric']}: weight {b['weight']}, contribution {b['contribution']:.4f}"
        for b in breakdown
    )
    flag_text = (
        f"Excluded metrics (missing data): {', '.join(flagged_metrics)}"
        if flagged_metrics else "No metrics were excluded."
    )

    prompt = f"""You are CeView's Senior Campaign Analyst for Cebu MSME tourism businesses — resorts, tour operators, dive shops, and cultural experience providers in Cebu, Philippines targeting Korean, Japanese, and US tourists.

Campaign PES Analysis:
- PES Score: {pes_score:.4f} / 1.00 ({pes_label})
- Base Metrics: {json.dumps(base_metrics, indent=2)}
- Metric Contributions (normalized × weight):
{breakdown_text}
- {flag_text}

Context on what each metric means for a Cebu tourism operator:
- CTR: % of tourists who saw the ad and clicked — measures ad creative relevance for Cebu's target tourist markets
- CPC: ₱ cost per click on platforms like Facebook, Naver Blog, or Instagram — measures ad spend efficiency per tourist reached
- ROAS: ₱ revenue from Cebu resort packages or tours per ₱1 of ad spend — measures overall campaign profitability
- CR: % of clicks that became booking enquiries or form submissions on the Cebu operator's landing page — measures offer and landing page effectiveness
- CAC: total ₱ cost to acquire one confirmed booking customer for the Cebu tourism business — measures total acquisition efficiency

Identify the weakest funnel stage and provide 3 specific, actionable recommendations to improve the campaign's PES score.
Each recommendation must:
  - Reference Cebu's tourism context specifically (e.g. Cebu resort packages, island-hopping tours, dive packages in Moalboal, cultural experiences)
  - Name the specific platform to act on (e.g. Naver Blog for Korean tourists, Instagram Reels for US tourists, Facebook for Japanese tourists)
  - State the expected business outcome for the Cebu operator (e.g. lower CAC, more booking enquiries, higher ROAS)

Return JSON with exactly:
- weakest_funnel_stage: string (e.g. "Clicks → Bookings", "Impressions → Clicks", etc.)
- recommendations: array of exactly 3 strings — each a concrete, Cebu-specific action with platform and expected outcome
- executive_summary: string — 3-4 sentences: state the PES score and what it means for this Cebu tourism business, explain which metric is the biggest drag on performance and why it matters for booking revenue, and name the single most impactful action the operator should take immediately
"""

    out = _generate_json(prompt)
    if not out or "recommendations" not in out:
        return {}

    return {
        "weakest_funnel_stage": out.get("weakest_funnel_stage", "Clicks → Bookings"),
        "recommendations":      list(out.get("recommendations", []))[:3],
        "executive_summary":    out.get("executive_summary", ""),
        "source":               "groq",
    }


def performance_report(
    metrics: dict,
    transitions: list[dict] | None = None,
    weeks: int = 4,
    market: str = "korea",
) -> dict:
    """
    Generate a prescriptive performance report using the new exhaustive funnel
    diagnostics schema (Phase 5 / Module 4).

    Args:
        metrics:     Raw KPI values (impressions, clicks, adSpend, …)
        transitions: Pre-ranked funnel transitions from Spring Boot
                     (business-impact order: Clk→Conv, Conv→Book, Imp→Clk)
        weeks:       Analysis window in weeks (4 or 8)
        market:      Target market key (e.g. "korea", "japan", "usa")

    Returns:
        New schema dict:
          executiveSummary, funnelDiagnostics[], recommendations[], recommendedPlatform
    """
    _platform_map = {
        "korea": "Naver Blog", "kr": "Naver Blog",
        "japan": "Facebook + Instagram", "jp": "Facebook + Instagram",
        "usa": "Instagram Reels", "us": "Instagram Reels",
        "australia": "Instagram Reels",
        "global": "Instagram Reels",
    }
    recommended_platform = _platform_map.get(market.lower(), "Naver Blog")

    # Fallback handled in report.py router — this function only runs when Gemini is enabled
    if transitions is None:
        transitions = [
            {"stage": "Clicks → Conversions",  "dropRate": "88.1%"},
            {"stage": "Conversions → Bookings", "dropRate": "78.8%"},
            {"stage": "Impressions → Clicks",   "dropRate": "95.2%"},
        ]

    # Build the ordered rank/urgency context for Gemini
    rank_context = "\n".join(
        f"  {i+1}. \"{t['stage']}\" — {t['dropRate']} absolute drop"
        for i, t in enumerate(transitions[:3])
    )

    prompt = f"""You are CeView's Senior Marketing Analyst specialising in Philippine tourism MSMEs.

CAMPAIGN DATA ({weeks}-week window, market: {market.upper()}):
{json.dumps(metrics, indent=2)}

PRE-RANKED FUNNEL TRANSITIONS (business-impact priority order — do NOT re-order):
{rank_context}

Rank 1 = "Weakest" | Rank 2 = "Moderate" | Rank 3 = "Alright"
Urgency 1 = "Most Urgent" | Urgency 2 = "Urgent" | Urgency 3 = "Not Very Urgent"

RULES:
1. Evaluate ALL THREE transitions. Do not skip any stage.
2. Preserve the pre-ranked order exactly (index 0 = Weakest, index 1 = Moderate, index 2 = Alright).
3. Each funnelDiagnostics entry MUST have exactly one matching recommendations entry (same "stage" value).
4. Urgency is strictly derived from the rank — do not deviate.
5. recommendedPlatform MUST be "{recommended_platform}".
6. Return ONLY valid JSON — no markdown, no explanation text.

Return this exact JSON structure:
{{
  "executiveSummary": "<4–6 sentence overall campaign assessment that: (1) opens with a plain-language explanation of what each of the 5 KPIs means for this Cebu tourism business — CTR is the percentage of tourists who saw the ad and clicked (measures ad creative relevance), CPC is the ₱ cost per click on platforms like Facebook and Naver Blog (measures ad spend efficiency), ROAS is the ₱ revenue earned per ₱1 of ad spend (measures overall campaign profitability for the resort or tour package), CR is the percentage of clicks that turned into a booking enquiry or form submission (measures how well the landing page converts tourist interest into action), and CAC is the total ₱ cost to secure one confirmed booking customer (measures total acquisition efficiency and directly impacts profit margin); (2) summarises the current overall campaign health in the context of this Cebu tourism MSME; (3) identifies the single top-priority improvement for the operator>",
  "funnelDiagnostics": [
    {{
      "stage": "<transition label>",
      "rank": "<Weakest|Moderate|Alright>",
      "dropRate": "<formatted percentage>",
      "insight": "<one-sentence root-cause diagnosis specific to this stage>"
    }}
  ],
  "recommendations": [
    {{
      "stage": "<must match the corresponding funnelDiagnostics stage>",
      "urgency": "<Most Urgent|Urgent|Not Very Urgent>",
      "title": "<≤8-word action title>",
      "action": "<one concrete implementation step — specific and actionable>"
    }}
  ],
  "recommendedPlatform": "{recommended_platform}"
}}"""

    return _generate_json(prompt)
