-- ─── V17: Module 4 — link tbl_campaign_records to tbl_business_profile ────────
-- tbl_campaign_records (V14) currently has no link to any operator/business —
-- it is flat global data. This adds business_profile_id so campaign histories
-- can be scoped per-operator (prerequisite for seed data + API access scoping).
--
-- Nullable / not back-filled here: existing rows are left with NULL until seed
-- data is rewritten in a later task.

ALTER TABLE tbl_campaign_records
    ADD COLUMN IF NOT EXISTS business_profile_id UUID
        REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE;

COMMENT ON COLUMN tbl_campaign_records.business_profile_id IS 'Owning operator business profile (nullable until seed data is rewritten)';
