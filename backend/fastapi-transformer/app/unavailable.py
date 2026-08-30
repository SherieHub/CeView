"""The one way a CeView service says "I cannot do this, and here is why".

Every externally-sourced value either comes from a real fetch or raises this. There
is no third option: no deterministic stub trend series, no straight-line GDP curve.
See docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md §Section 1.

This is a deliberate copy of fastapi-sbert/app/unavailable.py — the two services
deploy separately with no shared package. Keep them identical apart from SERVICE
and this paragraph; a diff between the two files should be exactly that.

`cause` is written once, here at the site that actually knows why, and is never
re-worded on the way up. Spring re-emits the body verbatim and the frontend
renders it verbatim, so a developer reading the browser sees the same sentence
the service logged.

Status code:
  503 (DEPENDENCY_DOWN) — a dependency we own or call is unavailable (PyTrends,
        Groq, World Bank / currency API)
  424 (MISSING_INPUT)   — a required upstream *input* is absent (empty metrics,
        no core services). Distinct because retrying will not help; the caller
        must supply the input.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

SERVICE = "fastapi-transformer"

DEPENDENCY_DOWN = 503  # retry may help
MISSING_INPUT = 424    # retry will not help; caller must supply the input


class DependencyUnavailable(Exception):
    """Raised instead of returning synthetic data."""

    def __init__(
        self,
        *,
        code: str,
        message: str,
        dependency: str,
        cause: str,
        stage: str,
        status_code: int = DEPENDENCY_DOWN,
    ) -> None:
        if status_code not in (DEPENDENCY_DOWN, MISSING_INPUT):
            raise ValueError(f"status_code must be 503 or 424, got {status_code}")
        super().__init__(f"{code}: {message} ({dependency}: {cause}) @{stage}")
        self.code = code
        self.message = message
        self.dependency = dependency
        self.cause = cause
        self.stage = stage
        self.status_code = status_code

    def to_body(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "dependency": self.dependency,
            "cause": self.cause,
            "stage": self.stage,
        }


async def dependency_unavailable_handler(
    request: Request, exc: DependencyUnavailable
) -> JSONResponse:
    logger.warning(
        "%s unavailable at %s: %s", exc.dependency, exc.stage, exc.cause,
        extra={"code": exc.code},
    )
    return JSONResponse(status_code=exc.status_code, content=exc.to_body())


def register_unavailable_handler(app: FastAPI) -> None:
    """Wire the handler onto a FastAPI app. Call once, at app construction."""
    app.add_exception_handler(DependencyUnavailable, dependency_unavailable_handler)
