"""Module 2 E2E, Step 5 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-04, H-33).

Real per-week statistics for a backfilled series, replacing the placeholder
0.5 seasonality / False spike / 0.0 std triple. compute_series() must reuse
compute() at every chronological prefix — known input, known per-week output,
including the truncated-window edge (an early point in a short series has a
narrower rolling window than a later one, and must say so via
stats_window_weeks).
"""
from app.services.seasonal_shift_detector import compute, compute_series


def test_stats_window_weeks_grows_with_the_prefix_no_look_ahead():
    series = [40.0, 42.0, 44.0, 46.0]
    points = compute_series(series)

    assert [p["stats_window_weeks"] for p in points] == [1, 2, 3, 4]


def test_each_point_matches_calling_compute_on_its_own_prefix():
    # Known input -> known output: compute_series must be exactly compute()
    # applied at every prefix, not a separate/approximate implementation.
    series = [40.0, 50.0, 45.0, 60.0, 55.0]
    points = compute_series(series)

    for i in range(len(series)):
        expected = compute(series[: i + 1])
        expected.pop("computed_at")
        assert points[i] == expected


def test_a_short_series_has_a_genuinely_truncated_window_not_a_full_one():
    # Only 3 real weeks exist — nowhere near the 7-period window compute()
    # normally uses, so this point's rolling_7d_avg is a 3-week mean, and
    # stats_window_weeks must say 3, not 7.
    series = [30.0, 60.0, 90.0]
    points = compute_series(series)
    last = points[-1]

    assert last["stats_window_weeks"] == 3
    assert last["rolling_7d_avg"] == round(sum(series) / 3, 4)


def test_no_row_is_left_at_the_old_placeholder_values():
    # The literal triple backfillHistory used to hardcode for every row.
    series = [41.0, 39.0, 44.0, 43.0, 40.0, 42.0]
    points = compute_series(series)

    for p in points:
        assert not (p["seasonality_score"] == 0.5 and p["spike_indicator"] is False
                    and p["rolling_7d_std"] == 0.0)


def test_yoy_ratio_is_null_below_fifty_nine_weeks_and_present_at_it():
    short_series = [50.0] * 30
    long_series = [50.0] * 58 + [70.0]   # 59th point — meets MIN_HISTORY_FOR_YOY

    short_points = compute_series(short_series)
    long_points = compute_series(long_series)

    assert all(p["yoy_ratio"] is None for p in short_points)
    assert long_points[-1]["yoy_ratio"] is not None
    assert long_points[-1]["stats_window_weeks"] == 59


def test_empty_series_returns_no_points():
    assert compute_series([]) == []


def test_imputed_flags_prevent_an_interior_prefixs_own_current_week_from_spiking():
    # Week 2 (index 1) is a huge outlier but flagged imputed — at THAT prefix it
    # is the "current" week, so it must not itself register as a spike.
    series = [50.0, 95.0, 50.0]
    flags = [False, True, False]
    points = compute_series(series, flags)

    assert points[1]["spike_indicator"] is False
