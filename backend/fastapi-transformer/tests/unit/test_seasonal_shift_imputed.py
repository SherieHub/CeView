"""Module 2 E2E, Step 4 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-03).

The gap policy's imputed flag must make a real difference: a spike can only be
confirmed by a REAL current-week measurement, never by an interior linear
interpolation MarketDataIngestionService's WeeklySeriesGapFiller produced.
Rolling means/std/YoY still consume every point (real or imputed) — only the
spike gate on the CURRENT point changes.
"""
from app.services import seasonal_shift_detector as detector


def _rising_series_with_a_spike_at_the_end():
    # 10 stable weeks, then a clear breakout on the last week.
    return [50.0] * 10 + [95.0]


def test_a_real_current_week_can_confirm_a_spike():
    series = _rising_series_with_a_spike_at_the_end()
    result = detector.compute(series, imputed_flags=[False] * len(series))
    assert result["spike_indicator"] is True


def test_an_imputed_current_week_can_never_confirm_a_spike():
    series = _rising_series_with_a_spike_at_the_end()
    flags = [False] * (len(series) - 1) + [True]   # only the LAST week is imputed
    result = detector.compute(series, imputed_flags=flags)
    assert result["spike_indicator"] is False


def test_no_flags_behaves_exactly_as_before_the_gap_policy():
    series = _rising_series_with_a_spike_at_the_end()
    with_none = detector.compute(series, imputed_flags=None)
    with_empty = detector.compute(series, imputed_flags=[])
    without_arg = detector.compute(series)
    assert with_none["spike_indicator"] == with_empty["spike_indicator"] == without_arg["spike_indicator"] is True


def test_an_imputed_interior_week_still_counts_toward_rolling_stats():
    # An interior imputed point contributes to the rolling mean/std exactly like
    # a real one would — imputed_flags only gates spike_indicator on the CURRENT
    # (last) point, never the arithmetic over earlier weeks. No spike anywhere
    # in this series, so both variants must agree on every field.
    series = [50.0, 52.0, 48.0, 51.0, 49.0, 50.0, 53.0]
    flagged_interior = detector.compute(
        series, imputed_flags=[False, False, True, False, False, False, False])
    unflagged = detector.compute(series)

    assert flagged_interior["rolling_7d_avg"] == unflagged["rolling_7d_avg"]
    assert flagged_interior["rolling_7d_std"] == unflagged["rolling_7d_std"]
    assert flagged_interior["spike_indicator"] == unflagged["spike_indicator"] is False
