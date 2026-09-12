"""BiLSTM + Transformer adapter — contract, normalization and no-fabrication rules.

Everything here runs offline: the Gradio client is monkeypatched, so none of these
tests consume Hugging Face ZeroGPU quota.

Run with: pytest tests/unit/test_bilstm_forecaster.py -v
"""
from __future__ import annotations

import json
import math

import pytest

from app.services import bilstm_forecaster as bf
from app.unavailable import DependencyUnavailable


def history(weeks: int = 52, start: float = 40.0) -> list[float]:
    return [start + index for index in range(weeks)]


def model_response(mean_4w: float = 46.5, mean_12w: float = 46.2, status: str = "provisional") -> dict:
    return {
        "market": "KR",
        "category": "coastal_island",
        "weekly_forecasts": [
            {"week_ahead": week, "google_trends": 46.0 + week * 0.1} for week in range(1, 13)
        ],
        "mean_demand_4_weeks": mean_4w,
        "mean_demand_12_weeks": mean_12w,
        "model": {"model_version": "ceview_C_seed42_provisional", "status": status},
    }


class FakeClient:
    """Records the exact arguments the adapter sends to the Space."""

    def __init__(self, response: dict | None = None):
        self.response = response if response is not None else model_response()
        self.calls: list[dict] = []

    def predict(self, **kwargs):
        self.calls.append(kwargs)
        return self.response


@pytest.fixture(autouse=True)
def _reset_client_cache():
    bf._cached_client = None
    yield
    bf._cached_client = None


def use_client(monkeypatch, client: FakeClient) -> FakeClient:
    monkeypatch.setattr(bf, "_client", lambda: client)
    return client


# ── History tensor ────────────────────────────────────────────────────────────

def test_tensor_has_52_rows_of_3_columns():
    rows = json.loads(bf.build_history_tensor(history()))
    assert len(rows) == 52
    assert all(len(row) == 3 for row in rows)


def test_trend_is_always_divided_by_100():
    """A conditional 'divide only if > 1' rule would read a genuine index of 1.0 as 100."""
    rows = json.loads(bf.build_history_tensor([0.0, 0.5, 1.0, 50.0, 100.0] + history(47)))
    scaled = [row[0] for row in rows]
    assert scaled[0] == 0.0
    assert scaled[1] == 0.005
    assert scaled[2] == 0.01
    assert scaled[3] == 0.5
    assert scaled[4] == 1.0


def test_week_encoding_is_a_unit_circle_and_ordered_oldest_first():
    rows = json.loads(bf.build_history_tensor(history()))
    for _, sin_v, cos_v in rows:
        assert math.isclose(sin_v**2 + cos_v**2, 1.0, abs_tol=1e-4)
    # oldest-first: the trailing window preserves input order
    assert rows[0][0] < rows[-1][0]


def test_only_the_trailing_52_weeks_are_used():
    rows = json.loads(bf.build_history_tensor(history(60, start=0.0)))
    assert len(rows) == 52
    assert rows[-1][0] == pytest.approx(0.59)  # last value of a 0..59 series


@pytest.mark.parametrize("weeks", [0, 1, 12, 51])
def test_short_history_raises_instead_of_padding(weeks):
    """The no-synthetic-fallbacks rule: never invent the missing weeks."""
    with pytest.raises(DependencyUnavailable) as excinfo:
        bf.build_history_tensor(history(weeks))
    assert excinfo.value.code == "MOD22_INSUFFICIENT_HISTORY"
    assert str(weeks) in excinfo.value.cause


# ── Market / category normalization ───────────────────────────────────────────

@pytest.mark.parametrize("value,expected", [
    ("korea", "KR"), ("Korea", "KR"), ("KR", "KR"),
    ("japan", "JP"), ("JP", "JP"),
    ("usa", "US"), ("United States", "US"),
])
def test_market_normalization(value, expected):
    assert bf.normalize_market(value) == expected


@pytest.mark.parametrize("label,expected", [
    ("Accommodation & Staycation", "accommodation_staycation"),
    ("Adventure & Nature", "adventure_nature"),
    ("Coastal & Island", "coastal_island"),
    ("Culinary & Gastronomy", "culinary_gastronomy"),
    ("Cultural & Heritage", "cultural_heritage"),
    ("Theme Parks / Entertainment", "theme_parks_entertainment"),
    ("Urban & City", "urban_city"),
])
def test_all_seven_categories_normalize(label, expected):
    assert bf.normalize_category(label) == expected


def test_unknown_market_and_category_raise_rather_than_defaulting():
    with pytest.raises(DependencyUnavailable) as market_err:
        bf.normalize_market("france")
    assert market_err.value.code == "MOD22_BILSTM_UNKNOWN_MARKET"

    with pytest.raises(DependencyUnavailable) as category_err:
        bf.normalize_category("Wellness & Spa")
    assert category_err.value.code == "MOD22_BILSTM_UNKNOWN_CATEGORY"


# ── Adapter output ────────────────────────────────────────────────────────────

