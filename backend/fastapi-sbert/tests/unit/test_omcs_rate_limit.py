"""The OMCS audit's handling of Groq rate limits: what to wait, when to retry, what to report.

No model or network: the LLM and the clock are stubbed.
"""
import types

import pytest

from app import errors
from app.agents.omcs_agent import node
from app.unavailable import DependencyUnavailable


class RateLimit(Exception):
    """Stands in for the Groq SDK's 429 error: a status code and a response with headers."""

    def __init__(self, message="Rate limit reached", headers=None, status_code=429):
        super().__init__(message)
        self.status_code = status_code
        self.response = types.SimpleNamespace(headers=headers or {})


class FakeLLM:
    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def invoke(self, messages):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.fixture
def slept(monkeypatch):
    waits = []
    monkeypatch.setattr(node.time, "sleep", waits.append)
    return waits


def use(monkeypatch, llm):
    monkeypatch.setattr(node, "get_llm", lambda: llm)


class TestRateLimitWait:
    def test_reads_the_retry_after_header(self):
        assert node._rate_limit_wait(RateLimit(headers={"retry-after": "7"})) == 7.0

    def test_reads_the_delay_from_the_message_when_there_is_no_header(self):
        assert node._rate_limit_wait(RateLimit("Please try again in 2.5s.")) == 2.5

    def test_reads_minutes_and_seconds(self):
        assert node._rate_limit_wait(RateLimit("Please try again in 1m3.5s.")) == 63.5

    def test_falls_back_to_a_short_default_when_groq_gives_no_hint(self):
        assert node._rate_limit_wait(RateLimit("Rate limit reached")) == node._DEFAULT_RATE_LIMIT_WAIT_S

    def test_a_request_that_is_too_large_is_never_worth_waiting_for(self):
        message = "Request too large for model `qwen`: Limit 1000, Requested 2048"
        assert node._rate_limit_wait(RateLimit(message)) is None

    def test_other_errors_are_not_rate_limits(self):
        assert node._rate_limit_wait(RateLimit(status_code=500)) is None
        assert node._rate_limit_wait(ValueError("nope")) is None


class TestInvoke:
    def test_a_successful_call_is_returned_untouched(self, monkeypatch, slept):
        llm = FakeLLM("ok")
        use(monkeypatch, llm)
        assert node._invoke(["m"]) == "ok"
        assert llm.calls == 1
        assert slept == []

    def test_waits_what_groq_asked_then_retries_once(self, monkeypatch, slept):
        llm = FakeLLM(RateLimit(headers={"retry-after": "3"}), "second try")
        use(monkeypatch, llm)

        assert node._invoke(["m"]) == "second try"
        assert llm.calls == 2
        assert slept == [pytest.approx(3.25)]

    def test_reports_the_rate_limit_when_the_retry_is_limited_too(self, monkeypatch, slept):
        llm = FakeLLM(RateLimit(headers={"retry-after": "2"}), RateLimit(headers={"retry-after": "9"}))
        use(monkeypatch, llm)

        with pytest.raises(DependencyUnavailable) as caught:
            node._invoke(["m"])

        assert llm.calls == 2  # one retry, never a loop
        assert caught.value.code == errors.MOD33_RATE_LIMITED
        assert caught.value.dependency == "groq"
        assert "about 9 seconds" in caught.value.cause

    def test_does_not_wait_when_groq_asks_for_longer_than_the_cap(self, monkeypatch, slept):
        llm = FakeLLM(RateLimit(headers={"retry-after": str(node.OMCS_RATE_LIMIT_MAX_WAIT_S + 40)}))
        use(monkeypatch, llm)

        with pytest.raises(DependencyUnavailable) as caught:
            node._invoke(["m"])

        assert llm.calls == 1
        assert slept == []
        assert caught.value.code == errors.MOD33_RATE_LIMITED

    def test_does_not_retry_a_request_that_is_too_large(self, monkeypatch, slept):
        too_large = RateLimit("Request too large for model `qwen`: Limit 1000, Requested 2048")
        llm = FakeLLM(too_large, "never reached")
        use(monkeypatch, llm)

        with pytest.raises(RateLimit):
            node._invoke(["m"])

        assert llm.calls == 1
        assert slept == []

    def test_other_failures_propagate_without_a_retry(self, monkeypatch, slept):
        llm = FakeLLM(RuntimeError("boom"), "never reached")
        use(monkeypatch, llm)

        with pytest.raises(RuntimeError):
            node._invoke(["m"])

        assert llm.calls == 1
        assert slept == []


def test_the_output_cap_fits_inside_groqs_per_minute_limit():
    # The free tier's limit is 1000 output tokens per minute; asking for more than that in a
    # single request is refused outright, and two calls per audit should fit in one minute.
    assert node.OMCS_MAX_OUTPUT_TOKENS * 2 <= 1000
