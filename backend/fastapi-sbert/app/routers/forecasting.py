from __future__ import annotations

import logging

from fastapi import APIRouter

from app.services import bilstm_transformer, ml_stubs, xgboost_scorer

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Submodule 2.2: BiLSTM + Transformer inference (FR2.11) ──────────────────

@router.post("/inference")
def run_inference(body: dict) -> dict:
    """Run BiLSTM+Transformer demand forecasting on multivariate sequences.

    Request body:
        profileId       — str
        market          — str
        sequences       — list[dict] each with keys:
                          {week, trendIndex, forexRate, gdpGrowth,
                           seasonalityScore, spikeIndicator, holidayFlag}
        sequenceLength  — int

    Response:
        predicted_demand_4w, predicted_demand_12w,
        mape, mae, rmse, confidence,
        passed, low_confidence_disclaimer, message
    """
    market: str = body.get("market", "")
    sequences: list[dict] = body.get("sequences", [])
    return bilstm_transformer.run_inference(sequences, market)


# ─── Submodule 2.2: XGBoost market scoring (FR2.13) ──────────────────────────

@router.post("/score")
def score_market(body: dict) -> dict:
    """Compute XGBoost Market Score (0-1) for a single market.

    Request body:
        market                — str
        predicted_demand      — float 0-100
        seasonality_score     — float 0-1
        spike_indicator       — bool
        gdp_growth            — float (annual %)
        forex_vs_php          — float
        historical_arrivals   — int

    Response:
        {market_score: float}
    """
    return xgboost_scorer.score(body)


# ─── Fallback stubs (preserved for backward compatibility) ───────────────────

@router.post("/analyze")
def analyze(_: dict) -> dict:
    """Legacy stub endpoint — used as fallback when enriched dataset is absent."""
    return {"markets": ml_stubs.forecast_markets()}


@router.post("/notifications")
def list_notifications(_: dict | None = None) -> dict:
    """Legacy stub endpoint — used as fallback when no DB alerts exist."""
    return {"notifications": ml_stubs.notifications()}
