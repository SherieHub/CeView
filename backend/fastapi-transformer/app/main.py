from dotenv import load_dotenv
load_dotenv()  # must run before any app module reads os.environ

from fastapi import FastAPI

from app.logging_config import configure as configure_logging
from app.middleware.trace import TraceIdMiddleware
from app.routers import (
    forecasting,
    market_data,
)
from app.api import trends_router
from app.unavailable import register_unavailable_handler

configure_logging()

app = FastAPI(
    title="CeView Transformer Microservice",
    version="0.2.0",
    description=(
        "Module 2 market intelligence: SerpApi (Google Trends) ingestion, seasonal shift detection "
        "(7d/30d rolling avg, 2σ spike, YoY), Gemini demand forecasting, "
        "XGBoost economic viability scoring."
    ),
)
app.add_middleware(TraceIdMiddleware)

register_unavailable_handler(app)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.get("/healthz/models")
def healthz_models() -> dict:
    """Report deterministic engine and optional-model availability without loading Groq."""
    from app.services.forecast_engine import model_health
    return model_health()


app.include_router(forecasting.router,         prefix="/internal/forecasting",  tags=["forecasting"])
app.include_router(market_data.router,         prefix="/internal/market-data",   tags=["market-data"])
app.include_router(trends_router.router,       prefix="/api/trends",           tags=["trends"])
