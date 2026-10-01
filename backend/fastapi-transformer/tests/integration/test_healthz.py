"""Integration smoke test: the app starts with no external forecast credential."""
from fastapi.testclient import TestClient

from app.main import app


def test_healthz_returns_ok():
    with TestClient(app) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
