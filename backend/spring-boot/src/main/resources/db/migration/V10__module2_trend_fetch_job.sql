-- V10 — Module 2.1: Trend Fetch Job state-tracking table
--
-- Tracks the status of Google Trends fetch jobs per (category, market, week_of).
-- The scheduler queries PENDING + FAILED rows (attempt_count < max_attempts)
-- each run, enabling resume-on-failure without duplicate data.
--
-- Status lifecycle:  PENDING → IN_PROGRESS → SUCCESS
--                                          ↘ FAILED  (attempt_count incremented; retried next run)

CREATE TABLE tbl_trend_fetch_job (
    job_id            UUID            NOT NULL DEFAULT gen_random_uuid(),
    category          VARCHAR(100)    NOT NULL,
    market            VARCHAR(50)     NOT NULL,
    status            VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    week_of           VARCHAR(10)     NOT NULL,  -- ISO format "YYYY-Www" e.g. "2026-W21"

    attempt_count     INT             NOT NULL DEFAULT 0,
    max_attempts      INT             NOT NULL DEFAULT 3,
    last_attempted_at TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,

    -- Result snapshot (populated on SUCCESS; allows downstream queries without a JOIN)
    trend_index        FLOAT,
    rolling_7d_avg     FLOAT,
    rolling_30d_avg    FLOAT,
    rolling_7d_std     FLOAT,
    spike_indicator    BOOLEAN,
    yoy_ratio          FLOAT,
    seasonality_score  FLOAT,
    data_points        INT,
    source             VARCHAR(20),

    last_error        TEXT,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_trend_fetch_job    PRIMARY KEY (job_id),
    CONSTRAINT uq_trend_fetch_job    UNIQUE      (category, market, week_of),
    CONSTRAINT chk_trend_fetch_status CHECK (status IN ('PENDING','IN_PROGRESS','SUCCESS','FAILED'))
);

CREATE INDEX idx_trend_fetch_job_status ON tbl_trend_fetch_job (status, attempt_count);
CREATE INDEX idx_trend_fetch_job_week   ON tbl_trend_fetch_job (week_of, market);
