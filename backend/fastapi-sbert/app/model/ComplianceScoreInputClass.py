from pydantic import BaseModel, Field
from typing import Any, Dict


class ComplianceInputClass(BaseModel):
    """Input contract for the omcs_agent compliance audit (Submodule 3.3).

    Mirrors the four input keys of CeviewValidationState (omcs_agent/state.py):
      caption          — operator-chosen caption text
      image_url        — chosen pubmat/image (http(s) URL or data: URL)
      business_profile — business identity context (name, description, market, ...)
      recommendations  — the visual-guide recommendations the caption should follow
                         (core_business_context, market_cultural_localization,
                          psychological_elements, creative_tone_atmosphere,
                          algorithmic_platform_architecture)
    """
    caption: str = Field(..., min_length=1)
    image_url: str = Field(..., min_length=1)
    business_profile: Dict[str, Any] = Field(default_factory=dict)
    recommendations: Dict[str, Any] = Field(default_factory=dict)
