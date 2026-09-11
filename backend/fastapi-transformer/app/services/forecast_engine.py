"""Forecast-engine registry for the frozen Module 2 inference contract."""
from __future__ import annotations

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
    """Adapter for the versioned, deterministic placeholder engine."""
    name = "stub"

    def forecast(self, request: dict[str, Any]) -> dict[str, Any]:
        from app.services import stub_forecaster
        return stub_forecaster.forecast(request)

    def forecast_batch(self, requests: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        from app.services import stub_forecaster
        return stub_forecaster.forecast_batch(requests)


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
