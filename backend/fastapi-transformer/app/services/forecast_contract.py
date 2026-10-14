"""Shapes shared by every forecast engine and the /internal/forecasting routes.

Dependency-free on purpose: importing ``forecast_engine`` resolves
FORECAST_ENGINE at import time, so the engines take these from here instead.
"""
from __future__ import annotations

from typing import Any

# Weekly rows in the frozen Module 2 inference sequence.
WINDOW_LENGTH = 12

# Per-row features whose imputation is tracked in `imputedMask`.
MASK_FEATURES: frozenset[str] = frozenset(
    {"trendIndex", "forexRate", "gdpGrowth", "seasonalityScore", "spikeIndicator", "holidayFlag"}
)


def batch_key(request: dict[str, Any]) -> str:
    """Batch result key: "{market}::{category}" (category may be empty).

    Keyed by category as well as market because one profile can send several
    categories for the same market in a single batch.
    """
    return f"{request['market']}::{request.get('category') or ''}"
