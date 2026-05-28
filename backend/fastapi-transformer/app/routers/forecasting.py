"""Submodule 2.2 — Demand Forecasting & Market Scoring endpoints.

Phase 2 architecture:
  POST /inference  — Gemini-powered 4w / 12w demand forecasting (replaces BiLSTM)
  POST /score      — XGBoost economic viability scoring (GDP, FX, flight, distance)
<<<<<<< HEAD
=======
  POST /analyze    — legacy stub fallback (kept for backward compatibility)
  POST /notifications — legacy stub fallback
>>>>>>> paldo
"""
from __future__ import annotations

import logging

<<<<<<< HEAD
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import gemini_forecaster, xgboost_scorer
=======
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import gemini_forecaster, ml_stubs, xgboost_scorer
>>>>>>> paldo

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
<<<<<<< HEAD
    # Optional — absent from early-stage requests.
=======
    # Optional — absent from early-stage / stub requests.
>>>>>>> paldo
    gdpTrendDirection: str   | None = None   # "growing" | "declining" | "flat"
    gdpTrendDelta:     float | None = None   # newest − oldest GDP growth point
    gdpTrend:    list[GdpTrendPoint]   = Field(default_factory=list)
    forexTrend:  list[ForexTrendPoint] = Field(default_factory=list)


class ForecastResponse(BaseModel):
    predicted_demand_4w:     float
    predicted_demand_12w:    float
<<<<<<< HEAD
    # Individual per-week forecasts [Wk+1, Wk+2, Wk+3, Wk+4] — used by the
    # Spring Boot ForecastingService to render a real trend line on the chart
    # instead of a flat repeated value.
=======
    # Per-week demand projections: [Wk+1, Wk+2, Wk+3, Wk+4].
    # weekly_forecasts[-1] == predicted_demand_4w.
    # Empty only on legacy/stub responses that pre-date this field.
>>>>>>> paldo
    weekly_forecasts:        list[float] = Field(default_factory=list)
    mape:                    float
    mae:                     float
    rmse:                    float
    confidence:              float
    passed:                  bool
    low_confidence_disclaimer: bool = False
    message:                 str   = ""
<<<<<<< HEAD
    source:                  str   = "gemini"


class GeminiBatchForecastRequest(BaseModel):
    """Batch payload: all markets' sequences in one call to avoid per-market RPM hits."""
    markets: list[GeminiForecastRequest]


class GeminiBatchForecastResponse(BaseModel):
    """Batch response: forecast results keyed by market name (e.g. 'korea')."""
    results: dict[str, ForecastResponse]
=======
    source:                  str   = "stub"
>>>>>>> paldo


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

