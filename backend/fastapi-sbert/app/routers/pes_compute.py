"""Module 4 — Raw Campaign PES Computation & AI Prescriptive Reporting.

  POST /analyze  — UC-4.2 (PES computation) + UC-4.3 (AI prescriptive insights)

Data flow
─────────
  Frontend → Spring Boot (POST /api/v1/analytics/manual)
           → saves raw data to PostgreSQL (CampaignRecord)
           → calls THIS endpoint with the raw inputs
           → endpoint computes metrics, normalises, applies PES, calls AI
           → returns enriched payload back to Spring Boot
           → Spring Boot updates DB record & returns MetricsResponse to frontend

Called by: Spring Boot AIInferenceGatewayService.computePesFromRaw()
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import gemini_client, report_llm
from app.services.pes_compute_service import (
    compute_base_metrics,
    compute_pes,
    flagged_metric_names,
    normalize_and_invert,
    rule_based_ai_report,
)

router = APIRouter()
log = logging.getLogger("module4.pes_compute")


# ─── Request schema ───────────────────────────────────────────────────────────


class CampaignRawRequest(BaseModel):
    """
    Raw campaign inputs forwarded from Spring Boot after DB persistence.
    All fields default to 0 so the endpoint tolerates partial submissions;
    missing metrics are flagged and excluded from the PES formula.
    """

    impressions: int = Field(default=0, ge=0, description="Total ad impressions served")
    clicks: int = Field(default=0, ge=0, description="Total clicks on ads")
    adSpend: float = Field(default=0.0, ge=0, description="Total ad spend in PHP (₱)")
    revenue: float = Field(default=0.0, ge=0, description="Revenue attributed to campaign in PHP")
    conversions: int = Field(default=0, ge=0, description="Leads / enquiry conversions")
    bookings: int = Field(default=0, ge=0, description="Confirmed bookings (sales)")
    newCustomers: int = Field(default=0, ge=0, description="Net-new customers acquired")


# ─── POST /analyze ────────────────────────────────────────────────────────────


@router.post("/analyze")
def analyze(req: CampaignRawRequest) -> dict:
    """
    UC-4.2 + UC-4.3: Compute PES from raw campaign data and generate AI
    prescriptive insights for Cebu MSME operators.

    Processing pipeline
    ───────────────────
    1. Base metrics     → CTR, CPC, CR, ROAS, CAC computed from raw inputs
    2. Normalization    → Min-Max scaling to [0, 1] using calibrated industry bounds
    3. Inversion        → CPC and CAC inverted: lower cost → higher PES contribution
    4. Edge cases       → Zero/missing metrics flagged; remaining weights recalibrated
    5. PES formula      → Weighted sum → 0–1 score + qualitative label
    6. AI insights      → Groq prompt: weakest funnel stage + 3 recommendations
                          Falls back to rule-based output if AI is unavailable (FR4.26)

    Response shape
    ──────────────
    {
      "base_metrics":       { CTR, CPC, CR, ROAS, CAC },
      "normalized_metrics": { CTR, CPC, CR, ROAS, CAC },   ← CPC/CAC already inverted
      "pes_score":          float (0.0 – 1.0),
      "pes_label":          str   ("Poor"|"Fair"|"Good"|"Excellent Performance"),
      "breakdown":          [ { metric, weight, contribution } ],
      "flagged_metrics":    [ str ],   ← metrics excluded from PES
      "effective_weights":  { metric: weight },  ← recalibrated weights
      "ai_report": {
          "weakest_funnel_stage": str,
          "recommendations":      [str, str, str],
          "executive_summary":    str,
          "source":               "groq" | "fallback"
      }
    }
    """
    log.info(
        "pes_compute.analyze  impressions=%s  clicks=%s  adSpend=%.2f  revenue=%.2f"
        "  conversions=%s  bookings=%s  newCustomers=%s",
        req.impressions,
        req.clicks,
        req.adSpend,
        req.revenue,
        req.conversions,
        req.bookings,
        req.newCustomers,
    )

    # ── 1. Base metrics ──────────────────────────────────────────────────────
    base_metrics, flagged = compute_base_metrics(
        impressions=req.impressions,
        clicks=req.clicks,
        ad_spend=req.adSpend,
        revenue=req.revenue,
        conversions=req.conversions,
        bookings=req.bookings,
        new_customers=req.newCustomers,
    )

    flagged_names = flagged_metric_names(flagged)

    # ── 2 & 3. Normalize + invert ────────────────────────────────────────────
    normalized, effective_weights = normalize_and_invert(base_metrics, flagged)

    # ── 4 & 5. PES formula ───────────────────────────────────────────────────
    pes_result = compute_pes(normalized, effective_weights)

    log.info(
        "pes_compute.analyze  pes_score=%.4f  label=%s  flagged=%s",
        pes_result.score,
        pes_result.label,
        flagged,
    )

    # ── 6. AI prescriptive insights ──────────────────────────────────────────
    if not gemini_client._enabled():
        log.info("pes_compute.analyze: AI client offline — using FR4.26 rule-based fallback")
        ai_report = rule_based_ai_report(
            base_metrics,
            pes_result.score,
            pes_result.label,
            pes_result.breakdown,
            flagged,
        )
    else:
        try:
            ai_report = report_llm.pes_compute_insights(
                base_metrics=base_metrics,
                pes_score=pes_result.score,
                pes_label=pes_result.label,
                breakdown=pes_result.breakdown,
                flagged_metrics=flagged,
            )
        except Exception as exc:
            log.warning("pes_compute.analyze: AI call failed (%s) — using fallback", exc)
            ai_report = rule_based_ai_report(
                base_metrics,
                pes_result.score,
                pes_result.label,
                pes_result.breakdown,
                flagged,
            )

    # Omit flagged (uncomputable) metrics from the response dicts so the
    # caller sees only metrics that actually produced a value.  The full
    # computation still used the raw values; we only clean up the output.
    clean_base = {k: v for k, v in base_metrics.items() if k not in flagged_names}
    clean_normalized = {k: v for k, v in normalized.items() if k not in flagged_names}

    return {
        "base_metrics": clean_base,
        "normalized_metrics": clean_normalized,
        "pes_score": pes_result.score,
        "pes_label": pes_result.label,
        "breakdown": pes_result.breakdown,
        "flagged_metrics": flagged,
        "effective_weights": effective_weights,
        "ai_report": ai_report,
    }
