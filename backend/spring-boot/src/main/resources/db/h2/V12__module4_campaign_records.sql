-- V12 — Module 4: Campaign Records  (H2 in-memory variant for local dev / CI)
-- ─────────────────────────────────────────────────────────────────────────────
-- H2 differences vs the PostgreSQL migration:
--   · UUID default: RANDOM_UUID() instead of gen_random_uuid()
--   · TIMESTAMPTZ → TIMESTAMP WITH TIME ZONE (H2 2.x syntax)
--   · DOUBLE PRECISION → DOUBLE  (H2 alias)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tbl_campaign_records (
    campaign_id     UUID                    NOT NULL DEFAULT RANDOM_UUID(),

    -- ── Raw operator inputs ───────────────────────────────────────────────
    impressions     BIGINT                  NOT NULL DEFAULT 0,
    clicks          BIGINT                  NOT NULL DEFAULT 0,
    ad_spend        DOUBLE                  NOT NULL DEFAULT 0,
    revenue         DOUBLE                  NOT NULL DEFAULT 0,
    conversions     BIGINT                  NOT NULL DEFAULT 0,
    bookings        BIGINT                  NOT NULL DEFAULT 0,
    new_customers   BIGINT                  NOT NULL DEFAULT 0,

    -- ── Derived KPIs ──────────────────────────────────────────────────────
    ctr             DOUBLE,
    cpc             DOUBLE,
    conv_rate       DOUBLE,
    roas            DOUBLE,
    cac             DOUBLE,

    -- ── PES result ────────────────────────────────────────────────────────
    pes_score       DOUBLE,
    pes_label       VARCHAR(50),

    -- ── Analysis window metadata ──────────────────────────────────────────
    analysis_weeks  INTEGER,
    period_start    VARCHAR(20),
    period_end      VARCHAR(20),

    -- ── Audit ─────────────────────────────────────────────────────────────
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE,

    CONSTRAINT pk_campaign_records PRIMARY KEY (campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_records_created_at
    ON tbl_campaign_records (created_at DESC);
