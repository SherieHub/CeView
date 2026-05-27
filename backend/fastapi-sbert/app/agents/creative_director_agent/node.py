"""LangGraph node implementations for the Caption Generation Agent (Submodule 3.1).

Node 1 — analyze_services:
    Filters all business services down to those relevant to the market category.

Node 2 — generate_platform_captions:
    Generates the 3-platform × 3-variation caption matrix using the
    platform-aware prompt template from prompts.py.

Both nodes raise RuntimeError with a structured error code when the LLM is
unavailable or Gemini returns an unusable response.  No fallback captions are
returned — callers must surface the error to the operator.
"""
from __future__ import annotations

import logging

from langchain_core.output_parsers import JsonOutputParser  # type: ignore[import]

from app import errors
from app.agents.creative_director_agent.prompts import (
    caption_generation_prompt,
    service_analysis_prompt,
)
from app.agents.creative_director_agent.state import SocialAgentState
from app.core.AgentLLMModel import model as llm_with_tools

logger = logging.getLogger(__name__)

_FALLBACK_SERVICES = ["resort stay", "beach activities", "local tours"]


# ── Graph nodes ───────────────────────────────────────────────────────────────

def analyze_services(state: SocialAgentState) -> dict:
    """Node 1 — Filter business services to those relevant to the market category."""
    if llm_with_tools is None:
        logger.error(
            "[%s] caption_agent.analyze_services: LLM unavailable — GOOGLE_API_KEY may be unset or invalid.",
            errors.MOD31_LLM_UNAVAILABLE,
        )
        raise RuntimeError(errors.MOD31_LLM_UNAVAILABLE)

    try:
        chain = service_analysis_prompt | llm_with_tools | JsonOutputParser()
        filtered = chain.invoke({
            "market_category": state.get("market_category", ""),
            "business_services": state.get("business_services", []),
        })
        return {"relevant_services": filtered if isinstance(filtered, list) else state.get("business_services", _FALLBACK_SERVICES)}
    except Exception as exc:
        logger.error(
            "[%s] caption_agent.analyze_services failed: %s",
            errors.MOD31_CAPTION_AGENT_FAILED,
            exc,
        )
        raise RuntimeError(errors.MOD31_CAPTION_AGENT_FAILED) from exc


def generate_platform_captions(state: SocialAgentState) -> dict:
    """Node 2 — Generate 3-platform × 3-variation caption matrix.

    Passes full market context (target_market, forecast_context, research_context)
    to the platform-aware prompt so Gemini can produce culturally localised,
    platform-rule-compliant captions with named variation types.
    """
    if llm_with_tools is None:
        logger.error(
            "[%s] caption_agent.generate_platform_captions: LLM unavailable — GOOGLE_API_KEY may be unset or invalid.",
            errors.MOD31_LLM_UNAVAILABLE,
        )
        raise RuntimeError(errors.MOD31_LLM_UNAVAILABLE)

    try:
        chain = caption_generation_prompt | llm_with_tools | JsonOutputParser()

        invoke_data = {
            "business_name":        state.get("business_name", ""),
            "business_description": state.get("business_description", ""),
            "business_uvp":         state.get("business_uvp", ""),
            "business_services":    state.get("business_services", []),
            "market_category":      state.get("market_category", ""),
            "country_market":       state.get("country_market", "Philippines"),
            "target_market":        state.get("target_market", ""),
            "relevant_services":    state.get("relevant_services", _FALLBACK_SERVICES),
            "forecast_context":     state.get("forecast_context", ""),
            "research_context":     state.get("research_context", ""),
        }

        matrix = chain.invoke(invoke_data)

        if not isinstance(matrix, dict):
            logger.error(
                "[%s] Gemini returned non-dict for caption matrix: %r",
                errors.MOD31_CAPTION_AGENT_FAILED,
                type(matrix),
            )
            raise ValueError(f"[{errors.MOD31_CAPTION_AGENT_FAILED}] Gemini returned non-dict for caption matrix")

        for platform in ("facebook", "instagram", "tiktok"):
            if not matrix.get(platform) or len(matrix[platform]) < 1:
                logger.error(
                    "[%s] Gemini output missing platform '%s'",
                    errors.MOD31_CAPTION_AGENT_FAILED,
                    platform,
                )
                raise ValueError(f"[{errors.MOD31_CAPTION_AGENT_FAILED}] Gemini output missing platform '{platform}'")
            for opt in matrix[platform]:
                if isinstance(opt, dict) and not opt.get("caption"):
                    opt["caption"] = ""

        return {"final_captions": matrix}

    except (RuntimeError, ValueError):
        raise
    except Exception as exc:
        logger.error(
            "[%s] caption_agent.generate_platform_captions failed: %s",
            errors.MOD31_CAPTION_AGENT_FAILED,
            exc,
        )
        raise RuntimeError(errors.MOD31_CAPTION_AGENT_FAILED) from exc
