from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import gemini_client

router = APIRouter()


class GenerateRequest(BaseModel):
    market: str = "korea"
    businessName: str = ""
    description: str = ""
    categories: list[str] = []
    trend: str = ""


@router.post("/generate")
def generate(req: GenerateRequest) -> dict:
    return gemini_client.content_for_market(
        req.market, req.businessName, req.description, req.categories, req.trend
    )
