import json
from typing import TypedDict, Dict, Any

# 1. Define the Shared State
class CeviewValidationState(TypedDict):
    caption: str
    image_url: str
    business_profile: Dict[str, Any]  
    recommendations: Dict[str, Any]
    
    profile_semantic_score: float
    rubric_evaluation_data: Dict[str, Any]
    recommendations_picture_score: float
    consistency_explanation: str
    pubmat_consistency_score: float
    omcs_score: float
    
    status: str
    feedback: str