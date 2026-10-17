import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config.markets import CONTENT_FRAMEWORK, market_header
from app.model.CaptionInputClass import CaptionInputClass
from app.services import cultural_research
from app.services.caption_formatting import format_research_context, transform_captions
from app.services.caption_generation import caption_generation_service
from app.services.gemini_client import get_platform_guides

router = APIRouter()
logger = logging.getLogger(__name__)


class ContentResponse(BaseModel):
    """Mirrors backend ContentDtos.ContentResponseDto."""

    market: dict
    framework: str
    captions: dict
    # Closed on purpose, and with no default. "fallback" was both the type's only
    # other value and its default, which meant an unset source silently shipped as
    # synthetic. Widening this is the visible diff that reintroducing a fallback
    # would require. See the spec's Section 5.
    source: Literal["groq"]


_MARKET_KEY_MAP = {
    "korea": "korea",
    "south korea": "korea",
    "japan": "japan",
    "usa": "usa",
    "united states": "usa",
}


@router.post("/caption", response_model=ContentResponse)
async def caption_generation(request: CaptionInputClass):
    market_key = _MARKET_KEY_MAP.get(request.target_market.strip().lower(), "korea")

    # FR3.3 — real-time cultural research for the target market. Spring sends a
    # blank research_context; a caller that already supplies one keeps it.
    if not request.research_context.strip():
        research = cultural_research.research_market(market_key)
        logger.info("caption.research ok market=%s source=%s", market_key, research.get("source"))
        request = request.model_copy(update={"research_context": format_research_context(research)})

    try:
        result = await caption_generation_service(request)
        final_captions = result.get("final_captions", {})
        source = result.get("source", "groq")

        guides = get_platform_guides(market_key)
        captions = transform_captions(final_captions, guides)

        return {
            "market": market_header(market_key),
            "framework": CONTENT_FRAMEWORK,
            "captions": captions,
            "source": source,
        }
    except RuntimeError as exc:
        error_code = str(exc)
        logger.error("caption_generation failed: %s", error_code)
        raise HTTPException(status_code=500, detail=error_code)
