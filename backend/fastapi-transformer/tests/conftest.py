"""Test-session setup shared by unit and integration tests."""
import os

# Startup must not require an external credential. Tests exercise the local,
# deterministic contract engine unless a test reloads the registry explicitly.
os.environ.pop("GROQ_API_KEY", None)
os.environ["FORECAST_ENGINE"] = "stub"
