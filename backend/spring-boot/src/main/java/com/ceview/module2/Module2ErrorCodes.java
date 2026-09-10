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
    /** Neither a live fetch nor a last-known-good DB row exists for a GDP/forex
     *  macro input (Step 6, C-06, H-18) — thrown instead of the deleted
     *  GDP_DEFAULTS/FOREX_DEFAULTS silent constant fallback. */
    public static final String MOD21_MACRO_UNAVAILABLE        = "MOD21_MACRO_UNAVAILABLE";

    // Submodule 2.2 — Forecasting and Market Scoring
    public static final String MOD22_FORECAST_STARTED         = "MOD22_FORECAST_STARTED";
    public static final String MOD22_FORECAST_MAPE_WARNING    = "MOD22_FORECAST_MAPE_WARNING";
    public static final String MOD22_SCORING_FAILED           = "MOD22_SCORING_FAILED";
    public static final String MOD22_INFERENCE_FAILED         = "MOD22_INFERENCE_FAILED";
    /** The 12-week feature matrix could not be constructed from real data. */
    public static final String MOD22_NO_MARKET_DATA           = "MOD22_NO_MARKET_DATA";
    public static final String MOD22_PROFILE_NOT_READY        = "MOD22_PROFILE_NOT_READY";
    public static final String MOD22_ALERT_GENERATED          = "MOD22_ALERT_GENERATED";
}
