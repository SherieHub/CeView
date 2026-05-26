from fastapi import APIRouter
from pydantic import BaseModel
from services.BertService import BertService

bert_router = APIRouter()

# 1. Matches the Spring Boot AnalyzeRequest DTO perfectly
class AnalyzeRequest(BaseModel):
    businessName: str
    coreServices: list[str]
    description: str
    uvp: str

# 2. Matches the exact endpoint Spring Boot is calling
@bert_router.post("/analyze")
async def analyze_business(request: AnalyzeRequest):
    service = BertService()
    
    # 3. Formats the JSON fields into the single text block your model needs
    formatted_text = BertService.model_input_format(
        description=request.description,
        uvp=request.uvp,
        services=request.coreServices
    )
    
    result = service.predict_text_categories(formatted_text)
    return result