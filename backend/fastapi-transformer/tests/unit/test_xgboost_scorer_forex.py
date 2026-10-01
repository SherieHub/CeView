"""Module 2 E2E, Step 3 (docs/module-2/MODULE_2_E2E_CONTRACT.md §1; C-05, T-07).

forex_vs_php is now PHP per 1 unit of foreign currency (canonical). The three
tracked markets' canonical rates span three orders of magnitude purely from
currency denomination (korea ~0.04, japan ~0.38, usa ~57-58), so the old linear
`forex_vs_php / 60.0` normalisation collapsed KRW and JPY toward zero just as
badly as it used to collapse USD under the pre-canonical unit. These tests
prove the log-scale replacement gives all three a sane, non-degenerate
purchasing-power component.
"""
from app.services.xgboost_scorer import _feature_vector, _forex_norm, score

BASE_FEATURES = {
    "predicted_demand": 60.0,
    "seasonality_score": 0.6,
    "spike_indicator": False,
    "direct_flight": True,
    "distance_km": 2500,
    "flight_frequency": 10,
}

# Canonical PHP-per-1-foreign-unit readings for the three tracked markets.
KRW_FOREX = 0.0416
JPY_FOREX = 0.38
USD_FOREX = 57.6


def test_usd_no_longer_scores_near_zero():
    result = score({**BASE_FEATURES, "gdp_growth": 2.5, "forex_vs_php": USD_FOREX})
    assert result["components"]["economic_component"] > 0.5


def test_krw_produces_a_sane_non_degenerate_component():
    result = score({**BASE_FEATURES, "gdp_growth": 2.1, "forex_vs_php": KRW_FOREX})
    assert 0.1 < result["economic_viability_score"] < 0.9


def test_jpy_produces_a_sane_non_degenerate_component():
    result = score({**BASE_FEATURES, "gdp_growth": 0.9, "forex_vs_php": JPY_FOREX})
    assert 0.1 < result["economic_viability_score"] < 0.9


def test_all_three_markets_rank_in_the_direction_of_the_canonical_rate():
    # A stronger canonical PHP-per-unit rate is a stronger currency, so the
    # ordering usa > japan > korea should hold on the forex component alone.
    krw = _forex_norm(KRW_FOREX)
    jpy = _forex_norm(JPY_FOREX)
    usd = _forex_norm(USD_FOREX)

    assert 0.0 < krw < jpy < usd < 1.0


def test_market_score_is_finite_and_bounded_for_every_currency():
    for forex in (KRW_FOREX, JPY_FOREX, USD_FOREX):
        result = score({**BASE_FEATURES, "gdp_growth": 2.0, "forex_vs_php": forex})
        assert 0.0 <= result["market_score"] <= 1.0
        assert 0.0 <= result["economic_viability_score"] <= 1.0


def test_score_identifies_the_scorer_that_actually_ran():
    result = score({**BASE_FEATURES, "gdp_growth": 2.0, "forex_vs_php": USD_FOREX})
    assert result["scorer"] in {"xgboost", "linear"}


def test_zero_or_negative_forex_is_never_inverted_into_a_fabricated_score():
    assert _forex_norm(0.0) == 0.0
    assert _forex_norm(-5.0) == 0.0


def test_feature_vector_places_forex_norm_second():
    vector = _feature_vector({**BASE_FEATURES, "gdp_growth": 2.0, "forex_vs_php": USD_FOREX})
    assert vector[1] == _forex_norm(USD_FOREX)
