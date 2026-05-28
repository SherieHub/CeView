"""OMCS — Overall Multimodal Compliance Score evaluation endpoint.

POST /api/v1/compliance/evaluate-omcs

Implements the Multimodal Compliance Evaluator system role:

  OMCS = (w1 × Ss) + (w2 × Ma) + (w3 × Hc)
       = (0.35 × Ss) + (0.45 × Ma) + (0.20 × Hc)

  Ss  — Semantic Similarity:      SBERT cosine vs AI recommendation
  Ma  — Multimodal Alignment:     Groq LLM visual/contextual scoring
  Hc  — Heuristic Compliance:     deterministic rule matching

Feedback rules (strict):
  OMCS ≥ 0.80 (success) → compliance_feedback fields are all null
  OMCS < 0.80 (failure)  → visual_deviations, token_level_attribution,
                           actionable_revision_guidance are populated
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import errors
from app.services import omcs_service, groq_client

router = APIRouter()
log    = logging.getLogger("compliance.router")

_W1, _W2, _W3   = 0.35, 0.45, 0.20
_PASS_THRESHOLD  = 0.80


# ─── Request / response schemas ───────────────────────────────────────────────

class OmcsEvalRequest(BaseModel):
    aiRecommendation: str       = Field(..., min_length=1, description="Baseline AI-generated marketing recommendation text")
    submissionText:   str       = Field(..., min_length=1, description="MSME operator's drafted promotional text")
    heuristicRules:   list[str] = Field(default_factory=list, description="Required keywords/phrases, e.g. ['Cebu Promo', 'store hours']")
    market:           str       = Field(default="general",    description="Target market context (e.g. korea, japan, usa, general)")
    mediaName:        str | None = Field(default=None,        description="Uploaded media filename (used as visual context hint)")
    mediaSize:        int | None = Field(default=None,        description="Uploaded media size in bytes")


class _ComponentScores(BaseModel):
    Ss_score: float
    Ma_score: float
    Hc_score: float


class _OmcsResults(BaseModel):
    total_score:      float
    status:           str              # "success" | "failure"
    component_scores: _ComponentScores


class _ComplianceFeedback(BaseModel):
    visual_deviations:            str | None
    token_level_attribution:      list[str] | None
    actionable_revision_guidance: str | None


class OmcsEvalResponse(BaseModel):
    omcs_results:       _OmcsResults
    compliance_feedback: _ComplianceFeedback


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/evaluate-omcs", response_model=OmcsEvalResponse)
def evaluate_omcs(body: OmcsEvalRequest) -> OmcsEvalResponse:
    """Compute OMCS and return structured compliance results.

    Returns the exact JSON schema defined in the Multimodal Compliance
    Evaluator system role.  Feedback fields are null on success (OMCS ≥ 0.80)
    and fully populated on failure (OMCS < 0.80)."""
    recommendation = body.aiRecommendation.strip()
    submission     = body.submissionText.strip()

    if not recommendation or not submission:
        raise HTTPException(status_code=400, detail={
            "error": "validation_failed",
            "code":  errors.OMCS_VALIDATION_ERROR,
            "message": "aiRecommendation and submissionText are required",
        })

    log.info(
        "evaluate-omcs: market=%s rules=%d media=%s rec_len=%d sub_len=%d",
        body.market, len(body.heuristicRules), body.mediaName,
        len(recommendation), len(submission),
    )

    # ── Ss — Semantic Similarity ──────────────────────────────────────────────
    ss = omcs_service.compute_ss(submission, recommendation)

    # ── Ma — Multimodal Alignment ─────────────────────────────────────────────
    ma, visual_mismatches = groq_client.evaluate_ma(
        ai_recommendation = recommendation,
        submission_text   = submission,
        media_name        = body.mediaName,
        media_size        = body.mediaSize,
    )

    # ── Hc — Heuristic Compliance ─────────────────────────────────────────────
    hc = omcs_service.compute_hc(submission, body.heuristicRules)

    # ── OMCS ──────────────────────────────────────────────────────────────────
    omcs   = round(_W1 * ss + _W2 * ma + _W3 * hc, 2)
    status = "success" if omcs >= _PASS_THRESHOLD else "failure"

    log.info(
        "evaluate-omcs: ss=%.4f ma=%.4f hc=%.4f omcs=%.2f status=%s",
        ss, ma, hc, omcs, status,
    )

    # ── Feedback (null on success, populated on failure) ──────────────────────
    if status == "success":
        feedback = _ComplianceFeedback(
            visual_deviations            = None,
            token_level_attribution      = None,
            actionable_revision_guidance = None,
        )
    else:
        failing_tokens = omcs_service.extract_failing_tokens(submission, recommendation)
        generated      = groq_client.generate_failure_feedback(
            ai_recommendation  = recommendation,
            submission_text    = submission,
            failing_tokens     = failing_tokens,
            visual_mismatches  = visual_mismatches,
            heuristic_rules    = body.heuristicRules,
            market             = body.market,
        )
        feedback = _ComplianceFeedback(
            visual_deviations            = generated.get("visual_deviations"),
            token_level_attribution      = failing_tokens if failing_tokens else None,
            actionable_revision_guidance = generated.get("actionable_revision_guidance"),
        )

    return OmcsEvalResponse(
        omcs_results = _OmcsResults(
            total_score      = omcs,
            status           = status,
            component_scores = _ComponentScores(
                Ss_score = ss,
                Ma_score = ma,
                Hc_score = hc,
            ),
        ),
        compliance_feedback = feedback,
    )
