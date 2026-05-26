from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app import errors
from app.services import gemini_client, sentence_bert_scorer

router = APIRouter()
log = logging.getLogger("module3.compliance")


@router.post("/evaluate")
def evaluate(body: dict[str, Any]) -> dict:
    """Multimodal compliance scoring. Returns { score, aligned[], gaps[], source }.

    Spring Boot forwards the JSON body from /api/v1/compliance/evaluate-json
    (and the multipart-stripped /evaluate) here. A missing or blank caption is
    a 400; everything else short-circuits to a fallback so the dashboard always
    renders something."""
    body = body or {}
    caption = (body.get("caption") or "").strip()
    market = (body.get("market") or "korea").strip() or "korea"
    media_name = body.get("mediaName")
    media_size = body.get("mediaSize")

    log.info(
        "compliance.evaluate received market=%s caption_len=%s media=%s",
        market, len(caption), media_name,
    )

    if not caption:
        log.warning(
            "compliance.evaluate rejected — empty caption",
            extra={"code": errors.MOD3_COMPLIANCE_VALIDATION},
        )
        raise HTTPException(status_code=400, detail={
            "error": "validation_failed",
            "code": errors.MOD3_COMPLIANCE_VALIDATION,
            "message": "caption is required",
        })

    result = gemini_client.evaluate_compliance(caption, market, media_name, media_size)
    log.info(
        "compliance.evaluate ok market=%s score=%s source=%s",
        market, result.get("score"), result.get("source"),
    )
    return result


@router.post("/evaluate-full")
def evaluate_full(body: dict[str, Any]) -> dict:
    """Multimodal Compliance Analysis — FR3.20-FR3.30 (Submodule 3.3).

    Accepts caption + context injected by Spring Boot (approved captions from
    3.1, creative direction from 3.2). Computes:
      CAS  (FR3.23, FR3.25.1) — Sentence-BERT cosine similarity
      VAS  (FR3.24, FR3.25.2) — Gemini multimodal visual alignment
      OMCS (FR3.25.3)         — 0.4×CAS + 0.6×VAS
      interpretation (FR3.25.4) — 4-tier threshold label

    Returns the full ComplianceResultDto-compatible dict including sub-scores,
    explainable AI outputs (FR3.26) and detected mismatches.

    Falls back to keyword CAS + static VAS (FR3.30) when AI unavailable."""
    body = body or {}
    caption = (body.get("caption") or "").strip()
    market = (body.get("market") or "korea").strip() or "korea"
    approved_captions: list[str] = body.get("approvedCaptions") or []
    visual_tone: str | None = body.get("visualTone")
    shot_list_context: str | None = body.get("shotListContext")
    media_name: str | None = body.get("mediaName")
    media_size: int | None = body.get("mediaSize")

    log.info(
        "compliance.evaluate-full market=%s caption_len=%d approved_count=%d media=%s",
        market, len(caption), len(approved_captions), media_name,
    )

    if not caption:
        log.warning(
            "compliance.evaluate-full rejected — empty caption",
            extra={"code": errors.MOD3_COMPLIANCE_VALIDATION},
        )
        raise HTTPException(status_code=400, detail={
            "error": "validation_failed",
            "code": errors.MOD3_COMPLIANCE_VALIDATION,
            "message": "caption is required",
        })

    # FR3.23, FR3.25.1 — Caption Alignment Score via Sentence-BERT (or keyword fallback)
    cas = sentence_bert_scorer.compute_cas(caption, approved_captions)

    # FR3.24, FR3.25.2 — Visual Alignment Score via Gemini multimodal
    visual_result = gemini_client.evaluate_compliance_multimodal(
        caption=caption,
        market=market,
        approved_captions=approved_captions,
        visual_tone=visual_tone,
        shot_list_context=shot_list_context,
        media_name=media_name,
        media_size=media_size,
    )
    vas = float(visual_result.get("vas", 0.0))

    # FR3.25.3 — Overall Multimodal Compliance Score
    omcs = round(0.4 * cas + 0.6 * vas, 2)

    # FR3.25.4 — Compliance threshold interpretation
    interpretation = sentence_bert_scorer.interpret_omcs(omcs)

    # Determine composite source label
    cas_source = "bert" if sentence_bert_scorer._model is not None else "keyword-fallback"
    vas_source = visual_result.get("source", "unknown")
    source = f"cas:{cas_source},vas:{vas_source}"

    log.info(
        "compliance.evaluate-full ok market=%s cas=%.1f vas=%.1f omcs=%.1f interpretation=%s",
        market, cas, vas, omcs, interpretation,
    )

    return {
        "score": int(round(omcs)),        # legacy integer field (equals omcs when full pipeline)
        "casScore": cas,
        "vasScore": vas,
        "omcsScore": omcs,
        "interpretation": interpretation,
        "aligned": visual_result.get("aligned", []),
        "gaps": visual_result.get("gaps", []),
        "mismatches": visual_result.get("mismatches", []),
        "source": source,
    }
