from fastapi import APIRouter, HTTPException
from app.model.ComplianceScoreInputClass import ComplianceInputClass
from app.services.omcs_analysis import omcs_calculation
from typing import Dict, Any
from pydantic import BaseModel

router = APIRouter()

from fastapi import APIRouter, UploadFile, File
import json

class EvaluateRequest(BaseModel):
    image: str  # This will receive the "data:image/jpeg;base64,..." string
    caption: str
    business_profile: Dict[str, Any]
    recommendations: Dict[str, Any]

# 2. Update the Endpoint
@router.post("/evaluate")
async def validate_pubmat_endpoint(payload: EvaluateRequest):
    """
    Receives the base64 image and JSON data, then triggers the LangGraph pipeline.
    """
    
    # Map the validated JSON payload directly to your LangGraph state.
    # Notice we removed all the await image.read(), base64 encoding, and json.loads() logic!
    initial_state = {
        "caption": payload.caption,
        "image_url": payload.image,  # Pass the Base64 string directly
        "business_profile": payload.business_profile, # FastAPI already parsed this into a dict
        "recommendations": payload.recommendations    # FastAPI already parsed this into a dict
    }
    
    # Run the OMCS pipeline
    result = omcs_calculation(initial_state)
    
    return {"success": True, "data": result}