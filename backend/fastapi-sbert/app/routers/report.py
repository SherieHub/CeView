"""Module 4 — Prescriptive Performance Report generation.

  POST /generate  — Gemini-powered exhaustive funnel diagnostics (503 when Gemini is offline)
  POST /pdf       — Returns a minimal valid PDF placeholder for the 'Download Report' button

New schema (Phase 5 / Module 4):
  {
    "executiveSummary": "...",
    "funnelDiagnostics": [
      { "stage": "Clicks → Conversions",  "rank": "Weakest",  "dropRate": "88.1%", "insight": "..." },
      { "stage": "Conversions → Bookings","rank": "Moderate", "dropRate": "78.8%", "insight": "..." },
      { "stage": "Impressions → Clicks",  "rank": "Alright",  "dropRate": "95.2%", "insight": "..." }
    ],
    "recommendations": [
      { "stage": "Clicks → Conversions",  "urgency": "Most Urgent",     "title": "...", "action": "..." },
      { "stage": "Conversions → Bookings","urgency": "Urgent",           "title": "...", "action": "..." },
      { "stage": "Impressions → Clicks",  "urgency": "Not Very Urgent",  "title": "...", "action": "..." }
    ],
    "recommendedPlatform": "Naver Blog"
  }
"""
from __future__ import annotations

import io
import logging

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app import errors
from app.services import gemini_client, report_llm
from app.unavailable import MISSING_INPUT, DependencyUnavailable

router = APIRouter()
log = logging.getLogger("module4.report")


# ─── Pydantic schema ──────────────────────────────────────────────────────────

class MetricsPayload(BaseModel):
    """Computed KPI metrics forwarded from Spring Boot MetricsCalculationService."""
    impressions:  float = Field(default=0, ge=0)
    clicks:       float = Field(default=0, ge=0)
    adSpend:      float = Field(default=0, ge=0)
    revenue:      float = Field(default=0, ge=0)
    conversions:  float = Field(default=0, ge=0)
    bookings:     float = Field(default=0, ge=0)
    newCustomers: float = Field(default=0, ge=0)


class FunnelTransition(BaseModel):
    """
    One pre-ranked funnel transition.

    Sent by Spring Boot MetricsCalculationService.computeFunnelTransitions()
    in business-impact priority order:
      index 0 → Clicks → Conversions  (Weakest)
      index 1 → Conversions → Bookings (Moderate)
      index 2 → Impressions → Clicks   (Alright)
    """
    stage:    str
    dropRate: str  # e.g. "88.1%"


class ReportRequest(BaseModel):
    """Request body for /generate — enriched by Spring Boot AnalyticsController."""
    metrics:            MetricsPayload      = Field(default_factory=MetricsPayload)
    funnelTransitions:  list[FunnelTransition] = Field(default_factory=list)
    weeks:              int                 = Field(default=4, ge=4, le=8)
    market:             str                 = Field(default="korea")


# Fields the frontend's action plan renders; a report without them is no report.
_REQUIRED_REPORT_FIELDS = ("executiveSummary", "funnelDiagnostics", "recommendations", "recommendedPlatform")


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate")
def generate(req: ReportRequest) -> dict:
    """
    Generate a prescriptive performance report from campaign metrics.

    When Gemini is available, produces AI-generated insights, root-cause
    diagnoses, and urgency-ranked recommendations for every funnel stage.
    Raises 503 MOD4_REPORT_UNAVAILABLE when Gemini is offline — no deterministic
    stand-in.

    Request body (from Spring Boot AnalyticsController):
        metrics            — computed KPI values
        funnelTransitions  — pre-ranked transitions (business-impact order)
        weeks              — analysis window (4 or 8)
        market             — target market key (e.g. "korea")

    Response:
        executiveSummary, funnelDiagnostics[], recommendations[], recommendedPlatform
    """
    log.info(
        "report.generate received weeks=%s market=%s transitions=%s",
        req.weeks, req.market,
        [t.stage for t in req.funnelTransitions],
    )

    # The report ranks exactly three measured funnel transitions. A shorter list
    # is a missing input: filling the gap with invented drop rates would hand the
    # operator "diagnostics" of a campaign that never produced those numbers.
    transitions = req.funnelTransitions[:3]
    if len(transitions) < 3:
        raise DependencyUnavailable(
            code=errors.MOD4_REPORT_NO_FUNNEL,
            message="The prescriptive report needs all three funnel transitions.",
            dependency="campaign_records",
            cause=f"received {len(transitions)} of 3 funnel transitions — "
                  "ingest campaign data before requesting a report",
            stage="fastapi-sbert/report.generate",
            status_code=MISSING_INPUT,
        )

    if not gemini_client._enabled():
        raise DependencyUnavailable(
            code=errors.MOD4_REPORT_UNAVAILABLE,
            message="The prescriptive report is unavailable.",
            dependency="gemini",
            cause="the report LLM is offline or returned no usable structure",
            stage="fastapi-sbert/report.generate",
        )

    result = report_llm.performance_report(
        metrics=req.metrics.model_dump(),
        transitions=[{"stage": t.stage, "dropRate": t.dropRate} for t in transitions],
        weeks=req.weeks,
        market=req.market,
    )

    # _generate_json returns {} on any model error, and the model can also answer
    # with JSON that lacks the report's structure. Either way there is no report:
    # returning it with 200 rendered a blank action plan with no error to show.
    missing = [key for key in _REQUIRED_REPORT_FIELDS if not (result or {}).get(key)]
    if missing:
        log.warning("report.generate unusable model output missing=%s", missing)
        raise DependencyUnavailable(
            code=errors.MOD4_REPORT_UNAVAILABLE,
            message="The prescriptive report is unavailable.",
            dependency="gemini",
            cause=(
                "the report model returned no output"
                if not result else
                f"the report model's answer was missing {', '.join(missing)}"
            ),
            stage="fastapi-sbert/report.generate",
        )

    log.info("report.generate ok source=groq")
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
