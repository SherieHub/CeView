"""Sentence-BERT Caption Alignment Score (CAS) and Heuristic Compliance Score (HCS)
for Submodule 3.3 (FR3.23-FR3.25).

CAS: Reuses the E5 model singleton already loaded by ml_classifier.py — no second
model download or memory overhead.  When the model is unavailable, falls back
to a rule-based keyword-overlap scorer so FR3.30 is always satisfied.

HCS (FR3.25.3): Deterministic rule-based scorer — six independent checks covering
tourism category alignment, target-market consistency, seasonal appropriateness,
promotional tone conformity, recommendation adherence, and caption-visual
consistency.  Always produces a value (no AI dependency).
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


# ── Market-specific cultural signal lists (FR3.25.3 rule 2) ──────────────────
_MARKET_SIGNALS: dict[str, list[str]] = {
    "korea": [
        "korea", "korean", "한국", "k-travel", "k-trip", "healing", "힐링",
        "seoul", "busan", "jeju", "한류", "wellness", "kdrama", "kpop",
    ],
    "japan": [
        "japan", "japanese", "日本", "nippon", "tokyo", "osaka", "kyoto",
        "zen", "onsen", "sakura", "wabi", "sabi", "traditional", "harmony",
    ],
    "usa": [
        "usa", "america", "american", "us travel", "bucket list", "paradise",
        "adventure", "surf", "tropical getaway", "dream vacation", "wanderlust",
    ],
}

# ── Tourism / hospitality terms for category alignment (FR3.25.3 rule 1) ─────
_TOURISM_TERMS: set[str] = {
    "resort", "beach", "island", "dive", "snorkel", "spa", "wellness", "healing",
    "nature", "jungle", "waterfall", "adventure", "cultural", "heritage", "food",
    "cuisine", "hotel", "eco", "retreat", "tour", "trip", "travel", "vacation",
    "holiday", "relax", "sunset", "sunrise", "pool", "villa", "lodge", "stay",
    "destination", "paradise", "pristine", "scenic", "breathtaking", "getaway",
    "cebu", "philippines", "visayas", "palawan", "boracay",
}

# ── Seasonal contradiction terms (non-tropical indicators) ───────────────────
_ANTI_TROPICAL: list[str] = [
    "snow", "snowflake", "blizzard", "winter wonderland", "icy", "freezing cold",
    "bundled up", "thick coat", "mittens", "frostbite", "polar vortex",
]

# ── Promotional CTA patterns (FR3.25.3 rule 4) ───────────────────────────────
_CTA_PATTERNS: list[str] = [
    "book", "visit", "explore", "discover", "experience", "join", "escape",
    "plan", "reserve", "come", "don't miss", "see you", "link in bio",
    "tap the link", "dm us", "→", "now", "today", "limited", "exclusive",
]

# ── Positive promotional adjectives ──────────────────────────────────────────
_POSITIVE_TERMS: list[str] = [
    "amazing", "beautiful", "stunning", "breathtaking", "unforgettable",
    "incredible", "magical", "serene", "peaceful", "vibrant", "luxurious",
    "authentic", "unique", "pristine", "paradise", "hidden gem", "must-see",
    "perfect", "ideal", "dreamy",
]


# ─── Public API ───────────────────────────────────────────────────────────────

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


def compute_hcs(
    caption: str,
    market: str,
    categories: list[str] | None = None,
    approved_captions: list[str] | None = None,
    visual_tone: str | None = None,
    media_name: str | None = None,
) -> float:
    """Compute Heuristic Compliance Score (0-100) via deterministic rule-based checks (FR3.25.3).

    Six independent rules — each contributes a fixed maximum weight:

        Rule 1: Tourism category alignment            — 20 pts
        Rule 2: Target-market cultural consistency   — 20 pts
        Rule 3: Seasonal appropriateness             — 20 pts
        Rule 4: Promotional tone conformity          — 15 pts
        Rule 5: Recommendation adherence             — 15 pts
        Rule 6: Caption-visual consistency           — 10 pts
                                                    ─────────
        Total                                       = 100 pts

    All checks are deterministic — no AI/network dependency (FR3.30 always satisfied).

    Args:
        caption:          operator caption text
        market:           target market key (korea | japan | usa)
        categories:       business category labels from the profile (FR3.1)
        approved_captions: approved captions from Transaction 3.1
        visual_tone:      visual tone string from creative direction (FR3.2)
        media_name:       uploaded media filename — used only as a signal that media exists

    Returns:
        HCS as float 0-100
    """
    if not caption or not caption.strip():
        return 0.0

    lower = caption.lower()
    tokens = set(_tokenize(caption))
    score = 0.0

    # ── Rule 1: Tourism category alignment (20 pts) ───────────────────────────
    # Caption must reference at least one tourism/hospitality keyword OR one of the
    # business's own categories to confirm the content is on-brand (FR3.25.3-R1).
    category_words: set[str] = set()
    for cat in (categories or []):
        category_words.update(_tokenize(cat))
    combined_tourism = _TOURISM_TERMS | category_words

    tourism_hits = len(tokens & combined_tourism)
    if tourism_hits >= 3:
        score += 20.0
    elif tourism_hits >= 1:
        score += 12.0
    log.debug("HCS rule1(tourism_align): hits=%d score_so_far=%.1f", tourism_hits, score)

    # ── Rule 2: Target-market cultural consistency (20 pts) ──────────────────
    # Caption should contain at least one culturally relevant signal for the
    # target market — validates market-specific localization (FR3.25.3-R2).
    signals = _MARKET_SIGNALS.get(market.lower(), [])
    market_hits = sum(1 for sig in signals if sig in lower)
    if market_hits >= 2:
        score += 20.0
    elif market_hits == 1:
        score += 12.0
    else:
        # Partial credit: market name itself mentioned
        if market.lower() in lower:
            score += 6.0
    log.debug("HCS rule2(market_consistency): hits=%d score_so_far=%.1f", market_hits, score)

    # ── Rule 3: Seasonal appropriateness (20 pts) ────────────────────────────
    # A Philippine tourism business should not use non-tropical seasonal language.
    # Full 20 pts for zero contradictions; 10 pts penalty per contradiction (FR3.25.3-R3).
    contradictions = sum(1 for term in _ANTI_TROPICAL if term in lower)
    if contradictions == 0:
        score += 20.0
    elif contradictions == 1:
        score += 10.0
    # 2+ contradictions → 0 pts
    log.debug("HCS rule3(seasonal_apt): contradictions=%d score_so_far=%.1f", contradictions, score)

    # ── Rule 4: Promotional tone conformity (15 pts) ─────────────────────────
    # Caption should include at least one CTA verb AND at least one positive
    # promotional adjective to confirm engagement-focused tone (FR3.25.3-R4).
    has_cta = any(p in lower for p in _CTA_PATTERNS)
    has_positive = any(p in lower for p in _POSITIVE_TERMS)
    if has_cta and has_positive:
        score += 15.0
    elif has_cta or has_positive:
        score += 8.0
    log.debug(
        "HCS rule4(promo_tone): has_cta=%s has_positive=%s score_so_far=%.1f",
        has_cta, has_positive, score,
    )

    # ── Rule 5: Recommendation adherence (15 pts) ────────────────────────────
    # Caption must carry at least one hashtag (platform discoverability) AND
    # fall within the recommended caption length 40–500 chars (FR3.25.3-R5).
    has_hashtag = bool(re.search(r"#\w+", caption))
    length = len(caption)
    good_length = 40 <= length <= 500

    if has_hashtag and good_length:
        score += 15.0
    elif has_hashtag or good_length:
        score += 8.0
    log.debug(
        "HCS rule5(rec_adherence): hashtag=%s length=%d good_len=%s score_so_far=%.1f",
        has_hashtag, length, good_length, score,
    )

    # ── Rule 6: Caption-visual consistency (10 pts) ──────────────────────────
    # When creative direction visual_tone is available, check lexical overlap
    # between the caption and the visual tone description — validates that the
    # written content aligns with the intended visual style (FR3.25.3-R6).
    if visual_tone:
        vt_tokens = set(_tokenize(visual_tone))
        overlap = len(tokens & vt_tokens)
        if overlap >= 3:
            score += 10.0
        elif overlap >= 1:
            score += 6.0
        else:
            score += 3.0  # visual tone present but unaligned — partial credit
    elif media_name:
        # Media was uploaded but no visual tone — caption has something to describe
        # Verify caption is substantive (not just emojis / numbers)
        word_tokens = [t for t in tokens if len(t) >= 3]
        if len(word_tokens) >= 5:
            score += 8.0
        elif len(word_tokens) >= 2:
            score += 4.0
    else:
        # No media, no visual tone — caption is text-only; 6/10 for simplicity
        word_tokens = [t for t in tokens if len(t) >= 3]
        score += 6.0 if len(word_tokens) >= 4 else 3.0

    log.debug("HCS rule6(caption_visual): score_so_far=%.1f", score)

    hcs = round(min(100.0, score), 2)
    log.info(
        "HCS computed: market=%s caption_len=%d hcs=%.1f",
        market, len(caption), hcs,
    )
    return hcs


def interpret_omcs(omcs: float) -> str:
    """Map OMCS to compliance threshold label (FR3.25.4)."""
    if omcs >= 90:
        return "Excellent Alignment"
    if omcs >= 80:
        return "High Compliance"
    if omcs >= 70:
        return "Moderate Revision Required"
    return "Significant Revision Required"


# ─── Private helpers ──────────────────────────────────────────────────────────

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
