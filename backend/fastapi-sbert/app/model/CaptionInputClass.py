from pydantic import BaseModel
from typing import List

class CaptionInputClass(BaseModel):
    business_name: str
    business_description: str
    business_uvp: str
    business_services: List[str]
    market_category: str
    country_market: str