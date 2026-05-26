"""
ML classifier for Module 1 business category prediction.

Architecture (two-stage) — mirrors bert-agent-service:
  1. intfloat/multilingual-e5-base  →  768-dim sentence embedding
  2. complete_classifier_head.keras →  Keras forward pass (Dense 256→128→7 sigmoid)

Both models are loaded once at import time via the BertModel singleton.
Falls back to ml_stubs when either model is unavailable.
"""

from __future__ import annotations
from core.BertModel import _BertModel, log

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
        pct = round(float(prob) / total * 100) if rank < last else remainder
        remainder -= pct
        result.append({"name": CATEGORY_LABELS[int(idx)], "percentage": pct})

    log.info("ml_classifier: predict_all top3=%s", [r["name"] for r in result[:3]])
    return result


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
