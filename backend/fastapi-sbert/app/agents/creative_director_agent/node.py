from __future__ import annotations

import logging

from langchain_core.output_parsers import JsonOutputParser  # type: ignore[import]
from app.agents.creative_director_agent.state import SocialAgentState
from app.agents.creative_director_agent.prompts import service_analysis_prompt, caption_generation_prompt
from app.core.AgentLLMModel import model as llm_with_tools

logger = logging.getLogger(__name__)

# ── Fallback stubs used when the LLM is unavailable ──────────────────────────

_FALLBACK_SERVICES = ["resort stay", "beach activities", "local tours"]

_FALLBACK_CAPTIONS: dict = {
    "facebook": [
        {"variation": "Informative",  "caption": "Discover Cebu's hidden paradise. Book your healing escape today. 🌊 #CebuTravel"},
        {"variation": "Emotional",    "caption": "Feel the warm sea breeze and let Cebu heal your soul. 🌴✨"},
        {"variation": "Call-to-Action", "caption": "Limited slots — plan your Cebu getaway now! Link in bio. 🇵🇭"},
    ],
    "instagram": [
        {"variation": "Aesthetic",    "caption": "Morning light. Ocean breeze. Pure Cebu. ☁️🌊 #HealingTrip"},
        {"variation": "Storytelling", "caption": "This is where the healing starts. Cebu, Philippines. 🌿"},
        {"variation": "Trendy",       "caption": "Cebu is calling — are you ready to answer? 🐚✨ #TravelGoals"},
    ],
    "tiktok": [
        {"variation": "POV",          "caption": "POV: You woke up in paradise. 🌅 #Cebu #HealingVibes"},
        {"variation": "Educational",  "caption": "5 reasons Cebu should be your next healing trip → #CebuTravel"},
        {"variation": "Trending",     "caption": "No thoughts, just Cebu waves. 🌊 #TravelTok #Philippines"},
    ],
}


# ── Graph nodes ───────────────────────────────────────────────────────────────

def analyze_services(state: SocialAgentState) -> dict:
    """Filter business services to those relevant to the market category (Node 1)."""
    if llm_with_tools is None:
        logger.info("caption_agent.analyze_services: LLM unavailable — returning all services as relevant.")
        return {
            "relevant_services": state.get("business_services", _FALLBACK_SERVICES),
        }

    try:
        chain = service_analysis_prompt | llm_with_tools | JsonOutputParser()
        filtered = chain.invoke({
            "market_category": state["market_category"],
            "business_services": state["business_services"],
        })
        return {"relevant_services": filtered}
    except Exception as exc:
        logger.warning("caption_agent.analyze_services failed: %s", exc)
        return {"relevant_services": state.get("business_services", _FALLBACK_SERVICES)}


def generate_platform_captions(state: SocialAgentState) -> dict:
    """Generate 3-variation caption matrix for Facebook, Instagram, TikTok (Node 2)."""
    if llm_with_tools is None:
        logger.info("caption_agent.generate_platform_captions: LLM unavailable — returning fallback captions.")
        return {"final_captions": _FALLBACK_CAPTIONS}

    try:
        chain = caption_generation_prompt | llm_with_tools | JsonOutputParser()
        matrix = chain.invoke(state)
        return {"final_captions": matrix}
    except Exception as exc:
        logger.warning("caption_agent.generate_platform_captions failed: %s", exc)
        return {"final_captions": _FALLBACK_CAPTIONS}
