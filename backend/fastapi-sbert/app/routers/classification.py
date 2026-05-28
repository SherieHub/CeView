from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import embedding_store, ml_classifier

router = APIRouter()


# ── /analyze ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    businessName: str = ""
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""


@router.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    """Return all 7 category allocations (name + %) via the SBERT + Keras classifier."""
    return {"categories": ml_classifier.predict_all(
        req.businessName, req.coreServices, req.description, req.uvp
    )}


# ── /uniqueness ───────────────────────────────────────────────────────────────

class UniquenessRequest(BaseModel):
    businessProfileId: str = ""   # UUID of the saved profile; "" for unsaved drafts
    businessName: str = ""
    categories: list[str] = []
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""


@router.post("/uniqueness")
def uniqueness(req: UniquenessRequest) -> dict:
    """Compute uniqueness scores for a business profile.

    semanticsScore — cosine distance vs. all stored business embeddings
                     (100 when corpus < 3 entries — trivially unique).
    categoryScore  — SBERT model confidence on the operator's chosen categories.
    overallScore   — simple average of the two component scores.
    """

    # ── 1. Semantic uniqueness via corpus comparison ───────────────────────────
    other_embeddings = embedding_store.fetch_others(req.businessProfileId)
    semantic_score: float | None = ml_classifier.compute_semantic_uniqueness(
        req.coreServices, req.description, req.uvp, other_embeddings
    )

    # Corpus too small (< 3 businesses) → trivially unique, score 100
    final_semantic_score = semantic_score if semantic_score is not None else 100.0

    # ── 2. Category score via ML classifier ───────────────────────────────────
    category_score = ml_classifier.compute_category_score(
        req.businessName, req.coreServices, req.description, req.uvp, req.categories
    )

    # ── 3. Compose response ───────────────────────────────────────────────────
    overall = round((category_score + final_semantic_score) / 2)
    return {
        "overallScore":    overall,
        "semanticsScore":  round(final_semantic_score),
        "categoryScore":   category_score,
    }


# ── /embed ────────────────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    businessProfileId: str
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""


@router.post("/embed")
def embed(req: EmbedRequest) -> dict:
    """Generate and persist the 768-dim E5 embedding for a saved business profile.

    Called by Spring Boot's BusinessProfileController immediately after a profile
    is saved/updated so the corpus stays current for future uniqueness comparisons.

    Returns:
        {"stored": true}  when the embedding was written to tbl_business_embedding.
        {"stored": false} when the E5 model is unavailable (falls back gracefully).
    """
    vector = ml_classifier.embed_business(req.coreServices, req.description, req.uvp)
    if vector:
        embedding_store.upsert_embedding(req.businessProfileId, vector)
        return {"stored": True}
    return {"stored": False}
