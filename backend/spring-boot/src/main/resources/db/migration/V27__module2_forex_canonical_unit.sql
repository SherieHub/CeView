-- V27 — Module 2 E2E, Step 2 (docs/module-2/MODULE_2_E2E_CONTRACT.md §1).
--
-- Normalizes every stored forex value onto ONE canonical unit: PHP per 1 unit of the
-- foreign currency (e.g. korea ≈ 0.0416, japan ≈ 0.387, usa ≈ 58.6). Before this
-- migration, two writers disagreed:
--   - ExternalMarketDataClient (live ingestion) stored foreign units per 1 PHP
--     (korea ≈ 23.8, japan ≈ 2.1, usa ≈ 0.018).
--   - V18__module2_module3_seed_data.sql already stored PHP per 1 foreign unit
--     (korea ≈ 0.0413-0.0416, japan ≈ 0.384-0.387, usa ≈ 57.42-58.65).
-- Both cannot be inverted the same way, so this migration must tell them apart.
--
-- DISCRIMINATOR (documented, not "blind inversion"):
--   1. Provenance test — V18 seed rows use fixed, literal primary keys:
--        tbl_market_signal_record   : '50000000-...' (most-recent week) and
--                                      '51000000-...' (prior week)
--        tbl_market_score           : '70000000-...'
--        tbl_market_economic_trend  : '90000000-...' (exactly 3 global rows)
--      Any row whose primary key does NOT match one of these prefixes was written
--      by live ingestion and is a foreign-per-PHP candidate.
--   2. Magnitude guard (defensive backstop, applied in addition to #1) — real
--      exchange rates put every canonical PHP-per-foreign value for korea/japan
--      below 1.0 and every canonical value for usa above 1.0, with wide margins
--      on both sides of the inversion boundary (23.8 vs 0.0416 for KRW; 2.1 vs
--      0.387 for JPY; 0.018 vs 58.6 for USD). A boundary of 1.5 sits safely
--      between both directions for all three markets. This guard means a rerun
--      of this migration, or a provenance test that missed a row, can never
--      invert an already-canonical value a second time.
-- A row is inverted only when BOTH tests agree it is foreign-per-PHP.
--
-- Guards: every UPDATE requires the source value to be NOT NULL and > 0 before
-- dividing, so a null, zero, or negative historic value is left untouched rather
-- than producing a divide-by-zero or an invented rate. JSON elements are
-- inverted individually with the same zero/null guard; a JSON value that is
-- absent or JSON null is preserved as null, never fabricated.
--
-- Scope note: this migration also converts tbl_market_signal_record.forex_rate
-- and tbl_market_economic_trend.forex_latest, in addition to the
-- tbl_market_score.forex_vs_php / forex_trend_json pair — the contract's unit
-- table (§1) requires the canonical unit at all four locations, and leaving
-- forex_rate/forex_latest inverted while forex_vs_php/forex_trend_json are
-- fixed would leave the system in a self-contradictory state.
--
-- ROLLBACK NOTE:
--   This repository has no down-migration convention (V1-V26 are all forward-only),
--   and none is added here. A byte-perfect rollback is not algorithmically
--   recoverable after this migration runs: once a converted korea/japan value is
--   back under 1.0, the magnitude guard can no longer tell "was already canonical"
--   apart from "was just converted." The supported rollback path is restoring
--   tbl_market_signal_record, tbl_market_score and tbl_market_economic_trend from
--   the pre-deploy backup taken before this migration.
--   If a rollback must be attempted anyway, in the SAME maintenance window and
--   before any new data has been written, running this exact discriminator in
--   reverse (still excluding the V18 seed-id prefixes, and now testing for values
--   ALREADY in canonical range) re-inverts only the rows this migration touched:
--     UPDATE tbl_market_signal_record SET forex_rate = 1.0 / forex_rate
--      WHERE forex_rate > 0 AND signal_record_id::text NOT LIKE '50000000-%'
--        AND signal_record_id::text NOT LIKE '51000000-%'
--        AND ((target_market IN ('korea','japan') AND forex_rate < 1.5)
--          OR (target_market = 'usa' AND forex_rate > 1.5));
--   (mirror for tbl_market_score.forex_vs_php and tbl_market_economic_trend,
--   reversing each boundary test the same way).
--
-- VERIFICATION (see the bottom of this file for the exact SELECTs).

-- ── tbl_market_economic_trend.forex_unit — explicit unit marker ────────────
ALTER TABLE tbl_market_economic_trend
    ADD COLUMN IF NOT EXISTS forex_unit VARCHAR(32) NOT NULL DEFAULT 'PHP_PER_FOREIGN';

-- ── tbl_market_signal_record.forex_rate ─────────────────────────────────────
UPDATE tbl_market_signal_record
   SET forex_rate = 1.0 / forex_rate
 WHERE forex_rate IS NOT NULL
   AND forex_rate > 0
   AND signal_record_id::text NOT LIKE '50000000-%'
   AND signal_record_id::text NOT LIKE '51000000-%'
   AND (
        (target_market IN ('korea', 'japan') AND forex_rate > 1.5)
     OR (target_market = 'usa' AND forex_rate < 1.5)
   );

-- ── tbl_market_score.forex_vs_php (joined to forecast_result for the market) ─
UPDATE tbl_market_score ms
   SET forex_vs_php = 1.0 / ms.forex_vs_php
  FROM tbl_forecast_result fr
 WHERE ms.forecast_result_id = fr.forecast_result_id
   AND ms.forex_vs_php IS NOT NULL
   AND ms.forex_vs_php > 0
   AND ms.market_score_id::text NOT LIKE '70000000-%'
   AND (
        (fr.target_market IN ('korea', 'japan') AND ms.forex_vs_php > 1.5)
     OR (fr.target_market = 'usa' AND ms.forex_vs_php < 1.5)
   );

-- ── tbl_market_economic_trend.forex_trend_json (element-wise, null-safe) ────
-- Direction is decided once per row from forex_latest (below), before forex_latest
-- itself is overwritten, so every element in one row is converted consistently.
UPDATE tbl_market_economic_trend t
   SET forex_trend_json = sub.inverted
  FROM (
        SELECT met.trend_id,
               jsonb_agg(
                 jsonb_build_object(
                   'date', elem->>'date',
                   'value', CASE
                              WHEN NOT (elem ? 'value') OR elem->'value' = 'null'::jsonb THEN NULL
                              WHEN (elem->>'value')::DOUBLE PRECISION = 0 THEN NULL
                              ELSE 1.0 / (elem->>'value')::DOUBLE PRECISION
                            END
                 ) ORDER BY ord
               )::TEXT AS inverted
          FROM tbl_market_economic_trend met,
               jsonb_array_elements(met.forex_trend_json::jsonb) WITH ORDINALITY AS x(elem, ord)
         WHERE met.trend_id::text NOT LIKE '90000000-%'
           AND met.forex_trend_json IS NOT NULL
           AND met.forex_latest IS NOT NULL
           AND met.forex_latest > 0
           AND (
                (met.market IN ('korea', 'japan') AND met.forex_latest > 1.5)
             OR (met.market = 'usa' AND met.forex_latest < 1.5)
           )
         GROUP BY met.trend_id
       ) sub
 WHERE t.trend_id = sub.trend_id;

-- ── tbl_market_economic_trend.forex_latest (after the JSON pass, per row) ───
UPDATE tbl_market_economic_trend
   SET forex_latest = 1.0 / forex_latest
 WHERE forex_latest IS NOT NULL
   AND forex_latest > 0
   AND trend_id::text NOT LIKE '90000000-%'
   AND (
        (market IN ('korea', 'japan') AND forex_latest > 1.5)
     OR (market = 'usa' AND forex_latest < 1.5)
   );

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
-- 1. Every market's forex now sits on the canonical side of the 1.5 boundary:
--      SELECT target_market, MIN(forex_rate), MAX(forex_rate)
--        FROM tbl_market_signal_record
--       WHERE forex_rate IS NOT NULL
--       GROUP BY target_market;
--      -- expect korea/japan < 1.5, usa > 1.5
--
--      SELECT fr.target_market, MIN(ms.forex_vs_php), MAX(ms.forex_vs_php)
--        FROM tbl_market_score ms JOIN tbl_forecast_result fr
--          ON fr.forecast_result_id = ms.forecast_result_id
--       WHERE ms.forex_vs_php IS NOT NULL
--       GROUP BY fr.target_market;
--      -- expect korea/japan < 1.5, usa > 1.5
--
--      SELECT market, forex_latest, forex_unit FROM tbl_market_economic_trend ORDER BY market;
--      -- expect korea ≈ 0.04, japan ≈ 0.38, usa ≈ 58; forex_unit = 'PHP_PER_FOREIGN' on every row
--
-- 2. forex_trend_json values moved with forex_latest (spot check one market):
--      SELECT market, forex_latest, forex_trend_json FROM tbl_market_economic_trend WHERE market = 'korea';
--      -- every element's "value" should be on the same side of 1.5 as forex_latest
