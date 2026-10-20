ALTER TABLE tbl_attribution_code
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS redemption_limit BIGINT,
    ADD COLUMN IF NOT EXISTS voucher_status TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE tbl_attribution_code
    ADD CONSTRAINT chk_attr_code_voucher_status
    CHECK (voucher_status IN ('ACTIVE', 'EXHAUSTED', 'EXPIRED'));

ALTER TABLE tbl_attribution_redemption
    ADD COLUMN IF NOT EXISTS gross_revenue NUMERIC(14,2);