<<<<<<< HEAD
    Error handling: Gemini quota exhaustion (429) and transient failures are
    caught here and returned as 503 JSON so Spring Boot's WebClient can parse
    the error body without an UnsupportedMediaTypeException.
    """
    try:
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
    except ValueError as exc:
        # Missing trend_series — ingestion has not run yet.
        error_msg = str(exc)
        logger.error("[MOD22_MISSING_TREND_DATA] market=%s: %s", body.market, exc)
        raise HTTPException(
            status_code=422,
            detail={
                "code": "MOD22_MISSING_TREND_DATA",
                "reason": error_msg,
                "message": "Trend series is empty — run the ingestion job first to populate signal records.",
            },
        )
    except RuntimeError as exc:
        error_msg = str(exc)
        if "429" in error_msg or "quota" in error_msg.lower() or "rate_limit" in error_msg.lower():
            code = "MOD22_AI_QUOTA_EXCEEDED"
            human_reason = (
                "AI model daily token limit reached. "
                "Wait until the quota resets (rolling 24-hour window) or upgrade the API plan."
            )
        elif "api key" in error_msg.lower() or "api_key" in error_msg.lower():
            code = "MOD22_AI_AUTH_FAILED"
            human_reason = (
                "AI model API key is invalid or missing. "
                "Check that the API key environment variable is set correctly."
            )
        elif "timeout" in error_msg.lower() or "deadline" in error_msg.lower():
            code = "MOD22_AI_TIMEOUT"
            human_reason = (
                "AI model request timed out after 3 attempts. "
                "The service may be experiencing high load — retry in a few minutes."
            )
        else:
            code = "MOD22_AI_UNAVAILABLE"
            human_reason = f"AI model failed after 3 attempts: {error_msg}"
        logger.error("[%s] AI forecast failed for market=%s: %s", code, body.market, exc)
        raise HTTPException(
            status_code=503,
            detail={
                "code": code,
                "reason": error_msg,
                "message": human_reason,
            },
        )
    return ForecastResponse(**result)


# ─── Submodule 2.2: Batch Gemini inference (1 call for all markets) ──────────

@router.post("/inference-batch", response_model=GeminiBatchForecastResponse)
def run_inference_batch(body: GeminiBatchForecastRequest) -> GeminiBatchForecastResponse:
    """Single Gemini call for all markets — replaces N sequential /inference calls.

    Reduces RPM consumption from N to 1, preventing rate-limit 503s when markets
    are processed back-to-back.  Error handling mirrors the single-market endpoint.
    """
    if not body.markets:
        raise HTTPException(status_code=422, detail="markets list must not be empty")

    markets_data = [
        {
            "market":              m.market,
            "trend_series":        m.trendSeries,
            "rolling_7d":          m.rolling7dAvg,
            "rolling_30d":         m.rolling30dAvg,
            "rolling_std_7d":      m.rollingStd7d,
            "spike_indicator":     m.spikeIndicator,
            "yoy_ratio":           m.yoyRatio,
            "seasonality_score":   m.seasonalityScore,
            "forex_rate":          m.forexRate,
            "gdp_growth":          m.gdpGrowth,
            "gdp_trend_direction": m.gdpTrendDirection,
            "gdp_trend_delta":     m.gdpTrendDelta,
        }
        for m in body.markets
    ]

    try:
        batch_result = gemini_forecaster.forecast_batch(markets_data)
    except ValueError as exc:
        logger.error("[MOD22_MISSING_TREND_DATA] batch inference: %s", exc)
        raise HTTPException(
            status_code=422,
            detail={
                "code": "MOD22_MISSING_TREND_DATA",
                "message": str(exc),
            },
        )
    except RuntimeError as exc:
        error_msg = str(exc)
        if "429" in error_msg or "quota" in error_msg.lower() or "rate_limit" in error_msg.lower():
            code = "MOD22_AI_QUOTA_EXCEEDED"
            human_reason = (
                "AI model daily token limit reached. "
                "Wait until the quota resets (rolling 24-hour window) or upgrade the API plan."
            )
        elif "api key" in error_msg.lower() or "api_key" in error_msg.lower():
            code = "MOD22_AI_AUTH_FAILED"
            human_reason = (
                "AI model API key is invalid or missing. "
                "Check that the API key environment variable is set correctly."
            )
        elif "timeout" in error_msg.lower() or "deadline" in error_msg.lower():
            code = "MOD22_AI_TIMEOUT"
            human_reason = (
                "AI model request timed out after 3 attempts. "
                "The service may be experiencing high load — retry in a few minutes."
            )
        elif "missing forecast for market" in error_msg:
            code = "MOD22_AI_INCOMPLETE_RESPONSE"
            human_reason = f"AI model returned an incomplete batch response: {error_msg}"
        else:
            code = "MOD22_AI_UNAVAILABLE"
            human_reason = f"AI model failed after 3 attempts: {error_msg}"
        logger.error("[%s] AI batch forecast failed: %s", code, exc)
        raise HTTPException(
            status_code=503,
            detail={"code": code, "message": human_reason},
        )

    return GeminiBatchForecastResponse(
        results={mkt: ForecastResponse(**data) for mkt, data in batch_result.items()}
    )
=======
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
>>>>>>> paldo


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
<<<<<<< HEAD
    try:
        result = xgboost_scorer.score(body.model_dump())
    except RuntimeError as exc:
        error_msg = str(exc)
        if "not loaded" in error_msg or "not found" in error_msg:
            code = "MOD22_XGBOOST_MODEL_MISSING"
            human_reason = (
                "XGBoost model file is not present. "
                "Place a trained 'xgboost_market.json' in the container at /app/models/ "
                "and rebuild the image. Without this file the economic viability score cannot be computed."
            )
        else:
            code = "MOD22_XGBOOST_SCORING_FAILED"
            human_reason = f"XGBoost scoring failed: {error_msg}"
        logger.error("[%s] XGBoost scoring failed for market=%s: %s", code, body.market, exc)
        raise HTTPException(
            status_code=503,
            detail={
                "code": code,
                "reason": error_msg,
                "message": human_reason,
            },
        )
    return EconomicScoreResponse(**result)
=======
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
>>>>>>> paldo
