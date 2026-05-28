from dotenv import load_dotenv
load_dotenv()  # must run before any app module reads os.environ

from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.logging_config import configure as configure_logging
from app.middleware.trace import TraceIdMiddleware
from app.routers import (
    classification,
    content,
    creative,
    compliance,
    report,
    caption_generation,
    pes_analysis,
)

configure_logging()
async def lifespan(app: FastAPI):
    """Eagerly load the E5 encoder + Keras classifier on startup.

    This runs before /healthz can return 200, so the Docker health check
    gates Spring Boot until the models are actually ready. Without this,
    the first incoming classify request would trigger a cold HuggingFace
    download while Spring Boot is already sending traffic — causing 503s.
    """
    from app.core.BertModel import _BertModel
    _BertModel.get()
    yield


app = FastAPI(title="CeView SBERT Microservice", version="0.1.0", lifespan=lifespan)
app.add_middleware(TraceIdMiddleware)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


app.include_router(classification.router, prefix="/internal/classification", tags=["classification"])
app.include_router(content.router,        prefix="/internal/content",        tags=["content"])
app.include_router(creative.router,       prefix="/internal/creative",       tags=["creative"])
app.include_router(compliance.router,     prefix="/internal/compliance",     tags=["compliance"])
app.include_router(report.router,         prefix="/internal/report",         tags=["report"])
app.include_router(caption_generation.router, prefix="/internal/generation",   tags=["caption"])
app.include_router(pes_analysis.router,       prefix="/internal/pes-analysis",  tags=["pes-analysis"])
