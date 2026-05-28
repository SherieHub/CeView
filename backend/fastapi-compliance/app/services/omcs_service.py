"""OMCS deterministic scoring components.

Provides three public functions:
  compute_ss  — Semantic Similarity (Ss) via SBERT cosine; keyword fallback
  compute_hc  — Heuristic Compliance (Hc) via rule matching; 0-1 scale
  extract_failing_tokens — token-level attribution for failure feedback
"""

from __future__ import annotations

import logging
import re

import numpy as np

log = logging.getLogger("compliance.omcs")

# ── SBERT model (optional — falls back to keyword overlap when unavailable) ───
_model = None
try:
    from sentence_transformers import SentenceTransformer
    _model = SentenceTransformer("intfloat/multilingual-e5-small")
    log.info("omcs_service: SBERT model loaded (multilingual-e5-small)")
except Exception as exc:
    log.warning("omcs_service: SBERT unavailable — using keyword fallback: %s", exc)

# ── English stopwords (common words excluded from token attribution) ──────────
_STOPWORDS: frozenset[str] = frozenset({
    "the", "and", "for", "that", "this", "with", "from", "have", "will",
    "your", "our", "their", "what", "when", "where", "which", "who",
    "how", "are", "was", "were", "has", "had", "been", "being", "also",
    "they", "them", "then", "than", "into", "onto", "upon", "over",
    "more", "most", "such", "each", "some", "any", "all", "can", "could",
    "would", "should", "must", "may", "might", "shall",
})


# ─── Public API ───────────────────────────────────────────────────────────────

def compute_ss(submission: str, ai_recommendation: str) -> float:
    """Semantic Similarity score (0.0–1.0).

    Uses SBERT cosine similarity when the model is available; falls back to
    normalised keyword-overlap scoring when it is not.
    """
    if not submission or not ai_recommendation:
        return 0.0

    if _model is not None:
        return _sbert_ss(submission, ai_recommendation)

    return _keyword_ss(submission, ai_recommendation)


def compute_hc(submission: str, heuristic_rules: list[str]) -> float:
    """Heuristic Compliance score (0.0–1.0).

    Each element of heuristic_rules is a required keyword or phrase that must
    appear in the submission (case-insensitive).  Score = matched / total.
    Returns 1.0 when heuristic_rules is empty (no rules = full compliance).
    """
    if not heuristic_rules:
        return 1.0

    if not submission:
        return 0.0

    lower = submission.lower()
    matched = sum(1 for rule in heuristic_rules if rule.strip().lower() in lower)
    hc = matched / len(heuristic_rules)
    log.debug(
        "HC: matched=%d total=%d hc=%.3f", matched, len(heuristic_rules), hc,
    )
    return round(hc, 4)


def extract_failing_tokens(submission: str, ai_recommendation: str) -> list[str]:
    """Return substantive words in the submission absent from the AI recommendation.

    These are the tokens most likely causing the Ss deficit. Filters out
    stopwords and very short tokens (len < 4) to keep the list signal-rich.
    """
    sub_tokens  = _meaningful_tokens(submission)
    ref_tokens  = _meaningful_tokens(ai_recommendation)
    failing     = sorted(sub_tokens - ref_tokens)
    log.debug("extract_failing_tokens: %d tokens not in recommendation", len(failing))
    return failing


# ─── Private helpers ──────────────────────────────────────────────────────────

def _sbert_ss(submission: str, reference: str) -> float:
    """SBERT cosine similarity, clamped to [0, 1]."""
    try:
        embeddings  = _model.encode([submission, reference], normalize_embeddings=True)
        similarity  = float(np.dot(embeddings[0], embeddings[1]))
        ss          = max(0.0, min(1.0, similarity))
        log.info("SS (SBERT): ss=%.4f", ss)
        return round(ss, 4)
    except Exception as exc:
        log.warning("SBERT SS failed — falling back to keyword: %s", exc)
        return _keyword_ss(submission, reference)


def _keyword_ss(submission: str, reference: str) -> float:
    """Keyword-overlap Jaccard-style similarity scaled to [0, 1]."""
    sub_words = set(_tokenize(submission))
    ref_words = set(_tokenize(reference))
    if not sub_words and not ref_words:
        return 1.0
    overlap = len(sub_words & ref_words)
    union   = len(sub_words | ref_words)
    ss      = overlap / max(union, 1)
    log.info("SS (keyword fallback): overlap=%d union=%d ss=%.4f", overlap, union, ss)
    return round(ss, 4)


def _tokenize(text: str) -> list[str]:
    """Lowercase alphabetic tokens of length ≥ 2."""
    return re.findall(r"[a-zA-ZÀ-ɏ가-힣぀-ヿ]{2,}", text.lower())


def _meaningful_tokens(text: str) -> set[str]:
    """Tokens len ≥ 4 that are not stopwords — used for attribution."""
    return {t for t in _tokenize(text) if len(t) >= 4 and t not in _STOPWORDS}
