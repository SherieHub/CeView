from fastapi import APIRouter
from app.model.CaptionInputClass import CaptionInputClass
from app.services.caption_generation import caption_generation_service

router = APIRouter()

@router.post("/caption")
async def caption_generation(request: CaptionInputClass):
    result = await caption_generation_service(request)
    return result