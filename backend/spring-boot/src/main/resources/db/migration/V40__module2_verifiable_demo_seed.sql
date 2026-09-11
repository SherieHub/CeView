-- V40 — Module 2 E2E, Step 20 (C-25).
--
-- Makes the existing V18 demo rows usable by the post-E2E pipeline without
-- rewriting V18.  These are explicitly demo rows, never live observations:
-- signal source is therefore `seed_demo_v40`, rather than falsely claiming
-- they came from PyTrends.  The runtime sequence builder deliberately accepts
-- only `pytrends` rows, so a refresh still requires measured input.
--
-- The forecast rows are persisted stub-engine output.  Each JSON array has
-- twelve non-flat values in the same 0–100 trend-index unit as the contract.
-- The first four values average to the row's `predicted_demand`; the later
-- values provide a visible, deterministic demo forecast rather than a flat
-- chart.  `source = stub-v1` makes that provenance visible to every reader.
--
-- The critical alert below is not free-form "demo copy": it satisfies the
-- runtime rule with the persisted values: 73.1 / 56.0 - 1 = 30.5357% > 20%,
-- spike_indicator = true, and yoy_ratio = 1.10 >= 1.0.  Its text mirrors
-- ForecastingService.persistDemandAlert's measured wording.
--
-- ROLLBACK NOTE:
-- This migration only changes the fixed V18 UUID namespace and inserts
-- deterministic md5-derived seed signal UUIDs.  Restore those rows from a
-- pre-V40 backup, or delete only rows whose source = 'seed_demo_v40' plus the
-- fixed V18 forecast/score/alert UUIDs, if a demo reset is required.
--
-- VERIFICATION (run after migration):
--   SELECT business_profile_id, target_market, category, COUNT(*)
--     FROM tbl_market_signal_record
--    WHERE source = 'seed_demo_v40'
--    GROUP BY 1,2,3 HAVING COUNT(*) < 12;
--   -- expect no rows
--   SELECT forecast_result_id, forecast_horizon_weeks, source,
--          jsonb_array_length(weekly_forecasts_json::jsonb) AS forecast_weeks
--     FROM tbl_forecast_result
--    WHERE forecast_result_id::text LIKE '60000000-%';
--   -- every row: horizon 4, source stub-v1, forecast_weeks 12
--   SELECT da.alert_level, da.uplift_pct, ms.spike_indicator, ms.yoy_ratio
--     FROM tbl_demand_alert da JOIN tbl_market_score ms ON ms.market_score_id = da.market_score_id
--    WHERE da.demand_alert_id = '80000000-0000-0000-0000-000000000005';
--   -- expect CRITICAL, 30.5357..., true, 1.10

-- All nine V18 forecast rows are consumed at horizon 4.  Its old 8-week rows
-- were invisible because every dashboard reader asks for four-week forecasts.
UPDATE tbl_forecast_result
   SET forecast_horizon_weeks = 4,
       source = 'stub-v1',
       weekly_forecasts_json = jsonb_build_array(
           predicted_demand * 0.94, predicted_demand * 0.98,
           predicted_demand * 1.02, predicted_demand * 1.06,
           predicted_demand * 1.04, predicted_demand * 1.02,
           predicted_demand * 1.00, predicted_demand * 0.99,
           predicted_demand * 0.98, predicted_demand * 0.97,
           predicted_demand * 0.96, predicted_demand * 0.95
       )::text
 WHERE forecast_result_id::text LIKE '60000000-%';

-- Existing V18 signal rows already use the canonical PHP-per-foreign unit.
-- Label them accurately and make their ISO/stat fields explicit as well.
UPDATE tbl_market_signal_record
   SET source = 'seed_demo_v40',
       source_fetched_at = aggregated_at,
       stats_window_weeks = COALESCE(stats_window_weeks, 2)
 WHERE signal_record_id::text LIKE '50000000-%'
    OR signal_record_id::text LIKE '51000000-%';

-- The V18 macro fixtures are already PHP per foreign unit.  Give their
-- values and the matching economic scores explicit demo provenance rather
-- than leaving the Step 6 fields null/unknown.
UPDATE tbl_market_economic_trend
   SET forex_unit = 'PHP_PER_FOREIGN',
       gdp_source = 'seed_demo_v40',
       gdp_fetched_at = COALESCE(gdp_fetched_at, fetched_at),
       forex_source = 'seed_demo_v40',
       forex_fetched_at = COALESCE(forex_fetched_at, fetched_at)
 WHERE trend_id::text LIKE '90000000-%';

