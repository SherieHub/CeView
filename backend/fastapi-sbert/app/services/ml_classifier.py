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

from dataclasses import dataclass

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


@dataclass(frozen=True)
class SemanticUniqueness:
    """Result of scoring one business against its cohort.

    ``semantics_score`` is the pre-existing raw-distance figure
    (``min(mean_dist / 0.5, 1) * 100``), retained only for continuity in the
    response contract — see the module docstring and 00-index.md's MEASURED
    finding for why it floor-bounds every business in every category to
    roughly 16-32/100 on the real corpus and cannot be trusted as a headline
    number by itself.

    ``percentile`` is the candidate's rank against the cohort's own internal
    distance distribution (0 = least distinct, 100 = most distinct within
    this cohort). This is what actually drives ``overallScore`` — see
    02-scoring-math.md Task 9.

    ``cohort_scores`` is each cohort member's own ``semantics_score``-style
    figure (their mean distance to the *rest* of the cohort, excluding
    themselves), already computed as part of building the percentile. Task 8
    derives ``cohortMedianScore`` from this list rather than a second pass
    over the corpus.
    """

    semantics_score: float
    percentile: int
    cohort_scores: list[float]


def _raw_score(mean_dist: float) -> float:
    """The pre-percentile raw-distance figure, unchanged since before this plan.

    Kept only for continuity — see ``SemanticUniqueness.semantics_score``.
    """
    return round(min(mean_dist / 0.5, 1.0) * 100.0, 1)


def compute_semantic_uniqueness(
    candidate_embedding: list[float],
    other_embeddings: list[list[float]],
    min_businesses: int = 3,
) -> SemanticUniqueness | None:
    """Score one business by percentile rank against its cohort's own distance distribution.

    ``min(mean_dist / 0.5, 1) x 100`` (the old formula, kept as ``semantics_score``
    below for continuity) assumes a mean cosine distance of 0.5 is attainable.
    Measured on the seeded corpus, within-category distances run 0.08-0.16, so
    that formula alone caps every business in every category at roughly
    16-32/100 — see 00-index.md. Ranking the candidate's distance against the
    cohort's own internal distances is self-calibrating: it needs no magic
    constant and cannot go stale when the encoder or the corpus changes.

    This function is intentionally pure — it takes vectors and returns
    numbers, with no model loading and no database access, so it is fully
    unit-testable with synthetic vectors. The candidate vector must already
    be encoded (via ``embed_business``) and the corpus already fetched (via
    ``embedding_store.fetch_others``); wiring those two calls together is the
    caller's job (see ``app/routers/classification.py``).

    Args:
        candidate_embedding: the business's own 768-dim vector, already encoded.
        other_embeddings:    768-dim float lists from the corpus DB — the cohort
                              to rank against (already category-filtered by the
                              caller; see ``embedding_store.fetch_others``).
        min_businesses:      minimum cohort size required to produce a score.
                              Below this, returns None so the caller can render
                              the explicit insufficient-cohort state (Task 10)
                              instead of a fabricated number.

    Returns:
        A ``SemanticUniqueness``, or None when the cohort is too small.
    """
    if len(other_embeddings) < min_businesses:
        log.info(
            "ml_classifier: semantic_uniqueness — cohort too small (%d < %d), returning None",
            len(other_embeddings),
            min_businesses,
        )
        return None

    try:
        candidate = np.array(candidate_embedding, dtype=np.float32)
        candidate = candidate / max(float(np.linalg.norm(candidate)), 1e-8)

        other_matrix = np.array(other_embeddings, dtype=np.float32)  # (n, 768)
        # L2-normalise corpus rows (stored as normalised but re-normalise for safety)
        norms = np.linalg.norm(other_matrix, axis=1, keepdims=True)
        other_matrix = other_matrix / np.maximum(norms, 1e-8)

        # Candidate vs. cohort — cosine similarities via dot product (unit vectors)
        similarities = other_matrix @ candidate                          # (n,)
        similarities = np.clip(similarities, -1.0, 1.0)
        distances = 1.0 - similarities                                   # (n,) in [0, 2]
        mean_dist = float(np.mean(distances))
        semantics_score = _raw_score(mean_dist)

        # Cohort's own internal distances: each member's mean distance to the
        # REST of the cohort, excluding itself. This is the distribution the
        # candidate is ranked against, and — Task 8 — the source of
        # cohortMedianScore with no second pass over the corpus.
        internal_similarities = other_matrix @ other_matrix.T            # (n, n)
        internal_similarities = np.clip(internal_similarities, -1.0, 1.0)
        internal_distances = 1.0 - internal_similarities
        np.fill_diagonal(internal_distances, np.nan)
        cohort_mean_dists = np.nanmean(internal_distances, axis=1)       # (n,)
        cohort_scores = [_raw_score(float(d)) for d in cohort_mean_dists]

        # Percentile rank: share of the cohort whose own mean distance is at
        # or below the candidate's — higher distance (more different) ranks
        # higher. `<=` so a candidate that exceeds every cohort member lands
        # exactly at 100, not just short of it.
        rank = int(np.sum(cohort_mean_dists <= mean_dist))
        percentile = round(rank / len(cohort_mean_dists) * 100)

        log.info(
            "ml_classifier: percentile=%d semantics_score=%.1f mean_dist=%.4f cohort_size=%d",
            percentile,
            semantics_score,
            mean_dist,
            len(other_embeddings),
        )
        return SemanticUniqueness(
            semantics_score=semantics_score,
            percentile=percentile,
            cohort_scores=cohort_scores,
        )

    except Exception as exc:
        log.warning("ml_classifier: semantic_uniqueness error — %s", exc,
                    extra={"code": "MOD1_ML_INFERENCE_FAIL"})
        return None

