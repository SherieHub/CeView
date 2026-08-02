"""Test-session setup shared by unit and integration tests.

gemini_forecaster.py reads GROQ_API_KEY at import time and hard-fails if it's
missing (no stub mode — see RUNNING.md). This must be set before app.main (or
anything importing gemini_forecaster) is imported by any test module, so it's
set here in conftest rather than per-test. It is a placeholder only — no test
in this suite makes a real Groq API call.
"""
import os

os.environ.setdefault("GROQ_API_KEY", "test-placeholder-key-not-real")
