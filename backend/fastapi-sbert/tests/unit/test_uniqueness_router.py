"""Composite fix (Task 9) and explicit insufficient-cohort state (Task 10).

`overallScore = round((categoryScore + semanticsScore) / 2)` is half
tautology: `categoryScore` averages normalised allocation shares that sum to
100 across the selected set, so keeping one chip yields ~100 and keeping
three yields ~33 each — half the headline number measured how many chips the
operator left selected, not distinctiveness. These tests pin the fix
(`overallScore == semanticPercentile`, chip count no longer moves it) and the
insufficient-cohort state (no fabricated 100 below the cohort floor).

Deliberately asserts PRESENCE and INVARIANTS, not exact copy — 00-index.md's
frozen contract fixes the shape, not the wording of the feedback strings.

Run with: pytest tests/unit/test_uniqueness_router.py -v
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.services.ml_classifier import SemanticUniqueness


@pytest.fixture()
def client():
    with patch("app.core.BertModel._BertModel.get"):
        from app.main import app

        with TestClient(app) as c:
            yield c


REQUEST_BODY = {
    "businessProfileId": "11111111-1111-1111-1111-111111111111",
    "businessName": "Test Dive Shop",
    "categories": ["Coastal & Island"],
    "coreServices": ["Diving"],
    "description": "A dive shop.",
    "uvp": "Certified instructors.",
}


def _post(client, **overrides):
    body = {**REQUEST_BODY, **overrides}
    return client.post("/internal/classification/uniqueness", json=body)


def test_overall_score_is_unaffected_by_how_many_categories_are_selected(client):
    """The whole point of Task 9: chip selection must not move the headline number."""
    fixed_result = SemanticUniqueness(semantics_score=37.0, percentile=68, cohort_scores=[41.0])

    with patch("app.services.ml_classifier.embed_business", return_value=[0.1] * 768), \
         patch("app.services.ml_classifier.compute_semantic_uniqueness", return_value=fixed_result), \
         patch("app.services.embedding_store.fetch_others", return_value=[[0.1] * 768] * 5), \
         patch("app.services.embedding_store.fetch_cohort_stats",
               return_value={"cohortSize": 5, "categoryDensity": "moderate"}), \
         patch("app.services.hf_space_classifier.category_score", side_effect=[100.0, 33.3]):

        one_category = _post(client, categories=["Coastal & Island"]).json()
        three_categories = _post(
            client, categories=["Coastal & Island", "Adventure & Nature", "Culinary & Gastronomy"]
        ).json()

    # categoryScore genuinely differs (the mock proves the two calls were distinct)…
    assert one_category["categoryScore"] != three_categories["categoryScore"]
    # …but overallScore does not move at all.
    assert one_category["overallScore"] == three_categories["overallScore"] == 68


def test_overall_score_equals_the_semantic_percentile_not_an_average(client):
    result = SemanticUniqueness(semantics_score=37.0, percentile=68, cohort_scores=[41.0, 50.0])

    with patch("app.services.ml_classifier.embed_business", return_value=[0.1] * 768), \
         patch("app.services.ml_classifier.compute_semantic_uniqueness", return_value=result), \
         patch("app.services.embedding_store.fetch_others", return_value=[[0.1] * 768] * 5), \
         patch("app.services.embedding_store.fetch_cohort_stats",
               return_value={"cohortSize": 5, "categoryDensity": "moderate"}), \
         patch("app.services.hf_space_classifier.category_score", return_value=100.0):

        body = _post(client).json()

    assert body["overallScore"] == 68
    assert body["semanticPercentile"] == 68
    assert body["semanticsScore"] == 37
    assert body["sufficientCohort"] is True
    assert body["cohortMedianScore"] == round((41.0 + 50.0) / 2)


def test_insufficient_cohort_returns_explicit_state_not_a_silent_100(client):
    """A cohort of two is a VALID response, not an error — never a fabricated 100."""
    with patch("app.services.ml_classifier.embed_business", return_value=[0.1] * 768), \
         patch("app.services.ml_classifier.compute_semantic_uniqueness", return_value=None), \
         patch("app.services.embedding_store.fetch_others", return_value=[[0.1] * 768] * 2), \
         patch("app.services.embedding_store.fetch_cohort_stats",
               return_value={"cohortSize": 2, "categoryDensity": "sparse"}), \
         patch("app.services.hf_space_classifier.category_score", return_value=100.0):

        body = _post(client).json()

    assert body["sufficientCohort"] is False
    assert body["overallScore"] != 100
    assert body["cohortSize"] == 2


def test_feedback_fields_are_populated_and_differ_by_outcome(client):
    """Task 10 Step 3 — no longer permanently empty, and not identical between
    a strong and a weak result (proof they are actually derived, not static).
    """
    strong = SemanticUniqueness(semantics_score=80.0, percentile=90, cohort_scores=[30.0, 35.0])
    weak = SemanticUniqueness(semantics_score=10.0, percentile=5, cohort_scores=[30.0, 35.0])

    with patch("app.services.ml_classifier.embed_business", return_value=[0.1] * 768), \
         patch("app.services.embedding_store.fetch_others", return_value=[[0.1] * 768] * 5), \
         patch("app.services.embedding_store.fetch_cohort_stats",
               return_value={"cohortSize": 5, "categoryDensity": "moderate"}), \
         patch("app.services.hf_space_classifier.category_score", return_value=100.0):

        with patch("app.services.ml_classifier.compute_semantic_uniqueness", return_value=strong):
            strong_body = _post(client).json()
        with patch("app.services.ml_classifier.compute_semantic_uniqueness", return_value=weak):
            weak_body = _post(client).json()

    assert strong_body["descriptionFeedback"] != ""
    assert weak_body["descriptionFeedback"] != ""
    assert strong_body["descriptionFeedback"] != weak_body["descriptionFeedback"]
    assert strong_body["categoryFeedback"] != ""


@pytest.mark.parametrize(
    "percentile,suffix",
    [(1, "1st"), (2, "2nd"), (3, "3rd"), (4, "4th"), (11, "11th"), (12, "12th"),
     (13, "13th"), (21, "21st"), (92, "92nd"), (100, "100th")],
)
def test_description_feedback_uses_correct_ordinal_suffixes(client, percentile, suffix):
    result = SemanticUniqueness(semantics_score=50.0, percentile=percentile, cohort_scores=[50.0])

    with patch("app.services.ml_classifier.embed_business", return_value=[0.1] * 768), \
         patch("app.services.ml_classifier.compute_semantic_uniqueness", return_value=result), \
         patch("app.services.embedding_store.fetch_others", return_value=[[0.1] * 768] * 5), \
         patch("app.services.embedding_store.fetch_cohort_stats",
               return_value={"cohortSize": 5, "categoryDensity": "moderate"}), \
         patch("app.services.hf_space_classifier.category_score", return_value=100.0):

        body = _post(client).json()

    assert suffix in body["descriptionFeedback"], (
        f"expected '{suffix}' in feedback for percentile {percentile}, "
        f"got: {body['descriptionFeedback']!r}"
    )


def test_raises_when_the_embedding_model_is_unavailable(client):
    """The router now calls embed_business itself (Task 6 made the scoring
    function pure). A model failure must be a loud 503, never silently
    treated as an insufficient cohort or a fabricated score.
    """
    with patch("app.services.ml_classifier.embed_business", return_value=None):
        response = _post(client)

    assert response.status_code == 503
