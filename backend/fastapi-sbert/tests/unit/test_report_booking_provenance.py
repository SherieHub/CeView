"""CVW-42 — the report is told how much of the booking total was measured.

Recommendation #7 of the expert validation: capture conversions automatically
before relying on AI insights. Until every booking is captured, the report must
at least know which of its booking numbers are tracked and which are recalled.
"""
import pytest
from fastapi.testclient import TestClient

from app.services import gemini_client, report_llm

TRANSITIONS = [
    {"stage": "Clicks → Conversions", "dropRate": "61.2%"},
    {"stage": "Conversions → Bookings", "dropRate": "40.0%"},
    {"stage": "Impressions → Clicks", "dropRate": "97.3%"},
]

PROVENANCE = {
    "reportedBookings": 10,
    "trackedBookings": 4,
    "automaticBookings": 2,
    "clickMatchedBookings": 1,
    "codeLoggedBookings": 1,
    "untrackedBookings": 6,
    "trackedExceedsReported": False,
}


@pytest.fixture
def client(monkeypatch):
    from app.main import app

    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)
    return TestClient(app)


@pytest.fixture
def report_calls(monkeypatch):
    calls = []
    full_report = {"executiveSummary": "s", "funnelDiagnostics": [{}], "recommendations": [{}],
                   "recommendedPlatform": "Naver Blog"}
    monkeypatch.setattr(report_llm, "performance_report", lambda **kw: calls.append(kw) or dict(full_report))
    return calls


def test_router_forwards_provenance_to_the_llm(client, report_calls):
    response = client.post("/internal/report/generate",
                           json={"funnelTransitions": TRANSITIONS, "bookingProvenance": PROVENANCE})

    assert response.status_code == 200
    assert report_calls[0]["provenance"] == PROVENANCE


def test_missing_provenance_is_forwarded_as_unknown(client, report_calls):
    response = client.post("/internal/report/generate", json={"funnelTransitions": TRANSITIONS})

    assert response.status_code == 200
    assert report_calls[0]["provenance"] is None


def test_prompt_states_the_tracked_split_and_requires_a_confidence_caveat(monkeypatch):
    prompts = []
    monkeypatch.setattr(gemini_client, "_generate_json", lambda prompt: prompts.append(prompt) or {})

    report_llm.performance_report(metrics={"bookings": 10}, transitions=TRANSITIONS, provenance=PROVENANCE)

    prompt = prompts[0]
    assert "BOOKING DATA PROVENANCE" in prompt
    assert "Bookings reported by the operator (typed from memory/records): 10" in prompt
    assert "Reported bookings with no tracked evidence: 6" in prompt
    assert "7. The executiveSummary MUST state how much of the bookings figure is backed" in prompt


def test_prompt_is_unchanged_without_provenance(monkeypatch):
    prompts = []
    monkeypatch.setattr(gemini_client, "_generate_json", lambda prompt: prompts.append(prompt) or {})

    report_llm.performance_report(metrics={"bookings": 10}, transitions=TRANSITIONS)

    assert "PROVENANCE" not in prompts[0]
    assert "\n7. " not in prompts[0]
