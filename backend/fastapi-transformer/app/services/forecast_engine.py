"""Forecast-engine registry for the frozen Module 2 inference contract."""
from __future__ import annotations

import math
import os
from typing import Any, Protocol

from app.unavailable import DependencyUnavailable

WINDOW_LENGTH = 12
ALLOWED_ENGINES = frozenset({"stub", "groq", "bilstm"})


class ForecastEngine(Protocol):
    name: str

    def forecast(self, request: dict[str, Any]) -> dict[str, Any]: ...

    def forecast_batch(self, requests: list[dict[str, Any]]) -> dict[str, dict[str, Any]]: ...


class StubForecastEngine:
    """Local deterministic seam. It is intentionally marked unvalidated."""
    name = "stub"

    def forecast(self, request: dict[str, Any]) -> dict[str, Any]:
        sequence = request.get("sequence") or []
        trends = [float(row["trendIndex"]) for row in sequence]
        if len(trends) != WINDOW_LENGTH:
            raise ValueError("sequence must contain exactly 12 weekly rows")
        baseline = sum(trends[-4:]) / 4.0
        slope = (trends[-1] - trends[0]) / (WINDOW_LENGTH - 1)
        weekly = [round(max(0.0, min(100.0, baseline + slope * (week + 1) * 0.25)), 4)
                  for week in range(WINDOW_LENGTH)]
        return {
            "predicted_demand_4w": round(sum(weekly[:4]) / 4.0, 4),
            "predicted_demand_12w": round(sum(weekly) / WINDOW_LENGTH, 4),
            "weekly_forecasts": weekly,
            "mape": 100.0,
            "mae": 100.0,
            "rmse": 100.0,
            "confidence": 0.0,
            "passed": False,
            "low_confidence_disclaimer": True,
            "message": "Deterministic stub forecast — not a validated model prediction.",
            "source": self.name,
        }

    def forecast_batch(self, requests: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        return {str(request["market"]): self.forecast(request) for request in requests}


class GroqForecastEngine:
    name = "groq"

    def forecast(self, request: dict[str, Any]) -> dict[str, Any]:
        from app.services import gemini_forecaster
        return gemini_forecaster.forecast_request(request)

    def forecast_batch(self, requests: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        from app.services import gemini_forecaster
        return gemini_forecaster.forecast_batch_requests(requests)


class BilstmUnavailableEngine:
    name = "bilstm"

    def forecast(self, request: dict[str, Any]) -> dict[str, Any]:
        raise DependencyUnavailable(
            code="MOD22_BILSTM_UNAVAILABLE",
            message="The BiLSTM + Transformer artifact is not integrated in this deployment.",
            dependency="bilstm",
            cause="No production model loader or trained artifact has been configured.",
            stage="fastapi/forecast-engine",
        )

    def forecast_batch(self, requests: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        self.forecast(requests[0] if requests else {})
        return {}


def _resolve_engine() -> ForecastEngine:
    configured = os.getenv("FORECAST_ENGINE", "stub").strip().lower()
    if configured not in ALLOWED_ENGINES:
        allowed = " | ".join(sorted(ALLOWED_ENGINES))
        raise RuntimeError(f"Invalid FORECAST_ENGINE={configured!r}; expected one of: {allowed}.")
    return {"stub": StubForecastEngine(), "groq": GroqForecastEngine(), "bilstm": BilstmUnavailableEngine()}[configured]


# Resolved once at process startup. Do not read FORECAST_ENGINE per request.
ACTIVE_ENGINE: ForecastEngine = _resolve_engine()


def active_engine_name() -> str:
    return ACTIVE_ENGINE.name


def model_health() -> dict[str, str]:
    from app.services import gemini_forecaster, xgboost_scorer
    return {
        "stub": "ok",
        "groq": "loaded" if gemini_forecaster.is_loaded() else "missing",
        "xgboost": "loaded" if xgboost_scorer._model is not None else "missing",
        "bilstm": "missing",
        "engine": active_engine_name(),
        "status": "ok",
    }
