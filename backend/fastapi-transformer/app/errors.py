"""Shared error codes for the fastapi-transformer service (Module 2).

The same constants appear in Spring Boot and in the frontend banner output
so that one failure surfaces with the same string everywhere it is logged."""

from __future__ import annotations

# ─── Module 2.1 — Market Data Aggregation ────────────────────────────────────
MOD21_PYTRENDS_UNAVAILABLE   = "MOD21_PYTRENDS_UNAVAILABLE"
MOD21_EXTERNAL_API_ERROR     = "MOD21_EXTERNAL_API_ERROR"
MOD21_ENRICHED_DATASET_EMPTY = "MOD21_ENRICHED_DATASET_EMPTY"
MOD21_INGESTION_JOB_FAILED   = "MOD21_INGESTION_JOB_FAILED"

# ─── Module 2.2 — Forecasting and Market Scoring ─────────────────────────────
MOD22_FORECAST_MAPE_WARNING  = "MOD22_FORECAST_MAPE_WARNING"
MOD22_SCORING_FAILED         = "MOD22_SCORING_FAILED"
MOD22_PROFILE_NOT_READY      = "MOD22_PROFILE_NOT_READY"
