"""`source` cannot hold "fallback" any more — Pydantic rejects it at runtime.

This is the mechanism that outlives any grep guard: reintroducing a fallback would
require widening this type, which is a visible and arguable diff.

Run with: pytest tests/unit/test_source_is_closed.py -v
"""
import pytest
from pydantic import ValidationError

from app.routers.content import ContentResponse
from app.routers.creative import CreativeDirectionResponse


def test_content_source_rejects_fallback():
    with pytest.raises(ValidationError):
        ContentResponse(market={}, framework="SOR", captions={}, source="fallback")


def test_content_source_accepts_groq():
    assert ContentResponse(market={}, framework="SOR", captions={}, source="groq").source == "groq"


def test_creative_source_rejects_fallback():
    with pytest.raises(ValidationError):
        CreativeDirectionResponse(
            visualGuide=[], shots=[], moodboard={}, platformRecommendations={},
            source="fallback",
        )


def test_source_has_no_default():
    """A default of "fallback" is how the old shape let an unset source pass."""
    with pytest.raises(ValidationError):
        ContentResponse(market={}, framework="SOR", captions={})
