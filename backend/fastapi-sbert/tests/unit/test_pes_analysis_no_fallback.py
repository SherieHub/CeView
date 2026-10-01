"""PES analysis reports its unavailability rather than an "offline" placeholder.

Run with: pytest tests/unit/test_pes_analysis_no_fallback.py -v
"""
import pytest

from app.routers import pes_analysis
from app.unavailable import DependencyUnavailable


@pytest.mark.asyncio
async def test_empty_metrics_is_a_424():
    request = pes_analysis.PesAnalysisRequest(metrics_data={}, weeks=4)

    with pytest.raises(DependencyUnavailable) as excinfo:
        await pes_analysis.generate(request)

    assert excinfo.value.status_code == 424
    assert excinfo.value.dependency == "campaign_records"


@pytest.mark.asyncio
async def test_agent_failure_is_a_503_naming_the_reason(monkeypatch):
    async def _boom(_state):
        raise RuntimeError("gemini timeout after 3 retries")

    monkeypatch.setattr(pes_analysis.pes_agent_graph, "ainvoke", _boom)
    request = pes_analysis.PesAnalysisRequest(metrics_data={"ctr": [1.0, 2.0]}, weeks=4)

    with pytest.raises(DependencyUnavailable) as excinfo:
        await pes_analysis.generate(request)

    assert excinfo.value.status_code == 503
    assert "gemini timeout" in excinfo.value.cause


def test_fallback_payload_no_longer_exists():
    assert not hasattr(pes_analysis, "_FALLBACK_PAYLOAD")
