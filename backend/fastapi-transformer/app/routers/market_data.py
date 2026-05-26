"""Submodule 2.1 — Market Data Aggregation endpoints.

Called by Spring Boot during the nightly ingestion job (FR2.1–FR2.8).
All endpoints are internal; not exposed to the frontend directly.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from app.services import market_data_processor, pytrends_client

logger = logging.getLogger(__name__)

router = APIRouter()


class TrendsRequest(dict):
    pass


@router.post("/trends")
def fetch_trends(body: dict) -> dict:
    """Fetch Google Trends index for a market-category pair (FR2.2).

    Request body:
        market      — str  (e.g. "korea")
        categories  — list[str]

    Response:
        market, trend_index (0-100), keywords_used, fetched_at
    """
    market: str = body.get("market", "")
    categories: list[str] = body.get("categories", [])

    raw = pytrends_client.fetch_trends(market, categories)
    raw["trend_index"] = market_data_processor.normalize_trend_index(raw.get("trend_index", 50.0))
    return raw


@router.post("/seasonality")
def compute_seasonality(body: dict) -> dict:
    """Compute FFT-based seasonality score for a market (FR2.7).

    Request body:
        profile_id      — str
        market          — str
        weekly_history  — list[float]  (at least 52 values recommended)

    Response:
        market, seasonality_score (0-1)
    """
    market: str = body.get("market", "")
    weekly_history: list[float] = body.get("weekly_history", [])

    score = market_data_processor.compute_seasonality_score(weekly_history)
    return {
        "market": market,
        "seasonality_score": score,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }
