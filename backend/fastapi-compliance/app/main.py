from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI

from app.logging_config import configure as configure_logging
from app.middleware.trace import TraceIdMiddleware
from app.routers import compliance

configure_logging()

app = FastAPI(
    title="CeView Compliance Evaluator",
    version="1.0.0",
    description="OMCS — Overall Multimodal Compliance Score evaluation service.",
)
app.add_middleware(TraceIdMiddleware)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "service": "fastapi-compliance"}


app.include_router(compliance.router, prefix="/api/v1/compliance", tags=["compliance"])
