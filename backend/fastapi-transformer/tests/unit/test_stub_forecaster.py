from __future__ import annotations

from copy import deepcopy

from app.services import stub_forecaster
from tests.unit.test_forecasting_contract import sequence_payload


def test_contract_shape_and_mean_invariants():
    result = stub_forecaster.forecast(sequence_payload())
    assert result["source"] == "stub-v1"
    assert len(result["weekly_forecasts"]) == 12
    assert all(0.0 <= value <= 100.0 for value in result["weekly_forecasts"])
    assert result["predicted_demand_4w"] == sum(result["weekly_forecasts"][:4]) / 4.0
    assert result["predicted_demand_12w"] == sum(result["weekly_forecasts"]) / 12.0


def test_is_deterministic_and_clamps_extreme_projection():
    request = sequence_payload()
    for index, row in enumerate(request["sequence"]):
        row["trendIndex"] = 98.0 + index
    first = stub_forecaster.forecast(request)
    second = stub_forecaster.forecast(deepcopy(request))
    assert first == second
    assert all(0.0 <= value <= 100.0 for value in first["weekly_forecasts"])


def test_honest_backtest_scores_known_constant_series():
    request = sequence_payload()
    for row in request["sequence"]:
        row["trendIndex"] = 50.0
        row["seasonalityScore"] = 0.5
    result = stub_forecaster.forecast(request)
    assert result["mape"] == 0.0
    assert result["mae"] == 0.0
    assert result["rmse"] == 0.0
    assert result["passed"] is True


def test_too_short_history_returns_null_metrics_and_low_confidence():
    request = sequence_payload()
    request["sequence"] = request["sequence"][:4]
    request["imputedMask"] = request["imputedMask"][:4]
    result = stub_forecaster.forecast(request)
    assert (result["mape"], result["mae"], result["rmse"]) == (None, None, None)
    assert result["low_confidence_disclaimer"] is True
    assert result["passed"] is False


def test_batch_returns_each_market():
    requests = []
    for market in ("korea", "japan", "usa"):
        request = sequence_payload()
        request["market"] = market
        requests.append(request)
    results = stub_forecaster.forecast_batch(requests)
    assert set(results) == {"korea::Food", "japan::Food", "usa::Food"}
    assert all(result["source"] == "stub-v1" for result in results.values())


def test_batch_keys_by_market_and_category_not_market_alone():
    """Two categories for the same market must not collide into one result."""
    coastal = sequence_payload()
    coastal["market"] = "korea"
    coastal["category"] = "Coastal & Island"
    accommodation = sequence_payload()
    accommodation["market"] = "korea"
    accommodation["category"] = "Accommodation & Staycation"
    for index, row in enumerate(accommodation["sequence"]):
        row["trendIndex"] = 10.0 + index  # deliberately different from coastal's

    results = stub_forecaster.forecast_batch([coastal, accommodation])

    assert set(results) == {"korea::Coastal & Island", "korea::Accommodation & Staycation"}
    assert results["korea::Coastal & Island"] != results["korea::Accommodation & Staycation"]
