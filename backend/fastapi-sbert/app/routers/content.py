"""Submodule 3.1 — Market-Localized Promotional Content Generation (FR3.1-FR3.10).

Called by Spring Boot ContentGenerationService with a fully enriched payload
that includes business profile attributes, uniqueness score, Module 2 forecast
outputs, and the market selection.  Performs real-time cultural research (FR3.3)
via cultural_research.py before building the Gemini prompt (FR3.4).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import cultural_research, gemini_client

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
    source:    str = "fallback"


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ContentResponse)
def generate(req: ContentGenerateRequest) -> ContentResponse:
    """Generate market-localised promotional content (FR3.5, FR3.6).

    1. FR3.3 — real-time cultural and tourism trend research via SerpAPI (or curated
       templates when SerpAPI is unavailable).
    2. FR3.4 / FR3.5 — builds a Gemini prompt enriched with research context, forecast
       signals and business profile attributes.
    3. FR3.6 — returns four platform-specific caption sets (Instagram, TikTok, Facebook,
       Naver Blog) plus a content framework and visual guide per platform.

    Response shape:
        market           — { country, city, flag }
        framework        — strategic caption framework string
        captions         — { instagram, tiktok, facebook, naver } each with options + guide
        source           — "gemini" | "fallback"
    """
    market          = (req.market or "korea").strip() or "korea"
    business_name   = req.businessName or ""
    description     = req.description or ""
    categories      = req.categories or []
    trend           = req.trend or ""
    uniqueness_score = int(req.uniquenessScore or 0)
    forecast_context = req.forecastContext or {}

    log.info("content.generate received market=%s business=%s", market, business_name)

    # FR3.3 — real-time cultural and tourism trend research
    research = cultural_research.research_market(market)
    log.info("content.research ok market=%s source=%s", market, research.get("source"))

    # FR3.5 / FR3.6 — generate captions + supplementary outputs via Gemini
    result = gemini_client.content_for_market(
        market           = market,
        business_name    = business_name,
        description      = description,
        categories       = categories,
        trend            = trend,
        uniqueness_score = uniqueness_score,
        forecast_context = forecast_context,
        research_context = research,
    )

    log.info("content.generate ok market=%s source=%s", market, result.get("source"))
    return result
