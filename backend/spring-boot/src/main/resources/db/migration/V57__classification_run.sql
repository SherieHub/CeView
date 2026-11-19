CREATE TABLE tbl_classification_run (
    run_id UUID PRIMARY KEY,
    operator_id UUID NOT NULL REFERENCES tbl_msme_operator(operator_id) ON DELETE CASCADE,
    business_profile_id UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    run_purpose VARCHAR(30) NOT NULL,
    input_description TEXT NOT NULL,
    input_uvp TEXT NOT NULL,
    input_services JSONB NOT NULL,
    top_category TEXT NOT NULL,
    top_confidence DOUBLE PRECISION NOT NULL CHECK (top_confidence BETWEEN 0 AND 1),
    predicted_categories JSONB NOT NULL,
    category_scores JSONB NOT NULL,
    recommended_categories JSONB NOT NULL,
    model_version TEXT NOT NULL,
    inference_latency_ms DOUBLE PRECISION NOT NULL CHECK (inference_latency_ms >= 0),
    final_categories JSONB,
    confirmed_at TIMESTAMPTZ,
    is_overridden BOOLEAN,
    CHECK ((confirmed_at IS NULL AND final_categories IS NULL AND is_overridden IS NULL)
        OR (confirmed_at IS NOT NULL AND final_categories IS NOT NULL AND is_overridden IS NOT NULL))
);
CREATE INDEX idx_classification_run_operator_time ON tbl_classification_run(operator_id, created_at DESC);
CREATE INDEX idx_classification_run_profile ON tbl_classification_run(business_profile_id);
