-- V20 — Restore the (category, market) dimension through the Module 2 chain.
--
-- tbl_trend_fetch_job already fetches per (category, market); the dimension was
-- being collapsed at aggregation into tbl_market_signal_record. These columns
-- stop that collapse so demand alerts can be attributed to the category whose
-- signal produced them (ARCHITECTURE_SPEC §Module 2 signal grid).
--
-- Nullable, because pre-V20 rows have no category and must keep resolving.
-- Readers treat NULL as "applies to all of the profile's categories".

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- yoy_ratio is computed during ingestion and passed to the forecaster as an
-- input, but was never persisted downstream — so MarketDto could not surface it.
ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS yoy_ratio DOUBLE PRECISION;

ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS yoy_ratio DOUBLE PRECISION;

-- The grid's natural lookup: "this profile's signal for this category+market".
CREATE INDEX IF NOT EXISTS idx_msr_profile_category_market
    ON tbl_market_signal_record (business_profile_id, category, target_market);

CREATE INDEX IF NOT EXISTS idx_fr_profile_category_market
    ON tbl_forecast_result (business_profile_id, category, target_market);
