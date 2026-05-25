from __future__ import annotations

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import gemini_client

router = APIRouter()
log = logging.getLogger("module3.content")


class GenerateRequest(BaseModel):
    market: str = "korea"
    businessName: str = ""
    description: str = ""
    categories: list[str] = []
    trend: str = ""


@router.post("/generate")
def generate(req: GenerateRequest) -> dict:
    log.info("content.generate received market=%s business=%s", req.market, req.businessName)
    result = gemini_client.content_for_market(
        req.market, req.businessName, req.description, req.categories, req.trend
    )
    log.info("content.generate ok market=%s source=%s", req.market, result.get("source"))
    return result
