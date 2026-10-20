-- ============================================================================
-- V48 — Module 3: uploaded media (images and videos) for publishing
--
-- WHY
--   Social platforms fetch media from a public HTTPS URL; today media exists only
--   as a base64 data URL in the browser. A row here tracks one uploaded file:
--   PENDING until the browser has PUT it to storage and the API has verified it,
--   then READY.
--
-- The file itself lives in S3 (served via CloudFront under /media/*) or, in local
-- dev, on disk. storage_key is the object key; public_url is what platforms fetch.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_media_asset (
    media_id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id UUID         NOT NULL,
    kind                VARCHAR(10)  NOT NULL,
    content_type        VARCHAR(50)  NOT NULL,
    -- Declared at request time, replaced by the real stored size on completion.
    size_bytes          BIGINT       NOT NULL,
    storage_key         VARCHAR(255) NOT NULL,
    public_url          VARCHAR(512) NOT NULL,
    status              VARCHAR(20)  NOT NULL,
    width               INTEGER,
    height              INTEGER,
    duration_seconds    INTEGER,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT pk_media_asset PRIMARY KEY (media_id),
    CONSTRAINT fk_media_asset_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_media_asset_key UNIQUE (storage_key),
    CONSTRAINT chk_media_asset_kind CHECK (kind IN ('image', 'video')),
    CONSTRAINT chk_media_asset_status CHECK (status IN ('PENDING', 'READY'))
);

COMMENT ON TABLE tbl_media_asset IS
    'One uploaded image/video. PENDING until stored and verified, then READY.';

CREATE INDEX IF NOT EXISTS idx_media_asset_profile
    ON tbl_media_asset (business_profile_id, created_at DESC);
