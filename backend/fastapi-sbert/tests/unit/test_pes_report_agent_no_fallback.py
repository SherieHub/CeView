"""The report agent's nodes raise; the router (Task 21) renders the 503.

Run with: pytest tests/unit/test_pes_report_agent_no_fallback.py -v
"""
from app.agents.pes_report_agent import nodes


def test_no_fallback_constants_survive():
    assert not hasattr(nodes, "_FALLBACK_REPORT")
    assert not hasattr(nodes, "_FALLBACK_EVALUATION")
