"""Groq connection settings shared by every LLM caller in this service."""
from __future__ import annotations

import os

# Groq's OpenAI-compatible endpoint (used with the `openai` SDK).
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Default text model; overridable with the GROQ_MODEL environment variable.
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"


def translation_model() -> str:
    """Model used for caption translation and re-localisation.

    GROQ_TRANSLATION_MODEL, else GROQ_MODEL, else DEFAULT_GROQ_MODEL. A blank
    value counts as unset: docker-compose passes ``${GROQ_TRANSLATION_MODEL:-}``
    through as an empty string when the operator has not set it.
    """
    return (
        os.environ.get("GROQ_TRANSLATION_MODEL", "").strip()
        or os.environ.get("GROQ_MODEL", "").strip()
        or DEFAULT_GROQ_MODEL
    )
