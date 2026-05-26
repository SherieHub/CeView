"""Sentence-BERT Caption Alignment Score (CAS) for Submodule 3.3 (FR3.23, FR3.25.1).

Reuses the E5 model singleton already loaded by ml_classifier.py — no second
model download or memory overhead.  When the model is unavailable, falls back
to a rule-based keyword-overlap scorer so FR3.30 is always satisfied.
"""
from __future__ import annotations

import logging
import re

import numpy as np

log = logging.getLogger("module3.compliance.bert")

# ── Reuse the E5 singleton from ml_classifier ────────────────────────────────
_model = None
try:
    from app.services.ml_classifier import _e5_model  # already loaded at startup
    _model = _e5_model
    if _model is not None:
        log.info("sentence_bert_scorer: reusing E5 model from ml_classifier")
    else:
        log.info("sentence_bert_scorer: E5 model not loaded — will use keyword fallback")
except Exception as exc:
    log.warning("sentence_bert_scorer: could not import E5 model — %s", exc)


def compute_cas(submitted_caption: str, approved_captions: list[str]) -> float:
    """Compute Caption Alignment Score (0-100) via Sentence-BERT cosine similarity (FR3.25.1).

    Encodes the submitted caption and all approved captions, then returns
    the maximum cosine similarity scaled to 0-100.

    Falls back to keyword-overlap scoring (FR3.30) when the model is unavailable.

    Args:
        submitted_caption: operator-uploaded caption to evaluate
        approved_captions: AI-generated approved captions from Transaction 3.1

    Returns:
        CAS as float 0-100
    """
    if not submitted_caption or not approved_captions:
        return 0.0

    if _model is not None:
        return _bert_cas(submitted_caption, approved_captions)

    return _keyword_cas(submitted_caption, approved_captions)


def _bert_cas(submitted: str, approved: list[str]) -> float:
    """BERT-based cosine similarity CAS."""
    try:
        all_texts = [submitted] + approved
        embeddings = _model.encode(all_texts, normalize_embeddings=True)

        submitted_emb = embeddings[0]   # shape (768,)
        approved_embs = embeddings[1:]  # shape (n, 768)

        # Cosine similarity: since embeddings are L2-normalised, dot product == cosine sim
        similarities = approved_embs @ submitted_emb
        max_similarity = float(np.max(similarities))

        # Clamp to [0, 1] then scale to [0, 100]
        cas = max(0.0, min(1.0, max_similarity)) * 100.0
        log.info(
            "CAS (BERT): submitted_len=%d approved_count=%d max_sim=%.4f cas=%.1f",
            len(submitted), len(approved), max_similarity, cas,
        )
        return round(cas, 2)

    except Exception as exc:
        log.warning("BERT CAS failed — falling back to keyword: %s", exc)
        return _keyword_cas(submitted, approved)


def _keyword_cas(submitted: str, approved: list[str]) -> float:
    """Rule-based keyword overlap CAS for FR3.30 fallback.

    Scores based on:
    - keyword overlap with approved captions (50%)
    - presence of hashtags (15%)
    - presence of CTAs (10%)
    - appropriate caption length (25%)
    """
    sub_words = set(_tokenize(submitted))
    approved_words = set(_tokenize(" ".join(approved)))

    overlap = len(sub_words & approved_words)
    union   = len(sub_words | approved_words)
    overlap_score = (overlap / max(union, 1)) * 50.0

    hashtag_score = 15.0 if re.search(r"#\w+", submitted) else 0.0

    cta_patterns = ["book", "visit", "discover", "explore", "link in bio", "→", "click"]
    has_cta = any(p in submitted.lower() for p in cta_patterns)
    cta_score = 10.0 if has_cta else 0.0

    length = len(submitted)
    length_score = 25.0 if 80 <= length <= 400 else (15.0 if length > 40 else 5.0)

    cas = overlap_score + hashtag_score + cta_score + length_score
    log.info(
        "CAS (keyword fallback): overlap=%.1f hashtag=%.1f cta=%.1f length=%.1f total=%.1f",
        overlap_score, hashtag_score, cta_score, length_score, cas,
    )
    return round(min(100.0, cas), 2)


def _tokenize(text: str) -> list[str]:
    """Lowercase word tokens, stripping punctuation and hashtag symbols."""
    return re.findall(r"[a-zA-Z가-힣가-힣぀-ゟ゠-ヿ]{2,}", text.lower())


def interpret_omcs(omcs: float) -> str:
    """Map OMCS to compliance threshold label (FR3.25.4)."""
    if omcs >= 90:
        return "Excellent Alignment"
    if omcs >= 80:
        return "High Compliance"
    if omcs >= 70:
        return "Moderate Revision Required"
    return "Significant Revision Required"
