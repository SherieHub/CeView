from __future__ import annotations

import logging
import os

import numpy as np
import tensorflow as tf
from sentence_transformers import SentenceTransformer

log = logging.getLogger("module1.bert_service")

# ── Resolve the .keras model path robustly ──────────────────────────────────
# Anchored to *this file's* location so the path is always correct regardless
# of which directory uvicorn is launched from (local dev vs Docker WORKDIR).
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_KERAS_PATH = os.path.normpath(
    os.path.join(_THIS_DIR, "..", "model", "complete_classifier_head.keras")
)
# Overridable via env var for volume-mounted models in Docker / cloud deployments.
KERAS_MODEL_PATH: str = os.environ.get("CLASSIFIER_MODEL_PATH", _DEFAULT_KERAS_PATH)

SBERT_MODEL_NAME: str = os.environ.get(
    "SBERT_MODEL_NAME", "intfloat/multilingual-e5-base"
)

# ── SafeDense: silently drops the `quantization_config` key that Keras 2
#    baked into the .keras file and that TF/Keras 3 does not recognise. ──────
class SafeDense(tf.keras.layers.Dense):
    def __init__(self, **kwargs):
        kwargs.pop("quantization_config", None)
        super().__init__(**kwargs)


# ── Canonical category list — must stay in sync with:
#      • ceview/constants.ts  BUSINESS_CATEGORIES
#      • db/migration/V2__module1_profile_multi_category.sql
CATEGORIES: list[str] = [
    "Coastal & Island",
    "Adventure & Nature",
    "Cultural & Heritage",
    "Theme Parks / Entertainment",
    "Urban & City",
    "Culinary & Gastronomy",
    "Accommodation & Staycation",
]


class BertService:
    """Singleton-style service. Call load_models() once at FastAPI startup
    (via the lifespan hook in main.py) so every subsequent request is instant."""

    _encoder: SentenceTransformer | None = None
    _classifier: tf.keras.Model | None = None  # type: ignore[name-defined]

    # ── Model loading ────────────────────────────────────────────────────────
    @classmethod
    def load_models(cls) -> None:
        """Eagerly loads both models into class-level singletons.
        Idempotent — safe to call multiple times."""
        if cls._encoder is None:
            log.info("Loading S-BERT encoder: %s …", SBERT_MODEL_NAME)
            cls._encoder = SentenceTransformer(SBERT_MODEL_NAME)
            log.info("S-BERT encoder ready.")

        if cls._classifier is None:
            log.info("Loading Keras classifier from: %s …", KERAS_MODEL_PATH)
            if not os.path.exists(KERAS_MODEL_PATH):
                raise FileNotFoundError(
                    f"Keras model not found at '{KERAS_MODEL_PATH}'. "
                    "Check CLASSIFIER_MODEL_PATH or rebuild the Docker image."
                )
            cls._classifier = tf.keras.models.load_model(
                KERAS_MODEL_PATH,
                compile=False,
                custom_objects={"Dense": SafeDense},
            )
            log.info(
                "Keras classifier ready. Output shape: %s",
                cls._classifier.output_shape,
            )

    @classmethod
    def _require_loaded(cls) -> None:
        """Guards against accidental lazy-load after startup."""
        if cls._encoder is None or cls._classifier is None:
            log.warning("Models not pre-loaded — loading now (cold-start penalty).")
            cls.load_models()

    # ── Inference: Business Category Classification ──────────────────────────
    @classmethod
    def classify_business(
        cls, description: str, services: list[str]
    ) -> list[dict]:
        """
        Returns a list of {name, percentage} dicts — one per category.
        Uses the trained Keras classifier head on top of S-BERT embeddings.
        """
        cls._require_loaded()

        # Format text the same way the model was trained on
        formatted = f"services: {services}\ndescription: {description}"

        embeddings = cls._encoder.encode([formatted])          # shape (1, 768)
        raw: np.ndarray = cls._classifier.predict(embeddings, verbose=0)[0]

        return [
            {"name": CATEGORIES[i], "percentage": round(float(p) * 100)}
            for i, p in enumerate(raw)
        ]

    # ── Inference: Uniqueness Scoring ────────────────────────────────────────
    @classmethod
    def evaluate_uniqueness(
        cls, description: str, categories: list[str], uvp: str
    ) -> dict:
        """
        Returns overallScore, descriptionScore, categoryScore (all 0-100 ints).

        Approach:
          • descriptionScore  = cosine similarity between UVP and Description
                                embeddings.  High value → UVP is coherent with
                                the description (semantic alignment).
          • categoryScore     = cosine similarity between Description and the
                                joined category-name text.  High value → the
                                business is well-represented by its categories.
          • overallScore      = average of both.

        NOTE: This is a *coherence* proxy, not a true market-uniqueness score.
        A reference-corpus comparison is the next milestone for this metric.
        """
        cls._require_loaded()

        desc_emb = cls._encoder.encode([description])[0]
        uvp_emb = cls._encoder.encode([uvp])[0] if uvp.strip() else desc_emb

        cat_text = " ".join(categories) if categories else "general business"
        cat_emb = cls._encoder.encode([cat_text])[0]

        def _cosine(a: np.ndarray, b: np.ndarray) -> float:
            norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return float(np.dot(a, b) / (norm_a * norm_b))

        semantics_score  = max(0, min(100, round(_cosine(uvp_emb, desc_emb) * 100)))
        category_score   = max(0, min(100, round(_cosine(desc_emb, cat_emb) * 100)))
        overall_score    = round((semantics_score + category_score) / 2)

        return {
            "overallScore":    overall_score,
            "descriptionScore": semantics_score,   # mapped → semanticsScore in router
            "categoryScore":   category_score,
        }
