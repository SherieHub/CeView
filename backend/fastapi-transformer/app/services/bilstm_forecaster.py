"""BiLSTM + Transformer demand forecaster — Module 2 (submodule 2.2).

Calls the hosted CeView demand-prediction model on Hugging Face Spaces
(``JamJamzz/ceview-demand-prediction-model``, Gradio endpoint ``/forecast``) and
adapts its response into the frozen Module 2 inference contract
(``ForecastResponse`` in app/routers/forecasting.py) so Spring's pipeline, the
database rows, the API DTOs and the frontend all stay unchanged.

Model contract
--------------
Input : history_json — exactly 52 rows of [trend_scaled, week_sin, week_cos],
        oldest first; market ∈ {JP, KR, US}; category ∈ 7 snake_case labels.
Output: {market, category, weekly_forecasts[12], mean_demand_4_weeks,
         mean_demand_12_weeks, model{...}}

No synthetic history
--------------------
The model needs 52 weeks. When fewer genuinely-measured weeks exist this raises
``DependencyUnavailable`` instead of padding the series out to 52 with a repeated
value. A forecast produced from ~77% fabricated input is indistinguishable from a
measured one once it reaches a chart, which is exactly what
docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md forbids —
the same rule behind MOD21_TRENDS_UNAVAILABLE and MOD22_NO_MARKET_DATA.
"""
from __future__ import annotations

import json
import logging
import math
import os
from typing import Any

from app.unavailable import DependencyUnavailable

logger = logging.getLogger(__name__)

SPACE_ID: str = os.getenv("HF_DEMAND_SPACE", "JamJamzz/ceview-demand-prediction-model")
API_ENDPOINT: str = "/forecast"
_HF_TOKEN: str | None = os.getenv("HF_TOKEN", "").strip() or None

#: The model's fixed lookback. Not configurable — the checkpoint's input layer.
MIN_HISTORY_WEEKS: int = 52
#: The model's fixed horizon, and the length Spring's requireWeeklyForecasts demands.
HORIZON_WEEKS: int = 12
#: Emitted as ForecastResponse.source. The frontend's engineLabel() maps exactly
#: this string to "BiLSTM + Transformer" (DrawerChartPanel.tsx).
SOURCE: str = "bilstm"
#: Confidence used while the checkpoint reports status="provisional". Deliberately
#: below the UI's LOW_CONFIDENCE_THRESHOLD (0.70) so the "Unvalidated forecast"
#: banner shows: the model ships no accuracy metric, so claiming a high number
#: would be inventing one.
PROVISIONAL_CONFIDENCE: float = 0.5
VALIDATED_CONFIDENCE: float = 0.8

MARKET_BY_ID: dict[str, str] = {
    "korea": "KR", "kr": "KR", "south korea": "KR", "south_korea": "KR",
    "japan": "JP", "jp": "JP",
    "usa": "US", "us": "US", "united states": "US", "united_states": "US",
}

CATEGORY_BY_LABEL: dict[str, str] = {
    "accommodation & staycation": "accommodation_staycation",
    "adventure & nature": "adventure_nature",
    "coastal & island": "coastal_island",
    "culinary & gastronomy": "culinary_gastronomy",
    "cultural & heritage": "cultural_heritage",
    "theme parks / entertainment": "theme_parks_entertainment",
    "urban & city": "urban_city",
}

_cached_client = None


def _unavailable(code: str, message: str, cause: str) -> DependencyUnavailable:
    return DependencyUnavailable(
        code=code, message=message, dependency=SOURCE, cause=cause,
        stage="fastapi-transformer/bilstm_forecaster",
    )


def _client():
    """Lazily build and cache the Gradio client for the Space."""
    global _cached_client
    if _cached_client is not None:
        return _cached_client
    try:
        from gradio_client import Client
        _cached_client = Client(SPACE_ID, token=_HF_TOKEN, verbose=False)
        logger.info("BiLSTM+Transformer client connected to %s", SPACE_ID)
        return _cached_client
    except Exception as exc:  # noqa: BLE001
        raise _unavailable(
            "MOD22_BILSTM_UNAVAILABLE",
            "The BiLSTM + Transformer demand model is unavailable.",
            f"could not connect to Space '{SPACE_ID}': {exc}",
        ) from exc


