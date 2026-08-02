"""Example pure unit test — no FastAPI app import, no model loading.

Pattern to copy: test a pure function directly. app.services.pes_compute_service
has no heavy dependencies (no tensorflow/sentence-transformers), so this runs
fast with just the base requirements installed.

Run with: pytest tests/unit -v
"""
from app.services.pes_compute_service import compute_base_metrics, normalize_and_invert, compute_pes


def test_compute_pes_returns_excellent_for_strong_metrics():
    metrics, flagged = compute_base_metrics(
        impressions=10_000,
        clicks=1_000,
        ad_spend=1_000.0,
        revenue=8_000.0,
        conversions=150,
        bookings=150,
        new_customers=1_000,
    )
    assert flagged == []

    normalized, effective_weights = normalize_and_invert(metrics, flagged)
    result = compute_pes(normalized, effective_weights)

    assert result.label == "Excellent Performance"
    assert 0.0 <= result.score <= 1.0
    assert len(result.breakdown) == 5


def test_compute_base_metrics_flags_zero_denominators():
    metrics, flagged = compute_base_metrics(
        impressions=0,
        clicks=0,
        ad_spend=0.0,
        revenue=0.0,
        conversions=0,
        bookings=0,
        new_customers=0,
    )

    assert metrics["CTR"] == 0.0
    assert "CTR (impressions = 0)" in flagged
    assert "CAC (newCustomers = 0)" in flagged
