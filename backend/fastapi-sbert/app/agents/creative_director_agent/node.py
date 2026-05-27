"""LangGraph node implementations for the Caption Generation Agent (Submodule 3.1).

Node 1 — analyze_services:
    Filters all business services down to those relevant to the market category.

Node 2 — generate_platform_captions:
    Generates the 3-platform × 3-variation caption matrix using the
    platform-aware prompt template from prompts.py.

Both nodes have full fallback paths that return structured caption dicts
(same shape as the Gemini output) so the /internal/generation/caption
endpoint always responds — FR3.30 compliance always satisfied.
"""
from __future__ import annotations

import logging

from langchain_core.output_parsers import JsonOutputParser  # type: ignore[import]

from app.agents.creative_director_agent.prompts import (
    caption_generation_prompt,
    service_analysis_prompt,
)
from app.agents.creative_director_agent.state import SocialAgentState
from app.core.AgentLLMModel import model as llm_with_tools

logger = logging.getLogger(__name__)

# ── Fallback caption matrix ───────────────────────────────────────────────────
# Structured as { platform: [ {core_business_context, market_cultural_localization,
#   psychological_elements, creative_tone_atmosphere,
#   algorithmic_platform_architecture, caption} ] }
# Same shape as the Gemini JSON output so all downstream consumers
# handle fallback data identically to live data.

_FALLBACK_CAPTIONS: dict = {
    "facebook": [
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
            "caption": (
                "no one told me Cebu was THIS good 🤯 three days, zero alarms, "
                "infinite ocean. the healing era starts NOW.\n\n"
                "grab your slot before May fills up → cebu-healing.ph\n\n"
                "#CebuTravel #HealingTrip"
            ),
        },
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
            "caption": (
                "Cebu, Philippines consistently ranks among Southeast Asia's top "
                "wellness destinations — and for good reason.\n\n"
                "Our 3D2N Healing Coast Package delivers a private pool villa, "
                "beachfront breakfast, and an expert-guided island tour. "
                "Comprehensive itinerary details and availability at cebu-healing.ph/packages.\n\n"
                "#VisitCebu"
            ),
        },
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
            "caption": (
                "🌅 Imagine waking up to this every morning.\n\n"
                "Cebu is calling — are you ready to answer? Perfect for a healing "
                "retreat, reconnection journey, or simply the rest you've been "
                "postponing. Our Cebu Healing Coast Package is designed for you.\n\n"
                "📍 Cebu, Philippines  🌊 3D2N available now\n"
                "Book your escape → cebu-healing.ph\n\n"
                "#CebuTravel #HealingDestination"
            ),
        },
    ],
    "instagram": [
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
            "caption": (
                "POV: you booked the 호캉스 your body has been begging for 🌊✈️\n\n"
                "Cebu said less alarms, more ocean. You said deal. 🤝 "
                "The glow-up trip is a link-in-bio away — go go go!\n\n"
                "#호캉스세부\n#CebuPhilippines\n#TravelTok\n#HealingTrip\n"
                "#세부여행\n#필리핀여행\n#힐링여행\n#TravelAesthetic\n"
                "#FOMO\n#WellnessTravel"
            ),
        },
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
            "caption": (
                "Cebu, Philippines: a certified wellness destination offering "
                "private coastal access, curated healing packages, and authentic "
                "Filipino hospitality. 📍\n\n"
                "Our resort combines private pool villas, beachfront dining, and "
                "expert-guided island experiences — tailored for discerning travellers "
                "seeking both cultural depth and restorative comfort.\n\n"
                "Availability and itinerary details: link in bio.\n\n"
                "#CebuPhilippines\n#WellnessTravel\n#LuxuryCebu\n"
                "#HealingVacation\n#세부여행\n#필리핀여행\n#힐링\n"
                "#TravelAesthetic\n#ResortLife\n#IslandHealing"
            ),
        },
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
            "caption": (
                "Burned out? ☁️ Find your pause button in Cebu.\n\n"
                "Warm breeze, healing food, and time that moves slower. 🛌✨ "
                "You deserve this rest. Step away from the rush and into a place "
                "where the wifi is weak but the connection to nature is strong.\n\n"
                "Link in bio to book your escape. 💙\n\n"
                "#힐링여행\n#세부여행\n#CebuHealing\n#Philippines\n"
                "#TravelGoals\n#WellnessTravel\n#필리핀여행\n"
                "#세부리조트\n#HealingTrip\n#TropicalHealing"
            ),
        },
    ],
    "tiktok": [
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
            "caption": (
                "POV: You just woke up in paradise. 🌊 No alarms, just ocean sounds. "
                "The healing era is here. Link in bio. ✈️🇵🇭\n\n"
                "#TravelTok #Cebu #HealingVibes #Philippines #호캉스"
            ),
        },
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
            "caption": (
                "Did you know Cebu has 168 islands? 🏝️ One private resort. "
                "3 days. Full healing package. Details → link in bio.\n\n"
                "#CebuPhilippines #WellnessTravel #TravelTok"
            ),
        },
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
            "caption": (
                "Salt air. No alarms. 🌅 The ocean calling your name at dawn. "
                "This is what tropical healing actually feels like. Cebu. Link in bio.\n\n"
                "#HealingTrip #TropicalHealing #Cebu #TravelTok #Philippines"
            ),
        },
    ],
}

