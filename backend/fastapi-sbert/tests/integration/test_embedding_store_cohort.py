"""Category-filtered cohort in `fetch_others`, plus `fetch_cohort_stats`.

The screen says "against the local cohort in those categories." The old
`fetch_others` compared against *every* stored embedding regardless of
category — these tests run against the real seeded reference corpus (see
docs/superpowers/plans/2026-09-04-uniqueness-scoring-honesty/01-prerequisites.md
Tasks 2-3) to prove the query now matches that claim.

Needs a live Postgres with the corpus imported:
    cd backend && docker compose up -d
    cd backend/spring-boot && ./mvnw flyway:migrate
    psql "$DATABASE_URL" -f backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql

Skipped automatically (not failed) when DATABASE_URL is not set, e.g. in CI,
which deliberately does not run Postgres for this service.

Run with: pytest tests/integration/test_embedding_store_cohort.py -v
"""
from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set — needs a live Postgres with the seeded corpus imported",
)

# Fixed reference-corpus IDs seeded by V26 (see 01-prerequisites.md Task 2) —
# stable across machines because the whole point of the shared dump is that
# every developer imports the same rows under the same UUIDs.
ADVENTURE_AND_NATURE = "Adventure & Nature"           # dense: 12 seeded rows
ADVENTURE_MEMBER_ID = "25000000-0000-0000-0000-000000000013"
URBAN_AND_CITY = "Urban & City"                       # sparse: 5 seeded rows
CULTURAL_AND_HERITAGE = "Cultural & Heritage"         # moderate: 9 seeded rows


def _store():
    from app.services import embedding_store
    return embedding_store


def test_category_filter_returns_only_that_categorys_seeded_count():
    store = _store()

    results = store.fetch_others(categories=[ADVENTURE_AND_NATURE])

    assert len(results) == 12


def test_category_filter_excludes_the_callers_own_row():
    store = _store()

    results = store.fetch_others(
        exclude_profile_id=ADVENTURE_MEMBER_ID, categories=[ADVENTURE_AND_NATURE]
    )

    assert len(results) == 11


def test_category_filter_returns_a_different_count_for_a_different_category():
    store = _store()

    results = store.fetch_others(categories=[URBAN_AND_CITY])

    assert len(results) == 5


def test_empty_categories_preserves_the_old_unfiltered_behaviour():
    store = _store()

    filtered = store.fetch_others(categories=[ADVENTURE_AND_NATURE])
    unfiltered = store.fetch_others(categories=[])

    # The whole corpus is at least as large as any one category's slice, and
    # in this seeded corpus is strictly larger — proving no filter was applied.
    assert len(unfiltered) > len(filtered)


def test_reference_rows_are_included_in_the_cohort():
    """This is deliberately the one place `is_reference = TRUE` rows are
    wanted: an operator is compared against the Cebu market, not just their
    own tenant account. See 01-prerequisites.md's "open item for Dev B".
    """
    store = _store()

    results = store.fetch_others(categories=[ADVENTURE_AND_NATURE])

    # All 12 seeded Adventure & Nature rows are is_reference = TRUE; if they
    # were being excluded this would be empty (cohort floor not even met).
    assert len(results) == 12


# ── Task 8: cohort statistics ────────────────────────────────────────────────


def test_cohort_stats_reports_the_seeded_size():
    store = _store()

    stats = store.fetch_cohort_stats(categories=[ADVENTURE_AND_NATURE])

    assert stats["cohortSize"] == 12


def test_cohort_stats_excludes_the_callers_own_row_from_the_size():
    store = _store()

    stats = store.fetch_cohort_stats(
        categories=[ADVENTURE_AND_NATURE], exclude_profile_id=ADVENTURE_MEMBER_ID
    )

    assert stats["cohortSize"] == 11


def test_cohort_stats_flags_a_dense_category():
    """12 of 64 seeded rows (~19%) — one of the plan's three named-dense categories."""
    store = _store()

    stats = store.fetch_cohort_stats(categories=[ADVENTURE_AND_NATURE])

    assert stats["categoryDensity"] == "dense"


def test_cohort_stats_flags_a_sparse_category():
    """5 of 64 seeded rows (~8%) — one of the plan's two named-sparse categories."""
    store = _store()

    stats = store.fetch_cohort_stats(categories=[URBAN_AND_CITY])

    assert stats["categoryDensity"] == "sparse"


def test_cohort_stats_flags_a_moderate_category():
    """9 of 64 seeded rows (~14%) — one of the plan's two named-moderate categories."""
    store = _store()

    stats = store.fetch_cohort_stats(categories=[CULTURAL_AND_HERITAGE])

    assert stats["categoryDensity"] == "moderate"
