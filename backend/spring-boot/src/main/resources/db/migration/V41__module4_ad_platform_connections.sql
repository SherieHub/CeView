-- ============================================================================
-- V27 — Module 4: ad-platform account connections and cached ad insights
--
-- WHY
--   Module 4's campaign metrics are entirely operator-typed today. The four
--   figures the ad platforms already know — impressions, clicks, spend,
--   conversions — are the tedious ones to look up and the easiest to mistype,
--   and a wrong ad spend silently corrupts the PES score. These tables let an
--   operator connect a Meta or TikTok ad account once and pull those figures.
--
-- WHY A SEPARATE STATE TABLE
--   The OAuth callback arrives as a browser redirect from the platform with no
--   Authorization header, so there is no JWT to resolve the tenant from. The
--   state token minted at authorize time carries the business_profile_id
--   through the redirect, and doubles as the OAuth CSRF defence.
--
-- SCOPE NOTE
--   These are ADS connections. The separate publishing connection specified in
--   docs/module-3/backend/PlatformConnectionController.md is a different grant
--   with different scopes and is not built here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_ad_platform_connection (
    connection_id           UUID        NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id     UUID        NOT NULL,
    provider                TEXT        NOT NULL,

    -- Base64(iv || ciphertext || tag) from common/crypto/TokenCipher.
    -- Never returned by any endpoint.
    access_token_encrypted  TEXT        NOT NULL,
    -- Meta long-lived tokens have no refresh token; TikTok's does.
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,

    -- Null until the operator picks which ad account to report on.
    external_account_id     TEXT,
    external_account_name   TEXT,
    -- The ad account's own currency, as reported by the platform. Stored rather
    -- than converted: a wrong FX rate silently corrupts ROAS. VARCHAR, not CHAR
    -- — the entity maps this as a plain String and Hibernate's schema
    -- validation expects varchar for that, not Postgres's blank-padded bpchar.
    currency                VARCHAR(3),

    scopes                  TEXT,
    status                  TEXT        NOT NULL,

    connected_at            TIMESTAMPTZ,
    last_synced_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ,

    CONSTRAINT pk_ad_platform_connection PRIMARY KEY (connection_id),
    CONSTRAINT fk_ad_conn_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_ad_conn_profile_provider UNIQUE (business_profile_id, provider),
    CONSTRAINT chk_ad_conn_provider CHECK (provider IN ('meta','tiktok')),
    CONSTRAINT chk_ad_conn_status CHECK (
        status IN ('PENDING_ACCOUNT_SELECTION','ACTIVE','REVOKED'))
);

COMMENT ON TABLE  tbl_ad_platform_connection IS
    'Per-operator OAuth grant for a Meta or TikTok ad account. Tokens are AES-GCM encrypted.';
COMMENT ON COLUMN tbl_ad_platform_connection.status IS
    'PENDING_ACCOUNT_SELECTION until the operator chooses an ad account; ACTIVE once chosen.';

CREATE INDEX IF NOT EXISTS idx_ad_conn_profile_status
    ON tbl_ad_platform_connection (business_profile_id, status);

-- OAuth state ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tbl_ad_oauth_state (
    state               UUID        NOT NULL,
    business_profile_id UUID        NOT NULL,
    provider            TEXT        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    consumed_at         TIMESTAMPTZ,

    CONSTRAINT pk_ad_oauth_state PRIMARY KEY (state),
    CONSTRAINT chk_ad_state_provider CHECK (provider IN ('meta','tiktok'))
);

COMMENT ON TABLE tbl_ad_oauth_state IS
    'Single-use, short-TTL token binding an OAuth redirect back to the operator who started it.';

CREATE INDEX IF NOT EXISTS idx_ad_oauth_state_expiry ON tbl_ad_oauth_state (expires_at);

-- Cached insights -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS tbl_ad_insight (
    insight_id          UUID          NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id UUID          NOT NULL,
    provider            TEXT          NOT NULL,
    external_account_id TEXT          NOT NULL,

    period_start        DATE          NOT NULL,
    period_end          DATE          NOT NULL,

    impressions         BIGINT        NOT NULL DEFAULT 0,
    clicks              BIGINT        NOT NULL DEFAULT 0,
    spend               NUMERIC(14,2) NOT NULL DEFAULT 0,
    conversions         BIGINT        NOT NULL DEFAULT 0,
    currency            VARCHAR(3),

    fetched_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- The raw payload is kept deliberately: field-shape surprises across API
    -- versions are the likeliest failure mode and this is what makes them
    -- diagnosable after the fact.
    raw_response        TEXT,

    CONSTRAINT pk_ad_insight PRIMARY KEY (insight_id),
    CONSTRAINT fk_ad_insight_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_ad_insight_period UNIQUE
        (business_profile_id, provider, period_start, period_end),
    CONSTRAINT chk_ad_insight_provider CHECK (provider IN ('meta','tiktok'))
);

COMMENT ON TABLE tbl_ad_insight IS
    'Last-fetched platform metrics for one reporting period. Re-syncing a period updates the row.';

CREATE INDEX IF NOT EXISTS idx_ad_insight_profile_period
    ON tbl_ad_insight (business_profile_id, period_start DESC);
