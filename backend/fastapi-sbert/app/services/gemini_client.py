"""
Server-side Gemini wrapper. Mirrors the five prompts currently in the
frontend's `ceview/services/geminiService.ts` so swapping the frontend over
later changes only the transport, not the behavior.

When ENABLE_GEMINI is false or GEMINI_API_KEY is missing, every function
returns a deterministic fallback. Module-3 functions tag the returned dict
with a `source` field ("gemini" | "fallback") so the UI can label demo data.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from app import errors

ENABLE_GEMINI = os.getenv("ENABLE_GEMINI", "false").lower() == "true"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

_client = None
if ENABLE_GEMINI and GEMINI_API_KEY:
    try:
        from google import genai
        _client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        _client = None


def _enabled() -> bool:
    return _client is not None


def _generate_json(prompt: str, schema: dict | None = None) -> dict:
    if not _enabled():
        return {}
    cfg: dict[str, Any] = {"response_mime_type": "application/json"}
    if schema:
        cfg["response_schema"] = schema
    try:
        resp = _client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=cfg,
        )
        return json.loads(resp.text or "{}")
    except Exception as exc:
        logging.getLogger("gemini_client").warning("Gemini API call failed: %s", exc)
        return {}


def keywords(business_name: str, description: str, category: str) -> list[str]:
    if not _enabled():
        return ["Cebu Healing", "Rustic Resort", "Wellness Retreat", "Filipino Cuisine", "Nature Escape"]
    out = _generate_json(
        f"""Analyze this tourism business to generate high-value Google Trends keywords.
Business: {business_name}
Category: {category}
Description: {description}

Generate 5-7 specific keywords or short phrases. Return JSON {{ "keywords": [...] }}.""",
    )
    return out.get("keywords", [])


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

    prompt = f"""You are CeView's Marketing Agent generating culturally-localised social media
content for a Cebu, Philippines tourism business targeting the {market} market.

Business: {business_name}
Description: {description}
Categories: {', '.join(categories)}
Current trend signal: {trend}
{research_block}{forecast_block}
Generate promotional captions tailored to the cultural expectations, psychological triggers,
and tourism motivations of this market (FR3.5).  Also generate supplementary outputs
including hashtags, CTA recommendations, posting tone, and platform recommendations (FR3.6).

