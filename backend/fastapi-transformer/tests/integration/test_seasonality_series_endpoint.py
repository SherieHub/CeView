"""Module 2 E2E, Step 5 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-04, H-33).

Boots the real FastAPI app and hits POST /internal/market-data/seasonality/series
through TestClient, proving the endpoint is actually wired end to end (request
schema -> compute_series -> response schema), not just the underlying function.
"""
from fastapi.testclient import TestClient

from app.main import app


def test_series_endpoint_returns_one_point_per_input_week():
    with TestClient(app) as client:
        response = client.post(
            "/internal/market-data/seasonality/series",
            json={"market": "korea", "weekly_history": [40.0, 45.0, 50.0, 55.0]},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["market"] == "korea"
    assert len(body["points"]) == 4
    assert [p["stats_window_weeks"] for p in body["points"]] == [1, 2, 3, 4]
    for point in body["points"]:
        assert 0.0 <= point["seasonality_score"] <= 1.0


def test_series_endpoint_accepts_imputed_flags():
    with TestClient(app) as client:
        response = client.post(
            "/internal/market-data/seasonality/series",
            json={
                "market": "japan",
                "weekly_history": [50.0, 95.0, 50.0],
                "imputed_flags": [False, True, False],
            },
        )

    assert response.status_code == 200
    points = response.json()["points"]
    assert points[1]["spike_indicator"] is False   # the imputed week can't self-confirm a spike


def test_empty_series_returns_no_points_not_an_error():
    with TestClient(app) as client:
        response = client.post(
            "/internal/market-data/seasonality/series",
            json={"market": "usa", "weekly_history": []},
        )

    assert response.status_code == 200
    assert response.json()["points"] == []


def test_single_point_endpoint_still_reports_stats_window_weeks():
    # The existing /seasonality endpoint gained an additive field — must not
    # break for callers that only send weekly_history, no imputed_flags.
    with TestClient(app) as client:
        response = client.post(
            "/internal/market-data/seasonality",
            json={"market": "korea", "weekly_history": [40.0, 42.0, 44.0]},
        )

    assert response.status_code == 200
    assert response.json()["stats_window_weeks"] == 3
