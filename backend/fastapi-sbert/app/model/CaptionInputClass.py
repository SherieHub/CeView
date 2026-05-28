from pydantic import BaseModel, Field
from typing import List

class CaptionInputClass(BaseModel):
    business_name: str
    business_description: str
    business_uvp: str = ""
    business_services: List[str] = Field(default_factory=list)
    market_category: str = ""
    # target_market is injected into the LangGraph state so the prompt can
    # localise captions per country (e.g. "South Korea", "Japan", "USA").
    target_market: str = ""
    # market_score is an optional enrichment from Module 2 forecasting output.
    market_score: str = ""
    forecast_context: str = ""
    research_context: str = ""
