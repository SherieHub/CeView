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

_log = logging.getLogger("gemini_client")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

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


def content_for_market(
        market: str,
        business_name: str,
        description: str,
        categories: list[str],
        trend: str,
        uniqueness_score: int = 0,
        forecast_context: dict | None = None,
        research_context: dict | None = None) -> dict:
    """Generate market-localised captions + supplementary outputs (FR3.5, FR3.6).

    Returns: { market: {country, flag, city}, framework, captions: {...}, source }
    `source` is "gemini" when the LLM response is used, "fallback" otherwise.
    """
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
        _content_log.info(
            "Gemini disabled; returning fallback content for market=%s",
            market,
            extra={"code": errors.MOD3_CONTENT_GEMINI_DISABLED},
        )
        return {**base, "source": "fallback"}

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
        _content_log.exception(
            "Gemini call failed for market=%s: %s",
            market, exc,
            extra={"code": errors.MOD3_CONTENT_GEMINI_EXCEPTION},
        )
        return {**base, "source": "fallback"}

    if not enriched or not enriched.get("captions"):
        _content_log.warning(
            "Gemini returned empty payload for market=%s",
            market,
            extra={"code": errors.MOD3_CONTENT_GEMINI_EMPTY},
        )
        return {**base, "source": "fallback"}

    _content_log.info("Groq content ok market=%s", market)
    return {
        "market":    enriched.get("market") or base["market"],
        "framework": enriched.get("framework") or base["framework"],
        "captions":  enriched.get("captions"),
        "source":    "groq",
    }


def evaluate_compliance(caption: str, market: str,
                        media_name: str | None, media_size: int | None) -> dict:
    """
    Returns: { score, aligned[], gaps[], source }.
    Same fallback/source contract as `content_for_market`.
    """
    base = {
        "score": 88,
        "aligned": [
            "Destination tags are correctly added so travelers can easily find your location.",
            "Text is clear and very easy to read against the background image.",
            "Important text is placed exactly where travelers naturally look first.",
            "Caption tone matches the target audience's search intent.",
        ],
        "gaps": [
            "The background looks a bit too crowded. Try a cleaner, simpler image.",
            "Missing words that suggest a 'fresh start' which travelers respond to.",
            "No people are visible in the photo. Adding one helps travelers project themselves.",
        ],
    }

    if not _enabled():
        _compliance_log.info(
            "Gemini disabled; returning fallback compliance for market=%s",
            market,
            extra={"code": errors.MOD3_COMPLIANCE_GEMINI_DISABLED},
        )
        return {**base, "source": "fallback"}

    media_hint = ""
    if media_name:
        media_hint = f"\nMedia file: {media_name} ({media_size or 0} bytes)"

    prompt = f"""You are CeView's Multimodal Compliance Auditor for Cebu tourism social media.

Caption to audit:
\"\"\"{caption}\"\"\"

Target market: {market}{media_hint}

Evaluate the caption (and implied visual) on cultural fit, readability, hashtag strategy,
destination tagging, emotional resonance, and trigger words for the target market.

Return JSON with exactly:
- score: integer 0-100 (overall compliance)
- aligned: array of 3-5 plain-language strings explaining what works well
- gaps: array of 2-4 plain-language strings explaining what is missing or weak
"""
    try:
        out = _generate_json(prompt)
    except Exception as exc:
        _compliance_log.exception(
            "Gemini compliance call failed market=%s: %s",
            market, exc,
            extra={"code": errors.MOD3_COMPLIANCE_GEMINI_EXCEPTION},
        )
        return {**base, "source": "fallback"}

    if not out or "score" not in out:
        _compliance_log.warning(
            "Gemini returned empty compliance payload market=%s",
            market,
            extra={"code": errors.MOD3_COMPLIANCE_GEMINI_EMPTY},
        )
        return {**base, "source": "fallback"}

    try:
        score = int(out.get("score", 0))
    except (TypeError, ValueError):
        score = 0

    _compliance_log.info("Groq compliance ok market=%s score=%s", market, score)
    return {
        "score": max(0, min(100, score)),
        "aligned": list(out.get("aligned") or [])[:5],
        "gaps": list(out.get("gaps") or [])[:4],
        "source": "groq",
    }


_DEMOGRAPHIC_OPTION_NAMES = [
    "Witty, Trend-Conscious & High-Energy",
    "Formal, Educational & Value-Driven",
    "Storytelling, Immersive & Emotional",
]