def test_adapts_model_output_into_the_forecast_response_contract(monkeypatch):
    use_client(monkeypatch, FakeClient())
    result = bf.forecast({
        "market": "korea", "category": "Coastal & Island", "trendHistory": history(),
    })

    assert result["predicted_demand_4w"] == 46.5      # mean_demand_4_weeks, unchanged unit
    assert result["predicted_demand_12w"] == 46.2     # mean_demand_12_weeks
    assert len(result["weekly_forecasts"]) == 12
    assert result["weekly_forecasts"][0] == pytest.approx(46.1)   # week_ahead=1 first
    assert result["source"] == "bilstm"               # engineLabel() matches this exactly
    # The checkpoint ships no holdout metrics — null, never an invented number.
    assert result["mape"] is None and result["mae"] is None and result["rmse"] is None


def test_provisional_status_reports_low_confidence(monkeypatch):
    use_client(monkeypatch, FakeClient(model_response(status="provisional")))
    result = bf.forecast({"market": "korea", "category": "Coastal & Island", "trendHistory": history()})
    assert result["confidence"] < 0.7      # below the UI's LOW_CONFIDENCE_THRESHOLD
    assert result["low_confidence_disclaimer"] is True
    assert result["passed"] is False


def test_validated_status_reports_normal_confidence(monkeypatch):
    use_client(monkeypatch, FakeClient(model_response(status="validated")))
    result = bf.forecast({"market": "korea", "category": "Coastal & Island", "trendHistory": history()})
    assert result["confidence"] >= 0.7
    assert result["low_confidence_disclaimer"] is False


def test_weekly_forecasts_are_ordered_by_week_ahead(monkeypatch):
    shuffled = model_response()
    shuffled["weekly_forecasts"] = list(reversed(shuffled["weekly_forecasts"]))
    use_client(monkeypatch, FakeClient(shuffled))
    result = bf.forecast({"market": "korea", "category": "Coastal & Island", "trendHistory": history()})
    assert result["weekly_forecasts"] == sorted(result["weekly_forecasts"])


def test_sends_normalized_market_and_category_to_the_space(monkeypatch):
    client = use_client(monkeypatch, FakeClient())
    bf.forecast({"market": "japan", "category": "Theme Parks / Entertainment", "trendHistory": history()})
    sent = client.calls[0]
    assert sent["market"] == "JP"
    assert sent["category"] == "theme_parks_entertainment"
    assert len(json.loads(sent["history_json"])) == 52


# ── Malformed responses ───────────────────────────────────────────────────────

@pytest.mark.parametrize("mutate,reason", [
    (lambda r: r.pop("mean_demand_4_weeks"), "missing 4w mean"),
    (lambda r: r.update({"mean_demand_4_weeks": float("nan")}), "NaN mean"),
    (lambda r: r.update({"weekly_forecasts": r["weekly_forecasts"][:11]}), "11 weeks"),
    (lambda r: r["weekly_forecasts"][0].update({"google_trends": 140.0}), "out of 0-100 range"),
    (lambda r: r["weekly_forecasts"][0].update({"google_trends": None}), "null value"),
])
def test_malformed_model_responses_raise(monkeypatch, mutate, reason):
    payload = model_response()
    mutate(payload)
    use_client(monkeypatch, FakeClient(payload))
    with pytest.raises(DependencyUnavailable) as excinfo:
        bf.forecast({"market": "korea", "category": "Coastal & Island", "trendHistory": history()})
    assert excinfo.value.code == "MOD22_BILSTM_INVALID_RESPONSE", reason


def test_space_failure_surfaces_as_bilstm_unavailable(monkeypatch):
    class Boom:
        def predict(self, **_kwargs):
            raise RuntimeError("You have exceeded your ZeroGPU runs limit")

    monkeypatch.setattr(bf, "_client", lambda: Boom())
    with pytest.raises(DependencyUnavailable) as excinfo:
        bf.forecast({"market": "korea", "category": "Coastal & Island", "trendHistory": history()})
    assert excinfo.value.code == "MOD22_BILSTM_UNAVAILABLE"
    assert "ZeroGPU" in excinfo.value.cause   # upstream reason preserved verbatim


# ── Batch keying — the category-isolation guarantee ───────────────────────────

def test_batch_keys_by_market_and_category_with_independent_results(monkeypatch):
    """Two categories of the same market must never share one forecast value."""
    class PerCategoryClient:
        def predict(self, **kwargs):
            factor = 1.0 if kwargs["category"] == "coastal_island" else 2.0
            return model_response(mean_4w=40.0 * factor, mean_12w=38.0 * factor)

    monkeypatch.setattr(bf, "_client", lambda: PerCategoryClient())
    results = bf.forecast_batch([
        {"market": "korea", "category": "Coastal & Island", "trendHistory": history()},
        {"market": "korea", "category": "Accommodation & Staycation", "trendHistory": history()},
    ])

    assert set(results) == {"korea::Coastal & Island", "korea::Accommodation & Staycation"}
    assert results["korea::Coastal & Island"]["predicted_demand_4w"] == 40.0
    assert results["korea::Accommodation & Staycation"]["predicted_demand_4w"] == 80.0
