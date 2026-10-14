"""OMCS profile-match score (replaces the hardcoded 85.5 stub).

The logic tests use a fake encoder so they need no model download. The final
test uses the real encoder and skips when it cannot load — it pins the
calibration in ``app/services/profile_alignment.py``.
"""
from __future__ import annotations

import asyncio
import math

import pytest

from app import errors
from app.agents.omcs_agent import node
from app.core.BertModel import _BertModel
from app.services import omcs_analysis, profile_alignment
from app.services.profile_alignment import COS_CEIL, COS_FLOOR, profile_alignment_score, rescale
from app.unavailable import DependencyUnavailable

PROFILE = {
    "core_services": ["Freediving courses", "Sardine run snorkeling"],
    "uvp": "Certified freediving instruction on the Moalboal reef wall",
    "business_description": "Dive shop on the Moalboal coast.",
}


_RECS = {"visual_guide": ["Use warm light"]}


class _FakeEncoder:
    """Returns two unit vectors whose cosine is exactly ``cosine``."""

    def __init__(self, cosine: float) -> None:
        self.cosine = cosine
        self.texts: list[str] = []

    def encode(self, texts, normalize_embeddings=True):
        self.texts = list(texts)
        return [[1.0, 0.0], [self.cosine, math.sqrt(1 - self.cosine ** 2)]]


class _FakeBert:
    def __init__(self, cosine: float) -> None:
        self.encoder = _FakeEncoder(cosine)


def _use_cosine(monkeypatch, cosine: float) -> _FakeBert:
    bert = _FakeBert(cosine)
    monkeypatch.setattr(profile_alignment._BertModel, "get", classmethod(lambda cls: bert))
    return bert


def test_rescale_maps_floor_to_zero_and_ceiling_to_hundred():
    assert rescale(COS_FLOOR) == 0.0
    assert rescale(COS_CEIL) == 100.0
    assert rescale((COS_FLOOR + COS_CEIL) / 2) == 50.0


def test_rescale_clamps_outside_the_calibrated_range():
    assert rescale(COS_FLOOR - 0.2) == 0.0
    assert rescale(1.0) == 100.0


def test_score_follows_cosine_and_is_not_a_constant(monkeypatch):
    scores = []
    for cosine in (0.70, 0.78, 0.82, 0.90):
        _use_cosine(monkeypatch, cosine)
        scores.append(profile_alignment_score(PROFILE, "any caption"))
    assert scores == sorted(scores)
    assert len(set(scores)) > 1
    assert 85.5 not in scores


def test_both_sides_carry_the_e5_query_prefix(monkeypatch):
    bert = _use_cosine(monkeypatch, 0.8)
    profile_alignment_score(PROFILE, "Dive the reef wall")
    profile_text, caption_text = bert.encoder.texts
    assert profile_text.startswith("query: services: Freediving courses, Sardine run snorkeling")
    assert caption_text == "query: Dive the reef wall"


def test_core_services_may_arrive_as_a_comma_separated_string(monkeypatch):
    bert = _use_cosine(monkeypatch, 0.8)
    profile_alignment_score({**PROFILE, "core_services": "Freediving courses, Night dives"}, "x")
    assert "services: Freediving courses, Night dives" in bert.encoder.texts[0]


@pytest.mark.parametrize("profile", [None, {}, {"business_name": "Only a name"},
                                      {"core_services": [], "uvp": "  ", "business_description": ""}])
def test_profile_without_text_raises_instead_of_inventing_a_score(monkeypatch, profile):
    _use_cosine(monkeypatch, 0.8)
    with pytest.raises(DependencyUnavailable) as excinfo:
        profile_alignment_score(profile, "caption")
    assert excinfo.value.code == errors.MOD33_PROFILE_MISSING
    assert excinfo.value.status_code == 503


def test_missing_encoder_raises_instead_of_inventing_a_score(monkeypatch):
    monkeypatch.setattr(profile_alignment._BertModel, "get", classmethod(lambda cls: None))
    with pytest.raises(DependencyUnavailable) as excinfo:
        profile_alignment_score(PROFILE, "caption")
    assert excinfo.value.code == errors.MOD33_PROFILE_ENCODER_UNAVAILABLE


def test_node_uses_the_computed_score(monkeypatch):
    state = {"caption": "c", "business_profile": PROFILE}
    _use_cosine(monkeypatch, 0.70)
    low = node.node_profile_diff(state)["profile_semantic_score"]
    _use_cosine(monkeypatch, 0.90)
    high = node.node_profile_diff(state)["profile_semantic_score"]
    assert low < high
    assert 85.5 not in (low, high)


def test_node_with_no_business_profile_key_raises():
    with pytest.raises(DependencyUnavailable) as excinfo:
        node.node_profile_diff({"caption": "c"})
    assert excinfo.value.code == errors.MOD33_PROFILE_MISSING


def test_omcs_calculation_keeps_the_specific_503_code(monkeypatch):
    class _Graph:
        async def ainvoke(self, _state):
            raise DependencyUnavailable(
                code=errors.MOD33_PROFILE_MISSING, message="m", dependency="d", cause="c", stage="s",
            )

    monkeypatch.setattr(omcs_analysis, "omcs_graph", _Graph())
    from app.model.ComplianceScoreInputClass import ComplianceInputClass

    with pytest.raises(DependencyUnavailable) as excinfo:
        asyncio.run(omcs_analysis.omcs_calculation(ComplianceInputClass(caption="c", image_url="u", recommendations=_RECS)))
    assert excinfo.value.code == errors.MOD33_PROFILE_MISSING


def test_endpoint_returns_503_with_the_profile_code_when_no_profile_is_sent():
    from fastapi.testclient import TestClient
    from app.main import app

    response = TestClient(app).post(
        "/internal/omcs/analyze",
        json={"caption": "c", "image_url": "https://example.invalid/x.jpg", "recommendations": _RECS},
    )
    assert response.status_code == 503
    assert response.json()["code"] == errors.MOD33_PROFILE_MISSING


# ── Calibration (real encoder) ───────────────────────────────────────────────

_REEF_SHOP = {
    "core_services": ["Freediving certification courses", "Guided sardine run snorkeling"],
    "uvp": "The only Moalboal operator pairing certified freediving instruction with guided sardine-run trips",
    "business_description": "A family-run dive and freediving outfit working the reef wall off Moalboal.",
}
_ON_BRAND = "Float over the reef wall at sunrise and swim through a swirling sardine ball. Book a small-group freedive with our certified instructors."
_OFF_BRAND = "Crackling lechon, charcoal-grilled seafood and sweet mango dessert at our family-run kitchen."
_UNRELATED = "Huge sale on running shoes this weekend, 50% off all sneakers in store."


@pytest.mark.skipif(_BertModel.get() is None, reason="E5 encoder unavailable (offline)")
def test_calibration_separates_on_brand_from_off_brand_and_unrelated():
    on = profile_alignment_score(_REEF_SHOP, _ON_BRAND)
    off = profile_alignment_score(_REEF_SHOP, _OFF_BRAND)
    unrelated = profile_alignment_score(_REEF_SHOP, _UNRELATED)
    assert on > off > unrelated
    assert on >= 50
    assert unrelated <= 15
