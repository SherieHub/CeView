from unittest.mock import Mock, patch

import pytest

from app.services import hf_space_classifier
from app.unavailable import DependencyUnavailable


def test_predict_categories_calls_the_documented_space_endpoint(monkeypatch):
    client = Mock()
    client.predict.return_value = (
        "Coastal & Island, Adventure & Nature, Accommodation & Staycation",
        "0.80, 0.15, 0.05",
    )
    monkeypatch.setenv("HF_SPACE_ID", "JamJamzz/ceview_sbert")
    monkeypatch.delenv("HF_TOKEN", raising=False)

    with patch("app.services.hf_space_classifier.Client", return_value=client) as client_type:
        result = hf_space_classifier.predict_categories(
            "A dive shop in Moalboal.",
            "Small groups with local guides.",
            ["Scuba diving", "Snorkeling"],
        )

    client_type.assert_called_once_with(
        "JamJamzz/ceview_sbert", token=None, verbose=False
    )
    client.predict.assert_called_once_with(
        description="A dive shop in Moalboal.",
        uvp="Small groups with local guides.",
        services="Scuba diving, Snorkeling",
        api_name="/predict_gradio",
    )
    assert result == [
        {"name": "Coastal & Island", "percentage": 80},
        {"name": "Adventure & Nature", "percentage": 15},
        {"name": "Accommodation & Staycation", "percentage": 5},
    ]


def test_predict_categories_rejects_mismatched_space_output():
    with pytest.raises(DependencyUnavailable, match="invalid response"):
        hf_space_classifier._to_allocations("Coastal & Island", "0.8, 0.2")


def test_predict_categories_uses_selected_category_scores_from_full_space_output():
    result = hf_space_classifier._to_allocations(
        "Coastal & Island, Adventure & Nature",
        "Coastal & Island: 0.9999779462814331\n"
        "Adventure & Nature: 0.8891581892967224\n"
        "Cultural & Heritage: 0.0032466796692460775\n"
        "Theme Parks / Entertainment: 0.0026977204252034426\n"
        "Urban & City: 0.046709828078746796\n"
        "Culinary & Gastronomy: 0.0003354674845468253\n"
        "Accommodation & Staycation: 0.0004866110684815794\n"
        "OUT_OF_SCOPE: 3.2888291912058776e-07",
    )

    assert result == [
        {"name": "Coastal & Island", "percentage": 53},
        {"name": "Adventure & Nature", "percentage": 47},
    ]


def test_selects_two_categories_when_two_scores_are_balanced():
    assert hf_space_classifier._to_allocations(
        "ignored", "Coastal & Island: 50\nAdventure & Nature: 50"
    ) == [
        {"name": "Coastal & Island", "percentage": 50},
        {"name": "Adventure & Nature", "percentage": 50},
    ]


def test_selects_three_categories_when_each_has_at_least_twenty_percent():
    assert hf_space_classifier._to_allocations(
        "ignored",
        "Coastal & Island: 60\nAdventure & Nature: 20\nCultural & Heritage: 20",
    ) == [
        {"name": "Coastal & Island", "percentage": 60},
        {"name": "Adventure & Nature", "percentage": 20},
        {"name": "Cultural & Heritage", "percentage": 20},
    ]


def test_selects_one_category_when_all_other_scores_are_zero():
    assert hf_space_classifier._to_allocations(
        "ignored",
        "Coastal & Island: 100\nAdventure & Nature: 0\nCultural & Heritage: 0",
    ) == [{"name": "Coastal & Island", "percentage": 100}]


def test_keeps_only_top_three_categories_when_scores_are_balanced():
    assert hf_space_classifier._to_allocations(
        "ignored",
        "Coastal & Island: 30\nAdventure & Nature: 30\nCultural & Heritage: 30\nUrban & City: 10",
    ) == [
        {"name": "Coastal & Island", "percentage": 33},
        {"name": "Adventure & Nature", "percentage": 33},
        {"name": "Cultural & Heritage", "percentage": 34},
    ]


def test_out_of_scope_overrides_categories_when_its_raw_score_exceeds_threshold():
    assert hf_space_classifier._to_allocations(
        "ignored",
        "Coastal & Island: 0.9\nAdventure & Nature: 0.8\nOUT_OF_SCOPE: 0.76",
    ) == [{"name": "OUT_OF_SCOPE", "percentage": 100}]


def test_out_of_scope_at_threshold_does_not_override_categories():
    assert hf_space_classifier._to_allocations(
        "ignored",
        "Coastal & Island: 1\nAdventure & Nature: 0.5\nOUT_OF_SCOPE: 0.75",
    ) == [
        {"name": "Coastal & Island", "percentage": 67},
        {"name": "Adventure & Nature", "percentage": 33},
    ]


def test_falls_back_to_the_highest_category_when_none_reach_twenty_percent():
    assert hf_space_classifier._to_allocations(
        "ignored",
        "Coastal & Island: 1\nAdventure & Nature: 1\nCultural & Heritage: 1\n"
        "Urban & City: 1\nCulinary & Gastronomy: 1\nAccommodation & Staycation: 1",
    ) == [{"name": "Coastal & Island", "percentage": 100}]


def test_category_score_uses_the_selected_space_categories(monkeypatch):
    monkeypatch.setattr(
        hf_space_classifier,
        "predict_categories",
        lambda *_args: [
            {"name": "Coastal & Island", "percentage": 80},
            {"name": "Adventure & Nature", "percentage": 20},
        ],
    )

    assert hf_space_classifier.category_score(
        "description", "uvp", ["diving"], ["Coastal & Island", "Adventure & Nature"]
    ) == 50.0
