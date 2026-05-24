from __future__ import annotations

from fastapi import APIRouter

from app.services import ml_stubs

router = APIRouter()


@router.post("/analyze")
def analyze(_: dict) -> dict:
    return {"markets": ml_stubs.forecast_markets()}


@router.post("/notifications")
def list_notifications(_: dict | None = None) -> dict:
    return {"notifications": ml_stubs.notifications()}
