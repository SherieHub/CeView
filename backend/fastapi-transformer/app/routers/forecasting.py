"""Submodule 2.2 — Demand Forecasting & Market Scoring endpoints.

Phase 2 architecture:
  POST /inference-batch — one engine call for all market forecasts
  POST /score      — XGBoost economic viability scoring (GDP, FX, flight, distance)
"""
from __future__ import annotations

import logging
import math
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services import xgboost_scorer
from app.services.forecast_engine import ACTIVE_ENGINE, WINDOW_LENGTH

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
    """Deprecated pre-feature-matrix payload; accepted during client rollout."""
    model_config = ConfigDict(extra="forbid", json_schema_extra={"deprecated": True})
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
    # Optional — absent from early-stage requests.
    gdpTrendDirection: str   | None = None   # "growing" | "declining" | "flat"
    gdpTrendDelta:     float | None = None   # newest − oldest GDP growth point
    gdpTrend:    list[GdpTrendPoint]   = Field(default_factory=list)
    forexTrend:  list[ForexTrendPoint] = Field(default_factory=list)


class WeeklyFeatureRow(BaseModel):
    """One fixed-order feature row, represented by named fields at the HTTP seam."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    iso_year: int = Field(validation_alias=AliasChoices("isoYear", "iso_year"), ge=2000, le=2100)
    iso_week: int = Field(validation_alias=AliasChoices("isoWeek", "iso_week"), ge=1, le=53)
    week_start_date: date = Field(validation_alias=AliasChoices("weekStartDate", "week_start_date"))
    trend_index: float = Field(validation_alias=AliasChoices("trendIndex", "trend_index"), ge=0.0, le=100.0)
    forex_rate: float = Field(validation_alias=AliasChoices("forexRate", "forex_rate"), gt=0.0)
    gdp_growth: float = Field(validation_alias=AliasChoices("gdpGrowth", "gdp_growth"))
    seasonality_score: float = Field(validation_alias=AliasChoices("seasonalityScore", "seasonality_score"), ge=0.0, le=1.0)
    spike_indicator: float = Field(validation_alias=AliasChoices("spikeIndicator", "spike_indicator"), ge=0.0, le=1.0)
    holiday_flag: float = Field(validation_alias=AliasChoices("holidayFlag", "holiday_flag"), ge=0.0, le=1.0)

    @field_validator("trend_index", "forex_rate", "gdp_growth", "seasonality_score", "spike_indicator", "holiday_flag")
    @classmethod
    def finite_float(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("must be a finite float, not null, NaN, or infinity")
        return value

    @field_validator("spike_indicator", "holiday_flag")
    @classmethod
    def binary_float(cls, value: float) -> float:
        if value not in (0.0, 1.0):
            raise ValueError("must be 0.0 or 1.0")
        return value

    @model_validator(mode="after")
    def matches_iso_week(self) -> "WeeklyFeatureRow":
        iso = self.week_start_date.isocalendar()
        if (iso.year, iso.week) != (self.iso_year, self.iso_week):
            raise ValueError("weekStartDate does not match isoYear/isoWeek")
        if self.week_start_date.weekday() != 0:
            raise ValueError("weekStartDate must be the Monday UTC date for its ISO week")
        return self


class SequenceForecastRequest(BaseModel):
    """Module 2 fixed 12-week forecasting request (C-02/T-09/T-10)."""
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    profile_id: str = Field(validation_alias=AliasChoices("profileId", "profile_id"))
    market: str = Field(min_length=1)
    category: str | None = None
    data_as_of: str | None = Field(default=None, validation_alias=AliasChoices("dataAsOf", "data_as_of"))
    data_stale: bool = Field(default=False, validation_alias=AliasChoices("dataStale", "data_stale"))
    sequence: list[WeeklyFeatureRow] = Field(min_length=WINDOW_LENGTH, max_length=WINDOW_LENGTH)
    imputed_mask: list[dict[str, bool]] = Field(validation_alias=AliasChoices("imputedMask", "imputed_mask"), min_length=WINDOW_LENGTH, max_length=WINDOW_LENGTH)
    # Deprecated scalar compatibility fields are retained for Groq rollout.
    trend_series: list[float] | None = Field(default=None, validation_alias=AliasChoices("trendSeries", "trend_series"))
    rolling_7d_avg: float | None = Field(default=None, validation_alias=AliasChoices("rolling7dAvg", "rolling_7d_avg"))
    rolling_30d_avg: float | None = Field(default=None, validation_alias=AliasChoices("rolling30dAvg", "rolling_30d_avg"))
    rolling_std_7d: float | None = Field(default=None, validation_alias=AliasChoices("rollingStd7d", "rolling_std_7d"))
    spike_indicator: bool | None = Field(default=None, validation_alias=AliasChoices("spikeIndicator", "spike_indicator"))
    yoy_ratio: float | None = Field(default=None, validation_alias=AliasChoices("yoyRatio", "yoy_ratio"))
    seasonality_score: float | None = Field(default=None, validation_alias=AliasChoices("seasonalityScore", "seasonality_score"))
    forex_rate: float | None = Field(default=None, validation_alias=AliasChoices("forexRate", "forex_rate"))
    gdp_growth: float | None = Field(default=None, validation_alias=AliasChoices("gdpGrowth", "gdp_growth"))

    @model_validator(mode="after")
    def increasing_weeks_and_masks(self) -> "SequenceForecastRequest":
        starts = [row.week_start_date for row in self.sequence]
        if any(right <= left for left, right in zip(starts, starts[1:])):
            raise ValueError("sequence must be strictly increasing by ISO week")
        required = {"trendIndex", "forexRate", "gdpGrowth", "seasonalityScore", "spikeIndicator", "holidayFlag"}
        for index, mask in enumerate(self.imputed_mask):
            if set(mask) != required:
                raise ValueError(f"imputedMask[{index}] must contain exactly {sorted(required)}")
        return self

    def engine_payload(self) -> dict:
        payload = self.model_dump()
        payload["profileId"] = payload.pop("profile_id")
        payload["dataAsOf"] = payload.pop("data_as_of")
        payload["dataStale"] = payload.pop("data_stale")
        payload["imputedMask"] = payload.pop("imputed_mask")
        payload["trendSeries"] = payload.pop("trend_series")
        payload["rolling7dAvg"] = payload.pop("rolling_7d_avg")
        payload["rolling30dAvg"] = payload.pop("rolling_30d_avg")
        payload["rollingStd7d"] = payload.pop("rolling_std_7d")
        payload["spikeIndicator"] = payload.pop("spike_indicator")
        payload["yoyRatio"] = payload.pop("yoy_ratio")
        payload["seasonalityScore"] = payload.pop("seasonality_score")
        payload["forexRate"] = payload.pop("forex_rate")
        payload["gdpGrowth"] = payload.pop("gdp_growth")
        payload["sequence"] = [{
            "isoYear": row["iso_year"], "isoWeek": row["iso_week"], "weekStartDate": row["week_start_date"].isoformat(),
            "trendIndex": row["trend_index"], "forexRate": row["forex_rate"], "gdpGrowth": row["gdp_growth"],
            "seasonalityScore": row["seasonality_score"], "spikeIndicator": row["spike_indicator"], "holidayFlag": row["holiday_flag"],
        } for row in payload["sequence"]]
        return payload


class ForecastResponse(BaseModel):
    predicted_demand_4w:     float
    predicted_demand_12w:    float
    # Individual per-week forecasts [Wk+1, Wk+2, Wk+3, Wk+4] — used by the
    # Spring Boot ForecastingService to render a real trend line on the chart
    # instead of a flat repeated value.
    weekly_forecasts:        list[float] = Field(default_factory=list)
    mape:                    float | None
    mae:                     float | None
    rmse:                    float | None
    confidence:              float
    passed:                  bool
    low_confidence_disclaimer: bool = False
    message:                 str   = ""
    source:                  str   = "gemini"


ForecastRequest = Annotated[SequenceForecastRequest | GeminiForecastRequest, Field(union_mode="left_to_right")]


class GeminiBatchForecastRequest(BaseModel):
    """Batch accepts fixed sequence requests and deprecated Gemini requests."""
    markets: list[ForecastRequest]


class GeminiBatchForecastResponse(BaseModel):
    """Batch response: forecast results keyed by market name (e.g. 'korea')."""
    results: dict[str, ForecastResponse]


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
    scorer:                   Literal["xgboost", "linear"]
    components:               dict


# ─── Submodule 2.2: batch demand forecasting (FR2.11) ─────────────────────────

def _engine_payload(body: ForecastRequest) -> dict:
    if isinstance(body, SequenceForecastRequest):
        return body.engine_payload()
    return body.model_dump()


# ─── Submodule 2.2: batch inference (one call for all markets) ───────────────

@router.post("/inference-batch", response_model=GeminiBatchForecastResponse)
def run_inference_batch(body: GeminiBatchForecastRequest) -> GeminiBatchForecastResponse:
    """One engine call for all markets; this is the only forecasting entry point."""
    if not body.markets:
        raise HTTPException(status_code=422, detail="markets list must not be empty")

    markets_data = [_engine_payload(m) for m in body.markets]

    try:
        batch_result = ACTIVE_ENGINE.forecast_batch(markets_data)
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
