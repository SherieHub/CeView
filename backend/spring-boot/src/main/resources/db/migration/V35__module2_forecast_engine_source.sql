-- Module 2 Step 10: retain the exact engine identifier returned by FastAPI.
ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS source VARCHAR(32);

-- Verification:
-- SELECT source, COUNT(*) FROM tbl_forecast_result GROUP BY source;
-- Rollback (only after application code stops reading the column):
-- ALTER TABLE tbl_forecast_result DROP COLUMN IF EXISTS source;
