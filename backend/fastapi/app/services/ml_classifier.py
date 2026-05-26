"""
ML classifier for Module 1 business category prediction.

Architecture (two-stage):
  1. intfloat/e5-base-v2  →  768-dim sentence embedding  (sentence-transformers)
  2. classifier_weights.npz  →  numpy forward pass (no TensorFlow in container)

The classifier head layers: Dense(256, relu) → Dropout → Dense(128, relu) → Dense(7, sigmoid)
Weights were extracted from complete_classifier_head.keras using extract_weights.py.
"""

from __future__ import annotations

import logging
import os

import numpy as np

log = logging.getLogger("module1.classifier")

CATEGORY_LABELS: list[str] = [
    "Coastal & Island",
    "Adventure & Nature",
    "Cultural & Heritage",
    "Theme Parks / Entertainment",
    "Urban & City",
    "Culinary & Gastronomy",
    "Accommodation & Staycation",
]

_WEIGHTS_PATH = os.path.join(
    os.path.dirname(os.environ.get("ML_MODEL_PATH", "/app/models/complete_classifier_head.keras")),
    "classifier_weights.npz",
)
E5_MODEL_ID = "intfloat/e5-base-v2"

# ── Singletons loaded once at import time ────────────────────────────────────
_weights: dict[str, np.ndarray] | None = None
_e5_model = None


def _load() -> None:
    global _weights, _e5_model

    try:
        data = np.load(_WEIGHTS_PATH)
        _weights = {k: data[k] for k in data.files}
        log.info("ml_classifier: weights loaded from %s (%d arrays)", _WEIGHTS_PATH, len(_weights))
    except Exception as exc:
        log.warning("ml_classifier: failed to load weights — %s", exc,
                    extra={"code": "MOD1_ML_LOAD_FAIL"})
        _weights = None

    try:
        import importlib
        sentence_transformers = importlib.import_module("sentence_transformers")
        SentenceTransformer = sentence_transformers.SentenceTransformer
        _e5_model = SentenceTransformer(E5_MODEL_ID)
        log.info("ml_classifier: E5 encoder loaded (%s)", E5_MODEL_ID)
    except Exception as exc:
        log.warning("ml_classifier: failed to load E5 model — %s", exc,
                    extra={"code": "MOD1_ML_LOAD_FAIL"})
        _e5_model = None


_load()


# ── Pure-numpy forward pass ───────────────────────────────────────────────────

def _relu(x: np.ndarray) -> np.ndarray:
    return np.maximum(0.0, x)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _forward(embedding: np.ndarray) -> np.ndarray:
    """Run the classifier head; embedding shape: (768,) or (1, 768)."""
    assert _weights is not None
    x = embedding.reshape(1, -1).astype(np.float32)
    x = _relu(x @ _weights["dense_kernel"] + _weights["dense_bias"])
    x = _relu(x @ _weights["dense_1_kernel"] + _weights["dense_1_bias"])
    x = _sigmoid(x @ _weights["predictions_kernel"] + _weights["predictions_bias"])
    return x[0]  # shape (7,)


# ── Internal helpers ─────────────────────────────────────────────────────────

def _build_text(core_services: list[str], uvp: str, description: str) -> str:
    services_str = ", ".join(core_services) if core_services else ""
    return f"passage: services: {services_str}\nuvp: {uvp}\ndescription: {description}"


def _embed(text: str) -> np.ndarray | None:
    if _e5_model is None:
        return None
    vec = _e5_model.encode(text, normalize_embeddings=True, convert_to_numpy=True)
    return vec.reshape(1, -1).astype(np.float32)


def _predict_probs(embedding: np.ndarray) -> np.ndarray:
    return _forward(embedding)


# ── Public API ────────────────────────────────────────────────────────────────

def predict_top3(
    business_name: str,
    core_services: list[str],
    description: str,
    uvp: str,
) -> list[dict]:
    """
    Returns the top 3 predicted categories as dicts with 'name' and
    'percentage' keys, where percentages sum to 100 (within rounding).
    Falls back to ml_stubs if models could not be loaded.
    """
    if _weights is None or _e5_model is None:
        from app.services import ml_stubs
        log.warning("ml_classifier: using stub fallback for predict_top3",
                    extra={"code": "MOD1_ML_LOAD_FAIL"})
        return ml_stubs.classify_categories(description, core_services)

    text = _build_text(core_services, uvp, description)
    embedding = _embed(text)
    if embedding is None:
        from app.services import ml_stubs
        return ml_stubs.classify_categories(description, core_services)

    probs = _predict_probs(embedding)

    top3_idx = probs.argsort()[::-1][:3]
    top3_probs = probs[top3_idx]
    total = top3_probs.sum() or 1.0

    result = []
    remainder = 100
    for rank, (idx, prob) in enumerate(zip(top3_idx, top3_probs)):
        pct = round(float(prob) / float(total) * 100) if rank < 2 else remainder
        remainder -= pct
        result.append({"name": CATEGORY_LABELS[int(idx)], "percentage": pct})

    log.info("ml_classifier: top3=%s probs=%s",
             [r["name"] for r in result], [round(float(p), 3) for p in top3_probs])
    return result


def compute_category_score(
    business_name: str,
    core_services: list[str],
    description: str,
    uvp: str,
    selected_categories: list[str],
) -> float:
    """
    Returns a 0–100 score reflecting how confidently the model predicts
    the user's chosen categories.
    Falls back to ml_stubs if models could not be loaded.
    """
    if _weights is None or _e5_model is None or not selected_categories:
        from app.services import ml_stubs
        result = ml_stubs.cosine_uniqueness(description, selected_categories)
        return float(result["categoryScore"])

    text = _build_text(core_services, uvp, description)
    embedding = _embed(text)
    if embedding is None:
        from app.services import ml_stubs
        result = ml_stubs.cosine_uniqueness(description, selected_categories)
        return float(result["categoryScore"])

    probs = _predict_probs(embedding)

    selected_indices = [
        i for i, label in enumerate(CATEGORY_LABELS)
        if label in selected_categories
    ]
    if not selected_indices:
        return 50.0

    selected_sum = float(probs[selected_indices].sum())
    max_possible = min(len(selected_categories), 7) / 7.0
    raw = selected_sum / max(max_possible, 0.01)
    score = round(min(max(raw * 100, 0.0), 100.0), 1)

    log.info("ml_classifier: category_score=%.1f selected=%s", score, selected_categories)
    return score
