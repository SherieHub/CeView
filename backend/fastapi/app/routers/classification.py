from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from app.services import gemini_client
from app.services.bert_service import BertService

router = APIRouter()


# ── /analyze ─────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    businessName: str = ""
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description must not be blank")
        return v


@router.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    """
    Transaction 1.1 — Business Category Classification.

    Uses the trained Keras classifier (via S-BERT embeddings) to predict how
    the business maps across the 7 Cebu tourism categories.

    Returns:
        { "categories": [ { "name": str, "percentage": int }, ... ] }
        One entry per category; percentages are 0-100 raw model probabilities.
    """
    categories = BertService.classify_business(
        description=req.description,
        services=req.coreServices,
    )
    return {"categories": categories}


# ── /uniqueness ───────────────────────────────────────────────────────────────

class UniquenessRequest(BaseModel):
    businessName: str = ""
    categories: list[str] = []
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description must not be blank")
        return v


@router.post("/uniqueness")
def uniqueness(req: UniquenessRequest) -> dict:
    """
    Transaction 1.2 — Uniqueness Scoring.

    Split-source response:
      • Numerical scores  → BertService (S-BERT cosine similarity)
      • Text feedback     → Gemini (qualitative reasoning)

    Returns the exact shape that UniquenessScoringController.java and the
    frontend UniquenessResultDTO both expect:
        {
            "overallScore":        int,   # 0-100
            "semanticsScore":      int,   # 0-100  (UVP ↔ Description alignment)
            "categoryScore":       int,   # 0-100  (Description ↔ Categories alignment)
            "descriptionFeedback": str,
            "categoryFeedback":    str,
        }
    """
    # 1. Quantitative scores from BERT
    bert = BertService.evaluate_uniqueness(
        description=req.description,
        categories=req.categories,
        uvp=req.uvp,
    )

    # 2. Qualitative text feedback from Gemini (falls back gracefully when disabled)
    gemini = gemini_client.uniqueness(
        business_name=req.businessName,
        categories=req.categories,
        core_services=req.coreServices,
        description=req.description,
        uvp=req.uvp,
    )

    return {
        # Numerical: from BERT
        "overallScore":   bert.get("overallScore", 0),
        "semanticsScore": bert.get("descriptionScore", 0),   # key rename: descriptionScore → semanticsScore
        "categoryScore":  bert.get("categoryScore", 0),
        # Text: from Gemini
        "descriptionFeedback": gemini.get(
            "descriptionReasoning",
            "Use more sensory, place-specific language to separate your copy from generic resort descriptions.",
        ),
        "categoryFeedback": gemini.get(
            "categoryReasoning",
            "Align but diversify your category mix to stand out from nearby competitors.",
        ),
    }


# ── /keywords ─────────────────────────────────────────────────────────────────

class KeywordRequest(BaseModel):
    businessName: str = ""
    description: str = ""
    category: str = ""


@router.post("/keywords")
def keywords(req: KeywordRequest) -> dict:
    """
    Transaction 1.1 (aux) — SEO keyword generation via Gemini.

    Returns:
        { "keywords": [ str, ... ] }
    """
    kws = gemini_client.keywords(
        business_name=req.businessName,
        description=req.description,
        category=req.category,
    )
    return {"keywords": kws}
