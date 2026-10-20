-- ============================================================================
-- V49 — Module 3: publishing accounts (Facebook Page, Instagram, TikTok)
--
-- WHY
--   Publishing needs credentials the Module 4 ads grant does not hold: a Page
--   access token, the linked Instagram user id, a TikTok creator token. One row
--   per (profile, platform). Tokens are AES-GCM encrypted (common/crypto/TokenCipher)
--   and never returned by any endpoint.
--
--   Facebook and Instagram rows come from ONE Meta login (the ads connection in
--   tbl_ad_platform_connection, provider 'meta'); TikTok has its own OAuth.
--
-- The TikTok creator login reuses tbl_ad_oauth_state with provider 'tiktok_creator',
-- so that table's CHECK constraint is widened.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_publishing_account (
    account_id              UUID         NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id     UUID         NOT NULL,
    platform                VARCHAR(20)  NOT NULL,
    external_id             VARCHAR(128) NOT NULL,
    display_name            VARCHAR(255),
    access_token_encrypted  TEXT         NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,
    refresh_expires_at      TIMESTAMPTZ,
    scopes                  TEXT,
    status                  VARCHAR(30)  NOT NULL,
    connected_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ,

    CONSTRAINT pk_publishing_account PRIMARY KEY (account_id),
    CONSTRAINT fk_publishing_account_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_publishing_account_profile_platform UNIQUE (business_profile_id, platform),
    CONSTRAINT chk_publishing_account_platform CHECK (platform IN ('facebook', 'instagram', 'tiktok')),
    CONSTRAINT chk_publishing_account_status CHECK (status IN ('ACTIVE', 'NEEDS_RECONNECT', 'REVOKED'))
);

COMMENT ON TABLE tbl_publishing_account IS
    'Per-operator credentials for publishing to one platform. Tokens are AES-GCM encrypted.';

CREATE INDEX IF NOT EXISTS idx_publishing_account_profile
    ON tbl_publishing_account (business_profile_id);

ALTER TABLE tbl_ad_oauth_state DROP CONSTRAINT IF EXISTS chk_ad_state_provider;
ALTER TABLE tbl_ad_oauth_state
    ADD CONSTRAINT chk_ad_state_provider CHECK (provider IN ('meta', 'tiktok', 'tiktok_creator'));
