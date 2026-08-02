"""Example integration test — boots the real FastAPI app and hits an endpoint
through TestClient.

app.services.gemini_forecaster raises RuntimeError at *import time* if
GROQ_API_KEY is unset (see RUNNING.md — this service has no stub mode), and
app.main imports it transitively via the forecasting router. conftest.py sets
a placeholder GROQ_API_KEY before any test module is collected so importing
the app doesn't crash here; it is never used to make a real API call.

Run with: pytest tests/integration -v
"""
from fastapi.testclient import TestClient

from app.main import app


def test_healthz_returns_ok():
    with TestClient(app) as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
