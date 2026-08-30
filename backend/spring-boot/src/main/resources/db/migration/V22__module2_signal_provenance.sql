-- V22 — Persist where each market signal actually came from.
--
-- tbl_trend_fetch_job.source already records 'pytrends' or 'stub', but that
-- distinction was lost at aggregation: once a stub trend index became a
-- tbl_market_signal_record row, nothing downstream could tell it from a real
-- measurement. Last-known-good reads (Task 12) are impossible without this —
-- they would faithfully resurrect the very stub data Phase 1 removes.
--
-- 'unknown' is the backfill value for pre-V22 rows. Readers treat it as
-- untrusted, the same as 'stub' — see V23, which purges what it can trace.

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'unknown';

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS source_fetched_at TIMESTAMPTZ;

-- Task 12's hot path: "the newest genuinely-measured rows for this
-- profile+category+market".
CREATE INDEX IF NOT EXISTS idx_msr_source_recency
    ON tbl_market_signal_record (business_profile_id, target_market, source, aggregated_at DESC);

COMMENT ON COLUMN tbl_market_signal_record.source IS
    'pytrends = genuinely measured; stub = synthetic (pre-V23 only); unknown = pre-V22, untrusted';
