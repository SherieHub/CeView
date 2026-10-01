-- Module 2 Step 14: retain the actual economic scorer selected by FastAPI.
ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS scorer VARCHAR(16);

-- Verification:
-- SELECT scorer, COUNT(*) FROM tbl_market_score GROUP BY scorer;
-- Rollback (only after application code stops reading the column):
-- ALTER TABLE tbl_market_score DROP COLUMN IF EXISTS scorer;
