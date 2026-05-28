import logging

from fastapi import APIRouter, HTTPException

from app.model.CaptionInputClass import CaptionInputClass
from app.services.caption_generation import caption_generation_service
from app.routers.content import _transform_captions, _MARKET_HEADERS
from app.services.gemini_client import get_platform_guides

router = APIRouter()
logger = logging.getLogger(__name__)

_MARKET_KEY_MAP = {
    "korea": "korea", "south korea": "korea",
    "japan": "japan",
    "usa": "usa", "united states": "usa",
}


@router.post("/caption")
async def caption_generation(request: CaptionInputClass):
    try:
        result = await caption_generation_service(request)
        final_captions = result.get("final_captions", {})
        source = result.get("source", "fallback")

        market_key = _MARKET_KEY_MAP.get(request.target_market.strip().lower(), "korea")
        guides = get_platform_guides(market_key)
        captions = _transform_captions(final_captions, guides)

        return {
            "market":    _MARKET_HEADERS.get(market_key, _MARKET_HEADERS["korea"]),
            "framework": "SOR — Stimulus-Organism-Response",
            "captions":  captions,
            "source":    source,
        }
    except RuntimeError as exc:
        error_code = str(exc)
        logger.error("caption_generation failed: %s", error_code)
        raise HTTPException(status_code=500, detail=error_code)