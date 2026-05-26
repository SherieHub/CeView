-- Module 1 performance indexes.
-- FKs in Postgres do NOT auto-create an index on the referencing column;
-- these cover the most common lookup and filter patterns for Module 1.

-- tbl_business_profile --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bpro_user_id
    ON tbl_business_profile(user_id);

CREATE INDEX IF NOT EXISTS idx_bpro_updated_at
    ON tbl_business_profile(updated_at DESC);

-- tbl_business_embedding ------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bemb_profile_id
    ON tbl_business_embedding(business_profile_id);

-- tbl_business_categories_score -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bcat_score_profile_id
    ON tbl_business_categories_score(business_profile_id);

-- tbl_classification_logs -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clf_log_profile_id
    ON tbl_classification_logs(business_profile_id);

CREATE INDEX IF NOT EXISTS idx_clf_log_status
    ON tbl_classification_logs(inference_status);
