"""Example integration test — boots the real FastAPI app and hits an endpoint
through TestClient.

The app's lifespan eagerly loads the E5/Keras models on startup (see
app/main.py + app/core/BertModel.py) so that /healthz only returns 200 once
they're ready. That means a naive `TestClient(app)` in CI would trigger a real
~1.1GB HuggingFace download. We patch `_BertModel.get` to a no-op before the
app starts so the test stays fast and offline — swap in real fixtures/mocks
for endpoints that need model output.

Run with: pytest tests/integration -v
"""
from unittest.mock import patch

from fastapi.testclient import TestClient


def test_healthz_returns_ok():
    with patch("app.core.BertModel._BertModel.get", return_value=None):
        from app.main import app

        with TestClient(app) as client:
            response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
