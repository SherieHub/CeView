"""XGBoost market scoring model for Module 2.2 (FR2.13).

Tries to load a trained XGBoost model from /app/models/xgboost_market.json.
Falls back to a deterministic weighted-formula stub when absent.

Input features (6):
    predicted_demand      — float 0-100
    seasonality_score     — float 0-1
    spike_indicator       — bool
    gdp_growth            — float (annual %)
    forex_vs_php          — float (units of foreign currency per PHP)
    historical_arrivals   — int (annual tourist arrivals)

Output:
    {market_score: float 0-1}
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_MODEL_PATH = os.getenv("XGBOOST_MODEL_PATH", "/app/models/xgboost_market.json")
_model = None

# Feature weights (sum to 1.0) — used by stub and as documentation for trained model
_WEIGHTS = {
    "predicted_demand":    0.30,
    "seasonality_score":   0.25,
    "spike_indicator":     0.15,
    "gdp_growth":          0.15,
    "forex_vs_php":        0.10,
    "historical_arrivals": 0.05,
}


def _load() -> None:
    global _model
    if not os.path.exists(_MODEL_PATH):
        logger.info("xgboost_market.json not found — using weighted-formula stub")
        return
    try:
        import xgboost as xgb  # type: ignore[import]
        m = xgb.Booster()
        m.load_model(_MODEL_PATH)
        _model = m
        logger.info("XGBoost market scoring model loaded from %s", _MODEL_PATH)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load XGBoost model: %s", exc)


_load()


def score(features: dict) -> dict:
    """Compute Market Score (0-1) for a single market.

    Args:
        features: dict with keys matching _WEIGHTS above.

    Returns:
        {market_score: float}
    """
    if _model is not None:
        return _xgb_score(features)
    return _stub_score(features)


# ─── XGBoost inference (used when model is loaded) ───────────────────────────

def _xgb_score(features: dict) -> dict:
    import xgboost as xgb  # type: ignore[import]
    import numpy as np

    X = np.array([[
        features.get("predicted_demand", 50.0) / 100.0,
        features.get("seasonality_score", 0.5),
        float(1 if features.get("spike_indicator") else 0),
        min(max(features.get("gdp_growth", 0.0) / 5.0, 0.0), 1.0),
        min(max(features.get("forex_vs_php", 1.0) / 60.0, 0.0), 1.0),
        min(features.get("historical_arrivals", 0) / 100_000.0, 1.0),
    ]], dtype=np.float32)

    dmatrix = xgb.DMatrix(X)
    raw = float(_model.predict(dmatrix)[0])
    return {"market_score": round(float(min(max(raw, 0.0), 1.0)), 4)}


# ─── weighted formula stub ────────────────────────────────────────────────────

def _stub_score(features: dict) -> dict:
    raw = (
        _WEIGHTS["predicted_demand"]    * features.get("predicted_demand", 50.0) / 100.0
        + _WEIGHTS["seasonality_score"] * features.get("seasonality_score", 0.5)
        + _WEIGHTS["spike_indicator"]   * (1.0 if features.get("spike_indicator") else 0.0)
        + _WEIGHTS["gdp_growth"]        * min(max(features.get("gdp_growth", 0.0) / 5.0, 0.0), 1.0)
        + _WEIGHTS["forex_vs_php"]      * min(max(features.get("forex_vs_php", 1.0) / 60.0, 0.0), 1.0)
        + _WEIGHTS["historical_arrivals"]
          * min(features.get("historical_arrivals", 0) / 100_000.0, 1.0)
    )
    return {"market_score": round(float(min(max(raw, 0.0), 1.0)), 4)}