def _mock_captions() -> dict:
    _instagram_metadata = [
        # Archetype 1 — Witty, Trend-Conscious & High-Energy
        {
            "core_business_context": (
                "Korean-market healing resort in Cebu, Philippines; POV hook + 호캉스 "
                "(hocance) positioning targets the K-wellness travel trend. Link-in-bio CTA."
            ),
            "market_cultural_localization": (
                "Korean market: 호캉스 naturally embedded, Korean hashtags throughout "
                "(#호캉스세부, #세부여행, #힐링여행, etc.). Bilingual hashtag strategy "
                "for Korean Instagram discovery."
            ),
            "psychological_elements": (
                "FOMO (go go go, urgency), excitement/hype, social proof via trend alignment "
                "('glow-up trip'). Playful deal-closing framing ('You said deal. 🤝')."
            ),
            "creative_tone_atmosphere": (
                "Gen Z slang register, very high emoji density, rhetorical casual voice. "
                "Short punchy sentences. Atmosphere: energetic, playful, viral-adjacent."
            ),
            "algorithmic_platform_architecture": (
                "Instagram: ≤2,200 chars; hook in first 125 chars (POV:); no URL (link-in-bio); "
                "10 native-language hashtags at bottom, one per line."
            ),
        },
        # Archetype 2 — Formal, Educational & Value-Driven
        {
            "core_business_context": (
                "Cebu wellness resort with private coastal access, curated healing packages, "
                "and Filipino hospitality; targets discerning travellers wanting cultural "
                "depth plus restorative comfort."
            ),
            "market_cultural_localization": (
                "Bilingual hashtag set (#세부여행, #필리핀여행, #힐링) mixed with English "
                "premium travel tags. Professional Korean-international travel lexicon — "
                "'discerning travellers', 'cultural depth'."
            ),
            "psychological_elements": (
                "Exclusivity ('private pool villas'), luxury positioning, security through "
                "specificity (detailed service list), value certainty. Rational trigger."
            ),
            "creative_tone_atmosphere": (
                "Authoritative, editorial. Low emoji (📍 only). Full sentences, formal "
                "phrasing. Structure: intro → detail × 2 → link CTA. "
                "Atmosphere: premium, refined."
            ),
            "algorithmic_platform_architecture": (
                "Instagram: ≤2,200 chars; 125-char hook closes with destination tag 📍; "
                "no URL (link-in-bio); 10 localised hashtags, mixed KR/EN, one per line."
            ),
        },
        # Archetype 3 — Storytelling, Immersive & Emotional
        {
            "core_business_context": (
                "Cebu healing resort as antidote to burnout; positions the destination as "
                "a sensory-rich pause from urban pressure. Emphasises nature connection "
                "over digital connectivity."
            ),
            "market_cultural_localization": (
                "Korean healing-travel archetype: 힐링여행 hashtag leads, 세부여행 + "
                "세부리조트 for geo-discovery. Emotional narrative aligned with "
                "'balance recovery' Korean wellness trend."
            ),
            "psychological_elements": (
                "Escapism ('pause button'), tropical healing, emotional relatability "
                "('you deserve this rest'), atmospheric contrast (wifi-weak vs nature-strong). "
                "Arc: burnout tension → tropical threshold → release."
            ),
            "creative_tone_atmosphere": (
                "Cinematic, contemplative, sensory. Moderate emoji (☁️, 🛌, ✨, 💙). "
                "Long descriptive sentence followed by short CTA. "
                "Atmosphere: warm, restorative, immersive."
            ),
            "algorithmic_platform_architecture": (
                "Instagram: ≤2,200 chars; emotional hook opens with question ('Burned out? ☁️'); "
                "no URL (link-in-bio); 10 Korean-led healing hashtags at bottom, one per line."
            ),
        },
    ]

    _tiktok_metadata = [
        # Archetype 1 — Witty, Trend-Conscious & High-Energy
        {
            "core_business_context": (
                "Cebu paradise resort experience distilled into a TikTok-native POV hook; "
                "frames healing travel as waking up in paradise with zero obligations."
            ),
            "market_cultural_localization": (
                "Korean market: 호캉스 hashtag anchors Korean discovery. English POV caption "
                "is universally TikTok-native; appeal is cross-market with Korean search tag."
            ),
            "psychological_elements": (
                "FOMO (implied exclusivity), excitement (emoji density, exclamation), "
                "escapism (no alarms, ocean sounds). Immediate-impact hook within 6 words."
            ),
            "creative_tone_atmosphere": (
                "Punchy, fast, viral. High emoji density. Ultra-short sentences. "
                "Atmosphere: high-energy, present-tense, movement-oriented. "
                "All within TikTok's ideal 150–300 chars."
            ),
            "algorithmic_platform_architecture": (
                "TikTok: 150 chars; link-in-bio CTA; 5 trending hashtags; entire caption "
                "functions as the on-screen hook for the first-frame audience grab."
            ),
        },
        # Archetype 2 — Formal, Educational & Value-Driven
        {
            "core_business_context": (
                "Cebu's 168-island geography as a factual discovery hook — reframes the "
                "destination's scale, then transitions to the private resort + healing "
                "package offer."
            ),
            "market_cultural_localization": (
                "English with global wellness travel tags; educational 'Did you know' format "
                "resonates with curiosity-driven mature planners who discover via TikTok's "
                "educational content subculture."
            ),
            "psychological_elements": (
                "Curiosity trigger ('Did you know'), value certainty (168 islands → 1 private "
                "resort — scarcity framing), credibility through specificity. "
                "Rational + mild FOMO."
            ),
            "creative_tone_atmosphere": (
                "Informative but concise. Minimal emoji (🏝️ only). Measured pacing: "
                "fact → offer → CTA. Atmosphere: authoritative but approachable."
            ),
            "algorithmic_platform_architecture": (
                "TikTok: 149 chars (within 150-char ideal window); 3 hashtags "
                "(destination, wellness, platform); link-in-bio CTA."
            ),
        },
        # Archetype 3 — Storytelling, Immersive & Emotional
        {
            "core_business_context": (
                "Cebu's sensory environment — salt air, ocean sounds at dawn — positioned "
                "as proof of genuine tropical healing. Understated emotional atmosphere "
                "over feature listing."
            ),
            "market_cultural_localization": (
                "Universal English emotional narrative; tropical healing vocabulary "
                "(#TropicalHealing, #HealingTrip) crosses Korean, Japanese, and US market "
                "expectations. Broad cross-market appeal."
            ),
            "psychological_elements": (
                "Escapism (sensory detail builds the daydream), emotional atmosphere "
                "('calling your name at dawn'), tropical healing. No hard sell — "
                "pure feeling trigger."
            ),
            "creative_tone_atmosphere": (
                "Lyrical, sparse, cinematic. Minimal emoji (🌅 only). Fragmented poetic "
                "sentences. Atmosphere: quiet, dawn-lit, deeply restorative."
            ),
            "algorithmic_platform_architecture": (
                "TikTok: 148 chars (within 150-char optimal); 5 hashtags covering healing + "
                "destination + platform discovery."
            ),
        },
    ]

    _facebook_metadata = [
        # Archetype 1 — Witty, Trend-Conscious & High-Energy
        {
            "core_business_context": (
                "Cebu-based coastal healing resort offering a signature 3D2N getaway "
                "package with private ocean access, emphasising urgency and limited availability."
            ),
            "market_cultural_localization": (
                "Casual, lowercase register aligned with millennial/Gen Z Korean and Southeast "
                "Asian digital-native tone; urgency CTA with 'before May fills up' seasonal hook."
            ),
            "psychological_elements": (
                "FOMO (limited slots), urgency (month deadline), social proof implied through "
                "high demand framing. Excitement and spontaneity triggers."
            ),
            "creative_tone_atmosphere": (
                "Lowercase casual, rapid-fire sentences, rhetorical exclamations. High emoji "
                "density (🤯). Conversational and punchy. Atmosphere: electric, hyper-present."
            ),
            "algorithmic_platform_architecture": (
                "Facebook: 3 short paragraphs, embedded URL in CTA, 2 hashtags. "
                "Well within 63,206-char limit; hook visible before 'See More' cutoff."
            ),
        },
        # Archetype 2 — Formal, Educational & Value-Driven
        {
            "core_business_context": (
                "Wellness resort in Cebu, Philippines; highlights the 3D2N Healing Coast "
                "Package featuring private pool villa, beachfront breakfast, and expert-guided "
                "island tour with direct booking link."
            ),
            "market_cultural_localization": (
                "Formal, authoritative English targeting mature international travellers; "
                "references Southeast Asia rankings to establish destination credibility "
                "for quality-focused audiences."
            ),
            "psychological_elements": (
                "Exclusivity (private villa), value certainty (concrete deliverables listed), "
                "social proof (SE Asia ranking), security through specificity. "
                "Zero FOMO — rational decision trigger."
            ),
            "creative_tone_atmosphere": (
                "Professional, respectful, editorial. Low emoji (📍 for location only). "
                "Structured paragraph format. Atmosphere: trustworthy, premium, curated."
            ),
            "algorithmic_platform_architecture": (
                "Facebook: 2 content paragraphs + CTA with embedded URL, 1 hashtag. "
                "Optimised for 'See More' cutoff at ~250 chars with hook sentence."
            ),
        },
        # Archetype 3 — Storytelling, Immersive & Emotional
        {
            "core_business_context": (
                "Cebu Healing Coast Package (3D2N) positioned as an emotional reset "
                "destination — appeals to reconnection, healing retreat, "
                "and rest-deferral resolution."
            ),
            "market_cultural_localization": (
                "Universal English with emotional resonance; broad international appeal. "
                "Designed for aspirational travellers who follow healing-travel editorial accounts."
            ),
            "psychological_elements": (
                "Escapism (imagine waking up), emotional appeal (healing retreat, reconnection "
                "journey), relatability (the rest you've been postponing), FOMO (3D2N available "
                "now). Arc: longing → invitation → availability signal."
            ),
            "creative_tone_atmosphere": (
                "Cinematic, inviting, warm. Moderate emoji (🌅, 📍, 🌊). Rhetorical opening "
                "('Imagine...'). Slow build then direct CTA. Atmosphere: warm, golden-hour aspirational."
            ),
            "algorithmic_platform_architecture": (
                "Facebook: 3 emotional paragraphs + direct booking URL, 2 hashtags. "
                "Optimised for shareability among travel communities."
            ),
        },
    ]

    return {
        "instagram": {
            "options": [
                # Archetype 1 — Witty, Trend-Conscious & High-Energy (Gen Z)
                (
                    "POV: you booked the 호캉스 your body has been begging for 🌊✈️\n\n"
                    "Cebu said less alarms, more ocean. You said deal. 🤝 "
                    "The glow-up trip is a link-in-bio away — go go go!\n\n"
                    "#호캉스세부\n#CebuPhilippines\n#TravelTok\n#HealingTrip\n"
                    "#세부여행\n#필리핀여행\n#힐링여행\n#TravelAesthetic\n"
                    "#FOMO\n#WellnessTravel"
                ),
                # Archetype 2 — Formal, Educational & Value-Driven (Mature Planners)
                (
                    "Cebu, Philippines: a certified wellness destination offering "
                    "private coastal access, curated healing packages, and authentic "
                    "Filipino hospitality. 📍\n\n"
                    "Our resort combines private pool villas, beachfront dining, and "
                    "expert-guided island experiences — tailored for discerning "
                    "travellers seeking both cultural depth and restorative comfort.\n\n"
                    "Availability and itinerary details: link in bio.\n\n"
                    "#CebuPhilippines\n#WellnessTravel\n#LuxuryCebu\n"
                    "#HealingVacation\n#세부여행\n#필리핀여행\n#힐링\n"
                    "#TravelAesthetic\n#ResortLife\n#IslandHealing"
                ),
                # Archetype 3 — Storytelling, Immersive & Emotional (Aspirational)
                (
                    "Burned out? ☁️ Find your pause button in Cebu.\n\n"
                    "Warm breeze, healing food, and time that moves slower. 🛌✨ "
                    "You deserve this rest. Step away from the rush and into a place "
                    "where the wifi is weak but the connection to nature is strong.\n\n"
                    "Link in bio to book your escape. 💙\n\n"
                    "#힐링여행\n#세부여행\n#CebuHealing\n#Philippines\n"
                    "#TravelGoals\n#WellnessTravel\n#필리핀여행\n"
                    "#세부리조트\n#HealingTrip\n#TropicalHealing"
                ),
            ],
            "optionNames": _DEMOGRAPHIC_OPTION_NAMES,
            "optionMetadata": _instagram_metadata,
            "guide": [
                "Aesthetic Mood Shot — open balcony doors, zero clutter, morning sunlight on tropical fruits beside a plunge pool.",
                "Apply warm, low-contrast golden filters (lightroom preset LUT recommended: 'Mango Sunrise').",
                "Recommended ratio: 4:5 portrait — maximizes feed real-estate on Korean Instagram feeds.",
                "Soft vignette, no text overlay. Let the image breathe completely.",
                "Cultural nuance: avoid showing other guests — solo 'me-space' framing resonates strongly with Korean healing-travel archetype.",
            ],
        },
        "tiktok": {
            "options": [
                # Archetype 1 — Witty, Trend-Conscious & High-Energy (Gen Z)
                (
                    "POV: You just woke up in paradise. 🌊 No alarms, just ocean sounds. "
                    "The healing era is here. Link in bio. ✈️🇵🇭\n\n"
                    "#TravelTok #Cebu #HealingVibes #Philippines #호캉스"
                ),
                # Archetype 2 — Formal, Educational & Value-Driven (Mature Planners)
                (
                    "Did you know Cebu has 168 islands? 🏝️ One private resort. "
                    "3 days. Full healing package. Details → link in bio.\n\n"
                    "#CebuPhilippines #WellnessTravel #TravelTok"
                ),
                # Archetype 3 — Storytelling, Immersive & Emotional (Aspirational)
                (
                    "Salt air. No alarms. 🌅 The ocean calling your name at dawn. "
                    "This is what tropical healing actually feels like. Cebu. Link in bio.\n\n"
                    "#HealingTrip #TropicalHealing #Cebu #TravelTok #Philippines"
                ),
            ],
            "optionNames": _DEMOGRAPHIC_OPTION_NAMES,
            "optionMetadata": _tiktok_metadata,
            "guide": [
                "Slow-motion first-person POV tracking shot. Start tight on a local delicacy.",
                "Pan smoothly upward to reveal a crisp ocean panorama — the 'reveal' moment is the hook.",
                "Keep ambient sound prominent; sync video rhythm to chill lo-fi acoustic track.",
                "Duration target: 18–27 seconds — optimal for Korean TikTok algorithm retention window.",
                "Add Korean subtitle overlay at bottom third. Font: rounded sans, white with soft shadow.",
            ],
        },
        "facebook": {
            "options": [
                # Archetype 1 — Witty, Trend-Conscious & High-Energy (Gen Z)
                (
                    "no one told me Cebu was THIS good 🤯 three days, zero alarms, "
                    "infinite ocean. the healing era starts NOW.\n\n"
                    "grab your slot before May fills up → cebu-healing.ph\n\n"
                    "#CebuTravel #HealingTrip"
                ),
                # Archetype 2 — Formal, Educational & Value-Driven (Mature Planners)
                (
                    "Cebu, Philippines consistently ranks among Southeast Asia's top "
                    "wellness destinations — and for good reason.\n\n"
                    "Our 3D2N Healing Coast Package delivers a private pool villa, "
                    "beachfront breakfast, and an expert-guided island tour. "
                    "Comprehensive itinerary details and availability at cebu-healing.ph/packages.\n\n"
                    "#VisitCebu"
                ),
                # Archetype 3 — Storytelling, Immersive & Emotional (Aspirational)
                (
                    "🌅 Imagine waking up to this every morning.\n\n"
                    "Cebu is calling — are you ready to answer? Perfect for a healing "
                    "retreat, reconnection journey, or simply the rest you've been "
                    "postponing. Our Cebu Healing Coast Package is designed for you.\n\n"
                    "📍 Cebu, Philippines  🌊 3D2N available now\n"
                    "Book your escape → cebu-healing.ph\n\n"
                    "#CebuTravel #HealingDestination"
                ),
            ],
            "optionNames": _DEMOGRAPHIC_OPTION_NAMES,
            "optionMetadata": _facebook_metadata,
            "guide": [
                "Wide establishing shot of coastline at golden hour — captures the 'breath of relief' emotional entry point.",
                "Include a human element (silhouette, hands holding coffee) to trigger empathy and projection.",
                "Facebook favors horizontal 16:9 frame for organic reach; include destination tag overlay at upper-left.",
                "Use warm, slightly desaturated tones — not oversaturated tropical clichés.",
                "CTA text in caption: 'Plan your escape →' — drives link-click micro-conversion on Facebook.",
            ],
        },
        "naver": {
            "options": [
                "세부에서 찾은 나만의 힐링 스팟 🌴\n\n바쁜 일상에서 벗어나, 필리핀 세부에서 진정한 휴식을 경험했어요. 따뜻한 바람, 맑은 바다, 그리고 느린 시간...\n\n#세부여행 #필리핀여행 #힐링여행 #세부맛집",
                "직장인 필수 코스! 세부 프라이빗 리조트 3박 4일 힐링 후기 ✈️\n\n매일 야근에 지쳐있다가 드디어 떠난 세부 여행! 나만 알고 싶은 세부 힐링 숙소 추천 리스트를 공개합니다. 💙\n\n#세부여행 #세부프라이빗리조트",
            ],
            "guide": [
                "Long-form editorial blog layout — Korean audiences expect deep photo-journaling, not quick posts.",
                "Lead with a 3×2 hero image collage grid — establishes visual authority before text.",
                "Include food close-ups, accommodation review shots, and activity documentation shots sequentially.",
                "Write in warm, conversational Korean with clear subheadings.",
                "Minimum 1,500 characters with embedded map — Naver SEO depends heavily on content depth.",
            ],
        },
    }


