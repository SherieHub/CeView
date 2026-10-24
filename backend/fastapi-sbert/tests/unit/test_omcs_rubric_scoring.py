"""OMCS rubric scoring: whole-number percentages, a mean total, and an OMCS that stays 0-100.

No model or network — only the pure scoring helpers.
"""
from app.agents.omcs_agent.node import (
    OMCS_PASS_THRESHOLD,
    RUBRIC_KEYS,
    _normalize_rubric,
    node_calculate_omcs,
)


def _scores(*values):
    return {"scores": dict(zip(RUBRIC_KEYS, values))}


def test_zero_to_one_scores_are_scaled_to_integer_percentages():
    scores, total = _normalize_rubric(_scores(0.85, 0.9, 0.6, 0.8, 0.95, 0.75, 0.8))
    assert scores["visual_business_context_match"] == 85
    assert scores["tone_visual_mood_alignment"] == 60
    assert all(isinstance(v, int) for v in scores.values())
    assert total == 81  # mean of the seven, not their 5.65 sum


def test_percentage_scores_pass_through():
    scores, total = _normalize_rubric(_scores(88, 82, 90, 79, 86, 84, 75))
    assert list(scores.values()) == [88, 82, 90, 79, 86, 84, 75]
    assert total == 83


def test_models_own_total_is_ignored():
    data = _scores(0.85, 0.9, 0.6, 0.8, 0.95, 0.75, 0.8)
    data["total"] = 5.65
    assert _normalize_rubric(data)[1] == 81


def test_out_of_range_values_are_clamped():
    scores, _ = _normalize_rubric(_scores(140, -5, 50, 50, 50, 50, 50))
    assert scores["visual_business_context_match"] == 100
    assert scores["visual_intent_consistency"] == 0


def test_missing_and_non_numeric_keys_are_skipped():
    data = {"scores": {"visual_business_context_match": 80, "platform_suitability": "n/a"}}
    scores, total = _normalize_rubric(data)
    assert scores == {"visual_business_context_match": 80}
    assert total == 80


def test_no_scores_gives_zero_total():
    assert _normalize_rubric({}) == ({}, 0)


def test_omcs_never_exceeds_100():
    out = node_calculate_omcs({
        "profile_semantic_score": 100,
        "recommendations_picture_score": 100,
        "pubmat_consistency_score": 100,
    })
    assert out["omcs_score"] == 100
    assert out["status"] == "Pass"


def test_omcs_uses_rubric_on_its_own_scale():
    out = node_calculate_omcs({
        "profile_semantic_score": 60,
        "recommendations_picture_score": 81,
        "pubmat_consistency_score": 80,
    })
    assert round(out["omcs_score"], 2) == round(0.35 * 60 + 0.45 * 81 + 0.20 * 80, 2)


def test_pass_threshold_boundary():
    at = node_calculate_omcs({
        "profile_semantic_score": OMCS_PASS_THRESHOLD,
        "recommendations_picture_score": OMCS_PASS_THRESHOLD,
        "pubmat_consistency_score": OMCS_PASS_THRESHOLD,
    })
    below = node_calculate_omcs({
        "profile_semantic_score": 69,
        "recommendations_picture_score": 69,
        "pubmat_consistency_score": 69,
    })
    assert at["status"] == "Pass"
    assert below["status"] == "Fail"
