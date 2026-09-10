from __future__ import annotations

from statistics import median

from fastapi import APIRouter
from pydantic import BaseModel

from app.errors import MOD1_ML_LOAD_FAIL
from app.services import embedding_store, hf_space_classifier
from app.unavailable import DependencyUnavailable

router = APIRouter()


# ── /analyze ──────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    businessName: str = ""
    coreServices: list[str] = []
    description: str = ""
    uvp: str = ""


@router.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    """Return category allocations from the hosted CeView Hugging Face Space."""
    return {"categories": hf_space_classifier.predict_categories(
        req.description, req.uvp, req.coreServices
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

    overallScore   — the semantic percentile alone (Task 9). categoryScore
                     used to be averaged in, but it is near-tautological:
                     it averages normalised allocation shares that sum to
                     100 across the selected set, so keeping one category
                     chip yields ~100 and keeping three yields ~33 each —
                     half the old headline number measured how many chips
                     were left selected, not distinctiveness. See
                     docs/superpowers/plans/2026-09-04-uniqueness-scoring-honesty/00-index.md.
    semanticsScore — the pre-percentile raw-distance figure, retained only
                     for continuity (00-index.md's frozen contract). Not
                     part of overallScore.
    semanticPercentile — same value as overallScore; the field exists
                     because 00-index.md's contract exposes it under its own
                     name for clarity at the call sites that use it.
    categoryScore  — SBERT model confidence on the operator's chosen
                     categories. Still returned as a separate
                     classification-confidence indicator, just no longer
                     folded into overallScore.
    cohortSize / cohortMedianScore / cohortCategories / categoryDensity —
                     disclose what the score was actually computed against
                     (Task 8), so the screen's cohort claim is backed by
                     real numbers instead of asserted blind.
    sufficientCohort — False below the 3-business floor. When False, the
                     numeric fields above are not meaningful and must not be
                     rendered as a score (Task 10) — they are still present,
                     as 0, because the response contract always carries
                     them; sufficientCohort is what the caller must check.
    """
    from app.services import ml_classifier

    # The scoring math itself is a pure function of vectors (Task 6) — model
    # loading is isolated here, at the one place that can turn its failure
    # into a loud 503 rather than silently defaulting to "cohort too small"
    # (a genuinely different condition) or a fabricated score.
    candidate_embedding = ml_classifier.embed_business(
        req.coreServices, req.description, req.uvp
    )
    if candidate_embedding is None:
        raise DependencyUnavailable(
            code=MOD1_ML_LOAD_FAIL,
            message="The uniqueness model is unavailable.",
            dependency="ml_classifier",
            cause="E5 encoder failed to load or produced no vector",
            stage="fastapi-sbert/classification.uniqueness",
        )

    other_embeddings = embedding_store.fetch_others(
        req.businessProfileId, categories=req.categories
    )
    result = ml_classifier.compute_semantic_uniqueness(candidate_embedding, other_embeddings)

    category_score = hf_space_classifier.category_score(
        req.description, req.uvp, req.coreServices, req.categories
    )

    stats = embedding_store.fetch_cohort_stats(req.categories, req.businessProfileId)

    if result is None:
        # Below the cohort floor — a VALID answer, not a failure. No number
        # here is meaningful, so none is fabricated; sufficientCohort is the
        # signal the caller must act on (Task 10).
        return {
            "overallScore":        0,
            "semanticsScore":      0,
            "categoryScore":       category_score,
            "semanticPercentile":  0,
            "cohortSize":          stats["cohortSize"],
            "cohortMedianScore":   0,
            "cohortCategories":    req.categories,
            "categoryDensity":     stats["categoryDensity"],
            "sufficientCohort":    False,
            "descriptionFeedback": _insufficient_cohort_feedback(stats["cohortSize"]),
            "categoryFeedback":    _category_feedback(category_score),
        }

    cohort_median_score = round(median(result.cohort_scores)) if result.cohort_scores else 0

    return {
        "overallScore":        result.percentile,
        "semanticsScore":      round(result.semantics_score),
        "categoryScore":       category_score,
        "semanticPercentile":  result.percentile,
        "cohortSize":          stats["cohortSize"],
        "cohortMedianScore":   cohort_median_score,
        "cohortCategories":    req.categories,
        "categoryDensity":     stats["categoryDensity"],
        "sufficientCohort":    True,
        "descriptionFeedback": _description_feedback(
            result.percentile, cohort_median_score, stats["categoryDensity"]
        ),
        "categoryFeedback": _category_feedback(category_score),
    }


# ── Deterministic feedback (Task 10) ─────────────────────────────────────────
#
# Derived from the cohort statistics already computed above — never
# LLM-generated, so the same inputs always produce the same sentence. That
# reproducibility is the property the whole shared-dump plan rests on (see
# 00-index.md). "A more specific UVP usually raises this score" (the old
# copy) is unactionable: specificity barely moves a floor-bound metric. This
# tells the operator where they actually sit instead.

def _insufficient_cohort_feedback(cohort_size: int) -> str:
    return (
        f"Only {cohort_size} comparable business{'es' if cohort_size != 1 else ''} on record "
        "in this category — too few to rank against. This will sharpen as more operators "
        "in your category join."
    )


def _ordinal(n: int) -> str:
    """1st, 2nd, 3rd, 4th, ... 11th-13th are the exception to the else-'th' rule."""
    if 11 <= (n % 100) <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _description_feedback(percentile: int, cohort_median_score: float, density: str) -> str:
    rank = _ordinal(percentile)
    if percentile >= 66:
        return (
            f"Your description reads as more distinct than most businesses in this cohort "
            f"(median {cohort_median_score:.0f}, you rank at the {rank} percentile)."
        )
    if percentile <= 33:
        return (
            f"Your description reads similarly to much of this cohort "
            f"(median {cohort_median_score:.0f}, you rank at the {rank} percentile). "
            "A more specific service or angle would separate it further."
        )
    return (
        f"Your description sits in the middle of this cohort (median {cohort_median_score:.0f}, "
        f"you rank at the {rank} percentile) — neither unusually generic nor "
        "unusually distinct."
    )


def _category_feedback(category_score: float) -> str:
    if category_score >= 80:
        return f"The classifier is confident in this category selection ({category_score:.0f}%)."
    if category_score >= 50:
        return (
            f"The classifier has moderate confidence in this category selection "
            f"({category_score:.0f}%) — consider whether another category fits better."
        )
    return (
        f"The classifier has low confidence in this category selection "
        f"({category_score:.0f}%) — the description may not clearly match it."
    )


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
    from app.services import ml_classifier

    vector = ml_classifier.embed_business(req.coreServices, req.description, req.uvp)
    if vector:
        embedding_store.upsert_embedding(req.businessProfileId, vector)
        return {"stored": True}
    return {"stored": False}
