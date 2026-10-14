"""Submodule 3.1 — Market-Localized Promotional Content Generation (FR3.1-FR3.10).

Called by Spring Boot ContentGenerationService with a fully enriched payload
that includes business profile attributes, uniqueness score, Module 2 forecast
outputs, and the market selection.

AGENT WIRING (Phase 5 integration):
  Caption generation is now routed through the LangGraph caption_generation_agent
  (analyze_services → generate_platform_captions nodes in graph.py).
  Visual guides come from gemini_client.get_platform_guides()
  so no second LLM call is needed for supplementary assets.

FR3.3 — real-time cultural research via cultural_research.py (before the agent)
FR3.4 — forecast context injected into agent's CaptionInputClass
FR3.5/FR3.6 — 3-platform × 3-archetype caption matrix via agent; wrapped into ContentResponseDto
"""
from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import errors as err_codes
from app.config.markets import CONTENT_FRAMEWORK, MARKET_DISPLAY_NAMES, market_header
from app.services import cultural_research, gemini_client
from app.services.caption_formatting import transform_captions
from app.services.caption_generation import caption_generation_service
from app.model.CaptionInputClass import CaptionInputClass

router = APIRouter()
log = logging.getLogger("module3.content")

# ─── Pydantic schema ──────────────────────────────────────────────────────────

class ContentGenerateRequest(BaseModel):
    """Request payload forwarded by Spring Boot ContentGenerationService.

    All fields except `market` are optional because the service populates them
    from the BusinessProfile entity; defaults prevent a 422 if any are absent.
    """
    market:          str        = Field(default="korea", description="korea | japan | usa")
    businessName:    str        = Field(default="")
    description:     str        = Field(default="")
    uvp:             str        = Field(default="", description="Unique Value Proposition from business profile")
    categories:      list[str]  = Field(default_factory=list)
    trend:           str        = Field(default="")
    uniquenessScore: int        = Field(default=0, ge=0, le=100)
    forecastContext: dict       = Field(
        default_factory=dict,
        description="{ marketScore, predictedDemand, spikeIndicator, seasonalityScore } from Module 2",
    )


class ContentResponse(BaseModel):
    """Mirrors backend ContentDtos.ContentResponseDto."""
    market:    dict
    framework: str
    captions:  dict
    # Closed on purpose, and with no default. "fallback" was both the type's only
    # other value and its default, which meant an unset source silently shipped as
    # synthetic. Widening this is the visible diff that reintroducing a fallback
    # would require. See the spec's Section 5.
    source:    Literal["groq"]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _format_forecast_context(fc: dict, uniqueness_score: int, spike: bool) -> str:
    """Format the Module 2 forecastContext dict into the pre-formatted string
    the LangGraph prompt template expects as {forecast_context}."""
    if not fc:
        return ""
    score      = fc.get("marketScore", "")
    demand     = fc.get("predictedDemand", "")
    seasonality = fc.get("seasonalityScore", "")
    return (
        f"Market forecast context (Module 2 outputs):\n"
        f"- Market score: {score} / 1.0\n"
        f"- Predicted 4-week demand index: {demand}\n"
        f"- Demand spike detected: {spike}"
        f"{' — use urgency framing' if spike else ''}\n"
        f"- Seasonality score: {seasonality}\n"
        f"- Uniqueness score: {uniqueness_score} / 100\n"
    )


def _format_research_context(rc: dict) -> str:
    """Format a cultural_research result dict into the pre-formatted string
    the LangGraph prompt template expects as {research_context}."""
    if not rc:
        return ""
    return (
        f"Cultural research context (source: {rc.get('source', 'template')}):\n"
        f"- Traveler behavior: {rc.get('traveler_behavior', '')}\n"
        f"- Tourism preferences: {rc.get('tourism_preferences', '')}\n"
        f"- Platform styles: {rc.get('platform_styles', '')}\n"
        f"- Language nuances: {rc.get('language_nuances', '')}\n"
    )


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ContentResponse)
async def generate(req: ContentGenerateRequest) -> ContentResponse:
    """Generate market-localised promotional content via the LangGraph caption agent.

    Pipeline:
      1. FR3.3 — real-time cultural research via cultural_research.research_market()
      2. FR3.4 — format Module 2 forecast context as agent-ready string
      3. FR3.5 — build CaptionInputClass and invoke caption_generation_agent
                 (analyze_services → generate_platform_captions nodes)
      4. FR3.6 — transform agent output into ContentResponseDto shape:
                 options[], optionNames[], optionMetadata[], guide[] per platform

    Response shape:
        market   — { country, city, flag }
        framework — strategic content framework
        captions  — { instagram, tiktok, facebook } each with options + guide
        source    — always "groq"
    """
    market           = (req.market or "korea").strip().lower() or "korea"
    business_name    = req.businessName or ""
    description      = req.description or ""
    uvp              = req.uvp or ""
    categories       = req.categories or []
    trend            = req.trend or ""
    uniqueness_score = int(req.uniquenessScore or 0)
    forecast_context = req.forecastContext or {}

    log.info("content.generate (agent path) market=%s business=%s", market, business_name)

    # FR3.3 — real-time cultural and tourism trend research
    research = cultural_research.research_market(market)
    log.info("content.research ok market=%s source=%s", market, research.get("source"))

    # FR3.4 — format context blocks for the agent prompt
    spike = bool(forecast_context.get("spikeIndicator", False))
    forecast_str  = _format_forecast_context(forecast_context, uniqueness_score, spike)
    research_str  = _format_research_context(research)
    target_market = MARKET_DISPLAY_NAMES.get(market, market.title())
    market_category = categories[0] if categories else (trend or "Coastal & Island")

    # FR3.5 — invoke the LangGraph caption generation agent
    agent_input = CaptionInputClass(
        business_name        = business_name,
        business_description = description,
        business_uvp         = uvp,
        business_services    = categories,
        market_category      = market_category,
        target_market        = target_market,
        forecast_context     = forecast_str,
        research_context     = research_str,
    )

    try:
        agent_result = await caption_generation_service(agent_input)
    except Exception as exc:
        error_code = str(exc) if str(exc).startswith("MOD3") else err_codes.MOD31_CAPTION_AGENT_FAILED
        log.error("[%s] Content generation failed for market=%s: %s", error_code, market, exc)
        raise HTTPException(
            status_code=503,
            detail={"code": error_code, "message": "Content generation service unavailable."},
        )

    final_captions = agent_result.get("final_captions", {})
    source         = agent_result.get("source", "groq")

    log.info("content.agent ok market=%s source=%s platforms=%s",
             market, source, list(final_captions.keys()))

    # FR3.6 — visual guides (per-market, per-platform curated templates)
    guides = gemini_client.get_platform_guides(market)

    # Build the response
    captions = transform_captions(final_captions, guides)

    return ContentResponse(
        market    = market_header(market),
        framework = CONTENT_FRAMEWORK,
        captions  = captions,
        source    = source,
    )
