"""The prescriptive report is generated or unavailable.

Run with: pytest tests/unit/test_report_no_fallback.py -v
"""
from app.routers import report


def test_fallback_report_helper_no_longer_exists():
    assert not hasattr(report, "_fallback_report")
