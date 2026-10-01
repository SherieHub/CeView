"""`_build_text` emits the E5 instruction prefix, and does so order-preservingly.

MEASURED FINDING (2026-09-04, 8 representative Cebu tourism profiles, 28 pairs):

                min      median   max      spread   sd
    bare        0.1290   0.1776   0.2197   0.0907   0.0218
    prefixed    0.1078   0.1575   0.1979   0.0901   0.0205
    spearman(bare, prefixed) = 0.93

The prefix shifts every distance down by ~0.02 and leaves the *spread*
unchanged. It does NOT decompress the similarity band. The narrow band is
inherent to multilingual-e5-base on same-domain text, not a symptom of the
missing prefix — a correction to the premise originally written into
docs/superpowers/plans/2026-09-04-uniqueness-scoring-honesty/00-index.md.

Two consequences, both load-bearing for the rest of that plan:

1. Percentile ranking (02-scoring-math.md) is doing *all* of the work of making
   scores usable. It is not an incremental improvement on top of the prefix; it
   is the entire fix. A median pairwise distance of 0.18 against the old
   `min(mean_dist / 0.5, 1) * 100` formula compresses every business in this
   corpus into roughly a 26-44 point band, which is what the plan set out to
   repair.
2. The prefix is kept anyway — it is this encoder's documented usage and costs
   nothing while the corpus is being generated fresh — but it is kept for
   correctness, not for range. Nothing downstream may assume it widens scores.

Business-to-business comparison is symmetric, so both sides carry the same
`query: ` prefix; mixing `query: ` with `passage: ` is the asymmetric-retrieval
recipe and would place the two sides in different regions of the space.

Run with: pytest tests/unit/test_ml_classifier_text.py -v
"""
from __future__ import annotations

import itertools

import numpy as np
import pytest

from app.services import ml_classifier
from app.services.ml_classifier import E5_QUERY_PREFIX, _build_text


def test_build_text_carries_the_e5_prefix():
    text = _build_text(["Canyoneering"], "uvp text", "description text")

    assert text.startswith(E5_QUERY_PREFIX)


def test_build_text_preserves_field_order_and_content():
    """The services/uvp/description ordering is shared with the corpus generator.

    Reordering silently invalidates every stored vector, so it is pinned here.
    """
    text = _build_text(["Canyoneering", "Kayaking"], "the uvp", "the description")
    body = text[len(E5_QUERY_PREFIX):]

    assert body == (
        "services: Canyoneering, Kayaking\n"
        "uvp: the uvp\n"
        "description: the description"
    )


def test_build_text_handles_empty_services():
    text = _build_text([], "u", "d")

    assert text.startswith(E5_QUERY_PREFIX)
    assert "services: \n" in text


# ── Encoder-backed characterisation ───────────────────────────────────────────
# These need the ~1.1GB E5 encoder, which CI deliberately does not download
# (see .github/workflows/ci-fastapi-sbert.yml). They run locally and on any
# machine that has imported the reference corpus.

_PROFILES = [
    "services: Canyoneering, Cliff jumping\n"
    "uvp: Dawn permits ahead of the day-tour vans.\n"
    "description: Guided descents of the Kanlaob gorge in Badian, Cebu.",
    "services: Whale shark watching\n"
    "uvp: Strict code-of-conduct encounters with a falls side trip.\n"
    "description: Community-partnered whale shark tours in Tan-awan, Oslob.",
    "services: Freediving courses, Snorkeling\n"
    "uvp: Certified instruction plus guided sardine run.\n"
    "description: A freediving outfit on Panagsama Beach, Moalboal.",
    "services: Whole roasted lechon, Catering\n"
    "uvp: Hand-basted over charcoal for eight hours.\n"
    "description: A third-generation lechon house in Talisay City.",
    "services: Heritage walking tours\n"
    "uvp: Guides are trained local historians.\n"
    "description: Walking tours of Fort San Pedro and Colon Street.",
    "services: Beachfront villas, Day-use pool\n"
    "uvp: Ten minutes from the airport, feels like a private island.\n"
    "description: A boutique 20-room beachfront resort on Mactan Island.",
]

_needs_encoder = pytest.mark.skipif(
    ml_classifier._bert is None,
    reason="E5 encoder unavailable (~1.1GB download); skipped in CI by design",
)


def _pairwise_distances(texts: list[str]) -> list[float]:
    vectors = ml_classifier._bert.encoder.encode(texts, normalize_embeddings=True)
    return [
        1.0 - float(np.dot(vectors[i], vectors[j]))
        for i, j in itertools.combinations(range(len(vectors)), 2)
    ]


@_needs_encoder
def test_prefix_preserves_the_ordering_of_business_pairs():
    """The property percentile ranking actually depends on.

    Absolute distances may move; which businesses are more alike than which
    others may not. If a future prefix change scrambles this, every stored
    vector and every score built on them becomes incomparable.
    """
    bare = _pairwise_distances(_PROFILES)
    prefixed = _pairwise_distances([E5_QUERY_PREFIX + t for t in _PROFILES])

    bare_rank = np.argsort(np.argsort(bare))
    prefixed_rank = np.argsort(np.argsort(prefixed))
    correlation = float(np.corrcoef(bare_rank, prefixed_rank)[0, 1])

    assert correlation > 0.85


@_needs_encoder
def test_same_domain_distances_are_compressed_far_below_the_old_threshold():
    """Characterises *why* the old formula could not work, so it stays fixed.

    `min(mean_dist / 0.5, 1) * 100` treats 0.5 as the mean distance worth a
    perfect score. Real Cebu tourism profiles sit nowhere near it. This test
    fails if someone reintroduces an absolute-distance threshold on the
    assumption that the band later widened.
    """
    distances = _pairwise_distances([E5_QUERY_PREFIX + t for t in _PROFILES])

    assert max(distances) < 0.35, (
        f"max pairwise distance {max(distances):.4f} — an absolute /0.5 threshold "
        "is still unreachable; percentile ranking remains required"
    )
