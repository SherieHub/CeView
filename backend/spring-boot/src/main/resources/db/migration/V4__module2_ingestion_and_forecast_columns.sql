-- ─── Submodule 2.1: Ingestion job audit log ──────────────────────────────────
CREATE TABLE tbl_ingestion_job_log (
    job_log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name          VARCHAR(80)  NOT NULL,
    status            VARCHAR(40)  NOT NULL,
    markets_processed INTEGER,
    records_ingested  INTEGER,
    error_message     TEXT,
    started_at        TIMESTAMPTZ  DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

-- ─── Submodule 2.1: rolling_std_dev on market signal record ──────────────────
ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS rolling_std_dev FLOAT;

-- ─── Submodule 2.2: additional columns on forecast_result ────────────────────
ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS mae                    FLOAT,
    ADD COLUMN IF NOT EXISTS rmse                   FLOAT,
    ADD COLUMN IF NOT EXISTS forecast_horizon_weeks INTEGER;

-- ─── Submodule 2.2: additional columns on market_score ───────────────────────
ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS gdp_per_capita_growth  FLOAT,
    ADD COLUMN IF NOT EXISTS forex_vs_php           FLOAT,
    ADD COLUMN IF NOT EXISTS historical_arrivals    INTEGER,
    ADD COLUMN IF NOT EXISTS market_rank            INTEGER;

-- ─── Submodule 2.2: window date on demand_alert ──────────────────────────────
ALTER TABLE tbl_demand_alert
    ADD COLUMN IF NOT EXISTS window_open_date TIMESTAMPTZ;

-- ─── Rename rank → market_rank to avoid reserved-word conflicts ───────────────
ALTER TABLE tbl_orig_weekly_demand_value
    RENAME COLUMN rank TO market_rank;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_msr_profile_market
    ON tbl_market_signal_record(business_profile_id, target_market);

CREATE INDEX IF NOT EXISTS idx_msr_aggregated_at
    ON tbl_market_signal_record(aggregated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ijl_job_name_started
    ON tbl_ingestion_job_log(job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_fr_profile_market
    ON tbl_forecast_result(business_profile_id, target_market);

CREATE INDEX IF NOT EXISTS idx_ms_forecast_result_id
    ON tbl_market_score(forecast_result_id);

CREATE INDEX IF NOT EXISTS idx_da_market_score_id
    ON tbl_demand_alert(market_score_id);
