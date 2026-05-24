"""
Server-side Gemini wrapper. Mirrors the five prompts currently in the
frontend's `ceview/services/geminiService.ts` so swapping the frontend over
later changes only the transport, not the behavior.

When ENABLE_GEMINI is false or GEMINI_API_KEY is missing, every function
returns a deterministic mock matching the frontend's existing data shapes —
sufficient for offline dev and CI.
"""

from __future__ import annotations

import json
import os
from typing import Any

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
    resp = _client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=cfg,
    )
    try:
        return json.loads(resp.text or "{}")
    except Exception:
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
        return {
            "descriptionScore": 72,
            "categoryScore": 58,
            "descriptionReasoning": "Use more sensory, place-specific language to separate your copy from generic resort descriptions.",
            "categoryReasoning": "Align but diversify your category mix to stand out from nearby competitors.",
        }
    return _generate_json(
        f"""You are CeView's Uniqueness Analyst for Philippine tourism businesses.

Business: {business_name}
Categories: {', '.join(categories)}
Core Services: {', '.join(core_services)}
Description: {description}
UVP: {uvp}

Return JSON: descriptionScore (0-100), categoryScore (0-100), descriptionReasoning (string), categoryReasoning (string).""",
    )


def content_for_market(market: str, business_name: str, description: str,
                       categories: list[str], trend: str) -> dict:
    """
    Returns the same shape ContentStudioView.tsx assembles in its MOCK constant:
    { market: {country, flag, city}, framework, captions: { instagram, tiktok, facebook, naver },
      compliance: { score, aligned[], gaps[] } }
    """
    # Frontend always renders this shape — we keep the mock comprehensive so
    # the view renders without any None handling on the React side.
    base = {
        "market": {
            "korea": {"country": "South Korea", "flag": "🇰🇷", "city": "Seoul"},
            "japan": {"country": "Japan", "flag": "🇯🇵", "city": "Osaka"},
            "usa":   {"country": "USA",   "flag": "🇺🇸", "city": "Los Angeles"},
        }.get(market, {"country": "South Korea", "flag": "🇰🇷", "city": "Seoul"}),
        "framework": "SOR — Stimulus-Organism-Response",
        "captions": _mock_captions(),
        "compliance": {
            "score": 88,
            "aligned": [
                "Destination tags are correctly added so travelers can easily find your location.",
                "Text is clear and very easy to read against the background image.",
                "Important text is placed exactly where Korean travelers naturally look first.",
                "Words like 'healing' and 'rest' perfectly match what your target audience wants to see.",
            ],
            "gaps": [
                "The background looks a bit too crowded or messy. Try using a cleaner, simpler image.",
                "Missing words that suggest a 'fresh start' or 'new beginning', which Korean tourists love.",
                "No people are visible in the photo. Adding a person helps travelers imagine themselves there.",
            ],
        },
    }
    if not _enabled():
        return base

    prompt = f"""Generate culturally-localized social media content for Cebu tourism.
Market: {market}
Business: {business_name}
Description: {description}
Categories: {', '.join(categories)}
Trend: {trend}

Return JSON with the same shape as: {json.dumps(base)} — fill captions with three Instagram options,
three TikTok options, two Facebook options, two Naver Blog options (Korean text for Naver).
"""
    enriched = _generate_json(prompt)
    return enriched if enriched else base


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
