from fastapi import APIRouter
from pydantic import BaseModel
from services.BertService import BertService

bert_router = APIRouter()

class ExampleClass(BaseModel):
    text: str

@bert_router.post("/predict")
async def predict(request: ExampleClass):
    service = BertService()
    result = service.predict_text_categories(request.text)
    return result