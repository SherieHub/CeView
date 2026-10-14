"""Groq connection settings shared by every LLM caller in this service."""
from __future__ import annotations

# Groq's OpenAI-compatible endpoint (used with the `openai` SDK).
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Default text model; overridable with the GROQ_MODEL environment variable.
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
