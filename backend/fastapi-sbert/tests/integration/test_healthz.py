"""Example integration test that boots the FastAPI app without local model loading.

Run with: pytest tests/integration -v
"""
from unittest.mock import patch

from fastapi.testclient import TestClient


def test_healthz_returns_ok():
    with patch("app.core.BertModel._BertModel.get") as get_model:
        from app.main import app

        with TestClient(app) as client:
            response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    get_model.assert_not_called()
