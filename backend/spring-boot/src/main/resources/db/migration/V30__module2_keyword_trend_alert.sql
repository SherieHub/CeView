-- V30 — Module 2 E2E, Step 2 (docs/module-2/MODULE_2_E2E_CONTRACT.md §7 background).
--
-- New table: persisted keyword-trend notifications. Today
-- CategoryRankNotificationService.buildForCategories() manufactures a fresh
-- UUID and alertMessage on every dashboard load, so read state can never stick
-- and every load re-runs the underlying PyTrends round trip. This table gives
-- those notifications a stable identity, one per (profile, category, ISO week),
-- so a later step can persist-and-reuse instead of regenerate.
--
-- This is a brand-new, currently-unused table: nothing reads or writes it yet
-- (that wiring is a later, dedicated step), so unlike V28/V29 there is no
-- existing-data backfill and no risk to a running write path. Every column can
-- be NOT NULL from the start.
--
-- Idempotency: the unique constraint on (business_profile_id, category, iso_year,
-- iso_week) is the mechanism — a second attempt to record the same profile's
-- category for the same ISO week must UPDATE the existing row (or be rejected),
-- never insert a duplicate.
--
-- ROLLBACK NOTE:
--   Unused table — safe to drop outright, no data-loss caveat:
--     DROP TABLE IF EXISTS tbl_keyword_trend_alert;
--
-- VERIFICATION (see the bottom of this file for the exact statements).

CREATE TABLE tbl_keyword_trend_alert (
    keyword_trend_alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_profile_id    UUID NOT NULL
        REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    category                VARCHAR(100) NOT NULL,
    target_market           VARCHAR(60)  NOT NULL,
    top_keyword             VARCHAR(255) NOT NULL,
    alert_message           TEXT         NOT NULL,
    alert_level             VARCHAR(40)  NOT NULL,
    iso_year                SMALLINT     NOT NULL,
    iso_week                SMALLINT     NOT NULL,
    is_read                 BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_keyword_trend_alert_profile_category_week
        UNIQUE (business_profile_id, category, iso_year, iso_week),
    CONSTRAINT chk_keyword_trend_alert_market CHECK (target_market IN ('korea', 'japan', 'usa')),
    CONSTRAINT chk_keyword_trend_alert_level  CHECK (alert_level IN ('INFO', 'WARNING', 'CRITICAL'))
);

CREATE INDEX idx_keyword_trend_alert_profile_created
    ON tbl_keyword_trend_alert (business_profile_id, created_at DESC);

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
-- 1. The table and its constraints exist with the expected shape:
--      SELECT column_name, is_nullable, data_type
--        FROM information_schema.columns
--       WHERE table_name = 'tbl_keyword_trend_alert'
--       ORDER BY ordinal_position;
--
-- 2. Idempotency actually rejects a duplicate week (run in a scratch
--    transaction against a real business_profile_id, then ROLLBACK):
--      BEGIN;
--      INSERT INTO tbl_keyword_trend_alert
--        (business_profile_id, category, target_market, top_keyword, alert_message,
--         alert_level, iso_year, iso_week)
--      VALUES ('<any existing business_profile_id>', 'Coastal & Island', 'korea',
--              'cebu diving', 'Keyword trend detected.', 'INFO', 2026, 37);
--      -- second insert with the same (business_profile_id, category, iso_year, iso_week)
--      -- must raise a unique_violation:
--      INSERT INTO tbl_keyword_trend_alert
--        (business_profile_id, category, target_market, top_keyword, alert_message,
--         alert_level, iso_year, iso_week)
--      VALUES ('<same business_profile_id>', 'Coastal & Island', 'japan',
--              'cebu island hopping', 'Different keyword, same week.', 'INFO', 2026, 37);
--      ROLLBACK;
