"""Caption translation endpoints (Submodule 3.1).

  POST /translate — native Korean/Japanese caption → meaning-faithful English
  POST /localize  — owner-edited English → natural native caption (+ fresh English)

Mounted under /internal/generation. Called by Spring's CaptionTranslationService.
"""
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.model.CaptionTranslationInputClass import CaptionLocalizeInput, CaptionTranslateInput
from app.services import caption_translation

router = APIRouter()


class CaptionTranslateResponse(BaseModel):
    caption_en: str
    source_language: str
    # Closed and defaultless, like ContentResponse.source.
    source: Literal["groq"]


class CaptionLocalizeResponse(BaseModel):
    caption: str
    caption_en: str
    target_language: Literal["ko", "ja"]
    source: Literal["groq"]


# Sync handlers: the chains use blocking invoke(), so FastAPI runs them in its threadpool.
@router.post("/translate", response_model=CaptionTranslateResponse)
def translate(body: CaptionTranslateInput):
    return caption_translation.translate_to_english(body.caption, body.platform, body.business_name)


@router.post("/localize", response_model=CaptionLocalizeResponse)
def localize(body: CaptionLocalizeInput):
    return caption_translation.localize_from_english(
        body.caption_en, body.target_language, body.platform, body.original_caption, body.business_name
    )
