"""trend_service must raise, never fabricate.

Before this change, an unavailable pytrends produced a curated 52-week series that
flowed into real forecasts indistinguishably from measured data.

Run with: pytest tests/unit/test_trend_service_no_stub.py -v
"""
import pytest

from app.services import trend_service
from app.unavailable import DependencyUnavailable


def test_raises_when_pytrends_is_not_installed(monkeypatch):
    monkeypatch.setattr(trend_service, "_TrendReq", None)
    monkeypatch.setattr(trend_service, "_IMPORT_ERROR", "No module named 'pytrends'")

    with pytest.raises(DependencyUnavailable) as excinfo:
        trend_service.fetch_current_index("korea", "Coastal & Island")

    assert excinfo.value.dependency == "pytrends"
    assert "No module named" in excinfo.value.cause
    assert excinfo.value.status_code == 503


def test_raises_with_the_upstream_reason_on_a_fetch_failure(monkeypatch):
    class _Boom:
        def __init__(self, *_args, **_kwargs):
            raise RuntimeError("429 Too Many Requests")

    monkeypatch.setattr(trend_service, "_TrendReq", _Boom)

    with pytest.raises(DependencyUnavailable) as excinfo:
        trend_service.fetch_current_index("korea", "Coastal & Island")

    assert "429" in excinfo.value.cause


def test_fetch_and_process_raises_when_pytrends_missing(monkeypatch):
    monkeypatch.setattr(trend_service, "_TrendReq", None)
    monkeypatch.setattr(trend_service, "_IMPORT_ERROR", "No module named 'pytrends'")

    with pytest.raises(DependencyUnavailable):
        trend_service.fetch_and_process("korea", "Coastal & Island")


def test_fetch_trend_history_raises_when_pytrends_missing(monkeypatch):
    monkeypatch.setattr(trend_service, "_TrendReq", None)
    monkeypatch.setattr(trend_service, "_IMPORT_ERROR", "boom")

    with pytest.raises(DependencyUnavailable):
        trend_service.fetch_trend_history("japan", "Coastal & Island", 12)


def test_no_stub_symbols_survive():
    # Every synthetic path was removed, not just the three the parent plan named.
    for symbol in (
        "_STUB_BASE",
        "_STUB_SERIES",
        "_stub_result",
        "_stub_current_index",
        "_stub_history",
        "_stub_category_volume",
    ):
        assert not hasattr(trend_service, symbol), f"{symbol} should be gone"
