"""Mirror of fastapi-sbert's test — the two services must speak the same shape.

Run with: pytest tests/unit/test_unavailable.py -v
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.unavailable import (
    SERVICE,
    DependencyUnavailable,
    register_unavailable_handler,
)


def _client() -> TestClient:
    app = FastAPI()
    register_unavailable_handler(app)

    @app.get("/boom")
    async def boom():
        raise DependencyUnavailable(
            code="MOD21_TRENDS_UNAVAILABLE",
            message="Google Trends data is unavailable.",
            dependency="pytrends",
            cause="429 Too Many Requests",
            stage=f"{SERVICE}/trend_service",
        )

    return TestClient(app)


def test_renders_the_full_wire_shape():
    response = _client().get("/boom")

    assert response.status_code == 503
    assert response.json() == {
        "code": "MOD21_TRENDS_UNAVAILABLE",
        "message": "Google Trends data is unavailable.",
        "dependency": "pytrends",
        "cause": "429 Too Many Requests",
        "stage": "fastapi-transformer/trend_service",
    }


def test_service_constant_names_this_service():
    """Guards the one line that must differ from the fastapi-sbert original.

    Nothing else references SERVICE yet, so a copy-paste that left it as
    "fastapi-sbert" would be silent until an operator saw the wrong service
    name in a production error body.
    """
    assert SERVICE == "fastapi-transformer"


def test_cause_is_required():
    with pytest.raises(TypeError, match="cause"):
        DependencyUnavailable(  # type: ignore[call-arg]
            code="X", message="y", dependency="z", stage="s"
        )