def normalize_market(market: str) -> str:
    """'korea' -> 'KR'. Never defaults: an unknown market is an error, not a guess."""
    key = str(market or "").strip().lower()
    if key in MARKET_BY_ID:
        return MARKET_BY_ID[key]
    raise _unavailable(
        "MOD22_BILSTM_UNKNOWN_MARKET",
        f"Market '{market}' is not supported by the demand model.",
        f"expected one of {sorted(set(MARKET_BY_ID.values()))}",
    )


def normalize_category(category: str) -> str:
    """'Coastal & Island' -> 'coastal_island'. Never defaults."""
    key = str(category or "").strip().lower()
    if key in CATEGORY_BY_LABEL:
        return CATEGORY_BY_LABEL[key]
    if key in set(CATEGORY_BY_LABEL.values()):
        return key
    raise _unavailable(
        "MOD22_BILSTM_UNKNOWN_CATEGORY",
        f"Category '{category}' is not supported by the demand model.",
        f"expected one of {sorted(set(CATEGORY_BY_LABEL.values()))}",
    )


def build_history_tensor(trend_history: list[float], anchor_iso_week: int | None = None) -> str:
    """Serialize the trailing 52 measured weeks as [trend_scaled, week_sin, week_cos].

    ``trend_scaled`` is ALWAYS value/100 — the incoming series is the 0–100 Google
    Trends index used throughout Module 2 (MarketSignalRecord.trendIndex), so a
    conditional "divide only if > 1" rule would silently read a genuine index of
    1.0 as 100 and 0.5 as 50.
    """
    measured = [float(v) for v in (trend_history or []) if v is not None and math.isfinite(float(v))]
    if len(measured) < MIN_HISTORY_WEEKS:
        raise _unavailable(
            "MOD22_INSUFFICIENT_HISTORY",
            "Not enough measured history to run the demand model.",
            f"the model requires {MIN_HISTORY_WEEKS} weekly observations; "
            f"{len(measured)} are on record. Run ingestion to backfill, or wait "
            f"for {MIN_HISTORY_WEEKS - len(measured)} more weekly fetches.",
        )

    window = measured[-MIN_HISTORY_WEEKS:]

    if anchor_iso_week is None:
        from datetime import date
        anchor_iso_week = date.today().isocalendar().week
    # The newest row sits on anchor week, so the oldest is 51 weeks earlier.
    start_week = ((int(anchor_iso_week) - MIN_HISTORY_WEEKS) % 52) + 1

    rows: list[list[float]] = []
    for index, value in enumerate(window):
        scaled = max(0.0, min(1.0, value / 100.0))
        week = ((start_week - 1 + index) % 52) + 1
        angle = 2.0 * math.pi * week / 52.0
        rows.append([round(scaled, 6), round(math.sin(angle), 6), round(math.cos(angle), 6)])
    return json.dumps(rows)


def _require_weekly(raw: Any) -> list[float]:
    """Order the model's 12 points by week_ahead and validate each one."""
    if not isinstance(raw, list) or len(raw) != HORIZON_WEEKS:
        raise _unavailable(
            "MOD22_BILSTM_INVALID_RESPONSE",
            "The demand model returned an unusable forecast.",
            f"weekly_forecasts must hold exactly {HORIZON_WEEKS} points, got "
            f"{len(raw) if isinstance(raw, list) else type(raw).__name__}",
        )
    try:
        ordered = sorted(raw, key=lambda point: int(point["week_ahead"]))
        values = [float(point["google_trends"]) for point in ordered]
    except (KeyError, TypeError, ValueError) as exc:
        raise _unavailable(
            "MOD22_BILSTM_INVALID_RESPONSE",
            "The demand model returned an unusable forecast.",
            f"weekly_forecasts entries must carry numeric week_ahead/google_trends: {exc}",
        ) from exc

    for value in values:
        # Out of the model's own declared 0–100 bound is a correctness signal,
        # not a rounding artifact — surfaced rather than clamped away.
        if not math.isfinite(value) or not 0.0 <= value <= 100.0:
            raise _unavailable(
                "MOD22_BILSTM_INVALID_RESPONSE",
                "The demand model returned an out-of-range forecast.",
                f"weekly google_trends value {value} is outside the declared 0–100 index range",
            )
    return values