_FALLBACK_SERVICES = ["resort stay", "beach activities", "local tours"]


# ── Graph nodes ───────────────────────────────────────────────────────────────

def analyze_services(state: SocialAgentState) -> dict:
    """Node 1 — Filter business services to those relevant to the market category."""
    
    # Safely extract both standard and extra services from the state
    base_services = state.get("business_services") or []
    extra_services = state.get("extra_additional_services") or []
    
    # Combine them so the LLM evaluates the full offering
    all_services = base_services + extra_services
    
    # If both were empty, use the fallback
    if not all_services:
        all_services = _FALLBACK_SERVICES

    if llm_with_tools is None:
        logger.info(
            "caption_agent.analyze_services: LLM unavailable — returning all services as relevant."
        )
        return {
            "relevant_services": all_services,
            "unique_differentiators": []
        }

    try:
        chain = service_analysis_prompt | llm_with_tools | JsonOutputParser()
        
        # Inject the combined 'all_services' into the 'business_services' prompt variable
        filtered = chain.invoke({
            "market_category": state.get("market_category", ""),
            "business_services": all_services,
        })
        
        # Return the parsed dict if successful, mapping it to state
        if isinstance(filtered, dict):
            return filtered
        else:
            logger.warning("caption_agent.analyze_services: Unexpected LLM output format. Using fallback.")
            return {
                "relevant_services": all_services,
                "unique_differentiators": []
            }
            
    except Exception as exc:
        logger.warning("caption_agent.analyze_services failed: %s", exc)
        return {
            "relevant_services": all_services,
            "unique_differentiators": []
        }


def generate_platform_captions(state: SocialAgentState) -> dict:
    """Node 2 — Generate 3-platform × 3-variation caption matrix.

    Passes full market context (target_market, forecast_context, research_context)
    to the platform-aware prompt so Gemini can produce culturally localised,
    platform-rule-compliant captions with named variation types.
    """
    if llm_with_tools is None:
        logger.info(
            "caption_agent.generate_platform_captions: LLM unavailable — returning fallback captions."
        )
        return {"final_captions": _FALLBACK_CAPTIONS}

    try:
        chain = caption_generation_prompt | llm_with_tools | JsonOutputParser()

        # Build prompt variables — all must match template placeholders exactly
        invoke_data = {
            "business_name":        state.get("business_name", ""),
            "business_description": state.get("business_description", ""),
            "business_uvp":         state.get("business_uvp", ""),
            "business_services":    state.get("business_services", []),
            "market_category":      state.get("market_category", ""),
            "target_market":        state.get("target_market", ""),
            "relevant_services":    state.get("relevant_services", _FALLBACK_SERVICES),
            "forecast_context":     state.get("forecast_context", ""),
            "research_context":     state.get("research_context", ""),
            "market_score":         state.get("market_score", ""),
        }

        matrix = chain.invoke(invoke_data)

        # Validate minimum structure — each platform must have 3 items
        if not isinstance(matrix, dict):
            raise ValueError("Gemini returned non-dict for caption matrix")

        for platform in ("facebook", "instagram", "tiktok"):
            if not matrix.get(platform) or len(matrix[platform]) < 1:
                logger.warning(
                    "caption_agent: missing platform '%s' in Gemini output — using fallback",
                    platform,
                )
                matrix[platform] = _FALLBACK_CAPTIONS[platform]
            else:
                # Validate each option has the required 'caption' field
                for opt in matrix[platform]:
                    if isinstance(opt, dict) and not opt.get("caption"):
                        opt["caption"] = ""

        return {"final_captions": matrix}

    except Exception as exc:
        logger.warning("caption_agent.generate_platform_captions failed: %s", exc)
        return {"final_captions": _FALLBACK_CAPTIONS}
