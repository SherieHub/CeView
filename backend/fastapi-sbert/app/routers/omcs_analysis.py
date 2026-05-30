"""Submodule 3.3 — OMCS Compliance Audit endpoint (omcs_agent).

  POST /analyze  — run the LangGraph omcs_agent over a chosen caption + image
                   against the visual-guide recommendations, returning the full
                   OMCS evaluation state.

Called by Spring Boot ComplianceController.omcsAnalyze (a stateless passthrough),
which assembles the payload from the chosen caption, the uploaded image (as an
http/data URL), the business profile, and the approved caption's recommendations.

Request body (ComplianceInputClass):
    caption          — operator-chosen caption text
    image_url        — chosen pubmat/image URL (http(s):// or data: base64)
    business_profile — { business_name, business_description, market_category, ... }
    recommendations  — visual-guide recommendations the caption should follow

Response (OmcsAnalysisResponse) — the full graph state:
    caption, image_url, business_profile, recommendations  (echoed inputs)
    profile_semantic_score        — float
    rubric_evaluation_data        — { scores{...}, total }
    recommendations_picture_score — float (rubric total)
    consistency_explanation       — caption/image consistency rationale
    pubmat_consistency_score      — float
    omcs_score                    — float  (0.35*profile + 0.45*rubric + 0.20*consistency)
    status                        — "Pass" | "Fail"
    feedback                      — diagnostic text (root-cause + fixes on Fail)
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import errors
from app.model.ComplianceScoreInputClass import ComplianceInputClass
from app.services.omcs_analysis import omcs_calculation

router = APIRouter()
log = logging.getLogger("module3.omcs")


class OmcsAnalysisResponse(BaseModel):
    """Full omcs_agent state — mirrors CeviewValidationState (omcs_agent/state.py)."""
    caption: str
    image_url: str
    business_profile: Dict[str, Any] = Field(default_factory=dict)
    recommendations: Dict[str, Any] = Field(default_factory=dict)

    profile_semantic_score: float = 0.0
    rubric_evaluation_data: Dict[str, Any] = Field(default_factory=dict)
    recommendations_picture_score: float = 0.0
    consistency_explanation: str = ""
    pubmat_consistency_score: float = 0.0
    omcs_score: float = 0.0

    status: str = ""
    feedback: str = ""


@router.post("/analyze", response_model=OmcsAnalysisResponse)
async def analyze(body: ComplianceInputClass) -> OmcsAnalysisResponse:
    """Run the omcs_agent compliance audit and return its full evaluation state."""
    log.info(
        "omcs.analyze caption_len=%d image_url_present=%s recommendations_keys=%s",
        len(body.caption), bool(body.image_url), list((body.recommendations or {}).keys()),
    )

    try:
        result = await omcs_calculation(body)
    except RuntimeError as exc:
        code = str(exc) if str(exc).startswith("MOD33") else errors.MOD33_OMCS_AGENT_FAILED
        log.error("[%s] omcs.analyze failed", code)
        raise HTTPException(
            status_code=503,
            detail={"code": code, "message": "OMCS compliance agent unavailable."},
        )

    return OmcsAnalysisResponse(**result)
