"""
Business-profile embeddings for Module 1 uniqueness scoring.

This module owns exactly one thing: turning a business profile into a 768-dim
``intfloat/multilingual-e5-base`` vector, and measuring how far that vector
sits from a cohort of other businesses.

Category *classification* does not live here — it is served by the hosted
Hugging Face Space (see ``hf_space_classifier.py``). The local two-stage
"encoder + complete_classifier_head.keras" path this module used to carry has
been removed: ``BertModel`` stopped exposing ``.classifier`` when
classification moved to the Space, so ``_predict_probs`` — and its callers
``predict_top3``, ``predict_all`` and ``compute_category_score`` — had been
raising AttributeError on every call, with no callers left anywhere in the
tree. Their ``ml_stubs`` fallbacks went with them; see
docs/superpowers/plans/2026-08-30-remove-synthetic-fallbacks/.

E5 PREFIXES: this encoder is trained with instruction prefixes, so
``_build_text`` emits one. Business-to-business comparison is *symmetric*, so
both sides carry the same ``query: `` prefix — mixing ``query: `` with
``passage: `` is the asymmetric-retrieval recipe and would place the two sides
in different regions of the space.

The prefix is here for correctness, NOT for score range. Measured over 8
representative Cebu profiles it shifts every pairwise distance down by ~0.02
and leaves the spread unchanged (0.0907 → 0.0901), preserving rank ordering.
The narrow similarity band is inherent to this model on same-domain text. That
is why uniqueness is scored by percentile rank against a cohort rather than by
an absolute distance threshold — see tests/unit/test_ml_classifier_text.py,
which pins both facts.

Any change to ``_build_text`` invalidates every stored vector. The reference
corpus is generated through this same function by
``scripts/generate-reference-corpus.py``, and
``embedding_store.EMBEDDING_MODEL_VERSION`` records which scheme produced a
given row.
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

# Expose the E5 encoder as a module-level alias for convenience.
_e5_model = _bert.encoder if _bert is not None else None

# E5 instruction prefix. Business-to-business comparison is symmetric, so the
# same prefix goes on both sides — see the module docstring.
E5_QUERY_PREFIX = "query: "

# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_text(core_services: list[str], uvp: str, description: str) -> str:
    """Format profile text for the E5 encoder, including its instruction prefix.

    The services/uvp/description ordering is shared with the reference-corpus
    generator — reordering silently invalidates every stored vector, so it is
    pinned by tests/unit/test_ml_classifier_text.py.
    """
    services_str = ", ".join(core_services) if core_services else ""
    return (
        f"{E5_QUERY_PREFIX}services: {services_str}\n"
        f"uvp: {uvp}\n"
        f"description: {description}"
    )


# ── Public API ────────────────────────────────────────────────────────────────

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

