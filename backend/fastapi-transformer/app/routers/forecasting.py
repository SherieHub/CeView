"""Submodule 2.2 — Demand Forecasting & Market Scoring endpoints.

Phase 2 architecture:
  POST /inference  — Gemini-powered 4w / 12w demand forecasting (replaces BiLSTM)
  POST /score      — XGBoost economic viability scoring (GDP, FX, flight, distance)
  POST /analyze    — legacy stub fallback (kept for backward compatibility)
  POST /notifications — legacy stub fallback
"""
from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import gemini_forecaster, ml_stubs, xgboost_scorer

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class GdpTrendPoint(BaseModel):
    """One annual GDP growth data point for MarketRadar trend charts."""
    year:  int
    value: float


class ForexTrendPoint(BaseModel):
    """One monthly forex rate data point (foreign-currency units per PHP)."""
    date:  str    # "YYYY-MM"
    value: float


class GeminiForecastRequest(BaseModel):
    """Payload built by Spring Boot EnrichedSequenceBuilder and sent to Gemini."""
    profileId: str = ""
    market: str
    # Full chronological series of weekly normalised trend indices (0–100).
    trendSeries: list[float] = Field(default_factory=list)
    # Pre-computed rolling statistics from SeasonalShiftDetector / DB.
    rolling7dAvg:      float = Field(default=50.0, ge=0.0, le=100.0)
    rolling30dAvg:     float = Field(default=50.0, ge=0.0, le=100.0)
    rollingStd7d:      float = Field(default=0.0,  ge=0.0)
    spikeIndicator:    bool  = False
    yoyRatio:          float | None = None
    # seasonalityScore is stored in DB as 0–1; passed as-is to Gemini.
    seasonalityScore:  float = Field(default=0.5, ge=0.0, le=1.0)
    forexRate:         float = Field(default=1.0, ge=0.0)
    gdpGrowth:         float = 2.0
    holidayFlag:       bool  = False
    # ── Economic trend context (Phase 3 MarketRadar extension) ────────────────
    # Optional — absent from early-stage / stub requests.
    gdpTrendDirection: str   | None = None   # "growing" | "declining" | "flat"
    gdpTrendDelta:     float | None = None   # newest − oldest GDP growth point
    gdpTrend:    list[GdpTrendPoint]   = Field(default_factory=list)
    forexTrend:  list[ForexTrendPoint] = Field(default_factory=list)


class ForecastResponse(BaseModel):
    predicted_demand_4w:     float
    predicted_demand_12w:    float
    mape:                    float
    mae:                     float
    rmse:                    float
    confidence:              float
    passed:                  bool
    low_confidence_disclaimer: bool = False
    message:                 str   = ""
    source:                  str   = "stub"


class EconomicScoreRequest(BaseModel):
    """Economic signal features for XGBoost market viability scoring (FR2.13)."""
    market: str = ""
    # Demand and seasonality feed the composite market_score.
    predicted_demand:   float = Field(default=50.0, ge=0.0,  le=100.0)
    seasonality_score:  float = Field(default=0.5,  ge=0.0,  le=1.0)
    spike_indicator:    bool  = False
    # Economic access features — core XGBoost inputs.
    gdp_growth:         float = 2.0
    forex_vs_php:       float = Field(default=1.0, ge=0.0)
    direct_flight:      bool  = False
    distance_km:        int   = Field(default=5000, ge=0)
    flight_frequency:   int   = Field(default=3,    ge=0)
    # ── Economic trend context — optional; forwarded from ForecastingService ──
    gdp_trend_direction: str  | None = None   # "growing" | "declining" | "flat"
    gdp_trend_delta:     float | None = None


class EconomicScoreResponse(BaseModel):
    market_score:             float
    economic_viability_score: float
    components:               dict


# ─── Submodule 2.2: Gemini demand forecasting (FR2.11) ────────────────────────

@router.post("/inference", response_model=ForecastResponse)
def run_inference(body: GeminiForecastRequest) -> ForecastResponse:
    """Gemini-powered 4-week and 12-week demand forecasting (FR2.11).

    Constructs a structured prompt from the trend series and rolling statistics,
    calls the Gemini API with temperature=0.1 and JSON response mode, then
    parses and validates the output (FR2.12 MAPE ≤ 15%).

    Falls back to a deterministic linear-extrapolation stub when:
      - GEMINI_API_KEY is not configured
      - The API returns an unparseable response after 3 retries
    """
    result = gemini_forecaster.forecast(
        market              = body.market,
        trend_series        = body.trendSeries,
        rolling_7d          = body.rolling7dAvg,
        rolling_30d         = body.rolling30dAvg,
        rolling_std_7d      = body.rollingStd7d,
        spike_indicator     = body.spikeIndicator,
        yoy_ratio           = body.yoyRatio,
        seasonality_score   = body.seasonalityScore,
        forex_rate          = body.forexRate,
        gdp_growth          = body.gdpGrowth,
        gdp_trend_direction = body.gdpTrendDirection,
        gdp_trend_delta     = body.gdpTrendDelta,
    )
    return ForecastResponse(**result)


# ─── Submodule 2.2: XGBoost economic scoring (FR2.13) ────────────────────────

@router.post("/score", response_model=EconomicScoreResponse)
def score_market(body: EconomicScoreRequest) -> EconomicScoreResponse:
    """XGBoost economic viability scoring (FR2.13).

    Evaluates the economic dimension of market attractiveness from five signals:
      GDP growth rate, forex rate vs PHP, direct flight availability,
      travel distance, and weekly flight frequency.

    The economic_viability_score (0–1) is combined with the Gemini demand
    score and the seasonality score to produce the final market_score:
      market_score = 0.40·demand + 0.35·seasonality + 0.25·economic_viability
    """
    result = xgboost_scorer.score(body.model_dump())
    return EconomicScoreResponse(**result)


# ─── Legacy stub fallbacks ────────────────────────────────────────────────────

@router.post("/analyze")
def analyze(_: dict | None = None) -> dict:
    """Legacy stub — returns MOCK_MARKETS-shaped data when no enriched dataset exists."""
    return {"markets": ml_stubs.forecast_markets()}


@router.post("/notifications")
def list_notifications(_: dict | None = None) -> dict:
    """Legacy stub — returns static notifications when DB alerts are absent."""
    return {"notifications": ml_stubs.notifications()}
