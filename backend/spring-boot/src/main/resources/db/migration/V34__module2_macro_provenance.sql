-- V34 — Module 2 E2E, Step 6 (docs/module-2/MODULE_2_E2E_CONTRACT.md; C-06, H-18).
--
-- Adds provenance for GDP/forex macro inputs: which tier produced the value
-- ("live" fetch vs. "last_known_good" DB reuse) and when that specific
-- reading was actually taken. Replaces ExternalMarketDataClient's silent
-- GDP_DEFAULTS/FOREX_DEFAULTS constant fallback (deleted this step) with a
-- three-tier policy — live fetch, then last-known-good, then a hard failure
-- (MOD21_MACRO_UNAVAILABLE) — and these columns are what let a consumer
-- (MarketDto.gdpSource/forexSource/macroAsOf) tell the operator which tier
-- actually produced the number on screen, rather than presenting a stale or
-- synthetic reading as fresh.
--
-- Deliberately left NULL for every existing row and given NO NOT NULL
-- constraint or backfill: there is no honest way to know which tier produced
-- a row written before this column existed, and inventing "live" for all of
-- them would misrepresent genuinely-stale historical data as fresh — the
-- exact "never a placeholder" principle this step exists to enforce. New
-- rows populate all four columns going forward (ForecastingService.
-- persistEconomicTrend).
--
-- ROLLBACK NOTE:
--   ALTER TABLE tbl_market_economic_trend
--     DROP COLUMN IF EXISTS gdp_source,
--     DROP COLUMN IF EXISTS gdp_fetched_at,
--     DROP COLUMN IF EXISTS forex_source,
--     DROP COLUMN IF EXISTS forex_fetched_at;
--   (Safe — purely additive, informational columns; nothing else derives from them yet.)
--
-- VERIFICATION (run manually after deploy; not executed by Flyway):
--   -- After a Refresh forecast run, the newest row per market should carry a
--   -- non-null gdp_source/forex_source ("live" or "last_known_good"):
--   SELECT trend_id, market, gdp_source, gdp_fetched_at, forex_source, forex_fetched_at, fetched_at
--     FROM tbl_market_economic_trend
--    ORDER BY fetched_at DESC
--    LIMIT 20;

ALTER TABLE tbl_market_economic_trend
    ADD COLUMN IF NOT EXISTS gdp_source       VARCHAR(32),
    ADD COLUMN IF NOT EXISTS gdp_fetched_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS forex_source     VARCHAR(32),
    ADD COLUMN IF NOT EXISTS forex_fetched_at TIMESTAMPTZ;
