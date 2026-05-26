-- H2 mirror of db/migration/V4. Key differences from Postgres:
--   RANDOM_UUID() instead of gen_random_uuid()
--   TIMESTAMP instead of TIMESTAMPTZ
--   CLOB instead of TEXT
--   RENAME COLUMN syntax: H2 2.x supports ALTER TABLE ... RENAME COLUMN ... TO ...

-- ─── Submodule 2.1: Ingestion job audit log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_ingestion_job_log (
    job_log_id        UUID PRIMARY KEY DEFAULT RANDOM_UUID(),
    job_name          VARCHAR(80)  NOT NULL,
    status            VARCHAR(40)  NOT NULL,
    markets_processed INTEGER,
    records_ingested  INTEGER,
    error_message     CLOB,
    started_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    completed_at      TIMESTAMP
);

-- ─── Submodule 2.1: rolling_std_dev on market signal record ──────────────────
ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS rolling_std_dev FLOAT;

-- ─── Submodule 2.2: additional columns on forecast_result ────────────────────
ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS mae                    FLOAT;
ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS rmse                   FLOAT;
ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS forecast_horizon_weeks INTEGER;

-- ─── Submodule 2.2: additional columns on market_score ───────────────────────
ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS gdp_per_capita_growth  FLOAT;
ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS forex_vs_php           FLOAT;
ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS historical_arrivals    INTEGER;
ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS market_rank            INTEGER;

-- ─── Submodule 2.2: window date on demand_alert ──────────────────────────────
ALTER TABLE tbl_demand_alert
    ADD COLUMN IF NOT EXISTS window_open_date TIMESTAMP;

-- ─── Rename rank_value → market_rank to align with Postgres schema ───────────
ALTER TABLE tbl_orig_weekly_demand_value
    RENAME COLUMN rank_value TO market_rank;

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
