"""
PES Computation Service — Module 4, UC-4.2.

Handles all deterministic computation steps for the Promotional Effectiveness Score:
  1. Base metric computation from raw campaign inputs (CTR, CPC, CR, ROAS, CAC)
  2. Min-Max normalization using industry-calibrated bounds for Cebu MSME tourism
  3. Cost-metric inversion (CPC, CAC) so lower cost → higher contribution
  4. PES weighted sum formula with edge-case weight recalibration
  5. Qualitative label assignment

PES Formula (full weights):
    PES = (ROAS × 0.35) + (CR × 0.30) + (CAC_inv × 0.15) + (CTR × 0.15) + (CPC_inv × 0.05)

Edge Case Handling (FR4.26 spec):
    If any metric value is zero or incalculable, it is FLAGGED and EXCLUDED from the weighted sum.
    The remaining active weights are proportionally recalibrated to still sum to 1.0, ensuring
    the PES score correctly occupies the full 0–1 range based on the available data.
"""
from __future__ import annotations

from typing import NamedTuple

# ── Industry-calibrated Min-Max bounds (Cebu MSME hospitality / tourism) ─────
#
# These bounds define the "worst possible" (min) and "theoretical ceiling" (max)
# values for each metric, used to map raw values onto a 0–1 scale via Min-Max.
# Calibrated for Philippine Peso (₱) and Cebu hospitality vertical.
#
METRIC_BOUNDS: dict[str, tuple[float, float]] = {
    "CTR":  (0.0,     10.0),    # 0 % – 10 % click-through rate
    "CPC":  (0.01,   500.0),    # ₱0.01 – ₱500 cost per click
    "CR":   (0.0,     15.0),    # 0 % – 15 % booking conversion rate
    "ROAS": (0.0,      8.0),    # 0 × – 8 × return on ad spend
    "CAC":  (1.0,  5_000.0),    # ₱1 – ₱5,000 customer acquisition cost
}

# ── Canonical weights (SDD §4.2) ─────────────────────────────────────────────
BASE_WEIGHTS: dict[str, float] = {
    "ROAS": 0.35,
    "CR":   0.30,
    "CAC":  0.15,
    "CTR":  0.15,
    "CPC":  0.05,
}

# ── Cost metrics inverted (lower cost → higher PES contribution) ──────────────
COST_METRICS: frozenset[str] = frozenset({"CPC", "CAC"})

# ── Human-readable display names for breakdown output ────────────────────────
DISPLAY_NAMES: dict[str, str] = {
    "ROAS": "ROAS",
    "CR":   "Conv. Rate",
    "CAC":  "CAC (Inv)",
    "CTR":  "CTR",
    "CPC":  "CPC (Inv)",
}

WEIGHT_LABELS: dict[str, str] = {
    "ROAS": "35%",
    "CR":   "30%",
    "CAC":  "15%",
    "CTR":  "15%",
    "CPC":  "5%",
}


# ─── Structured return types ──────────────────────────────────────────────────

class PesResult(NamedTuple):
    score:     float       # 0.0 – 1.0
    label:     str         # "Poor" | "Fair" | "Good" | "Excellent Performance"
    breakdown: list[dict]  # per-metric contribution table


# ─── Step 1 — Base Metric Computation ────────────────────────────────────────

def compute_base_metrics(
    impressions:   int,
    clicks:        int,
    ad_spend:      float,
    revenue:       float,
    conversions:   int,
    bookings:      int,
    new_customers: int,
) -> tuple[dict[str, float], list[str]]:
    """
    Derive the five core KPIs from raw campaign inputs.

    Returns:
        metrics  — { 'CTR': float, 'CPC': float, 'CR': float, 'ROAS': float, 'CAC': float }
        flagged  — list of descriptive strings for metrics that could not be computed
                   (due to zero denominators).  Format: "METRIC_NAME (reason)"
    """
    metrics: dict[str, float] = {}
    flagged: list[str] = []

    # ── CTR = (clicks / impressions) × 100  [%] ──────────────────────────────
    if impressions > 0:
        metrics["CTR"] = round(clicks / impressions * 100.0, 4)
    else:
        metrics["CTR"] = 0.0
        flagged.append("CTR (impressions = 0)")

    # ── CPC = adSpend / clicks  [₱ per click] ────────────────────────────────
    if clicks > 0 and ad_spend > 0:
        metrics["CPC"] = round(ad_spend / clicks, 4)
    else:
        metrics["CPC"] = 0.0
        flagged.append("CPC (clicks = 0 or adSpend = 0)")

    # ── CR  = (bookings / clicks) × 100  [%] ─────────────────────────────────
    if clicks > 0:
        metrics["CR"] = round(bookings / clicks * 100.0, 4)
    else:
        metrics["CR"] = 0.0
        flagged.append("CR (clicks = 0)")

    # ── ROAS = revenue / adSpend  [× multiple] ────────────────────────────────
    if ad_spend > 0:
        metrics["ROAS"] = round(revenue / ad_spend, 4)
    else:
        metrics["ROAS"] = 0.0
        flagged.append("ROAS (adSpend = 0)")

    # ── CAC  = adSpend / newCustomers  [₱ per customer] ──────────────────────
    if new_customers > 0:
        metrics["CAC"] = round(ad_spend / new_customers, 4)
    else:
        metrics["CAC"] = 0.0
        flagged.append("CAC (newCustomers = 0)")

    return metrics, flagged


