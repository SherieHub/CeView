CREATE TABLE tbl_social_post (
    id UUID PRIMARY KEY,
    business_profile_id UUID NOT NULL REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    publishing_account_id UUID, target_external_id VARCHAR(255), request_fingerprint VARCHAR(255),
    media_asset_id UUID NOT NULL REFERENCES tbl_media_asset(media_id),
    content_id UUID,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','meta_ads')),
    caption TEXT NOT NULL, market VARCHAR(255), visibility VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING','SCHEDULED_ON_PLATFORM','PUBLISHING','PUBLISHED','SENT_TO_INBOX','FAILED','CANCELLED')),
    external_id VARCHAR(255), permalink TEXT, ads_manager_url TEXT, error_message TEXT,
    container_id VARCHAR(255), campaign_id VARCHAR(255), ad_set_id VARCHAR(255),
    creative_id VARCHAR(255), ad_media_id VARCHAR(255), ad_account_external_id VARCHAR(255), ad_objective VARCHAR(255),
    ad_daily_budget_minor BIGINT, ad_start_time TIMESTAMPTZ, ad_end_time TIMESTAMPTZ,
    ad_countries VARCHAR(255), attribution_slug VARCHAR(255), pin_campaign BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_for TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ, next_attempt_at TIMESTAMPTZ, claimed_at TIMESTAMPTZ, processing_started_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0, version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(business_profile_id,request_id,platform)
);
CREATE INDEX idx_social_post_profile_created ON tbl_social_post(business_profile_id,created_at DESC);
CREATE INDEX idx_social_post_due ON tbl_social_post(status,next_attempt_at);
