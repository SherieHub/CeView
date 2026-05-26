-- H2 mirror of db/migration/V7. Key differences from Postgres:
--   H2 does not support expression indexes (aggregated_at::date) — index omitted.
--   H2 UNIQUE INDEX over nullable columns behaves correctly for IS NULL rows.

-- ─── Module 2: Add notification-state columns to tbl_demand_alert ─────────────
ALTER TABLE tbl_demand_alert
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE tbl_demand_alert
    ADD COLUMN IF NOT EXISTS trend VARCHAR(120);

-- ─── Covering index for the hot query path ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_msr_profile_market_date_desc
    ON tbl_market_signal_record (business_profile_id, target_market, aggregated_at DESC);
