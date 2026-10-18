from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


class ComplianceInputClass(BaseModel):
    """Input contract for the omcs_agent compliance audit (Submodule 3.3).

    Mirrors the four input keys of CeviewValidationState (omcs_agent/state.py):
      caption          — operator-chosen caption text
      caption_en       — optional English translation of the caption; used ONLY for the
                         profile-similarity sub-score (profile text is English). The rubric
                         and consistency checks still read the native caption.
      image_url        — chosen pubmat/image (http(s) URL or data: URL)
      business_profile — business identity context (name, description, market, ...)
      recommendations  — the visual-guide recommendations the caption should follow
                         (core_business_context, market_cultural_localization,
                          psychological_elements, creative_tone_atmosphere,
                          algorithmic_platform_architecture)
    """
    caption: str = Field(..., min_length=1)
    caption_en: Optional[str] = Field(default=None, max_length=8000)
    image_url: str = Field(..., min_length=1)
    business_profile: Dict[str, Any] = Field(default_factory=dict)
    recommendations: Dict[str, Any] = Field(default_factory=dict)
