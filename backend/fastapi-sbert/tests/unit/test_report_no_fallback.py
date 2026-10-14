"""The prescriptive report is generated or unavailable - never a rule-based stand-in.

Run with: pytest tests/unit/test_report_no_fallback.py -v
"""
from fastapi.testclient import TestClient

from app.routers import report
from app.services import gemini_client, report_llm

TRANSITIONS = [
    {"stage": "Clicks -> Conversions", "dropRate": "61.2%"},
    {"stage": "Conversions -> Bookings", "dropRate": "40.0%"},
    {"stage": "Impressions -> Clicks", "dropRate": "97.3%"},
]


def test_llm_offline_is_a_503_and_no_report_is_built(monkeypatch):
    from app.main import app

    monkeypatch.setattr(gemini_client, "_enabled", lambda: False)
    calls = []
    monkeypatch.setattr(report_llm, "performance_report", lambda **kw: calls.append(kw))

    response = TestClient(app).post("/internal/report/generate", json={"funnelTransitions": TRANSITIONS})

    assert response.status_code == 503
    assert response.json()["code"] == "MOD4_REPORT_UNAVAILABLE"
    assert calls == []


def test_fallback_report_helper_no_longer_exists():
    assert not hasattr(report, "_fallback_report")


def test_an_empty_model_answer_is_a_503_not_a_200_with_an_empty_report(monkeypatch):
    """_generate_json swallows every model error and returns {} — and the router
    returned that {} with 200, so the operator saw a blank action plan with no error
    (the frontend contract suite recorded this as "KNOWN GAP — Task 15"). An empty
    or structurally incomplete report is unavailability, not success. Fails until
    the router checks what came back."""
    from app.main import app

    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)
    monkeypatch.setattr(report_llm, "performance_report", lambda **kw: {})

    response = TestClient(app).post("/internal/report/generate", json={"funnelTransitions": TRANSITIONS})

    assert response.status_code == 503
    assert response.json()["code"] == "MOD4_REPORT_UNAVAILABLE"


def test_a_partial_model_answer_is_a_503_naming_what_is_missing(monkeypatch):
    from app.main import app

    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)
    monkeypatch.setattr(report_llm, "performance_report", lambda **kw: {"executiveSummary": "only this"})

    response = TestClient(app).post("/internal/report/generate", json={"funnelTransitions": TRANSITIONS})

    assert response.status_code == 503
    assert "funnelDiagnostics" in response.json()["cause"]


def test_a_complete_model_answer_is_returned_unchanged(monkeypatch):
    from app.main import app

    report_body = {
        "executiveSummary": "s", "funnelDiagnostics": [{"stage": "a"}],
        "recommendations": [{"stage": "a"}], "recommendedPlatform": "Naver Blog",
    }
    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)
    monkeypatch.setattr(report_llm, "performance_report", lambda **kw: dict(report_body))

    response = TestClient(app).post("/internal/report/generate", json={"funnelTransitions": TRANSITIONS})

    assert response.status_code == 200
    assert response.json() == report_body
