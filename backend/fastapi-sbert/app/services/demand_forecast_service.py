"""CeView Demand Prediction Transformer Model Service (Hugging Face Spaces).

This service interfaces with the dedicated time-series Transformer model hosted
on Hugging Face Spaces (JamJamzz/ceview-demand-prediction-model) via the Gradio API
endpoint `/forecast`.

API Reference:
  Space   : JamJamzz/ceview-demand-prediction-model
  Endpoint: /forecast
  Inputs  :
    - history_json (str): 52-week history formatted as JSON array containing
                          52 rows of [trend_scaled, week_sin, week_cos].
    - market (str)      : Literal['JP', 'KR', 'US'] (default: 'KR')
    - category (str)    : Standardized category snake_case identifier (default: 'accommodation_staycation')
  Returns :
    - dict containing:
        * weekly_forecasts (list of 12 dicts with week_ahead and google_trends)
        * mean_demand_4_weeks (float)
        * mean_demand_12_weeks (float)
        * model (dict of checkpoint/version metadata)
"""

from __future__ import annotations

import json
import logging
import math
import os
from typing import Any, Dict, List, Optional, Tuple

from app.model.DemandForecastInputClass import (
    CategoryLiteral,
    DemandForecastInputClass,
    DemandForecastOutputClass,
    MarketLiteral,
)

logger = logging.getLogger("ceview.demand_forecast")

# ── Configuration Defaults ───────────────────────────────────────────────────

DEFAULT_SPACE_ID = os.getenv("HF_DEMAND_SPACE", "JamJamzz/ceview-demand-prediction-model")
API_ENDPOINT = "/forecast"
HF_TOKEN = os.getenv("HF_TOKEN", None)

VALID_MARKETS: Tuple[str, ...] = ("JP", "KR", "US")
VALID_CATEGORIES: Tuple[str, ...] = (
    "accommodation_staycation",
    "adventure_nature",
    "coastal_island",
    "culinary_gastronomy",
    "cultural_heritage",
    "theme_parks_entertainment",
    "urban_city",
)

# Friendly mapping from CeView internal and UI labels to Hugging Face parameters
MARKET_NORMALIZATION_MAP: Dict[str, MarketLiteral] = {
    "kr": "KR",
    "korea": "KR",
    "south korea": "KR",
    "south_korea": "KR",
    "jp": "JP",
    "japan": "JP",
    "us": "US",
    "usa": "US",
    "united states": "US",
    "united_states": "US",
}

CATEGORY_NORMALIZATION_MAP: Dict[str, CategoryLiteral] = {
    "coastal & island": "coastal_island",
    "coastal and island": "coastal_island",
    "coastal_island": "coastal_island",
    "adventure & nature": "adventure_nature",
    "adventure and nature": "adventure_nature",
    "adventure_nature": "adventure_nature",
    "cultural & heritage": "cultural_heritage",
    "cultural and heritage": "cultural_heritage",
    "cultural_heritage": "cultural_heritage",
    "theme parks / entertainment": "theme_parks_entertainment",
    "theme parks and entertainment": "theme_parks_entertainment",
    "theme_parks_entertainment": "theme_parks_entertainment",
    "urban & city": "urban_city",
    "urban and city": "urban_city",
    "urban_city": "urban_city",
    "culinary & gastronomy": "culinary_gastronomy",
    "culinary and gastronomy": "culinary_gastronomy",
    "culinary_gastronomy": "culinary_gastronomy",
    "accommodation & staycation": "accommodation_staycation",
    "accommodation and staycation": "accommodation_staycation",
    "accommodation_staycation": "accommodation_staycation",
}

# ── Cached Gradio Client ─────────────────────────────────────────────────────

_cached_client = None


def get_client(space_id: Optional[str] = None, hf_token: Optional[str] = None):
    """Retrieve or initialize the Gradio Client singleton for the Space."""
    global _cached_client
    target_space = space_id or DEFAULT_SPACE_ID
    token = hf_token or HF_TOKEN

    if _cached_client is not None:
        return _cached_client

    try:
        from gradio_client import Client  # type: ignore[import]

        logger.info("Initializing Gradio Client for Space: %s", target_space)
        kwargs = {"token": token} if token else {}
        _cached_client = Client(target_space, **kwargs)
        logger.info("Gradio Client connected successfully to %s", target_space)
        return _cached_client
    except Exception as exc:
        logger.error("Failed to connect Gradio Client to %s: %s", target_space, exc)
        raise RuntimeError(f"Gradio Client initialization failed for Space '{target_space}': {exc}") from exc


# ── Domain Normalization Helpers ─────────────────────────────────────────────

def normalize_market(market: str) -> MarketLiteral:
    """Normalize input market string into 'JP' | 'KR' | 'US'."""
    cleaned = str(market).strip().lower()
    if cleaned in MARKET_NORMALIZATION_MAP:
        return MARKET_NORMALIZATION_MAP[cleaned]
    upper = str(market).strip().upper()
    if upper in VALID_MARKETS:
        return upper  # type: ignore[return-value]
    raise ValueError(
        f"Unsupported market '{market}'. Must be one of {VALID_MARKETS} or known names (korea, japan, usa)."
    )


def normalize_category(category: str) -> CategoryLiteral:
    """Normalize input category string into standardized snake_case identifier."""
    cleaned = str(category).strip().lower()
    if cleaned in CATEGORY_NORMALIZATION_MAP:
        return CATEGORY_NORMALIZATION_MAP[cleaned]
    if cleaned in VALID_CATEGORIES:
        return cleaned  # type: ignore[return-value]
    raise ValueError(
        f"Unsupported category '{category}'. Must match one of {VALID_CATEGORIES}."
    )


