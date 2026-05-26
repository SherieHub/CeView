"""Module 4 — Prescriptive Performance Report generation.

  POST /generate  — Gemini-powered analysis of campaign metrics (or deterministic fallback)
  POST /pdf       — Returns a minimal valid PDF placeholder for the 'Download Report' button
"""
from __future__ import annotations

import io
import logging

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services import gemini_client

router = APIRouter()
log = logging.getLogger("module4.report")


# ─── Pydantic schema ──────────────────────────────────────────────────────────

class MetricsPayload(BaseModel):
    """Campaign performance metrics payload (Module 4 analytics inputs)."""
    impressions:  float = Field(default=0, ge=0)
    clicks:       float = Field(default=0, ge=0)
    adSpend:      float = Field(default=0, ge=0)
    revenue:      float = Field(default=0, ge=0)
    conversions:  float = Field(default=0, ge=0)
    bookings:     float = Field(default=0, ge=0)
    newCustomers: float = Field(default=0, ge=0)


class ReportRequest(BaseModel):
    """Request body for /generate — wraps the metrics object."""
    metrics: MetricsPayload = Field(default_factory=MetricsPayload)


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate")
def generate(req: ReportRequest) -> dict:
    """Generate a prescriptive performance report from campaign metrics.

    Calls Gemini when available; falls back to a deterministic report stub.

    Request body:
        metrics — { impressions, clicks, adSpend, revenue, conversions, bookings, newCustomers }

    Response:
        executiveSummary, lowestMetric, lowestMetricMeaning, recommendations[],
        otherAreasImprove[], weakestStage { name, dropoff, diagnosis }, secondaryLeaks[]
    """
    log.info("report.generate received metrics=%s", req.metrics.model_dump())
    result = gemini_client.performance_report(req.metrics.model_dump())
    log.info("report.generate ok source=%s", "gemini" if gemini_client._enabled() else "fallback")
    return result


# ─── /pdf ─────────────────────────────────────────────────────────────────────

@router.post("/pdf")
def pdf(req: ReportRequest | None = None) -> Response:
    """Return a minimal valid PDF placeholder for the 'Download Report' button.

    Real PDF layout (WeasyPrint) is a future milestone.
    The file returned is a structurally valid 1-page PDF so the browser
    download succeeds and doesn't show a 'corrupted file' error.
    """
    buf = io.BytesIO()
    buf.write(_MINIMAL_PDF.encode("latin-1"))
    return Response(content=buf.getvalue(), media_type="application/pdf")


# ─── Minimal structurally valid 1-page PDF ────────────────────────────────────
_MINIMAL_PDF = (
    "%PDF-1.4\n"
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
    "4 0 obj<</Length 55>>stream\n"
    "BT /F1 18 Tf 72 720 Td (CeView Prescriptive Report) Tj ET\n"
    "endstream endobj\n"
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
    "xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n"
    "0000000098 00000 n \n0000000183 00000 n \n0000000280 00000 n \n"
    "trailer<</Size 6/Root 1 0 R>>\nstartxref\n344\n%%EOF\n"
)
