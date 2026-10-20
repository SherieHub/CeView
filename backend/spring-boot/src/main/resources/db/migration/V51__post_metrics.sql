CREATE TABLE tbl_post_metric (
    id UUID PRIMARY KEY,
    post_id UUID NOT NULL UNIQUE REFERENCES tbl_social_post(id) ON DELETE CASCADE,
    business_profile_id UUID NOT NULL REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    reach BIGINT,
    likes BIGINT,
    comments BIGINT,
    shares BIGINT,
    engagement_rate DOUBLE PRECISION,
    reach_series_json TEXT,
    last_synced_at TIMESTAMPTZ
);
CREATE INDEX idx_post_metric_profile ON tbl_post_metric(business_profile_id);
