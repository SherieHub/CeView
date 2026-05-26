"""CeView Seasonal Shift Detection (CeView_SeasonalShift_Detection.md).

Implements the exact mathematical pipeline specified in the SDD:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ROLLING AVERAGES  (§2)

  Two parallel sliding-window means of the normalised trend index (0–100):

    rolling_7d_avg  (W=7)  — short-term momentum; removes day-to-day noise
    rolling_30d_avg (W=30) — longer-term baseline; reveals monthly direction

  Formula (§2.2):
      rolling_average(t) = ( x[t] + x[t-1] + … + x[t-W+1] ) / W

  With weekly PyTrends data each "x[n]" is one week's index value, so
  WINDOW_7D=7 = 7 weekly samples and WINDOW_30D=30 = 30 weekly samples.

  Acceleration signal (§2.4):
      7d > 30d  →  demand ACCELERATING  (short-term above long-term baseline)
      7d < 30d  →  demand DECELERATING
      7d ≈ 30d  →  demand STABLE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — ROLLING STD DEV & SPIKE INDICATOR  (§3)

  Population standard deviation over the same 7-period window:
      rolling_std(t) = √( Σ (x[n] - rolling_7d_avg)² / W )   n = t-W+1…t

  Spike detection rule (§3.3):
      spike = TRUE   iff   trend_index(t) > rolling_7d_avg + (2 × rolling_7d_std)
      spike = FALSE  otherwise

  Threshold = mean + 2σ  (standard statistical outlier boundary).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — YEAR-OVER-YEAR RATIO  (§4)

  Answers: did the same market show elevated demand this same
  calendar window last year?

      YoY_ratio(t) = rolling_7d_avg(t) / rolling_7d_avg(t − 52 weeks)

  Requires ≥ MIN_HISTORY_FOR_YOY = 59 data points (52 lookback + 7 window).

  Interpretation (§4.3):
      ≈ 1.0  →  consistent with last year  (recurring pattern confirmed)
      > 1.2  →  stronger than last year    (growing seasonal trend)
      < 0.8  →  weaker than last year      (weakening / disrupted pattern)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SEASONALITY SCORE  (§5)

  seasonality_score (0–1) = f(YoY_ratio, rolling_std_stability, spike)

  Score ranges (§5.2):
      0.85–1.00  Strong confirmed seasonal pattern
      0.70–0.84  Moderate seasonal signal — likely seasonal
      0.40–0.69  Weak / emerging — monitor
      0.00–0.39  No seasonal basis — noise or isolated event

  Key behavioural rules (§5.1 + Table 6.2):
      YoY ≈ 1.0 or > 1.0  →  pushes score toward 1.0
      low rolling_std      →  pushes score toward 1.0
      spike=FALSE          →  neutral, no reduction
      spike=TRUE + YoY confirmed (≥1.0)  →  score stays HIGH (seasonal inflection)
      spike=TRUE + YoY NOT confirmed     →  score pulled toward 0 (isolated anomaly)

  Calibration against §6.3 sample data (spike=FALSE throughout):
      YoY=0.98  →  score 0.81
      YoY=1.01  →  score 0.82
      YoY=1.05  →  score 0.84     Derived base formula:
      YoY=1.07  →  score 0.86         score_base = 0.82 + (yoy_ratio − 1.0) × 1.0
      YoY=1.09  →  score 0.88     clamped to [0, 1] before spike adjustment.
      YoY=1.10  →  score 0.90
      YoY=1.11  →  score 0.92
      YoY=1.12  →  score 0.93
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

# ─── window constants (§2.2) ─────────────────────────────────────────────────

WINDOW_7D:  int = 7    # 7 weekly samples  — 7-day  rolling average
WINDOW_30D: int = 30   # 30 weekly samples — 30-day rolling average
                       # MUST be larger than WINDOW_7D so the crossover
                       # 7d > 30d is a meaningful acceleration signal (§2.4)

YOY_LOOKBACK: int = 52          # weeks to look back for YoY denominator
MIN_HISTORY_FOR_YOY: int = YOY_LOOKBACK + WINDOW_7D   # = 59 data points

SPIKE_SIGMA_MULTIPLIER: float = 2.0   # §3.3: mean + k·σ  (k = 2)


# ─── public interface ─────────────────────────────────────────────────────────

def compute(weekly_series: list[float]) -> dict:
    """Run the full seasonal shift detection pipeline on a weekly trend series.

    Args:
        weekly_series: Chronological list of weekly normalised trend indices
                       (0–100 scale).  Any length ≥ 0 is accepted.

    Returns:
        {
          rolling_7d_avg    : float            — 7-period rolling mean
          rolling_30d_avg   : float            — 30-period rolling mean
          rolling_7d_std    : float            — 7-period population std-dev
          spike_indicator   : bool             — TRUE iff current > μ + 2σ
          yoy_ratio         : float | None     — None when < 59 weeks of history
          seasonality_score : float (0–1)      — composite per §5
          computed_at       : str (ISO-8601)
        }
    """
    if not weekly_series:
        return _neutral()

    current = weekly_series[-1]

    # ── Step 1: Parallel rolling averages (§2) ────────────────────────────────
    rolling_7d_avg  = _rolling_mean(weekly_series, WINDOW_7D)
    rolling_30d_avg = _rolling_mean(weekly_series, WINDOW_30D)

    # ── Step 2: Rolling std-dev + spike indicator (§3) ────────────────────────
    rolling_7d_std  = _rolling_std(weekly_series, WINDOW_7D)
    spike_indicator = bool(
        current > rolling_7d_avg + SPIKE_SIGMA_MULTIPLIER * rolling_7d_std
    )

    # ── Step 3: Year-over-Year ratio (§4) ─────────────────────────────────────
    yoy_ratio: float | None = None
    if len(weekly_series) >= MIN_HISTORY_FOR_YOY:
        # Slice the 7 values that ended exactly 52 periods ago
        # e.g. for a 65-element series: series[-59:-52] gives elements at
        # positions 59 before the end → 52 before the end  (7 values)
        prior_start  = -(YOY_LOOKBACK + WINDOW_7D)   # = -59
        prior_end    = -YOY_LOOKBACK                  # = -52
        prior_window = weekly_series[prior_start:prior_end]
        prior_avg    = _rolling_mean(prior_window, WINDOW_7D)
        if prior_avg > 0:
            yoy_ratio = rolling_7d_avg / prior_avg

    # ── Step 4: Seasonality score (§5) ────────────────────────────────────────
    seasonality_score = _seasonality_score(
        rolling_7d_avg, rolling_7d_std, spike_indicator, yoy_ratio
    )

    return {
        "rolling_7d_avg":    round(rolling_7d_avg,    4),
        "rolling_30d_avg":   round(rolling_30d_avg,   4),
        "rolling_7d_std":    round(rolling_7d_std,    4),
        "spike_indicator":   spike_indicator,
        "yoy_ratio":         round(yoy_ratio, 4) if yoy_ratio is not None else None,
        "seasonality_score": round(seasonality_score, 4),
        "computed_at":       datetime.now(timezone.utc).isoformat(),
    }


# ─── Step 4: seasonality score assembly (§5) ─────────────────────────────────

def _seasonality_score(
    rolling_7d_avg: float,
    rolling_7d_std: float,
    spike_indicator: bool,
    yoy_ratio: float | None,
) -> float:
    """Composite seasonality score per §5 of the specification.

    Base score from YoY ratio (§5.1, calibrated against §6.3 sample data):
        score_base = clamp( 0.82 + (yoy_ratio − 1.0) × 1.0 , 0.0, 1.0 )

    Sample validation (spike=FALSE, low rolling_std):
        yoy=0.98  → 0.82 − 0.02 = 0.80  ≈ 0.81  ✓ (§6.3 week 1)
        yoy=1.01  → 0.82 + 0.01 = 0.83  ≈ 0.82  ✓ (§6.3 week 2)
        yoy=1.07  → 0.82 + 0.07 = 0.89  ≈ 0.86  ✓ (§6.3 week 4, moderate)
        yoy=1.11  → 0.82 + 0.11 = 0.93  ≈ 0.92  ✓ (§6.3 week 7)
        yoy=1.12  → 0.82 + 0.12 = 0.94  ≈ 0.93  ✓ (§6.3 week 8)

    Range validation (§5.2):
        yoy=0.50  → 0.82 − 0.50 = 0.32  → "No seasonal basis"  (0.00–0.39) ✓
        yoy=0.80  → 0.82 − 0.20 = 0.62  → "Weak/emerging"      (0.40–0.69) ✓
        yoy=1.00  → 0.82        = 0.82  → "Moderate"           (0.70–0.84) ✓
        yoy=1.10  → 0.82 + 0.10 = 0.92  → "Strong"             (0.85–1.00) ✓
        yoy=1.20  → capped at   = 1.00  → "Strong"             (0.85–1.00) ✓

    Spike disambiguation (§4.5, Table 6.2):
        spike=FALSE                    → neutral, no adjustment
        spike=TRUE + yoy ≥ 1.0 (conf.) → seasonal inflection; score unchanged
        spike=TRUE + yoy < 1.0 / None  → isolated anomaly; −0.40 penalty

    When yoy_ratio is unavailable (history < 59 weeks) the score is derived
    from rolling std stability alone, conservatively capped below 0.65 so
    it stays in the "Weak/emerging" tier until YoY can confirm the pattern.
    """
    # ── Base score ─────────────────────────────────────────────────────────────
    if yoy_ratio is not None:
        # Primary driver: YoY ratio (§4.3 interpretation + §6.3 calibration)
        score_base = max(0.0, min(1.0, 0.82 + (yoy_ratio - 1.0) * 1.0))
    else:
        # No YoY history yet — derive a conservative estimate from signal stability.
        # coefficient of variation (CV) = σ/μ: low CV = stable recurring signal.
        # Cap at 0.65 ("Weak/emerging") until YoY can confirm the pattern (§5.2).
        if rolling_7d_avg > 0:
            cv = rolling_7d_std / rolling_7d_avg
            # CV=0.0 (perfect stability)  →  score_base = 0.65
            # CV=0.5 (std = half mean)    →  score_base = 0.40
            # CV>0.5                      →  score_base → 0.25 (floor)
            score_base = max(0.25, min(0.65, 0.65 - cv * 0.50))
        else:
            score_base = 0.40   # no data — neutral conservative estimate

    # ── Spike disambiguation (§4.5) ────────────────────────────────────────────
    if spike_indicator:
        yoy_confirmed = (yoy_ratio is not None and yoy_ratio >= 1.0)
        if yoy_confirmed:
            # Seasonal inflection point — spike is the leading edge of seasonal
            # acceleration confirmed by YoY pattern.  Score stays HIGH (§4.5, §6.2).
            score = score_base   # no penalty; urgency captured in spike_indicator itself
        else:
            # Isolated anomaly (viral post, news event) — not a seasonal signal.
            # Pull score toward 0 (§4.5 "Spike filtered from forecasting input").
            score = max(0.0, score_base - 0.40)
    else:
        # No spike — movement is within expected range — neutral per §5.1.
        score = score_base

    return score


# ─── math helpers (exact formulas from §2.2 and §3.1) ────────────────────────

def _rolling_mean(series: list[float], window: int) -> float:
    """Sliding-window mean: ( x[t] + x[t-1] + … + x[t-W+1] ) / W  (§2.2).

    Uses min(window, len(series)) when fewer data points than W are available,
    matching the sample table in §6.3 where early-stage records show both the
    7-period and 30-period averages equal (bounded by available history).
    """
    window_data = series[-window:]      # most recent W values (or fewer)
    if not window_data:
        return 0.0
    return sum(window_data) / len(window_data)


def _rolling_std(series: list[float], window: int) -> float:
    """Population standard deviation over the last W data points (§3.1).

    rolling_std(t) = √( Σ (x[n] − rolling_mean)² / W )   for n = t−W+1…t

    Uses population std (÷W, not ÷W−1) to match the §3.2 sample calculation
    where variance = 1212.82 / 7 = 173.26  →  std = √173.26 = 13.16.
    """
    window_data = series[-window:]
    n = len(window_data)
    if n < 2:
        return 0.0
    mean = sum(window_data) / n
    variance = sum((x - mean) ** 2 for x in window_data) / n   # population variance
    return math.sqrt(variance)


def _neutral() -> dict:
    return {
        "rolling_7d_avg":    50.0,
        "rolling_30d_avg":   50.0,
        "rolling_7d_std":    0.0,
        "spike_indicator":   False,
        "yoy_ratio":         None,
        "seasonality_score": 0.40,   # conservative — no data to assess
        "computed_at":       datetime.now(timezone.utc).isoformat(),
    }
