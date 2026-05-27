from pydantic import BaseModel, Field
from typing import List


class CaptionInputClass(BaseModel):
    business_name:        str
    business_description: str
    market_category:      str
    country_market:       str

    # ── Optional fields — populated from BusinessProfile when available ────────
    # Defaults to empty so callers without these values (e.g. direct HTTP tests
    # or existing ContentGenerationService payloads) continue to work.

    business_uvp:      str        = Field(default="")
    """Business unique value proposition — enhances Archetype 2 & 3 copy."""

    business_services: List[str]  = Field(default_factory=list)
    """Full list of business services; Node 1 (analyze_services) filters this down."""

    # ── Market localisation context (FR3.5 / FR3.6) ──────────────────────────
    # All three fields default to empty string so existing callers that do not
    # provide them continue to work without modification.

    target_market: str = Field(default="")
    """Human-readable market label, e.g. 'South Korea', 'Japan', 'USA'.
    Injected directly into the LangChain prompt as {target_market}."""

    forecast_context: str = Field(default="")
    """Pre-formatted multi-line block from Module 2 forecasting output.
    Example:
        'Market forecast context:\\n- Market score: 0.87 / 1.0\\n...'
    Empty string when Module 2 data is unavailable."""

    research_context: str = Field(default="")
    """Pre-formatted multi-line block from SerpAPI / cultural-research agent.
    Example:
        'Cultural research context:\\n- Traveller behaviour: ...\\n...'
    Empty string when SerpAPI is unavailable."""