# ─── Steps 2 & 3 — Normalization + Inversion ─────────────────────────────────

def normalize_and_invert(
    metrics: dict[str, float],
    flagged: list[str],
) -> tuple[dict[str, float], dict[str, float]]:
    """
    Apply Min-Max normalization to all metrics, then invert cost metrics.

    Flagged metrics are set to 0.0 in the normalized map AND excluded from
    the effective weight calculation so the PES total still spans [0, 1].

    Returns:
        normalized        — { metric_name: 0.0–1.0 (inverted for CPC/CAC) }
        effective_weights — recalibrated weight map that sums to 1.0 for active metrics
    """
    # Extract just the metric names from flagged strings like "CTR (impressions = 0)"
    flagged_names: set[str] = {s.split(" ")[0] for s in flagged}

    normalized: dict[str, float] = {}
    for name, raw_val in metrics.items():
        if name in flagged_names:
            normalized[name] = 0.0
            continue

        lo, hi = METRIC_BOUNDS[name]
        # Min-Max normalization
        n = (raw_val - lo) / (hi - lo) if hi != lo else 0.0
        # Clamp to [0, 1] to handle values outside the calibrated range
        n = max(0.0, min(1.0, n))
        # Invert cost metrics: lower cost = higher effectiveness
        if name in COST_METRICS:
            n = 1.0 - n

        normalized[name] = round(n, 4)

    # Proportional weight recalibration — only include active (non-flagged) metrics
    active_weights = {k: v for k, v in BASE_WEIGHTS.items() if k not in flagged_names}
    total_active   = sum(active_weights.values())
    effective_weights: dict[str, float] = (
        {k: round(v / total_active, 6) for k, v in active_weights.items()}
        if total_active > 0 else {}
    )

    return normalized, effective_weights


# ─── Step 4 — PES Formula ─────────────────────────────────────────────────────

def compute_pes(
    normalized: dict[str, float],
    effective_weights: dict[str, float],
) -> PesResult:
    """
    Apply the weighted-sum PES formula and build the contribution breakdown.

    Full formula (no flags):
        PES = (ROAS × 0.35) + (CR × 0.30) + (CAC_inv × 0.15) + (CTR × 0.15) + (CPC_inv × 0.05)

    When metrics are flagged, effective_weights replaces BASE_WEIGHTS to ensure
    the active metric contributions still sum correctly to the full [0, 1] range.
    Flagged metrics (weight = 0) are excluded from the breakdown entirely so
    the output is not cluttered with zero-contribution rows.

    Returns a PesResult with the computed score, label, and per-metric breakdown.
    """
    breakdown: list[dict] = []
    total: float = 0.0

    # Canonical order: highest weight first
    for name in ("ROAS", "CR", "CAC", "CTR", "CPC"):
        eff_weight = effective_weights.get(name, 0.0)
        # Skip metrics that were flagged (excluded from effective_weights)
        if eff_weight == 0.0:
            continue

        norm_val     = normalized.get(name, 0.0)
        contribution = round(norm_val * eff_weight, 4)
        total       += contribution

        breakdown.append({
            "metric":       DISPLAY_NAMES[name],
            "weight":       f"{round(eff_weight * 100, 1)}%",   # actual recalibrated weight
            "contribution": contribution,
        })

    score = round(min(1.0, max(0.0, total)), 4)

    # ── Qualitative label (aligned with Spring Boot PESComputationService) ────
    if score >= 0.80:
        label = "Excellent Performance"
    elif score >= 0.60:
        label = "Good Performance"
    elif score >= 0.40:
        label = "Fair Performance"
    else:
        label = "Poor Performance"

    return PesResult(score=score, label=label, breakdown=breakdown)
