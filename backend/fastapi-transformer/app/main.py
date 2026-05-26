from fastapi import FastAPI

from app.logging_config import configure as configure_logging
from app.middleware.trace import TraceIdMiddleware
from app.routers import (
    forecasting,
    market_data,
)
from app.api import trends_router

configure_logging()

app = FastAPI(
    title="CeView Transformer Microservice",
    version="0.2.0",
    description=(
        "Module 2 market intelligence: PyTrends ingestion, seasonal shift detection "
        "(7d/30d rolling avg, 2σ spike, YoY), Gemini demand forecasting, "
        "XGBoost economic viability scoring."
    ),
)
app.add_middleware(TraceIdMiddleware)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.get("/healthz/models")
def healthz_models() -> dict:
    """Reports AI model availability for monitoring dashboards.

    Returns live/stub status for:
      gemini  — Gemini API availability (requires GEMINI_API_KEY)
      xgboost — XGBoost model file presence (requires xgboost_market.json)
    """
    from app.services.gemini_forecaster import _genai
    from app.services.xgboost_scorer import _model as xgb_model

    return {
        "gemini":   "live"   if _genai     is not None else "stub",
        "xgboost":  "loaded" if xgb_model  is not None else "stub",
        "status":   "ok",
    }


app.include_router(forecasting.router,         prefix="/internal/forecasting",  tags=["forecasting"])
app.include_router(market_data.router,         prefix="/internal/market-data",   tags=["market-data"])
app.include_router(trends_router.router,       prefix="/api/v1/trends",           tags=["trends"])
