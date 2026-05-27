"""
ML classifier for Module 1 business category prediction.

Architecture (two-stage) — mirrors bert-agent-service:
  1. intfloat/multilingual-e5-base  →  768-dim sentence embedding
  2. complete_classifier_head.keras →  Keras forward pass (Dense 256→128→7 sigmoid)

Both models are loaded once at import time via the BertModel singleton.
Falls back to ml_stubs when either model is unavailable.
"""

from __future__ import annotations
from app.core.BertModel import _BertModel, log

import numpy as np

CATEGORY_LABELS: list[str] = [
    "Coastal & Island",
    "Adventure & Nature",
    "Cultural & Heritage",
    "Theme Parks / Entertainment",
    "Urban & City",
    "Culinary & Gastronomy",
    "Accommodation & Staycation",
]

# Load at import time — same pattern as BertModel.get_model() in the reference.
_bert = _BertModel.get()

# Expose encoder as module-level alias so sentence_bert_scorer.py can reuse it
# without importing the class directly.
_e5_model = _bert.encoder if _bert is not None else None

# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_text(core_services: list[str], uvp: str, description: str) -> str:
    """Format input text to match the training-time input format."""
    services_str = ", ".join(core_services) if core_services else ""
    return f"services: {services_str}\nuvp: {uvp}\ndescription: {description}"


def _predict_probs(text: str) -> np.ndarray | None:
    """Encode text and run Keras classifier. Returns shape-(7,) sigmoid probabilities."""
    if _bert is None:
        return None
    try:
        vector = _bert.encoder.encode([text])               # (1, 768)
        raw = _bert.classifier.predict(vector, verbose=0)[0]  # (7,)
        return np.array(raw, dtype=np.float32)
    except Exception as exc:
        log.warning("ml_classifier: inference error — %s", exc,
                    extra={"code": "MOD1_ML_INFERENCE_FAIL"})
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def predict_top3(
    business_name: str,
    core_services: list[str],
    description: str,
    uvp: str,
) -> list[dict]:
    """Return the top-3 predicted categories with normalized percentages.

    Falls back to ml_stubs when models are unavailable.
    """
    if _bert is None:
        from app.services import ml_stubs
        log.warning("ml_classifier: using stub fallback for predict_top3",
                    extra={"code": "MOD1_ML_LOAD_FAIL"})
        return ml_stubs.classify_categories(description, core_services)

    text = _build_text(core_services, uvp, description)
    probs = _predict_probs(text)

    if probs is None:
        from app.services import ml_stubs
        return ml_stubs.classify_categories(description, core_services)

    top3_idx = probs.argsort()[::-1][:3]
    top3_probs = probs[top3_idx]
    total = float(top3_probs.sum()) or 1.0

    result = []
    remainder = 100
    for rank, (idx, prob) in enumerate(zip(top3_idx, top3_probs)):
        pct = round(float(prob) / total * 100) if rank < 2 else remainder
        remainder -= pct
        result.append({"name": CATEGORY_LABELS[int(idx)], "percentage": pct})

    log.info("ml_classifier: top3=%s probs=%s",
             [r["name"] for r in result], [round(float(p), 3) for p in top3_probs])
    return result


def predict_all(
    business_name: str,
    core_services: list[str],
    description: str,
    uvp: str,
) -> list[dict]:
    """Return all 7 categories sorted by probability descending, percentages normalized to 100.

    Falls back to ml_stubs when models are unavailable.
    """
    if _bert is None:
        from app.services import ml_stubs
        log.warning("ml_classifier: using stub fallback for predict_all",
                    extra={"code": "MOD1_ML_LOAD_FAIL"})
        return ml_stubs.classify_categories(description, core_services)

    text = _build_text(core_services, uvp, description)
    probs = _predict_probs(text)

    if probs is None:
        from app.services import ml_stubs
        return ml_stubs.classify_categories(description, core_services)

    sorted_idx = probs.argsort()[::-1]
    sorted_probs = probs[sorted_idx]
    total = float(sorted_probs.sum()) or 1.0

    result = []
    remainder = 100
    last = len(CATEGORY_LABELS) - 1
    for rank, (idx, prob) in enumerate(zip(sorted_idx, sorted_probs)):
        pct = round(float(prob) / total * 100) if rank < last else max(0, remainder)
        remainder -= pct
        result.append({"name": CATEGORY_LABELS[int(idx)], "percentage": pct})

    log.info("ml_classifier: predict_all top3=%s", [r["name"] for r in result[:3]])
    return result


