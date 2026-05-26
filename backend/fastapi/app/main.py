from fastapi import FastAPI

from app.logging_config import configure as configure_logging
from app.middleware.trace import TraceIdMiddleware
from app.routers import (
    classification,
    forecasting,
    market_data,
    content,
    creative,
    compliance,
    report,
)

configure_logging()

app = FastAPI(title="CeView AI Microservice", version="0.1.0")
app.add_middleware(TraceIdMiddleware)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


app.include_router(classification.router, prefix="/internal/classification", tags=["classification"])
app.include_router(forecasting.router, prefix="/internal/forecasting", tags=["forecasting"])
app.include_router(market_data.router, prefix="/internal/market-data", tags=["market-data"])
app.include_router(content.router, prefix="/internal/content", tags=["content"])
app.include_router(creative.router, prefix="/internal/creative", tags=["creative"])
app.include_router(compliance.router, prefix="/internal/compliance", tags=["compliance"])
app.include_router(report.router, prefix="/internal/report", tags=["report"])