Return JSON with the same shape as: {json.dumps(base)} — fill captions with:
- instagram: 3 options + 5 visual guide tips
- tiktok: 3 options + 5 visual guide tips
- facebook: 2 options + 5 visual guide tips
- naver: 2 options in Korean language + 5 visual guide tips (Korean audience)
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

    _content_log.info("Gemini content ok market=%s", market)
    return {
        "market":    enriched.get("market") or base["market"],
        "framework": enriched.get("framework") or base["framework"],
        "captions":  enriched.get("captions"),
        "source":    "gemini",
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

    _compliance_log.info("Gemini compliance ok market=%s score=%s", market, score)
    return {
        "score": max(0, min(100, score)),
        "aligned": list(out.get("aligned") or [])[:5],
        "gaps": list(out.get("gaps") or [])[:4],
        "source": "gemini",
    }


def _mock_captions() -> dict:
    return {
        "instagram": {
            "options": [
                "Burned out? ☁️ Find your pause button in Cebu. Warm breeze, healing food, and time that moves slower. 🛌✨ You deserve this rest.\n\n#HealingTrip #Cebu #Wellness #RestAndRelax #CebuPhilippines #HealingVacation #TravelAesthetic",
                "The ultimate 'Me Time' hideaway. 🌿 Discovering Cebu's secret healing spots where the wifi is weak but the connection to nature is strong. 🍃✨\n\n#HealingTrip #Cebu #CebuTravel #NatureRetreat #MindfulTravel",
                "Nothing but blue skies and private pools. 💧 Escaping the Seoul rush hour for this slice of paradise. Who would you bring here? ✈️\n\n#CebuPhilippines #TravelAesthetic #RestAndRelax #LuxuryCebu #HealingJourney",
            ],
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
                "POV: You just woke up in paradise. 🌊 No alarms, just ocean sounds. This is your sign to book that healing trip. ✈️🇵🇭\n\n#TravelTok #Cebu #HealingVibes #Philippines #HealingTrip #POVTravel",
                "Stop scrolling and take a deep breath. 🌬️ This is what 6AM in Cebu looks like. Healing energy only. ☁️✨\n\n#HealingVibes #Cebu2025 #TravelTok #MorningRoutine #Philippines",
                "The Cebu aesthetic you didn't know you needed. 🥥 Wait for the sunset reveal at the end... 🌅\n\n#POVTravel #HealingTrip #Philippines #HiddenGem #Cebu",
            ],
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
                "🌅 Imagine waking up to this every morning. Cebu is calling — are you ready to answer?\n\nPerfect for a healing retreat, reconnection journey, or simply the rest you've been postponing. Our Cebu Healing Coast Package is designed for you.\n\n📍 Cebu, Philippines  🌊 3D2N from ₩890,000\n\n#CebuTravel #HealingDestination #VisitCebu #PhilippinesTravel",
                "Looking for a quiet escape this weekend? 🌴 Swap your busy schedule for a slow morning in Cebu. Tag a friend who desperately needs a healing vacation! 👇\n\n📍 Cebu Healing Coast\n🌊 Book now and save 15% on early bird packages.\n\n#CebuTravel #VisitCebu #HealingDestination #BarkadaTrip",
            ],
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

    _creative_log.info("Gemini creative direction ok market=%s", market)
    return {
        "visualGuide":            out.get("visualGuide") or fallback["visualGuide"],
        "shots":                  out.get("shots") or fallback["shots"],
        "moodboard":              out.get("moodboard") or fallback["moodboard"],
        "platformRecommendations": out.get("platformRecommendations") or fallback["platformRecommendations"],
        "source": "gemini",
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

    _compliance_log.info("Gemini multimodal VAS ok market=%s vas=%s", market, vas)
    return {
        "vas":       vas,
        "aligned":   list(out.get("aligned") or [])[:5],
        "gaps":      list(out.get("gaps") or [])[:4],
        "mismatches": list(out.get("mismatches") or [])[:3],
        "source":    "gemini",
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


def performance_report(metrics: dict) -> dict:
    if not _enabled():
        return {
            "executiveSummary": "Over the selected period, the campaign successfully generated high top-of-funnel awareness within the Cebu metropolitan area. However, the overall Promotional Effectiveness Score (PES) indicates a significant efficiency leak mid-funnel. While cost-per-click (CPC) remains highly competitive for local MSME benchmarks, the traffic acquired is not converting into actionable leads at the expected rate.",
            "lowestMetric": "Conversion Rate",
            "lowestMetricMeaning": "Most clicks aren't turning into bookings. The traffic shape is right; what happens after the click isn't.",
            "recommendations": [
                "Realign Ad Copy with Landing Page Intent — ensure the headline on the destination page mirrors the localized Cebu promotional offer.",
                "Implement High-Intent Audience Filtering — shift 20% of the ad spend away from broad awareness targeting.",
                "Streamline the Conversion Form — reduce lead capture to Name and Phone Number only.",
            ],
            "otherAreasImprove": [
                "Impressions → Clicks drop-off",
                "Conversions → Bookings drop-off",
            ],
            "weakestStage": {
                "name": "Clicks → Conversions",
                "dropoff": "-88.1%",
                "diagnosis": "High traffic volume but low landing page engagement.",
            },
            "secondaryLeaks": [
                {"name": "Impressions → Clicks", "dropoff": "-95.2%", "diagnosis": "Ad creative not stopping the scroll."},
                {"name": "Conversions → Bookings", "dropoff": "-78.8%", "diagnosis": "Form friction and trust gaps at booking."},
            ],
        }
    return _generate_json(
        f"""You are CeView's Lead Marketing Analyst. Given these campaign metrics: {json.dumps(metrics)},
identify the lowest-performing PES metric, write a plain-language meaning, list 3+ ranked
recommendations and a few other areas to improve, plus the weakest funnel stage with diagnosis.
Return JSON.""",
    )
