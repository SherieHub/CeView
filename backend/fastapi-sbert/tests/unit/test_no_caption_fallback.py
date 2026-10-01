"""Content generation returns a real model output or raises. No third option.

Run with: pytest tests/unit/test_no_caption_fallback.py -v
"""
import pytest

from app.services import gemini_client
from app.unavailable import DependencyUnavailable


def test_raises_when_gemini_is_disabled(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: False)

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_content(
            market="korea", business_name="Test Dive Co",
            description="Diving in Cebu", categories=["Coastal & Island"], trend="surging",
        )

    assert excinfo.value.dependency == "groq"
    assert excinfo.value.code == "MOD3_CONTENT_GEMINI_DISABLED"


def test_raises_when_the_model_call_explodes(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)

    def _boom(_prompt):
        raise RuntimeError("404 model_not_found")

    monkeypatch.setattr(gemini_client, "_generate_json", _boom)

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_content(
            market="korea", business_name="T", description="d",
            categories=["c"], trend="t",
        )

    assert "404 model_not_found" in excinfo.value.cause


def test_raises_when_the_model_returns_nothing_usable(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)
    monkeypatch.setattr(gemini_client, "_generate_json", lambda _p: {})

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_content(
            market="korea", business_name="T", description="d",
            categories=["c"], trend="t",
        )

    assert excinfo.value.code == "MOD3_CONTENT_GEMINI_EMPTY"


def test_mock_captions_no_longer_exists():
    assert not hasattr(gemini_client, "_mock_captions")


def test_the_schema_example_carries_no_prose_captions():
    example = gemini_client._caption_schema_example()

    for platform in ("instagram", "tiktok", "facebook"):
        for option in example[platform]["options"]:
            assert option == "<string>", "the prompt example must be types, not sample copy"
        for guide_line in example[platform]["guide"]:
            assert guide_line == "<string>", "the guide array must be types, not sample copy"
