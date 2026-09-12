-- V37 — Module 2 E2E, Step 15 (audit H-19).
--
-- tbl_market_route_reference gains a reference peak-months list. It is the
-- FALLBACK the radar drawer shows when a market does not yet have >= 52 weeks of
-- weekly signal history for ForecastingService.derivePeakMonths() to rank the
-- calendar months by mean seasonality itself. MarketDto.peakMonthsSource tells
-- the two apart in the UI ("reference" vs "seasonal_history").
--
-- Seeded verbatim from ForecastingService.PEAK_MONTHS as it stood immediately
-- before this step (korea Jul/Aug/Dec/Jan, japan Apr/May/Aug/Mar,
-- usa Jun/Jul/Aug/Dec). Kept in lock-step with
-- com.ceview.module2.submodule21.MarketRouteReferenceData.
--
-- ROLLBACK NOTE:
--   ALTER TABLE tbl_market_route_reference DROP COLUMN IF EXISTS peak_months_json;

ALTER TABLE tbl_market_route_reference
    ADD COLUMN IF NOT EXISTS peak_months_json TEXT;

UPDATE tbl_market_route_reference SET peak_months_json = '["Jul","Aug","Dec","Jan"]' WHERE market = 'korea';
UPDATE tbl_market_route_reference SET peak_months_json = '["Apr","May","Aug","Mar"]' WHERE market = 'japan';
UPDATE tbl_market_route_reference SET peak_months_json = '["Jun","Jul","Aug","Dec"]' WHERE market = 'usa';

ALTER TABLE tbl_market_route_reference
    ALTER COLUMN peak_months_json SET NOT NULL;

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
--      SELECT market, peak_months_json FROM tbl_market_route_reference ORDER BY market;
--      -- expect 3 rows, each a 4-element JSON array of month abbreviations
