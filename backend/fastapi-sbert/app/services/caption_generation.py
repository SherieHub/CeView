from __future__ import annotations

import logging

from app.agents.creative_director_agent.graph import caption_generation_agent
from app.model.CaptionInputClass import CaptionInputClass

logger = logging.getLogger(__name__)

# ── Service-level fallback captions (6-field schema) ─────────────────────────
# Used only when the LangGraph agent itself raises an unhandled exception.
# Shape mirrors the agent's _FALLBACK_CAPTIONS so all consumers handle
# fallback data identically to live data.
_FALLBACK_CAPTIONS = {
    "facebook": [
        {
            "core_business_context": "Cebu coastal healing resort, 3D2N package, private ocean access.",
            "market_cultural_localization": "Casual register for Gen Z/millennial Southeast Asian audience; urgency hook.",
            "psychological_elements": "FOMO (limited slots), urgency (seasonal deadline), social proof.",
            "creative_tone_atmosphere": "Lowercase, punchy, high emoji density. Electric and hyper-present.",
            "algorithmic_platform_architecture": "Facebook: 3 short paragraphs, embedded URL in CTA, 2 hashtags.",
            "caption": "no one told me Cebu was THIS good 🤯 three days, zero alarms, infinite ocean. the healing era starts NOW.\n\ngrab your slot before May fills up → cebu-healing.ph\n\n#CebuTravel #HealingTrip",
        },
        {
            "core_business_context": "Wellness resort; 3D2N package with private pool villa and beachfront breakfast.",
            "market_cultural_localization": "Formal English for mature international travellers; SE Asia ranking credibility.",
            "psychological_elements": "Exclusivity, value certainty, social proof (SE Asia ranking). Rational trigger.",
            "creative_tone_atmosphere": "Professional, editorial, low emoji. Trustworthy and premium.",
            "algorithmic_platform_architecture": "Facebook: 2 content paragraphs + CTA with URL, 1 hashtag.",
            "caption": "Cebu ranks among Southeast Asia's top wellness destinations.\n\nOur 3D2N Healing Coast Package: private pool villa, beachfront breakfast, expert-guided island tour. Details at cebu-healing.ph/packages.\n\n#VisitCebu",
        },
        {
            "core_business_context": "Cebu Healing Coast Package positioned as emotional reset destination.",
            "market_cultural_localization": "Universal English; aspirational healing-travel editorial tone.",
            "psychological_elements": "Escapism, emotional appeal, relatability, subtle FOMO. Arc: longing → invitation → CTA.",
            "creative_tone_atmosphere": "Cinematic, warm, golden-hour aspirational. Moderate emoji.",
            "algorithmic_platform_architecture": "Facebook: 3 emotional paragraphs + booking URL, 2 hashtags.",
            "caption": "🌅 Imagine waking up to this every morning.\n\nCebu is calling — the rest you've been postponing starts here. Our Healing Coast Package is designed for exactly this.\n\n📍 Cebu, Philippines  🌊 3D2N available now\nBook your escape → cebu-healing.ph\n\n#CebuTravel #HealingDestination",
        },
    ],
    "instagram": [
        {
            "core_business_context": "Korean-market healing resort; 호캉스 positioning, link-in-bio CTA.",
            "market_cultural_localization": "Korean hashtags embedded (호캉스세부, 세부여행); bilingual discovery.",
            "psychological_elements": "FOMO, hype, social proof via trend alignment. Playful deal-closing.",
            "creative_tone_atmosphere": "Gen Z slang, very high emoji density. Energetic and viral-adjacent.",
            "algorithmic_platform_architecture": "Instagram: ≤2,200 chars; 125-char hook; link-in-bio; 10 native hashtags.",
            "caption": "POV: you finally booked that 호캉스 you've been dreaming about 🙌✈️\n\nCebu hit different. Private beach. Zero stress. Pure healing energy.\n\nLink in bio → snag your slot 🌊\n\n#호캉스세부 #세부여행 #힐링여행 #CebuTravel #HealingTrip",
        },
        {
            "core_business_context": "Cebu healing resort; positions as premium wellness destination for discerning Korean travellers.",
            "market_cultural_localization": "Korean wellness travel context; professional trust-building; KTX-travel aspirational frame.",
            "psychological_elements": "Authority, exclusivity, investment framing (worth every peso). Mature satisfaction.",
            "creative_tone_atmosphere": "Clean, aspirational editorial. Low emoji. Refined wellness brand voice.",
            "algorithmic_platform_architecture": "Instagram: structured paragraphs; branded hashtag + 4 discovery tags.",
            "caption": "For those who travel with intention.\n\nCebu's healing coastline offers something rare — genuine stillness. Private villas. Sunrise sessions. Expert wellness guides.\n\nBook through link in bio.\n\n#CebuWellness #VisitCebu #힐링여행 #TravelWithPurpose",
        },
        {
            "core_business_context": "Cebu resort; aspirational story of transformation through travel.",
            "market_cultural_localization": "Universal English with Korean discovery hashtags; targets aspirational travel content consumers.",
            "psychological_elements": "Transformation narrative, self-investment justification, vicarious escapism.",
            "creative_tone_atmosphere": "Storytelling, warm, immersive. Moderate emoji. Cinematic POV.",
            "algorithmic_platform_architecture": "Instagram: storytelling arc in 3 micro-paragraphs; 6 mixed hashtags.",
            "caption": "🌿 Three days in Cebu changed something in me.\n\nI arrived exhausted. I left lighter.\n\nThat's the thing about real healing — it happens in the quiet between the waves.\n\n📍 Cebu, Philippines\n\n#HealingTravel #CebuPhilippines #세부여행 #힐링 #TravelStories",
        },
    ],
    "tiktok": [
        {
            "core_business_context": "Cebu healing resort; short-form viral hook for TikTok discovery.",
            "market_cultural_localization": "TikTok Gen Z language; rapid-fire pacing; trend-native structure.",
            "psychological_elements": "Pattern interrupt, FOMO, aspiration. Hook stops the scroll immediately.",
            "creative_tone_atmosphere": "Ultra-short, punchy, lowercase. Maximum scroll-stop energy.",
            "algorithmic_platform_architecture": "TikTok: ≤300 chars optimal; hook first 3 words; 3–5 hashtags.",
            "caption": "cebu literally fixed me 🌊✨ 3 days no alarm no meetings just ocean\n\n#CebuTravel #HealingVibes #HealingTrip #TravelTok",
        },
        {
            "core_business_context": "Cebu resort; educational format for informed travel decision-making.",
            "market_cultural_localization": "Educational TikTok format popular with Korean and SE Asian travel researchers.",
            "psychological_elements": "Curiosity gap, authority, value stacking. Decision-making support.",
            "creative_tone_atmosphere": "List format, confident, informative. Medium emoji.",
            "algorithmic_platform_architecture": "TikTok: list hook, under 300 chars, 4 discovery hashtags.",
            "caption": "5 things nobody tells you about Cebu healing trips 👇\n1. it's cheaper than Bali\n2. the ocean actually calms you\n3. private villas exist under ₱10k/night\n\n#CebuTravel #TravelTips #HealingTrip #TravelTok",
        },
        {
            "core_business_context": "Cebu resort; emotional storytelling optimised for TikTok shares.",
            "market_cultural_localization": "Emotional resonance across Korean and global audiences; universally relatable burnout narrative.",
            "psychological_elements": "Relatability (burnout), transformation, escapism. Sharing trigger through emotional truth.",
            "creative_tone_atmosphere": "Quiet, honest, minimal. Poetic brevity. Low emoji — lets emotion carry.",
            "algorithmic_platform_architecture": "TikTok: under 150 chars; 3 targeted hashtags; emotional shareability.",
            "caption": "no thoughts. just waves. 🌊\n\ncebu is the reset button i didn't know i needed.\n\n#Cebu #HealingVibes #TravelTok",
        },
    ],
}


async def caption_generation_service(input: CaptionInputClass) -> dict:
    """Invoke the LangGraph caption generation agent (Submodule 3.1).

    Returns the compiled 3-platform caption matrix from the agent state
    (6-field schema: core_business_context, market_cultural_localization,
    psychological_elements, creative_tone_atmosphere,
    algorithmic_platform_architecture, caption).

    Falls back to deterministic 6-field captions if the agent is unavailable.
    """
    try:
        result = await caption_generation_agent.ainvoke(input.model_dump())
        captions = result.get("final_captions")
        if not captions:
            logger.error("caption_agent returned empty final_captions — using fallback")
            return {"final_captions": _FALLBACK_CAPTIONS, "source": "fallback"}
        return {"final_captions": captions, "source": "gemini"}
    except Exception as exc:
        logger.error("caption_agent.ainvoke failed: %s — returning fallback captions", exc)
        return {"final_captions": _FALLBACK_CAPTIONS, "source": "fallback"}
