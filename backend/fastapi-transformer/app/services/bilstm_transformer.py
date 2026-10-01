"""Reserved loader seam for the trained BiLSTM + Transformer artifact.

The artifact/scaler contract has not been supplied to this service. This module
must never manufacture weights or return a random forecast.
"""
from __future__ import annotations

from typing import Any

from app.unavailable import DependencyUnavailable


def is_available() -> bool:
    return False


def run_inference(sequences: list[dict[str, Any]], market: str) -> dict[str, Any]:
    raise DependencyUnavailable(
        code="MOD22_BILSTM_UNAVAILABLE",
        message="The trained BiLSTM + Transformer artifact is not integrated.",
        dependency="bilstm",
        cause="The production artifact, scaler, and loader are intentionally out of scope.",
        stage="fastapi/bilstm-loader",
    )
