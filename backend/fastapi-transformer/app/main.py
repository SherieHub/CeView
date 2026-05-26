from fastapi import FastAPI

from app.logging_config import configure as configure_logging
from app.middleware.trace import TraceIdMiddleware
from app.routers import (
    forecasting,
    market_data,
)

configure_logging()

app = FastAPI(title="CeView Transformer Microservice", version="0.1.0")
app.add_middleware(TraceIdMiddleware)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


app.include_router(forecasting.router,  prefix="/internal/forecasting",  tags=["forecasting"])
app.include_router(market_data.router,  prefix="/internal/market-data",  tags=["market-data"])
