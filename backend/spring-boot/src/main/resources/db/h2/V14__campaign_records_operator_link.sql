-- H2 mirror of db/migration/V17.
-- H2 2.x does not accept an inline REFERENCES clause on ADD COLUMN the way
-- Postgres does here, so the column and the FK constraint are added in two
-- separate statements (same pattern as the FKs in db/h2/V1__init_schema.sql).

ALTER TABLE tbl_campaign_records
    ADD COLUMN IF NOT EXISTS business_profile_id UUID;

ALTER TABLE tbl_campaign_records
    ADD CONSTRAINT IF NOT EXISTS fk_campaign_records_business_profile
        FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE;
