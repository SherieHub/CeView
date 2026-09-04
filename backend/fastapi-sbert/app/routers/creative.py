"""Submodule 3.2 — Creative Direction & Visual Recommendation Generation (FR3.11-FR3.19).

Called by Spring Boot CreativeDirectionService after approved captions are available.
Generates destination-specific visual direction, shot lists, lighting, moodboard,
and platform-aware recommendations via Gemini.  Raises when Gemini is unavailable —
no curated-template stand-in.
"""
from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import gemini_client

router = APIRouter()
log = logging.getLogger("module3.creative")


# ─── Pydantic schema ──────────────────────────────────────────────────────────

class CreativeGenerateRequest(BaseModel):
    """Request payload forwarded by Spring Boot CreativeDirectionService.

    Requires approved captions from Submodule 3.1 to generate market-aligned
    visual direction (FR3.11).  All other fields default so the endpoint
    remains callable even with a minimal payload.
    """
    profileId:        str       = Field(default="")
    market:           str       = Field(default="korea", description="korea | japan | usa")
    businessName:     str       = Field(default="")
    categories:       list[str] = Field(default_factory=list)
    approvedCaptions: list[str] = Field(
        default_factory=list,
        description="Approved captions from Submodule 3.1 (FR3.11 — used as creative brief)",
    )
    uniquenessScore:  int       = Field(default=0, ge=0, le=100)
    forecastContext:  dict      = Field(
        default_factory=dict,
        description="{ marketScore, predictedDemand, spikeIndicator } from Module 2 (FR3.12)",
    )


class ShotItem(BaseModel):
    label:       str
    description: str
    lighting:    str = ""


class MoodboardItem(BaseModel):
    palette:    str        = ""
    references: list[str]  = Field(default_factory=list)


class CreativeDirectionResponse(BaseModel):
    """Mirrors backend CreativeDirectionDtos.CreativeDirectionDto."""
    visualGuide:             list[str]          = Field(default_factory=list)
    shots:                   list[ShotItem]      = Field(default_factory=list)
    moodboard:               MoodboardItem       = Field(default_factory=MoodboardItem)
    # dict[platform_name → recommendation_string] — e.g. {"Naver Blog": "...", "Instagram": "..."}
    platformRecommendations: dict[str, str]      = Field(default_factory=dict)
    # Closed on purpose, and with no default — see ContentResponse.source. A
    # fallback is now an AiDependencyException, not a value this field can hold.
    source:                  Literal["groq"]


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=CreativeDirectionResponse)
def generate(req: CreativeGenerateRequest) -> CreativeDirectionResponse:
    """Generate creative direction for a market+profile (FR3.13-FR3.16).

    1. Consumes approved captions from 3.1 as the creative brief.
    2. Calls Gemini to produce visual direction, shot lists, moodboard and
       platform-specific recommendations (FR3.13-FR3.16).
    3. Falls back to curated per-market templates when Gemini is unavailable (FR3.30).

    Platform recommendations per FR3.16:
        Korea → Naver Blog (primary) + Instagram + TikTok
        Japan → Facebook + Instagram + TikTok
        USA   → Instagram Reels + TikTok

    Response shape:
        visualGuide             — list of visual direction statements
        shots                   — [ { label, description, lighting } ]
        moodboard               — { palette, references }
        platformRecommendations — ranked platform list with strategy notes
        source                  — always "groq"
    """
    market           = (req.market or "korea").strip() or "korea"
    business_name    = req.businessName or ""
    categories       = req.categories or []
    approved_captions = req.approvedCaptions or []
    uniqueness_score = int(req.uniquenessScore or 0)
    forecast_context = req.forecastContext or {}

    log.info(
        "creative.generate received market=%s captions=%d profile=%s",
        market, len(approved_captions), req.profileId,
    )

    result = gemini_client.generate_creative_direction(
        market            = market,
        business_name     = business_name,
        categories        = categories,
        approved_captions = approved_captions,
        uniqueness_score  = uniqueness_score,
        forecast_context  = forecast_context,
    )

    log.info("creative.generate ok market=%s source=%s", market, result.get("source"))
    return result
