package com.ceview.module2;

public final class Module2ErrorCodes {

    private Module2ErrorCodes() {}

    // Submodule 2.1 — Market Data Aggregation
    public static final String MOD21_INGESTION_JOB_STARTED    = "MOD21_INGESTION_JOB_STARTED";
    public static final String MOD21_INGESTION_JOB_COMPLETED  = "MOD21_INGESTION_JOB_COMPLETED";
    public static final String MOD21_INGESTION_JOB_FAILED     = "MOD21_INGESTION_JOB_FAILED";
    public static final String MOD21_PYTRENDS_UNAVAILABLE     = "MOD21_PYTRENDS_UNAVAILABLE";
    public static final String MOD21_EXTERNAL_API_ERROR       = "MOD21_EXTERNAL_API_ERROR";
    public static final String MOD21_ENRICHED_DATASET_EMPTY   = "MOD21_ENRICHED_DATASET_EMPTY";

    // Submodule 2.2 — Forecasting and Market Scoring
    public static final String MOD22_FORECAST_STARTED         = "MOD22_FORECAST_STARTED";
    public static final String MOD22_FORECAST_MAPE_WARNING    = "MOD22_FORECAST_MAPE_WARNING";
    public static final String MOD22_SCORING_FAILED           = "MOD22_SCORING_FAILED";
    public static final String MOD22_INFERENCE_FAILED         = "MOD22_INFERENCE_FAILED";
    public static final String MOD22_PROFILE_NOT_READY        = "MOD22_PROFILE_NOT_READY";
    public static final String MOD22_ALERT_GENERATED          = "MOD22_ALERT_GENERATED";
}
