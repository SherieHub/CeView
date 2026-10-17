"""FR3.3 research reaches the live caption route; the OMCS audit needs recommendations.

No model or network: the caption agent, research service and OMCS graph are stubbed.
"""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app import errors
from app.model.ComplianceScoreInputClass import ComplianceInputClass
from app.routers import caption_generation
from app.services import omcs_analysis
from app.unavailable import DependencyUnavailable

RESEARCH = {
    "source": "template",
    "traveler_behavior": "plans ahead",
    "tourism_preferences": "healing",
    "platform_styles": "calm",
    "language_nuances": "polite",
}
BODY = {
    "business_name": "Blue Reef",
    "business_description": "Dive shop",
    "business_uvp": "Freediving",
    "business_services": ["Freediving"],
    "target_market": "South Korea",
    "market_category": "Coastal & Island",
}


@pytest.fixture
def seen(monkeypatch):
    captured = {}

    async def fake_service(request):
        captured["research_context"] = request.research_context
        return {"final_captions": {"instagram": [{"caption": "hi"}]}, "source": "groq"}

    monkeypatch.setattr(caption_generation, "caption_generation_service", fake_service)
    monkeypatch.setattr(
        caption_generation.cultural_research,
        "research_market",
        lambda market: captured.setdefault("market", market) and RESEARCH,
    )
    return captured


@pytest.fixture
def client():
    from app.main import app

    return TestClient(app)


def test_blank_research_context_is_filled_for_the_target_market(client, seen):
    response = client.post("/internal/generation/caption", json=BODY)

    assert response.status_code == 200
    assert seen["market"] == "korea"
    assert "Traveler behavior: plans ahead" in seen["research_context"]
    assert response.json()["source"] == "groq"


def test_a_supplied_research_context_is_kept_and_research_is_skipped(client, seen, monkeypatch):
    monkeypatch.setattr(
        caption_generation.cultural_research,
        "research_market",
        lambda market: pytest.fail("research must not run when a context is supplied"),
    )
    client.post(
        "/internal/generation/caption", json={**BODY, "research_context": "caller supplied"}
    )

    assert seen["research_context"] == "caller supplied"


def test_the_duplicate_content_route_is_gone(client):
    assert client.post("/internal/content/generate", json={"market": "korea"}).status_code == 404


def test_omcs_without_recommendations_is_424_and_never_runs_the_graph(monkeypatch):
    class _Graph:
        async def ainvoke(self, _state):
            pytest.fail("graph must not run without recommendations")

    monkeypatch.setattr(omcs_analysis, "omcs_graph", _Graph())
    with pytest.raises(DependencyUnavailable) as excinfo:
        asyncio.run(
            omcs_analysis.omcs_calculation(ComplianceInputClass(caption="c", image_url="u"))
        )

    assert excinfo.value.code == errors.MOD33_RECOMMENDATIONS_MISSING
    assert excinfo.value.status_code == 424


def test_omcs_endpoint_returns_424_for_empty_recommendations(client):
    response = client.post(
        "/internal/omcs/analyze",
        json={
            "caption": "c",
            "image_url": "u",
            "business_profile": {"uvp": "x"},
            "recommendations": {},
        },
    )
    assert response.status_code == 424
    assert response.json()["code"] == errors.MOD33_RECOMMENDATIONS_MISSING
