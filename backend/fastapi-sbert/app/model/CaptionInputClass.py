from pydantic import BaseModel, Field
from typing import List

class CaptionInputClass(BaseModel):
    business_name: str
    business_description: str
    business_uvp: str
    business_services: List[str]
    market_category: str
    market_score: str
    forecast_context: str
    research_context: str