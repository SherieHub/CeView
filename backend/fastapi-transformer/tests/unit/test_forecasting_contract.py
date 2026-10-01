from __future__ import annotations

import importlib
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient


MASK_KEYS = {"trendIndex", "forexRate", "gdpGrowth", "seasonalityScore", "spikeIndicator", "holidayFlag"}


def sequence_payload() -> dict:
    start = date(2026, 1, 5)
    rows = []
    for index in range(12):
        monday = start + timedelta(weeks=index)
        iso = monday.isocalendar()
        rows.append({
            "isoYear": iso.year, "isoWeek": iso.week, "weekStartDate": monday.isoformat(),
            "trendIndex": 40.0 + index, "forexRate": 0.0416, "gdpGrowth": 2.0,
            "seasonalityScore": 0.5, "spikeIndicator": 0.0, "holidayFlag": 0.0,
        })
    return {
        "profileId": "00000000-0000-0000-0000-000000000001", "market": "korea", "category": "Food",
        "dataAsOf": "2026-03-23T00:00:00Z", "dataStale": False,
        "sequence": rows, "imputedMask": [{key: False for key in MASK_KEYS} for _ in rows],
    }


def test_sequence_schema_rejects_a_null_feature_with_its_field_path():
    from app.main import app
    payload = sequence_payload()
    payload["sequence"][3]["forexRate"] = None
    response = TestClient(app).post("/internal/forecasting/inference-batch", json={"markets": [payload]})
    assert response.status_code == 422
    assert any(error["loc"][-1] == "forexRate" for error in response.json()["detail"])


def test_sequence_schema_rejects_non_increasing_iso_weeks():
    from app.main import app
    payload = sequence_payload()
    payload["sequence"][2]["weekStartDate"] = payload["sequence"][1]["weekStartDate"]
    payload["sequence"][2]["isoYear"] = payload["sequence"][1]["isoYear"]
    payload["sequence"][2]["isoWeek"] = payload["sequence"][1]["isoWeek"]
    response = TestClient(app).post("/internal/forecasting/inference-batch", json={"markets": [payload]})
    assert response.status_code == 422
    assert any("sequence" in str(error["loc"]) or "sequence" in error["msg"] for error in response.json()["detail"])


def test_batch_stub_receives_sequence_and_returns_contract_response():
    from app.main import app
    response = TestClient(app).post("/internal/forecasting/inference-batch", json={"markets": [sequence_payload()]})
    assert response.status_code == 200
    # Results are keyed "{market}::{category}", not bare market — a profile sends
    # one request per category and a bare key would collide (see
    # stub_forecaster.forecast_batch). sequence_payload()'s category is "Food".
    body = response.json()["results"]["korea::Food"]
    assert body["source"] == "stub-v1"
    assert len(body["weekly_forecasts"]) == 12
    # A normal 12-week sequence has a real holdout backtest.  The disclaimer is
    # therefore derived from the 15% gate, not hardcoded to either state.
    assert body["low_confidence_disclaimer"] is (not body["passed"])


def test_single_inference_endpoint_is_removed_so_all_calls_use_batch_contract():
    from app.main import app
    response = TestClient(app).post("/internal/forecasting/inference", json=sequence_payload())
    assert response.status_code == 404


def test_engine_selection_and_unknown_value_fail_fast(monkeypatch):
    import app.services.forecast_engine as registry
    monkeypatch.setenv("FORECAST_ENGINE", "bilstm")
    assert importlib.reload(registry).active_engine_name() == "bilstm"
    monkeypatch.setenv("FORECAST_ENGINE", "not-an-engine")
    with pytest.raises(RuntimeError, match="Invalid FORECAST_ENGINE"):
        importlib.reload(registry)
    monkeypatch.setenv("FORECAST_ENGINE", "stub")
    importlib.reload(registry)


def test_health_endpoints_boot_without_groq_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    from app.main import app
    client = TestClient(app)
    assert client.get("/healthz").json() == {"status": "ok"}
    models = client.get("/healthz/models").json()
    # bilstm reports "configured", not "loaded": the checkpoint lives in a hosted
    # HF Space, so actual reachability is only knowable by calling it — which costs
    # GPU quota and must never happen on a health probe.
    assert models == {"stub": "ok", "groq": "missing", "xgboost": "missing", "bilstm": "configured", "engine": "stub", "status": "ok"}
