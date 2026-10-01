"""Creative direction is generated or unavailable — never a curated template.

Run with: pytest tests/unit/test_no_creative_fallback.py -v
"""
import pytest

from app.services import gemini_client
from app.unavailable import DependencyUnavailable


def test_raises_when_disabled(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: False)

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_creative_direction(
            market="korea", business_name="T", categories=["c"],
            approved_captions=[], uniqueness_score=0, forecast_context={},
        )

    assert excinfo.value.code == "MOD3_CREATIVE_GEMINI_DISABLED"
    assert excinfo.value.dependency == "groq"


def test_creative_fallback_helper_no_longer_exists():
    assert not hasattr(gemini_client, "_creative_fallback")
