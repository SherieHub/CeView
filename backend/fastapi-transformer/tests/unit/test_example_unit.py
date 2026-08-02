"""Example pure unit test — no FastAPI app import, no external API calls.

Pattern to copy: test a pure function directly. app.services.forecast_validator
has no heavy dependencies, so this runs instantly with just the base
requirements installed.

Run with: pytest tests/unit -v
"""
from app.services.forecast_validator import validate, MAPE_THRESHOLD


def test_validate_passes_below_threshold():
    result = validate(mape=10.0, mae=1.2, rmse=2.3)

    assert result["passed"] is True
    assert result["low_confidence_disclaimer"] is False
    assert result["message"] == ""


def test_validate_fails_above_threshold():
    result = validate(mape=MAPE_THRESHOLD + 5.0, mae=1.2, rmse=2.3)

    assert result["passed"] is False
    assert result["low_confidence_disclaimer"] is True
    assert "exceeds threshold" in result["message"]
