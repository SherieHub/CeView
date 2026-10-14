"""The report never invents funnel drop rates.

A request with fewer than three measured transitions used to be padded with fixed
"88.1% / 78.8% / 95.2%" stages. It is now a 424 missing-input error, raised
before the LLM is consulted.
"""
import inspect

import pytest
from fastapi.testclient import TestClient

from app.config import markets
from app.services import gemini_client, report_llm

TRANSITIONS = [
    {"stage": "Clicks → Conversions", "dropRate": "61.2%"},
    {"stage": "Conversions → Bookings", "dropRate": "40.0%"},
    {"stage": "Impressions → Clicks", "dropRate": "97.3%"},
]


@pytest.fixture
def client(monkeypatch):
    from app.main import app

    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)
    return TestClient(app)


@pytest.fixture
def report_calls(monkeypatch):
    calls = []
    # A complete report, so the router's output check (which rejects {} and partial
    # answers) passes and the test isolates the funnel-input behaviour.
    full_report = {"executiveSummary": "s", "funnelDiagnostics": [{}], "recommendations": [{}],
                   "recommendedPlatform": "Naver Blog"}
    monkeypatch.setattr(report_llm, "performance_report", lambda **kw: calls.append(kw) or dict(full_report))
    return calls


@pytest.mark.parametrize("count", [0, 1, 2])
def test_short_funnel_is_424_and_never_reaches_the_llm(client, report_calls, count):
    response = client.post("/internal/report/generate", json={"funnelTransitions": TRANSITIONS[:count]})

    assert response.status_code == 424
    body = response.json()
    assert body["code"] == "MOD4_REPORT_NO_FUNNEL"
    assert f"received {count} of 3" in body["cause"]
    assert report_calls == []


def test_complete_funnel_reaches_the_llm_with_exactly_the_measured_values(client, report_calls):
    response = client.post("/internal/report/generate", json={"funnelTransitions": TRANSITIONS})

    assert response.status_code == 200
    assert report_calls[0]["transitions"] == TRANSITIONS


def test_extra_transitions_are_trimmed_to_three(client, report_calls):
    extra = TRANSITIONS + [{"stage": "Bookings → Repeat", "dropRate": "5.0%"}]
    client.post("/internal/report/generate", json={"funnelTransitions": extra})

    assert report_calls[0]["transitions"] == TRANSITIONS


def test_invented_defaults_are_gone():
    assert not hasattr(markets, "DEFAULT_FUNNEL_TRANSITIONS")
    assert inspect.signature(report_llm.performance_report).parameters["transitions"].default is inspect.Parameter.empty
