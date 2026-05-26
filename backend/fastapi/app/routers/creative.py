"""Submodule 3.2 — Creative Direction & Visual Recommendation Generation (FR3.11-FR3.19).

Called by Spring Boot CreativeDirectionService after approved captions are available.
Generates destination-specific visual direction, shot lists, lighting, moodboard,
and platform-aware recommendations via Gemini.  Falls back to curated templates.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter

from app.services import gemini_client

router = APIRouter()
log = logging.getLogger("module3.creative")


@router.post("/generate")
def generate(body: dict) -> dict:
    """Generate creative direction for a market+profile (FR3.13-FR3.16).

    Request body (from Spring Boot CreativeDirectionService):
        profileId         — str
        market            — str  (korea | japan | usa)
        businessName      — str
        categories        — list[str]
        approvedCaptions  — list[str]  (FR3.11 — from approved content rows)
        uniquenessScore   — int  (FR3.12 — business positioning signal)
        forecastContext   — dict  (FR3.12 — market score / demand signals)

    Response:
        visualGuide, shots, moodboard, platformRecommendations, source
    """
    market: str = body.get("market", "korea")
    business_name: str = body.get("businessName", "")
    categories: list[str] = body.get("categories", [])
    approved_captions: list[str] = body.get("approvedCaptions", [])
    uniqueness_score: int = body.get("uniquenessScore", 0)
    forecast_context: dict = body.get("forecastContext", {})

    log.info(
        "creative.generate received market=%s captions=%d",
        market, len(approved_captions),
    )

    result = gemini_client.generate_creative_direction(
        market=market,
        business_name=business_name,
        categories=categories,
        approved_captions=approved_captions,
        uniqueness_score=uniqueness_score,
        forecast_context=forecast_context,
    )

    log.info("creative.generate ok market=%s source=%s", market, result.get("source"))
    return result
