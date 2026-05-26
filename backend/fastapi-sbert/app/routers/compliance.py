"""Submodule 3.3 — Multimodal Promotional Compliance Analysis (FR3.20-FR3.30).

Implements:
  /evaluate       — basic Gemini compliance audit (single-score path)
  /evaluate-full  — full CAS + VAS + HCS → OMCS pipeline (FR3.25)

OMCS formula (FR3.25.4):
  OMCS = (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)

where:
  CAS — Caption Alignment Score: Sentence-BERT cosine vs approved captions (FR3.25.1)
  VAS — Visual Alignment Score:  Gemini multimodal evaluation               (FR3.25.2)
  HCS — Heuristic Compliance Score: deterministic 6-rule checker            (FR3.25.3)

Compliance thresholds (FR3.25.4):
  90-100 → Excellent Alignment
  80-89  → High Compliance
  70-79  → Moderate Revision Required
  <70    → Significant Revision Required
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import errors
from app.services import gemini_client, sentence_bert_scorer

router = APIRouter()
log = logging.getLogger("module3.compliance")


# ─── Pydantic request / response schemas ──────────────────────────────────────

class EvaluateRequest(BaseModel):
    """Basic compliance evaluation request — forwarded from /api/v1/compliance/evaluate-json."""
    caption: str = Field(..., min_length=1, description="Operator-uploaded caption text (required)")
    market: str  = Field(default="korea", description="Target market key: korea | japan | usa")
    mediaName: str | None = Field(default=None)
    mediaSize: int | None = Field(default=None)


class EvaluateFullRequest(BaseModel):
    """Full multimodal compliance pipeline — FR3.20-FR3.30.

    Spring Boot ComplianceAnalysisService enriches this payload with approved captions
    from Submodule 3.1 and creative direction context from Submodule 3.2 before
    forwarding to this endpoint.
    """
    caption: str  = Field(..., min_length=1, description="Operator-uploaded caption (required)")
    market:  str  = Field(default="korea", description="Target market key: korea | japan | usa")
    approvedCaptions:  list[str]     = Field(default_factory=list)
    categories:        list[str]     = Field(default_factory=list)
    visualTone:        str | None    = Field(default=None)
    shotListContext:   str | None    = Field(default=None)
    mediaName:         str | None    = Field(default=None)
    mediaSize:         int | None    = Field(default=None)


class ComplianceResponse(BaseModel):
    """Full compliance result — mirrors ComplianceDtos.ComplianceResultDto in Spring Boot."""
    score:          int
    casScore:       float | None = None
    vasScore:       float | None = None
    hcsScore:       float | None = None
    omcsScore:      float | None = None
    interpretation: str | None   = None
    aligned:        list[str]    = Field(default_factory=list)
    gaps:           list[str]    = Field(default_factory=list)
    mismatches:     list[str]    = Field(default_factory=list)
    source:         str          = "unknown"


# ─── /evaluate — basic Gemini single-score path ───────────────────────────────

@router.post("/evaluate", response_model=ComplianceResponse)
def evaluate(body: EvaluateRequest) -> ComplianceResponse:
    """Basic compliance audit via Gemini — returns { score, aligned, gaps, source }.

    Spring Boot forwards the JSON body from /api/v1/compliance/evaluate-json here.
    A missing or blank caption is a 400; all other failures short-circuit to a
    fallback so the dashboard always renders something (FR3.30)."""
    caption = body.caption.strip()
    market  = (body.market or "korea").strip() or "korea"

    if not caption:
        raise HTTPException(status_code=400, detail={
            "error": "validation_failed",
            "code":  errors.MOD3_COMPLIANCE_VALIDATION,
            "message": "caption is required",
        })

    log.info(
        "compliance.evaluate received market=%s caption_len=%s media=%s",
        market, len(caption), body.mediaName,
    )

    result = gemini_client.evaluate_compliance(caption, market, body.mediaName, body.mediaSize)
    log.info(
        "compliance.evaluate ok market=%s score=%s source=%s",
        market, result.get("score"), result.get("source"),
    )
    return ComplianceResponse(
        score      = int(result.get("score", 0)),
        aligned    = result.get("aligned", []),
        gaps       = result.get("gaps", []),
        source     = result.get("source", "fallback"),
    )


# ─── /evaluate-full — CAS + VAS + HCS → OMCS pipeline ────────────────────────

@router.post("/evaluate-full", response_model=ComplianceResponse)
def evaluate_full(body: EvaluateFullRequest) -> ComplianceResponse:
    """Full multimodal compliance analysis — FR3.20-FR3.30 (Submodule 3.3).

    Computes three sub-scores and combines them into OMCS:

      CAS  (FR3.23, FR3.25.1) — Sentence-BERT cosine similarity vs approved captions
      VAS  (FR3.24, FR3.25.2) — Gemini multimodal visual alignment evaluation
      HCS  (FR3.25.3)         — Deterministic 6-rule heuristic compliance check
      OMCS (FR3.25.4)         — (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)

    Compliance interpretation (FR3.25.4):
      90-100 → Excellent Alignment
      80-89  → High Compliance
      70-79  → Moderate Revision Required
      <70    → Significant Revision Required

    Returns full ComplianceResultDto-compatible dict including sub-scores,
    explainable AI outputs (FR3.26) and detected mismatches.

    Falls back to keyword CAS + static VAS + full HCS (FR3.30) when AI unavailable."""
    caption          = body.caption.strip()
    market           = (body.market or "korea").strip() or "korea"
    approved_captions = body.approvedCaptions or []
    categories        = body.categories or []
    visual_tone       = body.visualTone
    shot_list_context = body.shotListContext
    media_name        = body.mediaName
    media_size        = body.mediaSize

    if not caption:
        raise HTTPException(status_code=400, detail={
            "error": "validation_failed",
            "code":  errors.MOD3_COMPLIANCE_VALIDATION,
            "message": "caption is required",
        })

    log.info(
        "compliance.evaluate-full market=%s caption_len=%d approved=%d categories=%d media=%s",
        market, len(caption), len(approved_captions), len(categories), media_name,
    )

    # ── FR3.23, FR3.25.1 — Caption Alignment Score (SBERT / keyword fallback) ──
    cas = sentence_bert_scorer.compute_cas(caption, approved_captions)

    # ── FR3.24, FR3.25.2 — Visual Alignment Score (Gemini multimodal) ─────────
    visual_result = gemini_client.evaluate_compliance_multimodal(
        caption         = caption,
        market          = market,
        approved_captions = approved_captions,
        visual_tone     = visual_tone,
        shot_list_context = shot_list_context,
        media_name      = media_name,
        media_size      = media_size,
    )
    vas = float(visual_result.get("vas", 0.0))

    # ── FR3.25.3 — Heuristic Compliance Score (deterministic, always succeeds) ──
    hcs = sentence_bert_scorer.compute_hcs(
        caption          = caption,
        market           = market,
        categories       = categories,
        approved_captions = approved_captions,
        visual_tone      = visual_tone,
        media_name       = media_name,
    )

    # ── FR3.25.4 — Overall Multimodal Compliance Score ─────────────────────────
    # OMCS = (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)
    omcs = round(0.35 * cas + 0.45 * vas + 0.20 * hcs, 2)

    # ── FR3.25.4 — Compliance threshold interpretation ─────────────────────────
    interpretation = sentence_bert_scorer.interpret_omcs(omcs)

    # Determine composite source label
    cas_source = "bert" if sentence_bert_scorer._model is not None else "keyword-fallback"
    vas_source = visual_result.get("source", "unknown")
    source     = f"cas:{cas_source},vas:{vas_source},hcs:rule-based"

    log.info(
        "compliance.evaluate-full ok market=%s cas=%.1f vas=%.1f hcs=%.1f omcs=%.1f [%s]",
        market, cas, vas, hcs, omcs, interpretation,
    )

    return ComplianceResponse(
        score          = int(round(omcs)),   # legacy integer field equals OMCS when full pipeline
        casScore       = cas,
        vasScore       = vas,
        hcsScore       = hcs,
        omcsScore      = omcs,
        interpretation = interpretation,
        aligned        = visual_result.get("aligned",    []),
        gaps           = visual_result.get("gaps",       []),
        mismatches     = visual_result.get("mismatches", []),
        source         = source,
    )
