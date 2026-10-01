"""The caption agent raises when it has no model, naming why.

Task 3 made AgentLLMModel record its failure reason; this is what consumes it.

Run with: pytest tests/unit/test_caption_agent_no_fallback.py -v
"""
import pytest

from app.agents.creative_director_agent import node
from app.unavailable import DependencyUnavailable


class _NoModel:
    last_error = "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found"

    def get_model(self):
        return None


def test_raises_with_the_wrappers_reason(monkeypatch):
    monkeypatch.setattr(node, "_llm_wrapper", _NoModel())

    with pytest.raises(DependencyUnavailable) as excinfo:
        node.generate_platform_captions({"target_market": "korea"})

    assert excinfo.value.code == "MOD31_LLM_UNAVAILABLE"
    assert excinfo.value.dependency == "groq"
    assert "404 model_not_found" in excinfo.value.cause


def test_fallback_helper_no_longer_exists():
    assert not hasattr(node, "_fallback_captions")


def test_no_dangling_reference_to_deleted_mock_captions():
    """Task 17 deleted gemini_client._mock_captions. This file must not still
    import it — that import used to live inside _fallback_captions() and would
    raise ImportError the moment this branch executed in production."""
    import inspect
    source = inspect.getsource(node)
    assert "_mock_captions" not in source
