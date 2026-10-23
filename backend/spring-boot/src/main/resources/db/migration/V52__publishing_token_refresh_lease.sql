-- A short lease serializes rotating creator refresh tokens across dispatchers/metrics.
-- No database transaction remains open during the token HTTP request.
ALTER TABLE tbl_publishing_account ADD COLUMN refresh_claimed_at TIMESTAMPTZ;