def _require_mean(payload: dict[str, Any], key: str) -> float:
    value = payload.get(key)
    if not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        raise _unavailable(
            "MOD22_BILSTM_INVALID_RESPONSE",
            "The demand model returned an unusable forecast.",
            f"'{key}' is missing or not a finite number",
        )
    return float(value)


def _adapt(raw: dict[str, Any], market: str, category: str) -> dict[str, Any]:
    """Model response -> the frozen ForecastResponse shape Spring already consumes."""
    weekly = _require_weekly(raw.get("weekly_forecasts"))
    demand_4w = _require_mean(raw, "mean_demand_4_weeks")
    demand_12w = _require_mean(raw, "mean_demand_12_weeks")

    meta = raw.get("model") or {}
    status = str(meta.get("status", "")).strip().lower() if isinstance(meta, dict) else ""
    provisional = status != "validated"
    version = meta.get("model_version", "unknown") if isinstance(meta, dict) else "unknown"

    logger.info(
        "bilstm forecast ok — market=%s category=%s 4w=%.2f 12w=%.2f model_version=%s status=%s",
        market, category, demand_4w, demand_12w, version, status or "unknown",
    )

    return {
        "predicted_demand_4w": demand_4w,
        "predicted_demand_12w": demand_12w,
        "weekly_forecasts": weekly,
        # The checkpoint ships no holdout metrics. ForecastResponse types these as
        # `float | None` precisely so an engine can say "not computed" instead of
        # inventing an accuracy figure; Spring reads them with optionalNum().
        "mape": None,
        "mae": None,
        "rmse": None,
        "confidence": PROVISIONAL_CONFIDENCE if provisional else VALIDATED_CONFIDENCE,
        "passed": not provisional,
        "low_confidence_disclaimer": provisional,
        "message": (
            f"BiLSTM + Transformer ({version}) — provisional checkpoint, "
            "not yet validated against measured outcomes."
            if provisional else
            f"BiLSTM + Transformer ({version})."
        ),
        "source": SOURCE,
    }


def forecast(request: dict[str, Any]) -> dict[str, Any]:
    """Run one (market, category) forecast through the hosted model."""
    market = request.get("market", "")
    category = request.get("category", "")
    norm_market = normalize_market(market)
    norm_category = normalize_category(category)

    # The 12-row `sequence` is the frozen cross-engine contract; this model needs a
    # 52-week lookback, which Spring supplies separately as the measured trendHistory.
    history = request.get("trendHistory") or request.get("trend_history") or []
    history_json = build_history_tensor([float(v) for v in history])

    client = _client()
    try:
        raw = client.predict(
            history_json=history_json,
            market=norm_market,
            category=norm_category,
            api_name=API_ENDPOINT,
        )
    except Exception as exc:  # noqa: BLE001
        raise _unavailable(
            "MOD22_BILSTM_UNAVAILABLE",
            "The BiLSTM + Transformer demand model is unavailable.",
            f"inference failed for {norm_market}/{norm_category}: {exc}",
        ) from exc

    if not isinstance(raw, dict):
        raise _unavailable(
            "MOD22_BILSTM_INVALID_RESPONSE",
            "The demand model returned an unusable forecast.",
            f"expected a JSON object, got {type(raw).__name__}",
        )
    return _adapt(raw, norm_market, norm_category)


def forecast_batch(requests: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """One independent inference per (market, category); no value is ever shared.

    Keyed "{market}::{category}" to match stub_forecaster.forecast_batch and the
    key Spring rebuilds in ForecastingService's CategorySequence.
    """
    return {
        f"{request['market']}::{request.get('category') or ''}": forecast(request)
        for request in requests
    }