def get_platform_guides(market: str) -> dict[str, list[str]]:
    """Return curated visual direction guides per platform for a given market.

    Used by content.py when routing caption generation through the LangGraph agent
    so that visual guides remain available without a second Gemini call.

    Returns: { "instagram": [...], "tiktok": [...], "facebook": [...], "naver": [...] }
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
            "naver": [
                "Long-form editorial blog layout — Korean audiences expect deep photo-journaling, not quick posts.",
                "Lead with a 3×2 hero image collage grid — establishes visual authority before text.",
                "Include food close-ups, accommodation review shots, and activity documentation shots sequentially.",
                "Write in warm, conversational Korean with clear subheadings.",
                "Minimum 1,500 characters with embedded map — Naver SEO depends heavily on content depth.",
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
            "naver": [
                "Long-form editorial blog layout — Korean audiences expect deep photo-journaling, not quick posts.",
                "Lead with a 3×2 hero image collage grid — establishes visual authority before text.",
                "Include food close-ups, accommodation review shots, and activity documentation shots sequentially.",
                "Write in warm, conversational Korean with clear subheadings.",
                "Minimum 1,500 characters with embedded map — Naver SEO depends heavily on content depth.",
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
            "naver": [
                "Long-form editorial blog layout — Korean audiences expect deep photo-journaling, not quick posts.",
                "Lead with a 3×2 hero image collage grid — establishes visual authority before text.",
                "Include food close-ups, accommodation review shots, and activity documentation shots sequentially.",
                "Write in warm, conversational Korean with clear subheadings.",
                "Minimum 1,500 characters with embedded map — Naver SEO depends heavily on content depth.",
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

    fallback = _creative_fallback(market, platforms)

    if not _enabled():
        _creative_log.info(
            "Gemini disabled; returning fallback creative for market=%s",
            market,
            extra={"code": errors.MOD3_CREATIVE_GEMINI_DISABLED},
        )
        return {**fallback, "source": "fallback"}

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
        return {**fallback, "source": "fallback"}

    if not out or not out.get("visualGuide"):
        _creative_log.warning(
            "Gemini returned empty creative payload for market=%s", market,
            extra={"code": errors.MOD3_CREATIVE_GEMINI_EMPTY},
        )
        return {**fallback, "source": "fallback"}

    _creative_log.info("Groq creative direction ok market=%s", market)
    return {
        "visualGuide":            out.get("visualGuide") or fallback["visualGuide"],
        "shots":                  out.get("shots") or fallback["shots"],
        "moodboard":              out.get("moodboard") or fallback["moodboard"],
        "platformRecommendations": out.get("platformRecommendations") or fallback["platformRecommendations"],
        "source": "groq",
    }


def _creative_fallback(market: str, platforms: dict) -> dict:
    """Curated fallback creative direction per market."""
    _fallbacks = {
        "korea": {
            "visualGuide": [
                "Aerial drone shot starting high above the ocean, moving slowly toward a private villa balcony.",
                "Close-up of a local breakfast tray on the balcony with ocean blur in the background.",
                "POV walking through lush resort gardens, opening a gate to a private beach.",
                "Soft, dreamy color grading — avoid oversaturated tropical clichés.",
                "Maintain a 4:5 portrait ratio for Korean Instagram feeds.",
            ],
            "shots": [
                {"label": "Golden Hour Reveal", "description": "Slow-motion balcony door opening to ocean panorama", "lighting": "Golden hour backlight, 06:00-07:30"},
                {"label": "Healing Table", "description": "Close-up of local breakfast beside a plunge pool", "lighting": "Soft diffused morning light, no direct sun"},
                {"label": "Garden POV Walk", "description": "First-person walk through resort gardens to private beach", "lighting": "Dappled natural light through canopy"},
            ],
            "moodboard": {
                "palette": "Warm golden + soft teal — low contrast, slightly desaturated. LUT: 'Mango Sunrise'.",
                "references": ["Aman Resorts editorial photography", "Korean 'healing travel' Instagram aesthetic", "Wabi-sabi minimal interiors"],
            },
            "platformRecommendations": {
                "Naver Blog": "Long-form photo journal (1,500+ chars) with embedded map, food close-ups, and sequential accommodation review shots.",
                "Instagram": "4:5 portrait, warm filter, no text overlay. Solo 'me-space' framing resonates with Korean healing-travel archetype.",
                "TikTok": "18-27 second POV reveal. Korean subtitle overlay, rounded sans font. Sync to chill lo-fi acoustic track.",
            },
        },
        "japan": {
            "visualGuide": [
                "Wide establishing shot of pristine coastline at golden hour — evokes 'non-daily life' (非日常) feeling.",
                "Detailed close-up of local cuisine with clean white background — Japanese audiences value food photography.",
                "Symmetrical resort architecture framing against a clear blue sky.",
                "Human silhouette at water's edge — scale reference creates emotional connection.",
                "Horizontal 16:9 framing for Facebook; square 1:1 for Instagram grid.",
            ],
            "shots": [
                {"label": "Non-Daily Reveal", "description": "Wide coastline pan from right to left, slow movement, hold on horizon", "lighting": "Golden hour, slightly underexposed for moody drama"},
                {"label": "Food Detail", "description": "Macro shot of signature dish, shallow depth of field", "lighting": "Soft diffused natural window light, no harsh shadows"},
                {"label": "Tranquil Moment", "description": "Single person sitting at water edge, back to camera, contemplative", "lighting": "Backlit by setting sun, silhouette with warm halo"},
            ],
            "moodboard": {
                "palette": "Clean whites, ocean blue, warm sand tones. Minimal saturation. Inspired by Japanese resort editorial.",
                "references": ["Hoshinoya Resort photography", "Japanese travel magazine (じゃらん) aesthetic", "Ryokan interior minimalism applied to tropical setting"],
            },
            "platformRecommendations": {
                "Facebook": "Multiple photos per post, detailed caption in Japanese with clear price point and booking link. Community group posting strategy.",
                "Instagram": "High-quality single hero image or 3-photo carousel. Japanese caption using 絶景 and 癒し trigger words.",
                "TikTok": "Scenic reveal format, minimal text. Japanese subtitle at bottom third.",
            },
        },
        "usa": {
            "visualGuide": [
                "9:16 vertical framing optimised for Instagram Reels and TikTok — fill the frame.",
                "Strong hook visual in first 2 seconds — underwater shot, aerial reveal, or unexpected angle.",
                "Authentic, slightly raw aesthetic — avoid overly polished stock-photo look.",
                "Action and adventure shots: diving, island-hopping, street food exploration.",
                "Text overlay for accessibility — bold, high-contrast font in first 3 seconds.",
            ],
            "shots": [
                {"label": "Reels Hook", "description": "2-second underwater-to-surface reveal, camera breaks the water line", "lighting": "Bright midday sun for underwater clarity, GoPro-style"},
                {"label": "Island Hop", "description": "Quick cuts between three islands, 3-5 seconds each, energetic pacing", "lighting": "Natural midday, saturated tropical colors"},
                {"label": "Street Food POV", "description": "First-person eating sequence at local market, reacting to flavors", "lighting": "Ambient market lighting, slightly warm"},
            ],
            "moodboard": {
                "palette": "Vibrant tropical — saturated blues and greens, warm skin tones. High energy, high contrast. Think GoPro travel aesthetic.",
                "references": ["GoPro Destination travel content", "Nas Daily-style authentic storytelling", "Instagram Reels trending travel creators"],
            },
            "platformRecommendations": {
                "Instagram Reels": "9:16, trending audio, strong 2-second hook, text overlay. 5-7 hashtags max. CTA: 'Link in bio to book'.",
                "TikTok": "Raw, authentic feel. Trending sound. 15-30 seconds. 'Hidden gem' and FOMO framing. Duet/stitch-friendly.",
                "Facebook": "Horizontal video for trip planning groups. Detailed caption with price comparison (US vs Philippines). Tag location.",
            },
        },
    }
    return _fallbacks.get(market, _fallbacks["korea"])


_creative_log = logging.getLogger("module3.creative.gemini")


def evaluate_compliance_multimodal(
        caption: str,
        market: str,
        approved_captions: list[str],
        visual_tone: str | None,
        shot_list_context: str | None,
        media_name: str | None,
        media_size: int | None) -> dict:
    """Visual Alignment Score (VAS) + explainable AI outputs (FR3.24, FR3.25.2, FR3.26).

    Evaluates: composition consistency, cultural appropriateness, visual tone
    alignment, subject emphasis, destination relevance (FR3.24 criteria).

    Returns:
        {
            vas: float 0-100,
            aligned: list[str],     — what works well (FR3.26)
            gaps: list[str],        — improvement areas (FR3.26)
            mismatches: list[str],  — detected mismatches and deviations (FR3.26)
            source: "gemini" | "fallback"
        }
    """
    fallback = _visual_fallback_evaluation(market)

    if not _enabled():
        _compliance_log.info(
            "Gemini disabled; returning fallback VAS for market=%s", market,
            extra={"code": errors.MOD3_COMPLIANCE_GEMINI_DISABLED},
        )
        return {**fallback, "source": "fallback"}

    approved_block = "\n".join(f"- {c}" for c in (approved_captions or [])[:3])
    visual_context = ""
    if visual_tone:
        visual_context += f"\nApproved visual tone: {visual_tone}"
    if shot_list_context:
        visual_context += f"\nApproved shot list: {shot_list_context[:400]}"

    media_hint = ""
    if media_name:
        media_hint = f"\nSubmitted media: {media_name} ({media_size or 0} bytes)"

    prompt = f"""You are CeView's Multimodal Compliance Auditor for Cebu tourism promotions
