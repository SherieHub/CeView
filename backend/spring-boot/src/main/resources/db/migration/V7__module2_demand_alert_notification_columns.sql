-- ─── Module 2: Add notification-state columns to tbl_demand_alert ─────────────
--
-- is_read  — allows the frontend to persist read/unread state for TrendAlertCard
-- trend    — human-readable trend label stored at alert creation time
--            (e.g. "Rising demand window") so the NotificationDto can surface it
--            without dynamic re-computation on every read.

ALTER TABLE tbl_demand_alert
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trend   VARCHAR(120);

-- ─── Composite unique index on tbl_market_signal_record ───────────────────────
--
-- Prevents duplicate signal records for the same (profile, market, calendar day).
-- The nightly ingestion job fires once per day; this index is the safety net.
CREATE UNIQUE INDEX IF NOT EXISTS uq_msr_profile_market_day
    ON tbl_market_signal_record (business_profile_id, target_market, (aggregated_at::date));

-- ─── Covering index for the hot query path ────────────────────────────────────
--
-- findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc is called in
-- both ForecastingService and EnrichedSequenceBuilder.  The composite DESC
-- index allows Postgres to serve the query without a sort step.
CREATE INDEX IF NOT EXISTS idx_msr_profile_market_date_desc
    ON tbl_market_signal_record (business_profile_id, target_market, aggregated_at DESC);
