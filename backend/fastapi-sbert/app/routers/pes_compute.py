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

from app.services.pes_compute_service import (
    BASE_WEIGHTS,
    compute_base_metrics,
    compute_pes,
    normalize_and_invert,
)
from app.services import gemini_client

router = APIRouter()
log    = logging.getLogger("module4.pes_compute")


# ─── Request schema ───────────────────────────────────────────────────────────

class CampaignRawRequest(BaseModel):
    """
    Raw campaign inputs forwarded from Spring Boot after DB persistence.
    All fields default to 0 so the endpoint tolerates partial submissions;
    missing metrics are flagged and excluded from the PES formula.
    """
    impressions:  int   = Field(default=0, ge=0, description="Total ad impressions served")
    clicks:       int   = Field(default=0, ge=0, description="Total clicks on ads")
    adSpend:      float = Field(default=0.0, ge=0, description="Total ad spend in PHP (₱)")
    revenue:      float = Field(default=0.0, ge=0, description="Revenue attributed to campaign in PHP")
    conversions:  int   = Field(default=0, ge=0, description="Leads / enquiry conversions")
    bookings:     int   = Field(default=0, ge=0, description="Confirmed bookings (sales)")
    newCustomers: int   = Field(default=0, ge=0, description="Net-new customers acquired")


# ─── Funnel-stage mapping (weakest metric → bottleneck stage) ─────────────────

_METRIC_TO_STAGE: dict[str, str] = {
    "ROAS":       "Impressions → Revenue (Ad Spend Efficiency)",
    "Conv. Rate": "Clicks → Bookings",
    "CAC (Inv)":  "Impressions → New Customers",
    "CTR":        "Impressions → Clicks",
    "CPC (Inv)":  "Impressions → Clicks (Cost Efficiency)",
}


# ─── Rule-based AI report fallback (FR4.26) ───────────────────────────────────