targeting the {market} market.

Operator-submitted caption:
\"\"\"{caption}\"\"\"

AI-approved reference captions:
{approved_block}
{visual_context}{media_hint}

Perform multimodal visual compliance analysis (FR3.24). Evaluate:
1. Composition consistency — does the caption imply visual framing aligned with recommendations?
2. Cultural appropriateness — does tone and language match {market} traveler expectations?
3. Visual tone alignment — does emotional atmosphere match the approved creative direction?
4. Subject emphasis — are the correct tourism subjects (healing, scenery, food) emphasised?
5. Destination relevance — is Cebu positioning clear and authentic?

Return JSON with exactly:
- vas: integer 0-100 (Visual Alignment Score — weighted average of the 5 criteria above)
- aligned: array of 3-5 strings — what works well and why (FR3.26)
- gaps: array of 2-4 strings — specific improvement areas (FR3.26)
- mismatches: array of 1-3 strings — detected mismatches vs approved direction (FR3.26)
"""

    try:
        out = _generate_json(prompt)
    except Exception as exc:
        _compliance_log.exception(
            "Gemini multimodal compliance failed market=%s: %s", market, exc,
            extra={"code": errors.MOD3_COMPLIANCE_GEMINI_EXCEPTION},
        )
        return {**fallback, "source": "fallback"}

    if not out or "vas" not in out:
        _compliance_log.warning(
            "Gemini multimodal compliance empty market=%s", market,
            extra={"code": errors.MOD3_COMPLIANCE_GEMINI_EMPTY},
        )
        return {**fallback, "source": "fallback"}

    try:
        vas = max(0, min(100, int(out.get("vas", 0))))
    except (TypeError, ValueError):
        vas = fallback["vas"]

    _compliance_log.info("Groq multimodal VAS ok market=%s vas=%s", market, vas)
    return {
        "vas":       vas,
        "aligned":   list(out.get("aligned") or [])[:5],
        "gaps":      list(out.get("gaps") or [])[:4],
        "mismatches": list(out.get("mismatches") or [])[:3],
        "source":    "groq",
    }


def _visual_fallback_evaluation(market: str) -> dict:
    """Rule-based VAS fallback for FR3.30 — deterministic per market."""
    _fallbacks = {
        "korea": {
            "vas": 74,
            "aligned": [
                "Caption adopts a warm, contemplative tone consistent with Korean healing-travel aesthetic.",
                "Destination references Cebu clearly — tourism positioning is unambiguous.",
                "Language register is appropriately calm and non-aggressive for the market.",
            ],
            "gaps": [
                "No Korean hashtags detected — Naver Blog SEO depends on #세부여행 and similar tags.",
                "Visual tone cues (golden hour, minimal clutter) are absent from the caption.",
            ],
            "mismatches": [
                "Caption does not reference the solo 'me-space' framing recommended in creative direction.",
            ],
        },
        "japan": {
            "vas": 76,
            "aligned": [
                "Tone is polite and understated — consistent with Japanese communication norms.",
                "Destination imagery (ocean, resort) aligns with 非日常 (non-daily life) travel motivation.",
                "Caption length is appropriate for Facebook/Instagram Japanese audience.",
            ],
            "gaps": [
                "Missing Japanese trigger words (絶景, 癒し) that drive emotional resonance.",
                "No clear price point or value reference — important for Japanese purchase decisions.",
            ],
            "mismatches": [
                "Food/cultural close-up emphasis is missing despite being a priority in the shot list.",
            ],
        },
        "usa": {
            "vas": 71,
            "aligned": [
                "Hook is energetic — consistent with Instagram Reels first-2-second requirement.",
                "Informal tone matches US casual communication style.",
                "Hashtag strategy present — discoverability for Reels is addressed.",
            ],
            "gaps": [
                "No explicit CTA ('Book now', 'Link in bio') — conversion intent is weak.",
                "FOMO framing ('hidden gem', 'bucket list') is absent.",
            ],
            "mismatches": [
                "Caption describes a slow, contemplative experience — mismatches the high-energy adventure framing in the US creative direction.",
            ],
        },
    }
    return _fallbacks.get(market, _fallbacks["korea"])


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
  "executiveSummary": "<2–3 sentence overall campaign assessment referencing PES and funnel>",
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
