from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app import errors
from app.services import gemini_client

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
