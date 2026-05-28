"""XGBoost Economic Viability Scorer for CeView Module 2.2 (FR2.13).

<<<<<<< HEAD
Phase 2 architectural directive: XGBoost evaluates and weights the
=======
Phase 2 architectural directive: XGBoost now evaluates and weights the
>>>>>>> paldo
ECONOMIC SIGNALS exclusively:

    Input features (5 economic):
        gdp_growth          — annual GDP growth rate (%)
        forex_vs_php        — units of foreign currency per PHP (inverse rate)
        direct_flight       — bool: direct flights available
        distance_km         — great-circle distance from origin city to Cebu
        flight_frequency    — weekly scheduled flights to Cebu (direct or via MNL)

    Output:
        economic_viability_score (0–1)

The final market_score is assembled OUTSIDE this module as:
    market_score = 0.40·(predicted_demand/100) + 0.35·seasonality_score + 0.25·econ

<<<<<<< HEAD
Requires a trained XGBoost model at XGBOOST_MODEL_PATH.
=======
Tries to load a trained XGBoost model from XGBOOST_MODEL_PATH; falls back to
the weighted-formula stub when absent.
>>>>>>> paldo
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_MODEL_PATH = os.getenv("XGBOOST_MODEL_PATH", "/app/models/xgboost_market.json")
_model = None

<<<<<<< HEAD
# ─── economic feature weights (documentation for trained model feature order) ─
=======
# ─── economic feature weights (sum to 1.0) ────────────────────────────────────
# Used by stub and as documentation for the trained model feature order.
>>>>>>> paldo
_ECONOMIC_WEIGHTS: dict[str, float] = {
    "gdp_growth_norm":       0.30,   # higher GDP growth → higher overseas spending
    "forex_norm":            0.30,   # stronger foreign currency → Cebu more affordable
    "direct_flight":         0.20,   # direct flights dramatically lower travel barrier
    "distance_norm":         0.10,   # proximity reduces cost and time barrier
    "flight_frequency_norm": 0.10,   # more schedule options → better accessibility
}

# ─── market-score composition weights ─────────────────────────────────────────
_SCORE_WEIGHTS: dict[str, float] = {
    "demand":      0.40,   # Gemini-predicted demand (0–1 normalised)
    "seasonality": 0.35,   # YoY-based seasonality score (0–1)
    "economic":    0.25,   # XGBoost economic viability (0–1)
}


def _load() -> None:
    global _model
    if not os.path.exists(_MODEL_PATH):
<<<<<<< HEAD
        logger.warning("XGBoost model not found at %s", _MODEL_PATH)
=======
        logger.info("xgboost_market.json not found — using weighted-formula stub")
>>>>>>> paldo
        return
    try:
        import xgboost as xgb  # type: ignore[import]
        m = xgb.Booster()
        m.load_model(_MODEL_PATH)
        _model = m
        logger.info("XGBoost economic viability model loaded from %s", _MODEL_PATH)
    except Exception as exc:  # noqa: BLE001
<<<<<<< HEAD
        logger.error("Failed to load XGBoost model: %s", exc)
        raise RuntimeError(f"XGBoost model load failed: {exc}") from exc
=======
        logger.warning("Failed to load XGBoost model: %s", exc)
>>>>>>> paldo


_load()


def score(features: dict) -> dict:
    """Compute the composite market score and economic viability sub-score.

    Args:
        features: dict with keys:
            predicted_demand    (float 0-100)   — from Gemini forecaster
            seasonality_score   (float 0-1)     — from SeasonalShiftDetector
            spike_indicator     (bool)
            gdp_growth          (float)          — annual % GDP growth
            forex_vs_php        (float)          — foreign currency units per PHP
            direct_flight       (bool)
            distance_km         (int)
            flight_frequency    (int)

    Returns:
        {
          market_score             : float 0-1,
          economic_viability_score : float 0-1,
          components               : {demand_component, seasonality_component,
                                      economic_component}
        }
    """
<<<<<<< HEAD
    econ = _xgb_economic(features) if _model is not None else _linear_economic(features)
=======
    econ = (
        _xgb_economic(features) if _model is not None
        else _stub_economic(features)
    )
>>>>>>> paldo

    demand_component      = features.get("predicted_demand", 50.0) / 100.0
    seasonality_component = features.get("seasonality_score", 0.5)

    market_score = (
        _SCORE_WEIGHTS["demand"]      * demand_component
        + _SCORE_WEIGHTS["seasonality"] * seasonality_component
        + _SCORE_WEIGHTS["economic"]    * econ
    )

    return {
        "market_score":             round(float(min(max(market_score, 0.0), 1.0)), 4),
        "economic_viability_score": round(float(econ), 4),
        "components": {
            "demand_component":      round(demand_component,      4),
            "seasonality_component": round(seasonality_component, 4),
            "economic_component":    round(float(econ),           4),
        },
    }


<<<<<<< HEAD
# ─── Linear fallback (used when XGBoost model file is absent) ────────────────

def _linear_economic(features: dict) -> float:
    """Weighted linear approximation of the XGBoost economic score.

    Uses the same feature weights defined in _ECONOMIC_WEIGHTS so the output
    range and interpretation match what a trained model would produce.
    Used automatically when xgboost_market.json has not been loaded.
    """
    fv = _feature_vector(features)
    weights = list(_ECONOMIC_WEIGHTS.values())  # order matches _feature_vector output
    return float(min(max(sum(w * v for w, v in zip(weights, fv)), 0.0), 1.0))


=======
>>>>>>> paldo
# ─── XGBoost economic inference ───────────────────────────────────────────────

def _xgb_economic(features: dict) -> float:
    import xgboost as xgb  # type: ignore[import]
    import numpy as np

    X = np.array([_feature_vector(features)], dtype=np.float32)
    raw = float(_model.predict(xgb.DMatrix(X))[0])
    return min(max(raw, 0.0), 1.0)


<<<<<<< HEAD
=======
# ─── weighted formula stub ────────────────────────────────────────────────────

def _stub_economic(features: dict) -> float:
    keys = list(_ECONOMIC_WEIGHTS.keys())
    fv   = _feature_vector(features)
    raw  = sum(_ECONOMIC_WEIGHTS[k] * v for k, v in zip(keys, fv))
    return min(max(raw, 0.0), 1.0)


>>>>>>> paldo
# ─── feature engineering ──────────────────────────────────────────────────────

def _feature_vector(features: dict) -> list[float]:
    """Normalise all economic inputs to [0, 1].

    Normalisation rationale:
        gdp_growth_norm     : 0% → 0.0; ≥5% → 1.0 (linear)
        forex_norm          : 0 PHP/unit → 0.0; ≥60 PHP/unit → 1.0
                              (USD≈57, KRW≈23, JPY≈0.37 PHP per unit)
                              Using inverse rate: PHP per 1 unit of foreign currency.
        direct_flight       : binary 0/1
        distance_norm       : 0 km → 1.0 (best); ≥15,000 km → 0.0 (worst)
        flight_frequency    : 0 flights/week → 0.0; ≥20 flights/week → 1.0
    """
    gdp    = features.get("gdp_growth",     2.0)
    forex  = features.get("forex_vs_php",   1.0)
    direct = features.get("direct_flight",  False)
    dist   = features.get("distance_km",    5000)
    freq   = features.get("flight_frequency", 3)

    return [
        min(max(gdp / 5.0, 0.0), 1.0),                   # gdp_growth_norm
        min(max(forex / 60.0, 0.0), 1.0),                 # forex_norm
        1.0 if direct else 0.0,                           # direct_flight
        max(0.0, 1.0 - min(1.0, dist / 15_000.0)),        # distance_norm
        min(max(freq / 20.0, 0.0), 1.0),                  # flight_frequency_norm
    ]
