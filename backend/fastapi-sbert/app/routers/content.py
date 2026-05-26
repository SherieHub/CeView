"""Submodule 3.1 — Market-Localized Promotional Content Generation (FR3.1-FR3.10).

Called by Spring Boot ContentGenerationService with a fully enriched payload
that includes business profile attributes, uniqueness score, Module 2 forecast
outputs, and the market selection.  Performs real-time cultural research (FR3.3)
via cultural_research.py before building the Gemini prompt (FR3.4).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter

from app.services import cultural_research, gemini_client

router = APIRouter()
log = logging.getLogger("module3.content")


@router.post("/generate")
def generate(body: dict) -> dict:
    """Generate market-localised promotional content (FR3.5, FR3.6).

    Request body (from Spring Boot ContentGenerationService):
        market           — str  (korea | japan | usa)
        businessName     — str  (FR3.1)
        description      — str  (FR3.1)
        categories       — list[str]  (FR3.1)
        trend            — str
        uniquenessScore  — int  (FR3.4)
        forecastContext  — dict  { marketScore, predictedDemand, spikeIndicator, seasonalityScore }  (FR3.4)

    Response:
        market, framework, captions (4 platforms), source
    """
    market: str = body.get("market") or "korea"
    business_name: str = body.get("businessName") or ""
    description: str = body.get("description") or ""
    categories: list[str] = body.get("categories") or []
    trend: str = body.get("trend") or ""
    uniqueness_score: int = int(body.get("uniquenessScore") or 0)
    forecast_context: dict = body.get("forecastContext") or {}

    log.info("content.generate received market=%s business=%s", market, business_name)

    # FR3.3 — real-time cultural and tourism trend research
    research = cultural_research.research_market(market)
    log.info("content.research ok market=%s source=%s", market, research.get("source"))

    # FR3.5 / FR3.6 — generate captions + supplementary outputs via Gemini
    result = gemini_client.content_for_market(
        market=market,
        business_name=business_name,
        description=description,
        categories=categories,
        trend=trend,
        uniqueness_score=uniqueness_score,
        forecast_context=forecast_context,
        research_context=research,
    )

    log.info("content.generate ok market=%s source=%s", market, result.get("source"))
    return result