def _rule_based_ai_report(
    base_metrics: dict[str, float],
    pes_score:    float,
    pes_label:    str,
    breakdown:    list[dict],
    flagged:      list[str],
) -> dict:
    """
    Deterministic, rule-based AI report returned when the DeepSeek / Gemini
    service is offline or fails (FR4.26 Fallback Mechanism).

    Logic:
      - Identifies the lowest-scoring (smallest contribution) active metric.
      - Maps it to the most impacted funnel stage.
      - Returns three hardcoded-but-contextual recommendations.
      - Generates a plain-language executive summary from the computed values.
    """
    active_items = [b for b in breakdown if b["contribution"] > 0]
    if active_items:
        weakest_item  = min(active_items, key=lambda x: x["contribution"])
        weakest_name  = weakest_item["metric"]
        weakest_stage = _METRIC_TO_STAGE.get(weakest_name, "Clicks → Bookings")
    else:
        weakest_name  = "Conversion Rate"
        weakest_stage = "Clicks → Bookings"

    # Identify the highest-weight metric that IS performing (for positive framing)
    top_item = max(active_items, key=lambda x: x["contribution"]) if active_items else None
    top_name = top_item["metric"] if top_item else "ROAS"

    recommendations = [
        (
            f"Your '{weakest_stage}' funnel stage is the weakest link — the {weakest_name} metric "
            "is contributing the least to your PES score for this Cebu tourism campaign. "
            "Audit this specific conversion step before increasing ad spend: for Cebu resorts and tour operators, "
            "this typically means aligning your ad creative with your Cebu landing page offer and simplifying the booking enquiry form."
        ),
        (
            "Launch a retargeting campaign on Facebook targeting Cebu tourists who clicked your ad but did not complete a booking enquiry. "
            "Use carousel ads showcasing your specific Cebu experience (e.g. island-hopping packages, Moalboal dive tours, or Oslob whale shark encounters) "
            "with a limited-time discount — this typically recovers 15–25% of lost mid-funnel leads within two campaign cycles."
        ),
        (
            "Add Cebu-specific social proof directly above your booking CTA: verified guest reviews mentioning Cebu attractions, "
            "a live booking counter showing recent reservations, and a guaranteed response-time badge. "
            "For Korean tourists, include Naver Blog or KakaoTalk review snippets; for US tourists, Google Reviews work best. "
            "This reduces commitment hesitation and improves your Clicks → Bookings conversion rate."
        ),
    ]

    flag_note = (
        f" Note: {len(flagged)} metric(s) were excluded from PES due to missing data: "
        + ", ".join(flagged) + "."
        if flagged else ""
    )

    executive_summary = (
        f"Your Cebu tourism campaign's Promotional Effectiveness Score is {pes_score:.2f} / 1.00 ({pes_label}). "
        f"The strongest contributor to your score is {top_name}, which is currently working well for your campaign. "
        f"However, the primary bottleneck is the '{weakest_stage}' transition — this is the stage where the most potential booking revenue is being lost, "
        f"either through poor ad-to-landing-page alignment, weak conversion copy, or insufficient trust signals for international tourists visiting Cebu. "
        f"Prioritising improvements to this stage will have the highest direct impact on your bookings and revenue per peso of ad spend."
        f"{flag_note}"
    )

    return {
        "weakest_funnel_stage": weakest_stage,
        "recommendations":      recommendations,
        "executive_summary":    executive_summary,
        "source":               "fallback",
    }


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
    6. AI insights      → DeepSeek prompt: weakest funnel stage + 3 recommendations
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
          "source":               "deepseek" | "fallback"
      }
    }
    """
    log.info(
        "pes_compute.analyze  impressions=%s  clicks=%s  adSpend=%.2f  revenue=%.2f"
        "  conversions=%s  bookings=%s  newCustomers=%s",
        req.impressions, req.clicks, req.adSpend, req.revenue,
        req.conversions, req.bookings, req.newCustomers,
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

    # Extract just the metric keys from flagged strings like "CTR (impressions = 0)"
    flagged_names: set[str] = {s.split(" ")[0] for s in flagged}

    # ── 2 & 3. Normalize + invert ────────────────────────────────────────────
    normalized, effective_weights = normalize_and_invert(base_metrics, flagged)

    # ── 4 & 5. PES formula ───────────────────────────────────────────────────
    pes_result = compute_pes(normalized, effective_weights)

    log.info(
        "pes_compute.analyze  pes_score=%.4f  label=%s  flagged=%s",
        pes_result.score, pes_result.label, flagged,
    )

    # ── 6. AI prescriptive insights ──────────────────────────────────────────
    if not gemini_client._enabled():
        log.info("pes_compute.analyze: AI client offline — using FR4.26 rule-based fallback")
        ai_report = _rule_based_ai_report(
            base_metrics, pes_result.score, pes_result.label,
            pes_result.breakdown, flagged,
        )
    else:
        try:
            ai_report = gemini_client.pes_compute_insights(
                base_metrics=base_metrics,
                pes_score=pes_result.score,
                pes_label=pes_result.label,
                breakdown=pes_result.breakdown,
                flagged_metrics=flagged,
            )
        except Exception as exc:
            log.warning("pes_compute.analyze: AI call failed (%s) — using fallback", exc)
            ai_report = _rule_based_ai_report(
                base_metrics, pes_result.score, pes_result.label,
                pes_result.breakdown, flagged,
            )

    # Omit flagged (uncomputable) metrics from the response dicts so the
    # caller sees only metrics that actually produced a value.  The full
    # computation still used the raw values; we only clean up the output.
    clean_base       = {k: v for k, v in base_metrics.items() if k not in flagged_names}
    clean_normalized = {k: v for k, v in normalized.items()   if k not in flagged_names}

    return {
        "base_metrics":       clean_base,
        "normalized_metrics": clean_normalized,
        "pes_score":          pes_result.score,
        "pes_label":          pes_result.label,
        "breakdown":          pes_result.breakdown,
        "flagged_metrics":    flagged,
        "effective_weights":  effective_weights,
        "ai_report":          ai_report,
    }
