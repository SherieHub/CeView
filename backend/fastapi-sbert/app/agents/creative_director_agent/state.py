"""LangGraph state schema for the Caption Generation Agent (Submodule 3.1).

SocialAgentState carries every value the two nodes need across the graph:
  Node 1 (analyze_services)          → writes  relevant_services
  Node 2 (generate_platform_captions) → writes  final_captions

New fields (target_market, forecast_context, research_context) are
pre-formatted string blocks injected directly into the LangChain
prompt template — they must be populated by the caller before invoking
the graph (via CaptionInputClass).
"""
from typing import Any, Dict, List, TypedDict


class SocialAgentState(TypedDict):
    # ── Core business context (required) ─────────────────────────────────────
    business_name:        str
    business_description: str
    business_uvp:         str
    business_services:    List[str]   # full list; Node 1 filters this down
    market_category:      str         # e.g. "Coastal & Island", "healing travel"
    country_market:       str         # e.g. "Philippines"

    # ── Market localisation context (optional, defaults to empty string) ─────
    target_market:        str   # e.g. "South Korea", "Japan", "USA"
                                # injected into prompt as {target_market}

    forecast_context:     str   # pre-formatted multi-line block, e.g.:
                                #   "Market forecast context:\n- Market score: 0.87 / 1.0\n..."
                                # empty string when Module 2 data is unavailable

    research_context:     str   # pre-formatted multi-line block from SerpAPI/cultural_research,
                                # e.g.: "Cultural research context:\n- Traveller behaviour: ..."
                                # empty string when SerpAPI is unavailable

    # ── Derived / generated (written by graph nodes) ─────────────────────────
    relevant_services: List[str]                           # set by Node 1
    final_captions:    Dict[str, List[Dict[str, Any]]]    # set by Node 2
    # final_captions shape (6-field schema — one object per demographic archetype):
    # {
    #   "facebook":  [ { "core_business_context": "...",
    #                    "market_cultural_localization": "...",
    #                    "psychological_elements": "...",
    #                    "creative_tone_atmosphere": "...",
    #                    "algorithmic_platform_architecture": "...",
    #                    "caption": "..." }, ... ]
    #   "instagram": [ { … same 6 fields … }, ... ]
    #   "tiktok":    [ { … same 6 fields … }, ... ]
    # }
