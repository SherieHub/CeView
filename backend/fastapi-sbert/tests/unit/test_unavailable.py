"""DependencyUnavailable renders the one wire shape every CeView service speaks.

Run with: pytest tests/unit/test_unavailable.py -v
"""
import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.unavailable import DependencyUnavailable, register_unavailable_handler


def _client() -> TestClient:
    app = FastAPI()
    register_unavailable_handler(app)

    @app.get("/boom")
    async def boom():
        raise DependencyUnavailable(
            code="MOD31_LLM_UNAVAILABLE",
            message="Caption generation is unavailable.",
            dependency="groq",
            cause="GROQ_API_KEY is not set",
            stage="fastapi-sbert/caption_agent",
        )

    @app.get("/missing-input")
    def missing_input():
        raise DependencyUnavailable(
            code="MOD31_NO_CORE_SERVICES",
            message="Business profile has no core services.",
            dependency="business_profile",
            cause="coreServices was empty",
            stage="fastapi-sbert/caption_agent",
            status_code=424,
        )

    @app.get("/non-ascii")
    def non_ascii():
        raise DependencyUnavailable(
            code="MOD31_LLM_UNAVAILABLE",
            message="Caption generation is unavailable.",
            dependency="groq",
            cause="GROQ_MODEL '라마' returned 404",
            stage="fastapi-sbert/caption_agent",
        )

    return TestClient(app)


def test_renders_the_full_wire_shape():
    response = _client().get("/boom")

    assert response.status_code == 503
    assert response.json() == {
        "code": "MOD31_LLM_UNAVAILABLE",
        "message": "Caption generation is unavailable.",
        "dependency": "groq",
        "cause": "GROQ_API_KEY is not set",
        "stage": "fastapi-sbert/caption_agent",
    }


def test_missing_upstream_input_is_424_not_503():
    response = _client().get("/missing-input")

    assert response.status_code == 424
    assert response.json()["code"] == "MOD31_NO_CORE_SERVICES"
    assert response.json()["dependency"] == "business_profile"


def test_cause_is_required():
    with pytest.raises(TypeError, match="cause"):
        DependencyUnavailable(  # type: ignore[call-arg]
            code="X", message="y", dependency="z", stage="s"
        )


def test_non_ascii_cause_survives_the_wire():
    response = _client().get("/non-ascii")

    assert response.json()["cause"] == "GROQ_MODEL '라마' returned 404"


def test_handler_logs_a_warning(caplog):
    with caplog.at_level(logging.WARNING, logger="app.unavailable"):
        _client().get("/boom")

    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.levelno == logging.WARNING
    assert record.code == "MOD31_LLM_UNAVAILABLE"
    assert "groq" in record.getMessage()
    assert "fastapi-sbert/caption_agent" in record.getMessage()
    assert "GROQ_API_KEY is not set" in record.getMessage()
