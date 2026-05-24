from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import gemini_client, ml_stubs

router = APIRouter()


class AnalyzeRequest(BaseModel):
    businessName: str = ""
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""


@router.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    return {"categories": ml_stubs.classify_categories(req.description, req.coreServices)}


class UniquenessRequest(BaseModel):
    businessName: str = ""
    categories: list[str] = []
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""


@router.post("/uniqueness")
def uniqueness(req: UniquenessRequest) -> dict:
    gemini_out = gemini_client.uniqueness(
        req.businessName, req.categories, req.coreServices, req.description, req.uvp
    )
    cosine = ml_stubs.cosine_uniqueness(req.description, req.categories)
    # Prefer Gemini's qualitative feedback; lean on cosine for the numbers if
    # Gemini is disabled or omits a field.
    return {
        "overallScore": gemini_out.get("overallScore", cosine["overallScore"]),
        "semanticsScore": gemini_out.get("descriptionScore", cosine["descriptionScore"]),
        "categoryScore": gemini_out.get("categoryScore", cosine["categoryScore"]),
        "descriptionFeedback": gemini_out.get("descriptionReasoning", cosine["descriptionReasoning"]),
        "categoryFeedback": gemini_out.get("categoryReasoning", cosine["categoryReasoning"]),
    }


class KeywordRequest(BaseModel):
    businessName: str = ""
    description: str = ""
    category: str = ""


@router.post("/keywords")
def keywords(req: KeywordRequest) -> dict:
    return {"keywords": gemini_client.keywords(req.businessName, req.description, req.category)}
