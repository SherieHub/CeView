-- H2 mirror of db/migration/V8.
-- Differences from Postgres:
--   H2 DECIMAL(p,s) supported. No expression indexes needed.
--   H2 does not require IF NOT EXISTS for ADD COLUMN (syntax differs per version);
--   using IF NOT EXISTS for safety with H2 2.x+.

-- H2 2.x does not support multiple comma-separated ADD COLUMN clauses in a
-- single ALTER TABLE — split into one statement per column.
ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS rolling_average_7d  DECIMAL(8, 4);
ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS rolling_average_30d DECIMAL(8, 4);
ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS yoy_ratio           DECIMAL(8, 4);

CREATE INDEX IF NOT EXISTS idx_msr_profile_market_date_asc
    ON tbl_market_signal_record (business_profile_id, target_market, aggregated_at ASC);
