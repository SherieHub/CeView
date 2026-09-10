"""Percentile ranking replaces the unreachable 0.5-distance constant.

`min(mean_dist / 0.5, 1) x 100` assumes a mean cosine distance of 0.5 is
attainable. It is not — measured on the seeded corpus, within-category
distances run 0.08-0.16, capping every business in every category at roughly
16-32/100 (see docs/superpowers/plans/2026-09-04-uniqueness-scoring-honesty/
00-index.md). Ranking the candidate's distance against the cohort's own
internal distance distribution is self-calibrating.

All cohorts here are synthetic 2D unit vectors (cosine geometry does not care
about dimensionality), chosen so the expected percentile is known by
construction rather than by inspection — see the comment on each fixture.

Run with: pytest tests/unit/test_semantic_uniqueness.py -v
"""
from __future__ import annotations

import numpy as np
import pytest

from app.services.ml_classifier import SemanticUniqueness, compute_semantic_uniqueness


def _unit_vector(angle_degrees: float) -> list[float]:
    radians = np.radians(angle_degrees)
    return [float(np.cos(radians)), float(np.sin(radians))]


def _cohort(angles_degrees: list[float]) -> list[list[float]]:
    return [_unit_vector(a) for a in angles_degrees]


def test_returns_none_below_the_cohort_floor():
    result = compute_semantic_uniqueness(
        _unit_vector(0), _cohort([10, 20]), min_businesses=3
    )

    assert result is None


def test_candidate_further_than_every_cohort_member_scores_near_100():
    """A tight 5-member cluster (angles 0-20deg) has small mutual distances.

    A candidate on the opposite side of the circle (190deg) is further from
    every cohort member than any of them are from each other, so it exceeds
    every entry in the cohort's own distance distribution.
    """
    cohort = _cohort([0, 5, 10, 15, 20])
    candidate = _unit_vector(190)

    result = compute_semantic_uniqueness(candidate, cohort, min_businesses=3)

    assert isinstance(result, SemanticUniqueness)
    assert result.percentile == 100


def test_candidate_at_the_cohort_median_scores_near_50():
    """Seven members at irregular angles (no symmetric ties) spread their own
    mean-distance-to-the-rest values out. A candidate whose own mean distance
    to the cohort lands at that spread's median (not at any single member's
    position — matching a member exactly makes the candidate read as a near-
    duplicate, the case the previous test covers) ranks near the middle.
    """
    cohort = _cohort([0, 15, 40, 70, 95, 130, 160])
    candidate = _unit_vector(3)  # tuned so its mean distance sits at the cohort's own median

    result = compute_semantic_uniqueness(candidate, cohort, min_businesses=3)

    assert isinstance(result, SemanticUniqueness)
    assert 30 <= result.percentile <= 70, (
        f"expected a mid-range percentile, got {result.percentile}"
    )


def test_near_duplicate_of_the_cohort_scores_near_0():
    """5 members clustered tightly (0-20deg) plus one outlier (180deg).

    A candidate placed dead-center of the cluster is closer to the whole
    cohort, on average, than any actual cluster member is to the rest of the
    cohort (each member's own average still includes its own distance to the
    outlier) — so it ranks at the very bottom: least distinct.
    """
    cohort = _cohort([0, 5, 10, 15, 20, 180])
    candidate = _unit_vector(10)  # the cluster's own center

    result = compute_semantic_uniqueness(candidate, cohort, min_businesses=3)

    assert isinstance(result, SemanticUniqueness)
    assert result.percentile == 0


def test_full_0_to_100_range_is_reachable():
    """The regression this plan exists to fix: the old formula could not
    reach either end of the 0-100 scale on real-world same-domain distances.
    """
    cohort = _cohort([0, 5, 10, 15, 20])

    low = compute_semantic_uniqueness(_unit_vector(10), cohort, min_businesses=3)
    high = compute_semantic_uniqueness(_unit_vector(190), cohort, min_businesses=3)

    assert low.percentile < 10
    assert high.percentile > 90


def test_semantics_score_is_retained_for_continuity():
    """The raw pre-percentile figure still ships in the result — the contract
    carries both (00-index.md's frozen contract), even though only the
    percentile drives overallScore (Task 9).
    """
    cohort = _cohort([0, 5, 10, 15, 20])

    result = compute_semantic_uniqueness(_unit_vector(190), cohort, min_businesses=3)

    assert isinstance(result.semantics_score, float)
    assert 0.0 <= result.semantics_score <= 100.0


def test_cohort_scores_has_one_entry_per_cohort_member():
    """Task 8 derives cohortMedianScore from this list with no second pass —
    it must have exactly one entry per cohort member.
    """
    cohort = _cohort([0, 5, 10, 15, 20])

    result = compute_semantic_uniqueness(_unit_vector(190), cohort, min_businesses=3)

    assert len(result.cohort_scores) == len(cohort)
