from pydantic import BaseModel, HttpUrl
from typing import Dict, Any

class ComplianceInputClass(BaseModel):
    caption: str
    image_url: str
    business_profile: Dict[str, Any]  
    recommendations: Dict[str, Any]