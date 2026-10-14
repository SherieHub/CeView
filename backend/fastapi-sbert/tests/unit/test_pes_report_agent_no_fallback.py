"""The report agent's nodes raise when there is no LLM, and the retry gate is real.

The router (Task 21) renders the 503. Checking that the old fallback constants are
gone is not enough on its own: a fallback reintroduced under any other name would
pass that, so the behaviour is asserted directly.

Run with: pytest tests/unit/test_pes_report_agent_no_fallback.py -v
"""
import pytest

from app.agents.pes_report_agent import nodes
from app.unavailable import DependencyUnavailable


class _NoModel:
    def get_model(self):
        return None


@pytest.fixture
def no_llm(monkeypatch):
    monkeypatch.setattr(nodes, "AgentLLMModel", lambda: _NoModel())


def test_generate_raises_instead_of_returning_a_canned_report(no_llm):
    with pytest.raises(DependencyUnavailable) as excinfo:
        nodes.generate_report({"metrics_data": "{}", "iterations": 0})

    assert excinfo.value.code == "MOD4_PES_AGENT_FAILED"
    assert excinfo.value.status_code == 503
    assert excinfo.value.stage == "fastapi-sbert/pes_report_agent.generate"


def test_evaluate_raises_instead_of_returning_a_canned_evaluation(no_llm):
    with pytest.raises(DependencyUnavailable) as excinfo:
        nodes.evaluate_report({"metrics_data": "{}", "report": {}})

    assert excinfo.value.stage == "fastapi-sbert/pes_report_agent.evaluate"


@pytest.mark.parametrize("score,passed,iterations,expected", [
    (nodes.PASS_SCORE, True, 1, "finalize_response"),
    (nodes.PASS_SCORE - 1, True, 1, "generate_report"),
    (nodes.PASS_SCORE, False, 1, "generate_report"),
    (0, False, nodes.MAX_RETRIES, "finalize_response"),
])
def test_route_retries_until_pass_or_max_retries(score, passed, iterations, expected):
    state = {"evaluation": {"score": score, "pass": passed}, "iterations": iterations}
    assert nodes.route_action(state) == expected


def test_report_released_after_max_retries_is_flagged_for_human_review():
    out = nodes.finalize_response(
        {"report": {"x": 1}, "evaluation": {"score": nodes.PASS_SCORE - 1}, "iterations": nodes.MAX_RETRIES}
    )
    assert out["final_metadata"]["needs_human_review"] is True
    assert out["final_ui_payload"]["report_data"] == {"x": 1}


def test_no_fallback_constants_survive():
    assert not hasattr(nodes, "_FALLBACK_REPORT")
    assert not hasattr(nodes, "_FALLBACK_EVALUATION")
