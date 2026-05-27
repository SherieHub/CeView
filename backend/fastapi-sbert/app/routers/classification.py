from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services import embedding_store, gemini_client, ml_classifier, ml_stubs

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
                     (falls back to Gemini / stub when corpus < 3 entries).
    categoryScore  — SBERT model confidence on the operator's chosen categories.
    overallScore   — simple average of the two component scores.
    """

    # ── 1. Semantic uniqueness via corpus comparison ───────────────────────────
    other_embeddings = embedding_store.fetch_others(req.businessProfileId)
    semantic_score: float | None = ml_classifier.compute_semantic_uniqueness(
        req.coreServices, req.description, req.uvp, other_embeddings
    )

    # ── 2. Qualitative feedback (Gemini / DeepSeek) — always attempted for text ─
    gemini_out = gemini_client.uniqueness(
        req.businessName, req.categories, req.coreServices, req.description, req.uvp
    )

    # ── 3. Fallback stub scores (used only when corpus too small or model down) ─
    cosine = ml_stubs.cosine_uniqueness(req.description, req.categories)

    # ── 4. Resolve final semantics score ──────────────────────────────────────
    if semantic_score is not None:
        # Real corpus comparison is available — use it as the authoritative score.
        # Gemini is still used for feedback text but its numeric score is ignored.
        final_semantic_score = semantic_score
    else:
        # Corpus too small (< 3 businesses) — trivially unique with no competitors.
        # Score 100; Gemini feedback text is still shown to guide description quality.
        final_semantic_score = 100.0

    # ── 5. Category score via ML classifier ───────────────────────────────────
    category_score = ml_classifier.compute_category_score(
        req.businessName, req.coreServices, req.description, req.uvp, req.categories
    )

    # ── 6. Compose response ───────────────────────────────────────────────────
    overall = round((category_score + final_semantic_score) / 2)
    return {
        "overallScore": overall,
        "semanticsScore": round(final_semantic_score),
        "categoryScore": category_score,
        "descriptionFeedback": gemini_out.get(
            "descriptionReasoning", cosine["descriptionReasoning"]
        ),
        "categoryFeedback": gemini_out.get(
            "categoryReasoning", cosine["categoryReasoning"]
        ),
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
