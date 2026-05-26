"""Forecast quality validation for Module 2.2.

Validates MAPE against the configured threshold and attaches a disclaimer
flag when the threshold is exceeded (FR2.12).
"""
from __future__ import annotations

MAPE_THRESHOLD = 15.0


def validate(mape: float, mae: float, rmse: float) -> dict:
    passed = mape <= MAPE_THRESHOLD
    return {
        "passed": passed,
        "low_confidence_disclaimer": not passed,
        "message": (
            f"MAPE {mape:.1f}% exceeds threshold {MAPE_THRESHOLD}%. "
            "Forecast confidence is reduced; interpret with caution."
        ) if not passed else "",
    }
