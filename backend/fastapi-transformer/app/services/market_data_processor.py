"""Trend-index helpers for Module 2.1."""

from __future__ import annotations


def normalize_trend_index(v: float) -> float:
    """Clamp a trend index to the 0–100 range Google Trends reports in."""
    return float(max(0.0, min(100.0, v)))
