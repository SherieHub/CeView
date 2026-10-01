-- V38 — Module 2 E2E, Step 16 (C-07, C-08, C-09).
--
-- MarketDataIngestionJob now triggers the forecast pipeline for every
-- profile it successfully ingests (closing the "scheduler writes rows that
-- never become alerts" gap), with bounded concurrency and per-profile
-- failure isolation. These two columns let a daily run's forecast-trigger
-- outcome be read back from tbl_ingestion_job_log the same way
-- markets_processed/records_ingested already report the ingestion phase.
--
-- Nullable, no backfill: a run logged before this step never attempted a
-- forecast trigger, so there is no honest count to invent for it.
--
-- ROLLBACK NOTE:
--   ALTER TABLE tbl_ingestion_job_log
--     DROP COLUMN IF EXISTS forecasts_triggered,
--     DROP COLUMN IF EXISTS forecast_failures;
--   (Safe — purely additive, informational columns.)
--
-- VERIFICATION (run manually after deploy; not executed by Flyway):
--   SELECT job_name, status, markets_processed, records_ingested,
--          forecasts_triggered, forecast_failures, started_at, completed_at
--     FROM tbl_ingestion_job_log
--    ORDER BY started_at DESC
--    LIMIT 10;

ALTER TABLE tbl_ingestion_job_log
    ADD COLUMN IF NOT EXISTS forecasts_triggered INTEGER,
    ADD COLUMN IF NOT EXISTS forecast_failures   INTEGER;
