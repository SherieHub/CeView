-- H2 mirror of db/migration/V45.
ALTER TABLE tbl_msme_operator
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE;
