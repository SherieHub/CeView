ALTER TABLE tbl_attribution_code ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(14,2);
ALTER TABLE tbl_attribution_code ADD COLUMN IF NOT EXISTS redemption_limit BIGINT;
ALTER TABLE tbl_attribution_code ADD COLUMN IF NOT EXISTS voucher_status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE tbl_attribution_redemption ADD COLUMN IF NOT EXISTS gross_revenue DECIMAL(14,2);
