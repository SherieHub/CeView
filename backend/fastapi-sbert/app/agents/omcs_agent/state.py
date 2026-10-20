from typing import TypedDict, Dict, Any, Optional

# 1. Define the Shared State
class CeviewValidationState(TypedDict):
    caption: str
    caption_en: Optional[str]  # English translation; used only for profile_semantic_score
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