UPDATE tbl_market_score
   SET scorer = 'linear'
 WHERE market_score_id::text LIKE '70000000-%';

-- Supply the preceding ten Mondays for every V18 profile/category/market.
-- Together with V18's 2026-W30 and 2026-W31 rows this yields exactly twelve
-- ISO-aligned weeks from 2026-W20 through 2026-W31, without synthetic chart
-- padding in application code.  ON CONFLICT makes the migration idempotent.
WITH seeded AS (
    SELECT fr.business_profile_id, fr.category, fr.target_market,
           latest.trend_index AS latest_trend,
           latest.forex_rate, latest.gdp_growth, latest.seasonality_score,
           latest.rolling_average, latest.rolling_std_dev,
           latest.rolling_average_7d, latest.rolling_average_30d
      FROM tbl_forecast_result fr
      JOIN LATERAL (
          SELECT msr.*
            FROM tbl_market_signal_record msr
           WHERE msr.business_profile_id = fr.business_profile_id
             AND msr.target_market = fr.target_market
           ORDER BY msr.week_start_date DESC
           LIMIT 1
      ) latest ON TRUE
     WHERE fr.forecast_result_id::text LIKE '60000000-%'
), weeks AS (
    SELECT seeded.*, (DATE '2026-05-11' + (series.n * INTERVAL '7 days'))::date AS week_start,
           series.n
      FROM seeded CROSS JOIN generate_series(0, 9) AS series(n)
)
INSERT INTO tbl_market_signal_record (
    signal_record_id, business_profile_id, category, target_market,
    trend_index, forex_rate, gdp_growth, seasonality_score,
    rolling_average, rolling_std_dev, rolling_average_7d, rolling_average_30d,
    yoy_ratio, spike_indicator, aggregated_at, iso_year, iso_week, week_start_date,
    first_seen_at, stats_window_weeks, source, source_fetched_at
)
SELECT md5('module2-v40:' || business_profile_id::text || ':' || target_market || ':' || week_start::text)::uuid,
       business_profile_id, category, target_market,
       GREATEST(0.0, LEAST(100.0, latest_trend - (10 - n) * 1.5)),
       forex_rate, gdp_growth, seasonality_score,
       rolling_average, rolling_std_dev, rolling_average_7d, rolling_average_30d,
       NULL, FALSE, week_start::timestamp AT TIME ZONE 'UTC',
       EXTRACT(ISOYEAR FROM week_start)::smallint, EXTRACT(WEEK FROM week_start)::smallint, week_start,
       week_start::timestamp AT TIME ZONE 'UTC', n + 1, 'seed_demo_v40', week_start::timestamp AT TIME ZONE 'UTC'
  FROM weeks
ON CONFLICT ON CONSTRAINT uq_msr_profile_category_market_iso_week DO NOTHING;

-- Make the critical seed exercise the same inputs that the Java alert rule
-- reads.  Historical alert uplifts intentionally stayed NULL in V29; this is
-- a newly corrected demo row, so its measured value is persisted.
UPDATE tbl_market_signal_record
   SET yoy_ratio = 1.10
 WHERE signal_record_id = '50000000-0000-0000-0000-000000000005';

UPDATE tbl_forecast_result
   SET yoy_ratio = 1.10
 WHERE forecast_result_id = '60000000-0000-0000-0000-000000000005';

UPDATE tbl_market_score
   SET yoy_ratio = 1.10
 WHERE market_score_id = '70000000-0000-0000-0000-000000000005';

UPDATE tbl_demand_alert
   SET business_profile_id = '20000000-0000-0000-0000-000000000005',
       category = (SELECT category FROM tbl_forecast_result
                    WHERE forecast_result_id = '60000000-0000-0000-0000-000000000005'),
       alert_level = 'CRITICAL',
       uplift_pct = (73.1 / 56.0 - 1.0) * 100.0,
       trend = 'Sudden interest spike',
       window_open_date = '2026-08-03 00:00:00+00',
       alert_message = 'Critical demand window for United States — the 4-week forecast is 30.5% above the rolling baseline. First forecast week crossing the demand-window threshold starts 2026-08-03.'
 WHERE demand_alert_id = '80000000-0000-0000-0000-000000000005';
