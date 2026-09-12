"""Deterministic, explicitly non-model Module 2 forecast placeholder.

This is **not a trained model**. It applies a naive damped trend from observed
trend-index values and a small seasonality-score offset. It exists solely to
exercise the exact BiLSTM request/response seam until the trained artifact and
its scaler are integrated.
"""
from __future__ import annotations

import math
from typing import Any

from app.services.forecast_validator import MAPE_THRESHOLD

WINDOW_LENGTH = 12
FEATURE_COUNT = 6


def forecast(request: dict[str, Any]) -> dict[str, Any]:
    """Return a deterministic naive forecast and honest 4-week holdout metrics."""
    sequence = request.get("sequence") or []
    trends = [float(row["trendIndex"]) for row in sequence]
    if not trends:
        raise ValueError("sequence is required for the stub forecast engine")

    seasonality = float(sequence[-1]["seasonalityScore"])
    weekly = _project(trends, seasonality, WINDOW_LENGTH)
    predicted_4w = sum(weekly[:4]) / 4.0
    predicted_12w = sum(weekly) / WINDOW_LENGTH
    assert len(weekly) == WINDOW_LENGTH
    assert all(0.0 <= value <= 100.0 and math.isfinite(value) for value in weekly)
    assert math.isclose(predicted_4w, sum(weekly[:4]) / 4.0, abs_tol=1e-12)
    assert math.isclose(predicted_12w, sum(weekly) / WINDOW_LENGTH, abs_tol=1e-12)

    mape, mae, rmse = _backtest(trends, seasonality)
    imputed_ratio = _imputed_cell_ratio(request.get("imputedMask"), len(sequence))
    confidence = _confidence(mape, imputed_ratio)
    passed = mape is not None and mape <= MAPE_THRESHOLD
    low_confidence = not passed
    message = (
        "Stub v1 deterministic naive forecast — not a trained model."
        if low_confidence else
        "Stub v1 deterministic naive forecast — not a trained model; holdout error passed the 15% gate."
    )
    return {
        "predicted_demand_4w": predicted_4w,
        "predicted_demand_12w": predicted_12w,
        "weekly_forecasts": weekly,
        "mape": mape,
        "mae": mae,
        "rmse": rmse,
        "confidence": confidence,
        "passed": passed,
        "low_confidence_disclaimer": low_confidence,
        "message": message,
        "source": "stub-v1",
    }


def forecast_batch(requests: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Run the same deterministic method independently for every (market, category) row.

    Keyed by "{market}::{category}", not bare market — a profile can send more than
    one category per market (Module 2's per-category demand forecasting), and a
    bare-market key would silently collide, dropping every category but the last
    one processed for that market. Spring builds the identical key to look a result
    back up (ForecastingService's `CategorySequence.key()`) — keep the two in sync.
    """
    return {
        f"{request['market']}::{request.get('category') or ''}": forecast(request)
        for request in requests
    }


def _project(history: list[float], seasonality_score: float, horizon: int) -> list[float]:
    """Damped last-window slope plus a bounded seasonal offset; no RNG or clock."""
    if not history:
        raise ValueError("history must not be empty")
    recent = history[-min(4, len(history)):]
    slope = 0.0 if len(recent) < 2 else (recent[-1] - recent[0]) / (len(recent) - 1)
    seasonal_offset = (max(0.0, min(1.0, seasonality_score)) - 0.5) * 2.0
    last = history[-1]
    return [round(max(0.0, min(100.0, last + slope * (0.80 ** step) + seasonal_offset)), 4)
            for step in range(1, horizon + 1)]


def _backtest(trends: list[float], seasonality_score: float) -> tuple[float | None, float | None, float | None]:
    """Hold out the final four observed weeks and score the same naive method."""
    if len(trends) <= 4:
        return None, None, None
    training, actual = trends[:-4], trends[-4:]
    predicted = _project(training, seasonality_score, len(actual))
    errors = [prediction - observed for prediction, observed in zip(predicted, actual)]
    mae = sum(abs(error) for error in errors) / len(errors)
    rmse = math.sqrt(sum(error * error for error in errors) / len(errors))
    # Percentage error is undefined at zero; do not invent a denominator.
    if any(observed == 0.0 for observed in actual):
        return None, mae, rmse
    mape = sum(abs(error / observed) * 100.0 for error, observed in zip(errors, actual)) / len(actual)
    return mape, mae, rmse


def _imputed_cell_ratio(mask: Any, row_count: int) -> float:
    if not isinstance(mask, list) or not mask or row_count <= 0:
        return 0.0
    imputed = sum(sum(bool(value) for value in row.values()) for row in mask if isinstance(row, dict))
    return min(1.0, imputed / (row_count * FEATURE_COUNT))


def _confidence(mape: float | None, imputed_ratio: float) -> float:
    """Confidence = (1 - min(MAPE/100, 1)) × (1 - imputed-cell ratio)."""
    if mape is None:
        return 0.0
    return round(max(0.0, min(1.0, (1.0 - min(mape / 100.0, 1.0)) * (1.0 - imputed_ratio))), 4)
