-- ─── Module 2 Phase 2: Seasonal Shift Detection columns ─────────────────────
-- Adds rolling average / YoY columns produced by the new SeasonalShiftDetector
-- (CeView_SeasonalShift_Detection.md) to tbl_market_signal_record.
--
-- rolling_average_7d  : 7-period rolling mean  (≈ 7-day  MA with weekly data)
-- rolling_average_30d : 30-period rolling mean (≈ 30-day MA with weekly data)
-- yoy_ratio           : rolling_7d_avg_now / rolling_7d_avg_52_weeks_prior
--                       NULL when fewer than 59 weeks of history exist.
--
-- The existing `rolling_average` column is kept (contains the 7-period legacy
-- value) for backward compatibility; downstream code should prefer rolling_average_7d.

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS rolling_average_7d  FLOAT,
    ADD COLUMN IF NOT EXISTS rolling_average_30d FLOAT,
    ADD COLUMN IF NOT EXISTS yoy_ratio           FLOAT;

-- ─── Covering index for the Gemini trend-series query ─────────────────────────
-- Supports: SELECT trend_index … ORDER BY aggregated_at ASC (build chronological series)
CREATE INDEX IF NOT EXISTS idx_msr_profile_market_date_asc
    ON tbl_market_signal_record (business_profile_id, target_market, aggregated_at ASC);
