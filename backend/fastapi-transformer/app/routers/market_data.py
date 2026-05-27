"""Submodule 2.1 — Market Data Aggregation endpoints.

Called by Spring Boot during the weekly ingestion job (FR2.1–FR2.8).

  POST /trends      — Google Trends index via PyTrends (FR2.2)
  POST /seasonality — Seasonal shift detection pipeline (FR2.7):
                        7d/30d rolling averages, 2σ spike, YoY ratio,
                        seasonality score 0–1 (per CeView_SeasonalShift_Detection.md)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import market_data_processor, pytrends_client, seasonal_shift_detector

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class TrendsRequest(BaseModel):
    market: str
    categories: list[str] = Field(default_factory=list)


class TrendsResponse(BaseModel):
    market: str
    trend_index: float = Field(ge=0.0, le=100.0)
    keywords_used: list[str] = Field(default_factory=list)
    fetched_at: str
    source: str = "live"


class TrendHistoryRequest(BaseModel):
    market: str
    categories: list[str] = Field(default_factory=list)
    weeks: int = Field(default=12, ge=4, le=52)


class TrendWeekPoint(BaseModel):
    date: str
    trend_index: float = Field(ge=0.0, le=100.0)


class TrendHistoryResponse(BaseModel):
    market: str
    weekly_series: list[TrendWeekPoint]
    keywords_used: list[str] = Field(default_factory=list)
    fetched_at: str
    source: str = "live"


class SeasonalityRequest(BaseModel):
    profile_id: str = ""
    market: str
    # Chronological list of weekly normalised trend indices (0–100).
    # Requirements:
    #   ≥  1 entry — basic rolling stats computed; spike evaluated
    #   ≥  7 entries — 7-period rolling average/std meaningful
    #   ≥ 59 entries — YoY ratio computed (52-week lookback + 7-period window)
    weekly_history: list[float] = Field(default_factory=list)


class SeasonalityResponse(BaseModel):
    market: str
    # All values returned in 0–1 or natural units.
    # Spring Boot multiplies seasonality_score by 100 only in ChartDataPointDto
    # for the frontend DemandForecastChart Y-axis [0, 100].
    seasonality_score: float = Field(ge=0.0, le=1.0)
    rolling_7d_avg:    float
    rolling_30d_avg:   float
    rolling_7d_std:    float
    spike_indicator:   bool
    yoy_ratio:         float | None
    computed_at:       str


# ─── Google Trends index (FR2.2) ──────────────────────────────────────────────

@router.post("/trends", response_model=TrendsResponse)
def fetch_trends(body: TrendsRequest) -> TrendsResponse:
    """Fetch Google Trends index for a market-category pair (FR2.2).

    Uses PyTrends to fetch the 3-month trailing average for up to 5 keywords
    derived from the market identifier and business category labels.
    Falls back to a deterministic stub index on rate-limit or network error.
    """
    raw = pytrends_client.fetch_trends(body.market, body.categories)
    trend_index = market_data_processor.normalize_trend_index(
        float(raw.get("trend_index", 50.0))
    )
    return TrendsResponse(
        market        = raw["market"],
        trend_index   = trend_index,
        keywords_used = raw.get("keywords_used", []),
        fetched_at    = raw.get("fetched_at", datetime.now(timezone.utc).isoformat()),
        source        = raw.get("source", "live"),
    )


# ─── Weekly trend history — used on first ingestion to backfill signal records ──

@router.post("/trends/history", response_model=TrendHistoryResponse)
def fetch_trend_history(body: TrendHistoryRequest) -> TrendHistoryResponse:
    """Fetch N weeks of weekly Google Trends history for a market (FR2.2).

    Called once per profile/market on first ingestion to backfill historical
    MarketSignalRecord rows so the demand chart shows real week-over-week
    variance rather than a flat repeated value.
    """
    raw = pytrends_client.fetch_trend_history(body.market, body.categories, body.weeks)
    series = [
        TrendWeekPoint(
            date=point["date"],
            trend_index=market_data_processor.normalize_trend_index(float(point["trend_index"])),
        )
        for point in raw.get("weekly_series", [])
    ]
    return TrendHistoryResponse(
        market        = raw["market"],
        weekly_series = series,
        keywords_used = raw.get("keywords_used", []),
        fetched_at    = raw.get("fetched_at", datetime.now(timezone.utc).isoformat()),
        source        = raw.get("source", "live"),
    )


# ─── Seasonal Shift Detection (FR2.7) ─────────────────────────────────────────

@router.post("/seasonality", response_model=SeasonalityResponse)
def compute_seasonality(body: SeasonalityRequest) -> SeasonalityResponse:
    """Full seasonal shift detection pipeline (FR2.7).

    Implements the exact mathematics from CeView_SeasonalShift_Detection.md:
      Step 1: 7-period and 30-period rolling averages of the trend index
      Step 2: Spike indicator — current > rolling_7d_avg + (2 × rolling_7d_std)
      Step 3: Year-over-Year ratio — rolling_7d_avg_now / rolling_7d_avg_52w_prior
      Step 4: Seasonality score (0–1) — weighted composite of YoY, spike, stability

    The seasonality_score is returned in [0, 1].
    Spring Boot stores this value in the DB and multiplies by 100 exclusively
    in buildChartData() for the frontend chart Y-axis.

    Also returns rolling_7d_avg, rolling_7d_std, spike_indicator, and yoy_ratio
    so Spring Boot can persist them directly in tbl_market_signal_record.
    """
    result = seasonal_shift_detector.compute(body.weekly_history)
    return SeasonalityResponse(
        market            = body.market,
        seasonality_score = result["seasonality_score"],
        rolling_7d_avg    = result["rolling_7d_avg"],
        rolling_30d_avg   = result["rolling_30d_avg"],
        rolling_7d_std    = result["rolling_7d_std"],
        spike_indicator   = result["spike_indicator"],
        yoy_ratio         = result["yoy_ratio"],
        computed_at       = result["computed_at"],
    )
