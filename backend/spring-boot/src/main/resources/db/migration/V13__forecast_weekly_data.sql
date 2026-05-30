-- V13 — Store per-week Gemini forecast array so the DB read path
--        can reconstruct chart data without re-invoking the AI pipeline.
--
-- weekly_forecasts_json : JSON array of 12 weekly demand floats [Wk+1 … Wk+12].
--   Populated only for horizon=4 rows (the chart uses the 4-week result as its base).
--   NULL on pre-V13 rows — buildChartData() already falls back to the scalar demand value.

ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS weekly_forecasts_json TEXT;
