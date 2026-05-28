"""Module 4 — Prescriptive Performance Report generation.

  POST /generate  — Gemini-powered exhaustive funnel diagnostics (or deterministic fallback)
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
import json
import logging

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services import gemini_client

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


# ─── Urgency mapping (rank → urgency label) ───────────────────────────────────

_RANK_LABELS    = ["Weakest", "Moderate", "Alright"]
_URGENCY_LABELS = ["Most Urgent", "Urgent", "Not Very Urgent"]

# Platform recommendation per market
_PLATFORM_MAP = {
    "korea":     "Naver Blog",
    "kr":        "Naver Blog",
    "japan":     "Facebook + Instagram",
    "jp":        "Facebook + Instagram",
    "usa":       "Instagram Reels",
    "us":        "Instagram Reels",
    "australia": "Instagram Reels",
    "global":    "Instagram Reels",
}


def _fallback_report(transitions: list[FunnelTransition], market: str) -> dict:
    """
    Deterministic fallback used when Gemini is offline.
    Uses the pre-ranked business-impact order from Spring Boot.
    Matches the target schema exactly.
    """
    # Build funnel diagnostics using business-impact ranking from Spring Boot
    default_insights = [
        "Visitors who clicked showed initial interest but the landing page failed to sustain engagement — a mismatch between ad promise and destination experience.",
        "High-intent leads reached the booking step but abandoned due to form friction and insufficient social proof to overcome commitment hesitation.",
        "Broad audience targeting resulted in a high raw drop but CTR remains within acceptable range for awareness-stage campaigns; creative refresh needed.",
    ]
    default_rec_titles = [
        "Align Landing Page to Ad Promise",
        "Streamline the Booking Conversion Path",
        "Sharpen Ad Creative Targeting",
    ]
    default_rec_actions = [
        "Mirror the headline copy from your best-performing ad variant directly onto the landing page hero section and reduce form fields to Name + Phone only.",
        "Add trust signals (reviews, booking counter) above the CTA, implement a single-click 'Reserve Now' button, and follow up with an abandoned-booking SMS within 2 hours.",
        "Shift 25% of ad spend from broad awareness audiences to retargeting pools of past website visitors and lookalike audiences based on confirmed bookers.",
    ]

    diagnostics = []
    recommendations = []

    for i, t in enumerate(transitions[:3]):
        rank    = _RANK_LABELS[i]
        urgency = _URGENCY_LABELS[i]
        diagnostics.append({
            "stage":    t.stage,
            "rank":     rank,
            "dropRate": t.dropRate,
            "insight":  default_insights[i],
        })
        recommendations.append({
            "stage":   t.stage,
            "urgency": urgency,
            "title":   default_rec_titles[i],
            "action":  default_rec_actions[i],
        })

    platform = _PLATFORM_MAP.get(market.lower(), "Naver Blog")

    return {
        "executiveSummary": (
            "Here is what your five campaign metrics mean for your Cebu tourism business: "
            "CTR (Click-Through Rate) shows the percentage of tourists who saw your ad and clicked — a low or declining CTR means your ad creative or audience targeting is losing relevance with your target market. "
            "CPC (Cost Per Click) is how much you pay in ₱ for each visitor on platforms like Facebook or Naver Blog — a rising CPC means you are reaching fewer tourists per peso of ad budget. "
            "ROAS (Return on Ad Spend) is the ₱ revenue your resort or tour packages generate for every ₱1 spent on ads — it directly measures campaign profitability. "
            "CR (Conversion Rate) is the percentage of clicks that became booking enquiries or form submissions — a falling CR points to a landing page or offer issue that is losing high-intent tourists before they enquire. "
            "CAC (Customer Acquisition Cost) is the total ₱ you spend to secure one confirmed booking — rising CAC directly erodes your profit margin per customer. "
            f"Currently, the '{transitions[0].stage if transitions else 'Clicks → Conversions'}' "
            "stage is your most urgent bottleneck and should be your immediate focus to improve overall campaign efficiency."
        ),
        "funnelDiagnostics": diagnostics,
        "recommendations":   recommendations,
        "recommendedPlatform": platform,
    }


# ─── /generate ────────────────────────────────────────────────────────────────

@router.post("/generate")
def generate(req: ReportRequest) -> dict:
    """
    Generate a prescriptive performance report from campaign metrics.

    When Gemini is available, produces AI-generated insights, root-cause
    diagnoses, and urgency-ranked recommendations for every funnel stage.
    Falls back to deterministic output when Gemini is offline.

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

    # Ensure we have exactly 3 transitions (pad with defaults if needed)
    transitions = req.funnelTransitions[:3]
    if len(transitions) < 3:
        defaults = [
            FunnelTransition(stage="Clicks → Conversions",  dropRate="88.1%"),
            FunnelTransition(stage="Conversions → Bookings", dropRate="78.8%"),
            FunnelTransition(stage="Impressions → Clicks",   dropRate="95.2%"),
        ]
        transitions = (transitions + defaults)[:3]

    if not gemini_client._enabled():
        log.info("report.generate using deterministic fallback (Gemini offline)")
        return _fallback_report(transitions, req.market)

    result = gemini_client.performance_report(
        metrics=req.metrics.model_dump(),
        transitions=[{"stage": t.stage, "dropRate": t.dropRate} for t in transitions],
        weeks=req.weeks,
        market=req.market,
    )
    log.info("report.generate ok source=gemini")
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
