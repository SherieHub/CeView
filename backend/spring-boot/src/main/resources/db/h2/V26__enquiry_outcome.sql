-- H2 mirror of db/migration/V56__enquiry_outcome.sql.

ALTER TABLE tbl_attribution_enquiry
    ADD COLUMN IF NOT EXISTS outcome    VARCHAR(16) DEFAULT 'NEW' NOT NULL;

ALTER TABLE tbl_attribution_enquiry
    ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE tbl_attribution_enquiry
    ADD CONSTRAINT chk_attr_enquiry_outcome
    CHECK (outcome IN ('NEW', 'BOOKED', 'DECLINED'));