def build_52week_history(
    trend_series: List[float],
    start_iso_week: Optional[int] = None,
) -> str:
    """Construct a compliant 52-week history JSON string from a list of raw trend indices.

    The Hugging Face model requires:
      - Exactly 52 rows, ordered oldest first.
      - Each row is [trend_scaled, week_sin, week_cos].
      - trend_scaled in [0, 1] (trend_index / 100.0).
      - week_sin, week_cos represent the sinusoidal week-of-year encoding:
          sin(2 * pi * week / 52), cos(2 * pi * week / 52)

    Args:
        trend_series: List of numerical trend values (0-100 scale).
                      If more than 52 are provided, the last 52 are used.
                      If fewer than 52 are provided, the series is backfilled with the earliest value.
        start_iso_week: Optional ISO week number for the oldest observation in the 52-week slice.
                        If omitted (None), the backend automatically determines the current calendar
                        week and anchors the 52nd week to today's week.

    Returns:
        JSON string matching the required [trend_scaled, week_sin, week_cos] tensor format.
    """
    if not trend_series:
        raise ValueError("trend_series must not be empty to build 52-week history.")

    # If not provided, automatically deduce start_iso_week so the final point is today's current week
    if start_iso_week is None:
        from datetime import date
        current_iso_week = date.today().isocalendar().week
        # In a 52-week sequence ending today, the oldest week (51 weeks ago) is:
        start_iso_week = (current_iso_week % 52) + 1

    # Align sequence to exactly 52 items (oldest first)
    if len(trend_series) >= 52:
        selected_series = [float(v) for v in trend_series[-52:]]
    else:
        # Backfill oldest observation to reach 52 points
        pad_count = 52 - len(trend_series)
        pad_val = float(trend_series[0])
        selected_series = [pad_val] * pad_count + [float(v) for v in trend_series]

    rows: List[List[float]] = []
    for index, val in enumerate(selected_series):
        # 1. Scale trend to 0.0 - 1.0 range
        scaled_val = max(0.0, min(1.0, val / 100.0 if val > 1.0 else val))

        # 2. Compute calendar angle for the week (1 to 52)
        week_num = ((start_iso_week - 1 + index) % 52) + 1
        angle = 2.0 * math.pi * float(week_num) / 52.0
        w_sin = math.sin(angle)
        w_cos = math.cos(angle)

        rows.append([round(scaled_val, 6), round(w_sin, 6), round(w_cos, 6)])

    return json.dumps(rows)


# ── Core Inference API ────────────────────────────────────────────────────────

def call_transformer_forecast(
    history_json: str,
    market: str = "KR",
    category: str = "accommodation_staycation",
    space_id: Optional[str] = None,
    hf_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute demand prediction against the Hugging Face Space /forecast endpoint.

    Args:
        history_json: Serialized JSON array of exactly 52 rows: [[trend_scaled, week_sin, week_cos], ...]
        market: Target market ('JP' | 'KR' | 'US' or name like 'korea')
        category: Tourism category ('accommodation_staycation', 'coastal_island', etc.)
        space_id: Optional Hugging Face Space identifier override
        hf_token: Optional Hugging Face API token for authentication

    Returns:
        Dict returned by the model containing:
          - market
          - category
          - weekly_forecasts: list of 12 predicted points
          - mean_demand_4_weeks: float
          - mean_demand_12_weeks: float
          - model: metadata dict
    """
    norm_market = normalize_market(market)
    norm_category = normalize_category(category)

    client = get_client(space_id=space_id, hf_token=hf_token)

    logger.info(
        "Calling HF Transformer /forecast — market=%s category=%s",
        norm_market,
        norm_category,
    )

    try:
        raw_result = client.predict(
            history_json=history_json,
            market=norm_market,
            category=norm_category,
            api_name=API_ENDPOINT,
        )
        logger.info(
            "HF Transformer /forecast successful — market=%s category=%s 4w_mean=%.2f 12w_mean=%.2f",
            norm_market,
            norm_category,
            raw_result.get("mean_demand_4_weeks", 0.0),
            raw_result.get("mean_demand_12_weeks", 0.0),
        )
        return raw_result
    except Exception as exc:
        logger.error(
            "HF Transformer /forecast call failed (market=%s, category=%s): %s",
            norm_market,
            norm_category,
            exc,
        )
        raise RuntimeError(f"Hugging Face Space forecast inference failed: {exc}") from exc


def forecast_from_trend_series(
    trend_series: List[float],
    market: str = "KR",
    category: str = "accommodation_staycation",
    start_iso_week: Optional[int] = None,
    space_id: Optional[str] = None,
    hf_token: Optional[str] = None,
) -> DemandForecastOutputClass:
    """Convenience wrapper: builds 52-week sinusoidal history from raw trend numbers and runs forecast.

    Args:
        trend_series: Chronological weekly trend values (0-100 scale).
        market: Target market identifier.
        category: Tourism category.
        start_iso_week: Starting ISO week for calendar encoding.
        space_id: Optional Space ID override.
        hf_token: Optional Hugging Face token.

    Returns:
        Validated DemandForecastOutputClass Pydantic object.
    """
    history_str = build_52week_history(trend_series, start_iso_week=start_iso_week)
    result_dict = call_transformer_forecast(
        history_json=history_str,
        market=market,
        category=category,
        space_id=space_id,
        hf_token=hf_token,
    )
    return DemandForecastOutputClass.model_validate(result_dict)
