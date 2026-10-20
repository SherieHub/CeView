"""OMCS profile-match score: how well a caption reflects the business behind it.

Feeds ``profile_semantic_score`` (weight 0.35 of the OMCS composite). The
profile (services, UVP, description) and the caption are embedded with the same
``intfloat/multilingual-e5-base`` encoder used for uniqueness scoring, and the
cosine similarity is rescaled to 0-100.

Rescaling: E5 cosines sit in a narrow band on same-domain text (see the
``ml_classifier`` module docstring), so raw cosine x 100 would score almost
everything the same. ``COS_FLOOR`` maps to 0 and ``COS_CEIL`` to 100.

Calibration (measured, 7 seeded Cebu profiles from scripts/mock-data/corpus.py x
21 hand-written captions: 7 categories x English / Korean / Japanese):

    caption vs its own business     mean 0.824  (EN 0.852, KR 0.804, JP 0.816)  p90 0.861
    caption vs another business     mean 0.789  p90 0.811
    off-topic caption (shoes, tax)  mean 0.759  p90 0.776
    own business ranked 1st of 7    17 of 21 captions (mean rank 1.24); the misses are
                                    neighbouring concepts (Adventure/Heritage, Park/Urban)

COS_FLOOR 0.75 sits at the off-topic mean; COS_CEIL 0.86 at the on-brand p90.
That puts a typical on-brand caption near 65, a caption written for a different
business near 35 and unrelated copy near 0. The signal is real but coarse: it
separates on-brand from off-brand, not two similar businesses. Korean captions
score a little lower than English ones against English profile text, so callers
pass the English translation (``caption_en``) when they have one. Re-measure
if ``ml_classifier._build_text`` or the encoder changes.

Unavailability: with no encoder, or a profile that has no text to compare, this
raises ``DependencyUnavailable`` (503). A made-up score would be
indistinguishable from a measured one once it is folded into the OMCS total.
"""
from __future__ import annotations

import logging

from app import errors
from app.core.BertModel import _BertModel
from app.services.ml_classifier import E5_QUERY_PREFIX, _build_text
from app.unavailable import DependencyUnavailable

log = logging.getLogger("module3.omcs.profile")

COS_FLOOR = 0.75
COS_CEIL = 0.86

_STAGE = "fastapi-sbert/omcs_agent.profile_alignment"


def _as_list(value: object) -> list[str]:
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [part.strip() for part in value.split(",") if part.strip()]
    return []


def profile_text(business_profile: dict) -> str | None:
    """E5 text for the profile, or None when it carries nothing to compare."""
    services = _as_list(business_profile.get("core_services"))
    uvp = str(business_profile.get("uvp") or "").strip()
    description = str(business_profile.get("business_description") or "").strip()
    if not (services or uvp or description):
        return None
    return _build_text(services, uvp, description)


def rescale(cosine: float) -> float:
    """Map a raw cosine onto 0-100 using the calibrated floor/ceiling."""
    scaled = (cosine - COS_FLOOR) / (COS_CEIL - COS_FLOOR)
    return round(max(0.0, min(1.0, scaled)) * 100.0, 1)


def profile_alignment_score(business_profile: dict, caption: str) -> float:
    """0-100 alignment between the business profile and ``caption``."""
    text = profile_text(business_profile or {})
    if text is None:
        raise DependencyUnavailable(
            code=errors.MOD33_PROFILE_MISSING,
            message="The compliance audit needs the business profile to score the caption.",
            dependency="business_profile",
            cause="the business profile has no services, UVP or description to compare against",
            stage=_STAGE,
        )

    bert = _BertModel.get()
    if bert is None:
        raise DependencyUnavailable(
            code=errors.MOD33_PROFILE_ENCODER_UNAVAILABLE,
            message="The compliance audit could not score the caption against the business profile.",
            dependency="e5_encoder",
            cause="the multilingual-e5 encoder failed to load",
            stage=_STAGE,
        )

    vectors = bert.encoder.encode(
        [text, f"{E5_QUERY_PREFIX}{caption}"], normalize_embeddings=True
    )
    cosine = float(sum(float(a) * float(b) for a, b in zip(vectors[0], vectors[1])))
    score = rescale(cosine)
    log.info("omcs.profile_alignment cosine=%.4f score=%.1f", cosine, score)
    return score
