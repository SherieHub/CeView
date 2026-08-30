"""AgentLLMModel must report *why* it has no model, not just that it has none.

Task 18 turns that reason into the `cause` field of a 503. Without it the operator
sees "LLM unavailable" with no way to tell an unset key from a dead model id.

Run with: pytest tests/unit/test_agent_llm_model.py -v
"""
import pytest

from app.core.AgentLLMModel import AgentLLMModel


@pytest.fixture(autouse=True)
def _reset_singleton():
    AgentLLMModel._instance = None
    yield
    AgentLLMModel._instance = None


def test_unset_api_key_is_reported_as_the_cause(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    wrapper = AgentLLMModel()

    assert wrapper.get_model() is None
    assert wrapper.last_error == "GROQ_API_KEY is not set"


def test_initialisation_failure_is_reported_as_the_cause(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "sk-test")
    monkeypatch.setenv("GROQ_MODEL", "some-model")

    def _explode(*_args, **_kwargs):
        raise RuntimeError("connection refused")

    monkeypatch.setattr("langchain_groq.ChatGroq", _explode)

    wrapper = AgentLLMModel()

    assert wrapper.get_model() is None
    assert "connection refused" in wrapper.last_error
    assert "some-model" in wrapper.last_error


def test_last_error_is_cleared_once_a_model_initialises(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "sk-test")
    monkeypatch.setattr("langchain_groq.ChatGroq", lambda **_kwargs: object())

    wrapper = AgentLLMModel()

    assert wrapper.get_model() is not None
    assert wrapper.last_error is None


def test_long_exception_message_is_truncated(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "sk-test")
    monkeypatch.setenv("GROQ_MODEL", "some-model")

    long_message = "x" * 1000

    def _explode(*_args, **_kwargs):
        raise RuntimeError(long_message)

    monkeypatch.setattr("langchain_groq.ChatGroq", _explode)

    wrapper = AgentLLMModel()

    assert wrapper.get_model() is None
    assert len(wrapper.last_error) < 400
    assert "some-model" in wrapper.last_error
    assert "RuntimeError" in wrapper.last_error
