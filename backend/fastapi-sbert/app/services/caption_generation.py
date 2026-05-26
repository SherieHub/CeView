from __future__ import annotations

import logging

from app.agents.creative_director_agent.graph import caption_generation_agent
from app.model.CaptionInputClass import CaptionInputClass

logger = logging.getLogger(__name__)

_FALLBACK_CAPTIONS = {
    "facebook": [
        {"variation": "Informative",    "caption": "Discover Cebu's hidden paradise. Book your healing escape today. 🌊 #CebuTravel"},
        {"variation": "Emotional",      "caption": "Feel the warm sea breeze and let Cebu heal your soul. 🌴✨"},
        {"variation": "Call-to-Action", "caption": "Limited slots — plan your Cebu getaway now! Link in bio. 🇵🇭"},
    ],
    "instagram": [
        {"variation": "Aesthetic",      "caption": "Morning light. Ocean breeze. Pure Cebu. ☁️🌊 #HealingTrip"},
        {"variation": "Storytelling",   "caption": "This is where the healing starts. Cebu, Philippines. 🌿"},
        {"variation": "Trendy",         "caption": "Cebu is calling — are you ready to answer? 🐚✨ #TravelGoals"},
    ],
    "tiktok": [
        {"variation": "POV",            "caption": "POV: You woke up in paradise. 🌅 #Cebu #HealingVibes"},
        {"variation": "Educational",    "caption": "5 reasons Cebu should be your next healing trip → #CebuTravel"},
        {"variation": "Trending",       "caption": "No thoughts, just Cebu waves. 🌊 #TravelTok #Philippines"},
    ],
}


async def caption_generation_service(input: CaptionInputClass) -> dict:
    """Invoke the LangGraph caption generation agent.

    Returns the compiled 3-platform caption matrix from the agent state,
    or deterministic fallback captions if the agent is unavailable.
    """
    try:
        result = await caption_generation_agent.ainvoke(input.model_dump())
        captions = result.get("final_captions")
        if not captions:
            logger.warning("caption_agent returned empty final_captions — using fallback")
            return {"final_captions": _FALLBACK_CAPTIONS, "source": "fallback"}
        return {"final_captions": captions, "source": "gemini"}
    except Exception as exc:
        logger.warning("caption_agent.ainvoke failed: %s — returning fallback captions", exc)
        return {"final_captions": _FALLBACK_CAPTIONS, "source": "fallback"}
