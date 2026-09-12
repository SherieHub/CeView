"""Router for Module 2 Transformer Demand Prediction Model (Hugging Face Spaces).

Interfaces with app/services/demand_forecast_service.py to execute 12-week tourism search
demand predictions on the JamJamzz/ceview-demand-prediction-model Space.

Includes an asynchronous Weights & Biases (W&B) monitoring layer to track model performance,
prediction distributions, input characteristics, and inference latency in production.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.model.DemandForecastInputClass import (
    CategoryLiteral,
    DemandForecastInputClass,
    DemandForecastOutputClass,
    MarketLiteral,
)
from app.services.demand_forecast_service import (
    API_ENDPOINT,
    DEFAULT_SPACE_ID,
    VALID_CATEGORIES,
    VALID_MARKETS,
    call_transformer_forecast,
    forecast_from_trend_series,
)

logger = logging.getLogger("ceview.router.demand_forecast")

router = APIRouter()

# ── Weights & Biases (W&B) Monitoring Configuration ───────────────────────────

WANDB_API_KEY = os.getenv("WANDB_API_KEY", "").strip()
WANDB_PROJECT = os.getenv("WANDB_PROJECT", "ceview-demand-forecast").strip()
WANDB_ENTITY = os.getenv("WANDB_ENTITY", "").strip() or None
ENABLE_WANDB = os.getenv("ENABLE_WANDB", "true").lower() in ("true", "1", "yes")

_wandb_logged_in = False


def _init_wandb_if_needed() -> bool:
    """Initialize Weights & Biases session safely if enabled and API key is present."""
    global _wandb_logged_in
    if not ENABLE_WANDB:
        return False

    api_key = os.getenv("WANDB_API_KEY", WANDB_API_KEY).strip()
    if not api_key:
        logger.debug("W&B tracking is enabled but WANDB_API_KEY is not set.")
        return False

    try:
        import wandb

        if not _wandb_logged_in:
            wandb.login(key=api_key, relogin=False)
            _wandb_logged_in = True

        if wandb.run is None:
            wandb.init(
                project=WANDB_PROJECT,
                entity=WANDB_ENTITY,
                job_type="model-inference-monitoring",
                resume="allow",
                name="ceview-demand-radar",
                config={
                    "model_space": DEFAULT_SPACE_ID,
                    "architecture": "Time-Series Transformer Encoder",
                    "lookback_weeks": 52,
                    "forecast_horizon_weeks": 12,
                    "endpoint": API_ENDPOINT,
                },
            )
        return True
    except Exception as exc:
        logger.warning("Failed to initialize Weights & Biases: %s", exc)
        return False


def log_forecast_to_wandb(
    request_type: str,
    market: str,
    category: str,
    result_dict: Optional[Dict[str, Any]],
    latency_seconds: float,
    status: str = "success",
    error_message: Optional[str] = None,
    input_stats: Optional[Dict[str, Any]] = None,
) -> None:
    """Background task: logs model inference metrics to Weights & Biases.

    Executes asynchronously after HTTP response is returned, ensuring 0 added API latency.
    """
    if not ENABLE_WANDB or not _init_wandb_if_needed():
        return

    try:
        import wandb

        log_payload: Dict[str, Any] = {
            "timestamp": time.time(),
            "request_type": request_type,
            "market": market,
            "category": category,
            "status": status,
            "latency_seconds": round(latency_seconds, 4),
        }

        if error_message:
            log_payload["error_message"] = error_message

        if input_stats:
            for key, val in input_stats.items():
                log_payload[f"input_{key}"] = val

        if result_dict:
            log_payload["mean_demand_4_weeks"] = result_dict.get("mean_demand_4_weeks")
            log_payload["mean_demand_12_weeks"] = result_dict.get("mean_demand_12_weeks")

            model_meta = result_dict.get("model", {})
            if isinstance(model_meta, dict):
                log_payload["model_version"] = model_meta.get("model_version")
                log_payload["best_epoch"] = model_meta.get("best_epoch")
                log_payload["architecture"] = model_meta.get("architecture")

            weekly = result_dict.get("weekly_forecasts", [])
            if weekly and isinstance(weekly, list):
                for pt in weekly:
                    if isinstance(pt, dict) and "week_ahead" in pt:
                        log_payload[f"forecast/week_{pt['week_ahead']}"] = pt.get("google_trends")

        wandb.log(log_payload)
        logger.debug("Successfully logged forecast event to Weights & Biases.")
    except Exception as exc:
        # Non-critical: never allow monitoring failure to impact application stability
        logger.warning("Weights & Biases logging encountered an error: %s", exc)


# ── Pydantic Request Schemas ──────────────────────────────────────────────────

class TrendSeriesForecastRequest(BaseModel):
    """Convenience payload accepting a list of raw weekly trend numbers (0-100 scale)."""

    trend_series: List[float] = Field(
        ...,
        min_length=1,
        description="Chronological list of weekly Google Trends search interest indices (0-100 scale).",
        examples=[[45.0, 48.0, 52.0, 55.0]],
    )
    market: str = Field(
        default="KR",
        description="Target origin market. Accepts 'JP', 'KR', 'US' or names like 'korea', 'japan', 'usa'.",
        examples=["korea"],
    )
    category: str = Field(
        default="accommodation_staycation",
        description="Tourism category label (e.g. 'Accommodation & Staycation' or 'accommodation_staycation').",
        examples=["Accommodation & Staycation"],
    )
    start_iso_week: Optional[int] = Field(
        default=None,
        ge=1,
        le=53,
        description="Optional. Earliest ISO week number (1-53). If omitted, the server automatically computes the calendar week from the system clock.",
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status", summary="Check Transformer Space and W&B configuration")
def get_service_status() -> Dict[str, Any]:
    """Return model service metadata, W&B tracking status, and valid markets/categories."""
    has_wandb_key = bool(os.getenv("WANDB_API_KEY", WANDB_API_KEY).strip())
    return {
        "status": "configured",
        "huggingface_space": DEFAULT_SPACE_ID,
        "endpoint": API_ENDPOINT,
        "weights_and_biases": {
            "enabled": ENABLE_WANDB,
            "api_key_configured": has_wandb_key,
            "project": WANDB_PROJECT,
            "entity": WANDB_ENTITY,
        },
        "supported_markets": list(VALID_MARKETS),
        "supported_categories": list(VALID_CATEGORIES),
    }


@router.post(
    "/forecast",
    response_model=DemandForecastOutputClass,
    summary="Generate 12-week demand forecast from 52-week JSON history",
)
def predict_forecast(
    request: DemandForecastInputClass,
    background_tasks: BackgroundTasks,
) -> DemandForecastOutputClass:
    """Predict 12-week search interest using the 52-week history tensor contract.

    Expects:
      - `history_json`: JSON string containing 52 rows of [trend_scaled, week_sin, week_cos].
      - `market`: 'JP' | 'KR' | 'US'.
      - `category`: snake_case tourism category identifier.

    Includes asynchronous Weights & Biases telemetry logging.
    """
    start_time = time.perf_counter()
    logger.info(
        "Received forecast request — market=%s category=%s",
        request.market,
        request.category,
    )

    try:
        raw_result = call_transformer_forecast(
            history_json=request.history_json,
            market=request.market,
            category=request.category,
        )
        latency = time.perf_counter() - start_time

        # Schedule background W&B logging (0 added latency for caller)
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="tensor_json",
            market=request.market,
            category=request.category,
            result_dict=raw_result,
            latency_seconds=latency,
            status="success",
        )

        return DemandForecastOutputClass.model_validate(raw_result)

    except ValueError as val_err:
        latency = time.perf_counter() - start_time
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="tensor_json",
            market=request.market,
            category=request.category,
            result_dict=None,
            latency_seconds=latency,
            status="validation_error",
            error_message=str(val_err),
        )
        logger.warning("Validation error in forecast request: %s", val_err)
        raise HTTPException(status_code=422, detail=str(val_err)) from val_err

    except RuntimeError as run_err:
        latency = time.perf_counter() - start_time
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="tensor_json",
            market=request.market,
            category=request.category,
            result_dict=None,
            latency_seconds=latency,
            status="inference_error",
            error_message=str(run_err),
        )
        logger.error("Inference runtime error: %s", run_err)
        raise HTTPException(
            status_code=503,
            detail=f"Hugging Face Space forecast service unavailable: {run_err}",
        ) from run_err

    except Exception as exc:
        latency = time.perf_counter() - start_time
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="tensor_json",
            market=request.market,
            category=request.category,
            result_dict=None,
            latency_seconds=latency,
            status="internal_error",
            error_message=str(exc),
        )
        logger.exception("Unexpected error in predict_forecast: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Internal forecast failure: {exc}"
        ) from exc


@router.post(
    "/forecast/series",
    response_model=DemandForecastOutputClass,
    summary="Generate 12-week demand forecast from raw trend numbers",
)
def predict_forecast_from_series(
    request: TrendSeriesForecastRequest,
    background_tasks: BackgroundTasks,
) -> DemandForecastOutputClass:
    """High-level endpoint: accepts raw 0-100 weekly trend numbers, auto-encodes 52-week calendar sin/cos,
    and returns the 12-week predicted trajectory.

    Includes asynchronous Weights & Biases telemetry logging.
    """
    start_time = time.perf_counter()
    logger.info(
        "Received series forecast request — points=%d market=%s category=%s",
        len(request.trend_series),
        request.market,
        request.category,
    )

    input_stats = {
        "series_points": len(request.trend_series),
        "trend_mean": round(sum(request.trend_series) / len(request.trend_series), 2),
        "trend_latest": round(request.trend_series[-1], 2),
        "trend_min": round(min(request.trend_series), 2),
        "trend_max": round(max(request.trend_series), 2),
    }

    try:
        output_model = forecast_from_trend_series(
            trend_series=request.trend_series,
            market=request.market,
            category=request.category,
            start_iso_week=request.start_iso_week,
        )
        latency = time.perf_counter() - start_time

        # Schedule background W&B logging
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="raw_series",
            market=output_model.market,
            category=output_model.category,
            result_dict=output_model.model_dump(),
            latency_seconds=latency,
            status="success",
            input_stats=input_stats,
        )

        return output_model

    except ValueError as val_err:
        latency = time.perf_counter() - start_time
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="raw_series",
            market=request.market,
            category=request.category,
            result_dict=None,
            latency_seconds=latency,
            status="validation_error",
            error_message=str(val_err),
            input_stats=input_stats,
        )
        logger.warning("Validation error in series forecast: %s", val_err)
        raise HTTPException(status_code=422, detail=str(val_err)) from val_err

    except RuntimeError as run_err:
        latency = time.perf_counter() - start_time
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="raw_series",
            market=request.market,
            category=request.category,
            result_dict=None,
            latency_seconds=latency,
            status="inference_error",
            error_message=str(run_err),
            input_stats=input_stats,
        )
        logger.error("Inference runtime error in series forecast: %s", run_err)
        raise HTTPException(
            status_code=503,
            detail=f"Hugging Face Space forecast service unavailable: {run_err}",
        ) from run_err

    except Exception as exc:
        latency = time.perf_counter() - start_time
        background_tasks.add_task(
            log_forecast_to_wandb,
            request_type="raw_series",
            market=request.market,
            category=request.category,
            result_dict=None,
            latency_seconds=latency,
            status="internal_error",
            error_message=str(exc),
            input_stats=input_stats,
        )
        logger.exception("Unexpected error in predict_forecast_from_series: %s", exc)
        raise HTTPException(
            status_code=500, detail=f"Internal forecast failure: {exc}"
        ) from exc
