from __future__ import annotations

import contextlib
import logging

from fastapi import FastAPI

from app.logging_config import configure as configure_logging
from app.middleware.trace import TraceIdMiddleware
from app.routers import (
    classification,
    compliance,
    content,
    creative,
    forecasting,
    report,
)
from app.services.bert_service import BertService

configure_logging()

log = logging.getLogger("app.startup")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Eagerly loads all ML models before FastAPI begins accepting requests.

    Why this matters:
      - SentenceTransformer ('intfloat/multilingual-e5-base') takes ~20-30s
        to initialise on a cold container.
      - Spring Boot's AIInferenceGatewayService has a 30-second timeout.
      - Without this, the very first /classify or /uniqueness call after a
        container restart races against that timeout and reliably fails.
      - The /healthz endpoint only becomes reachable AFTER lifespan completes,
        so the docker-compose healthcheck naturally gates Spring Boot startup.
    """
    log.info("=== CeView FastAPI starting — preloading BERT models ===")
    try:
        BertService.load_models()
        log.info("=== BERT models loaded. Ready to accept traffic. ===")
    except Exception as exc:
        log.critical(
            "FATAL: BERT model failed to load at startup: %s — container will exit.",
            exc,
        )
        raise  # re-raise so Docker/Compose marks the container as failed and restarts it

    yield  # application runs here

    # Graceful shutdown (nothing to clean up for in-memory models)
    log.info("=== CeView FastAPI shutting down. ===")


app = FastAPI(
    title="CeView AI Microservice",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(TraceIdMiddleware)


@app.get("/healthz")
def healthz() -> dict:
    """
    Liveness probe.  Only reachable after lifespan() completes (models loaded).
    Used by the docker-compose healthcheck to gate Spring Boot startup.
    """
    return {"status": "ok"}


app.include_router(
    classification.router,
    prefix="/internal/classification",
    tags=["classification"],
)
app.include_router(
    forecasting.router,
    prefix="/internal/forecasting",
    tags=["forecasting"],
)
app.include_router(
    content.router,
    prefix="/internal/content",
    tags=["content"],
)
app.include_router(
    creative.router,
    prefix="/internal/creative",
    tags=["creative"],
)
app.include_router(
    compliance.router,
    prefix="/internal/compliance",
    tags=["compliance"],
)
app.include_router(
    report.router,
    prefix="/internal/report",
    tags=["report"],
)
