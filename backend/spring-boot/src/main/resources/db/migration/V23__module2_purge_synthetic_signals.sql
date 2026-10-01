-- V23 — Remove signal records derived from synthetic trend data.
--
-- Task 12 makes forecasts read the newest *real* signal record when a live fetch
-- fails. Without this purge, that last-known-good read would faithfully resurrect
-- stub data — the exact failure mode Phase 1 exists to eliminate.
--
-- Three passes, innermost dependency first, so no orphaned forecast survives:
--   1. Mark signal records traceable to a stub fetch job
--   2. Delete forecast results and market scores derived from them
--   3. Delete the signal records themselves
--
-- Rows with no traceable job keep source='unknown' from V22 and are simply never
-- trusted by readers. They are NOT deleted: they may well be real, and deleting
-- unclassifiable history is a worse default than declining to rely on it.

-- 1 — attribute what we can trace. A signal record matches a job when the
--     profile's category and market and the aggregation week line up.
UPDATE tbl_market_signal_record msr
   SET source = j.source,
       source_fetched_at = j.completed_at
  FROM tbl_trend_fetch_job j
 WHERE msr.source = 'unknown'
   AND msr.target_market = j.market
   AND msr.category IS NOT DISTINCT FROM j.category
   AND to_char(msr.aggregated_at, 'IYYY-"W"IW') = j.week_of
   AND j.source IS NOT NULL;

-- 2 — drop derived forecasts. tbl_market_score hangs off tbl_forecast_result,
--     so it goes first.
DELETE FROM tbl_market_score
 WHERE forecast_result_id IN (
       SELECT fr.forecast_result_id
         FROM tbl_forecast_result fr
        WHERE EXISTS (
              SELECT 1 FROM tbl_market_signal_record msr
               WHERE msr.source = 'stub'
                 AND msr.business_profile_id = fr.business_profile_id
                 AND msr.target_market       = fr.target_market
                 AND msr.category IS NOT DISTINCT FROM fr.category));

DELETE FROM tbl_forecast_result fr
 WHERE EXISTS (
       SELECT 1 FROM tbl_market_signal_record msr
        WHERE msr.source = 'stub'
          AND msr.business_profile_id = fr.business_profile_id
          AND msr.target_market       = fr.target_market
          AND msr.category IS NOT DISTINCT FROM fr.category);

-- 3 — and the synthetic signals themselves.
DELETE FROM tbl_market_signal_record WHERE source = 'stub';

-- Leave a trace in the Flyway log of how much was fabricated.
DO $$
DECLARE remaining_unknown INT;
BEGIN
    SELECT COUNT(*) INTO remaining_unknown
      FROM tbl_market_signal_record WHERE source = 'unknown';
    RAISE NOTICE 'V23: purged synthetic signals; % rows remain unattributed (source=unknown)',
        remaining_unknown;
END $$;
