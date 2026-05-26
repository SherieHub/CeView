-- H2 mirror of db/migration/V3.
-- H2 supports CREATE INDEX; IF NOT EXISTS requires H2 1.4.198+ (bundled version satisfies this).

CREATE INDEX IF NOT EXISTS idx_bpro_user_id
    ON tbl_business_profile(user_id);

CREATE INDEX IF NOT EXISTS idx_bpro_updated_at
    ON tbl_business_profile(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bemb_profile_id
    ON tbl_business_embedding(business_profile_id);

CREATE INDEX IF NOT EXISTS idx_bcat_score_profile_id
    ON tbl_business_categories_score(business_profile_id);

CREATE INDEX IF NOT EXISTS idx_clf_log_profile_id
    ON tbl_classification_logs(business_profile_id);

CREATE INDEX IF NOT EXISTS idx_clf_log_status
    ON tbl_classification_logs(inference_status);