def embed_business(
    core_services: list[str],
    description: str,
    uvp: str,
) -> list[float] | None:
    """Encode the business profile text to a 768-dim L2-normalised vector.

    Uses the same ``_build_text`` format as the classifier so the vector lives
    in the same embedding space as the training corpus.

    Returns:
        768-element float list, or None when the E5 model is unavailable.
    """
    if _bert is None:
        log.warning("ml_classifier: embed_business — model unavailable, returning None",
                    extra={"code": "MOD1_ML_LOAD_FAIL"})
        return None

    try:
        text = _build_text(core_services, uvp, description)
        # normalize_embeddings=True → unit vectors; dot product == cosine similarity
        vector = _bert.encoder.encode([text], normalize_embeddings=True)[0]  # (768,)
        return [float(v) for v in vector]
    except Exception as exc:
        log.warning("ml_classifier: embed_business error — %s", exc,
                    extra={"code": "MOD1_ML_INFERENCE_FAIL"})
        return None


def compute_semantic_uniqueness(
    core_services: list[str],
    description: str,
    uvp: str,
    other_embeddings: list[list[float]],
    min_businesses: int = 3,
) -> float | None:
    """Compute semantic uniqueness score (0-100) via cosine distance to corpus.

    Embeds the current business profile and measures its average cosine distance
    from every other stored embedding.  Higher distance = more unique = higher score.

    Scoring formula::

        cosine_distance_i = 1 − cosine_similarity_i       # range [0, 1] for text
        mean_distance     = mean(cosine_distance_i)
        score             = min(mean_distance / 0.5, 1.0) × 100

    A mean distance ≥ 0.5 maps to the maximum score of 100.  This threshold is
    calibrated for Philippine tourism businesses where descriptions tend to share
    vocabulary (beach, resort, tropical, etc.) keeping typical distances in the
    0.10–0.40 range.

    Args:
        core_services:     list of service tags from the business profile.
        description:       long-form business description text.
        uvp:               unique value proposition text.
        other_embeddings:  list of 768-dim float lists from the corpus DB.
        min_businesses:    minimum corpus size required to produce a score;
                           returns None when below threshold so the caller can
                           fall back to the Gemini/stub path.

    Returns:
        float 0-100 (one decimal place), or None when corpus is too small or
        the E5 model is unavailable.
    """
    if len(other_embeddings) < min_businesses:
        log.info(
            "ml_classifier: semantic_uniqueness — corpus too small (%d < %d), returning None",
            len(other_embeddings),
            min_businesses,
        )
        return None

    if _bert is None:
        log.warning("ml_classifier: semantic_uniqueness — model unavailable, returning None",
                    extra={"code": "MOD1_ML_LOAD_FAIL"})
        return None

    try:
        text = _build_text(core_services, uvp, description)
        current_emb = _bert.encoder.encode([text], normalize_embeddings=True)[0]  # (768,)

        other_matrix = np.array(other_embeddings, dtype=np.float32)  # (n, 768)
        # L2-normalise corpus rows (stored as normalised but re-normalise for safety)
        norms = np.linalg.norm(other_matrix, axis=1, keepdims=True)
        other_matrix = other_matrix / np.maximum(norms, 1e-8)

        # Cosine similarities via dot product (both sides are unit vectors)
        similarities = other_matrix @ current_emb.astype(np.float32)   # (n,)
        similarities = np.clip(similarities, -1.0, 1.0)

        distances = 1.0 - similarities                                  # (n,) in [0, 2]
        mean_dist = float(np.mean(distances))

        # Scale: 0 → same as everyone (score 0); ≥ 0.5 → very different (score 100)
        score = round(min(mean_dist / 0.5, 1.0) * 100.0, 1)

        log.info(
            "ml_classifier: semantic_uniqueness=%.1f mean_dist=%.4f corpus_size=%d",
            score,
            mean_dist,
            len(other_embeddings),
        )
        return score

    except Exception as exc:
        log.warning("ml_classifier: semantic_uniqueness error — %s", exc,
                    extra={"code": "MOD1_ML_INFERENCE_FAIL"})
        return None


def compute_category_score(
    business_name: str,
    core_services: list[str],
    description: str,
    uvp: str,
    selected_categories: list[str],
) -> float:
    """Return 0-100 score: how confidently the model predicts the operator's chosen categories.

    Falls back to ml_stubs when models are unavailable.
    """
    if _bert is None or not selected_categories:
        from app.services import ml_stubs
        result = ml_stubs.cosine_uniqueness(description, selected_categories)
        return float(result["categoryScore"])

    text = _build_text(core_services, uvp, description)
    probs = _predict_probs(text)

    if probs is None:
        from app.services import ml_stubs
        result = ml_stubs.cosine_uniqueness(description, selected_categories)
        return float(result["categoryScore"])

    selected_indices = [
        i for i, label in enumerate(CATEGORY_LABELS)
        if label in selected_categories
    ]
    if not selected_indices:
        return 50.0

    selected_sum = float(probs[selected_indices].sum())
    max_possible = min(len(selected_categories), 7) / 7.0
    score = round(min(max(selected_sum / max(max_possible, 0.01) * 100, 0.0), 100.0), 1)

    log.info("ml_classifier: category_score=%.1f selected=%s", score, selected_categories)
    return score
