from typing import Literal

from pydantic import BaseModel, Field

Platform = Literal["instagram", "tiktok", "facebook"]


class CaptionTranslateInput(BaseModel):
    """Native (Korean/Japanese) caption to translate into English for the owner."""
    caption: str = Field(..., min_length=1, max_length=8000)
    platform: Platform = "instagram"
    business_name: str = ""


class CaptionLocalizeInput(BaseModel):
    """Owner-edited English to rewrite as a native caption."""
    caption_en: str = Field(..., min_length=1, max_length=8000)
    target_language: Literal["ko", "ja"]
    platform: Platform = "instagram"
    original_caption: str = Field(default="", max_length=8000)
    business_name: str = ""
