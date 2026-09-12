-- V33 — Module 2 E2E, Step 5 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-04, H-33).
--
-- Adds stats_window_weeks: how many weeks of history backed a row's rolling/
-- spike/seasonality figures, so a consumer can tell a truncated early-backfill
-- window from a full one (e.g. week 1 of a 12-week backfill only ever had a
-- 1-week window, not the usual 7 or 30).
--
-- Deliberately left NULL for every existing row and given NO NOT NULL
-- constraint: there is no honest way to recompute how wide a window backed a
-- row written before this column existed, and inventing a number for it would
-- violate the exact "never a placeholder" principle this step exists to
-- enforce. New rows populate it going forward
-- (MarketDataIngestionService.ingestMarket / backfillHistory).
--
-- ROLLBACK NOTE:
--   ALTER TABLE tbl_market_signal_record DROP COLUMN IF EXISTS stats_window_weeks;
--   (Safe — purely additive, informational column; nothing else derives from it yet.)
--
-- VERIFICATION (see the bottom of this file for the exact SELECT).

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS stats_window_weeks INTEGER;

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
--      -- After a Refresh forecast run for a seeded operator, the CURRENT week's
--      -- row (and any freshly-backfilled rows) should have a real, non-null
--      -- stats_window_weeks; pre-Step-5 rows remain NULL by design:
--      SELECT signal_record_id, iso_year, iso_week, stats_window_weeks
--        FROM tbl_market_signal_record
--       ORDER BY week_start_date DESC
--       LIMIT 20;
