-- H2 mirror of db/migration/V27__module4_ad_platform_connections.sql
--
-- NOTE ON THIS MIRROR SET: db/h2 is hand-maintained, is nine migrations behind
-- db/migration, and uses divergent version numbers (this file mirrors V27 but
-- is numbered V18 because the h2 set's highest existing version is V17). It is
-- used ONLY by the `h2` runtime profile — tests build their schema from the JPA
-- entities with Flyway disabled (src/test/resources/application.properties).
--
-- Differences forced by H2: no gen_random_uuid() default (the entity's
-- @PrePersist assigns the id), and no COMMENT ON statements.

CREATE TABLE IF NOT EXISTS tbl_ad_platform_connection (
    connection_id           UUID        NOT NULL,
    business_profile_id     UUID        NOT NULL,
    provider                VARCHAR(20) NOT NULL,
    access_token_encrypted  CLOB        NOT NULL,
    refresh_token_encrypted CLOB,
    token_expires_at        TIMESTAMP WITH TIME ZONE,
    external_account_id     VARCHAR(128),
    external_account_name   VARCHAR(255),
    currency                VARCHAR(3),
    scopes                  CLOB,
    status                  VARCHAR(30) NOT NULL,
    connected_at            TIMESTAMP WITH TIME ZONE,
    last_synced_at          TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_ad_platform_connection PRIMARY KEY (connection_id),
    CONSTRAINT uq_ad_conn_profile_provider UNIQUE (business_profile_id, provider),
    CONSTRAINT chk_ad_conn_provider CHECK (provider IN ('meta','tiktok')),
    CONSTRAINT chk_ad_conn_status CHECK (status IN ('PENDING_ACCOUNT_SELECTION','ACTIVE','REVOKED'))
);

ALTER TABLE tbl_ad_platform_connection
    ADD CONSTRAINT fk_ad_conn_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ad_conn_profile_status
    ON tbl_ad_platform_connection (business_profile_id, status);

CREATE TABLE IF NOT EXISTS tbl_ad_oauth_state (
    state               UUID        NOT NULL,
    business_profile_id UUID        NOT NULL,
    provider            VARCHAR(20) NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at         TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_ad_oauth_state PRIMARY KEY (state),
    CONSTRAINT chk_ad_state_provider CHECK (provider IN ('meta','tiktok'))
);

CREATE INDEX IF NOT EXISTS idx_ad_oauth_state_expiry ON tbl_ad_oauth_state (expires_at);

CREATE TABLE IF NOT EXISTS tbl_ad_insight (
    insight_id          UUID          NOT NULL,
    business_profile_id UUID          NOT NULL,
    provider            VARCHAR(20)   NOT NULL,
    external_account_id VARCHAR(128)  NOT NULL,
    period_start        DATE          NOT NULL,
    period_end          DATE          NOT NULL,
    impressions         BIGINT        NOT NULL DEFAULT 0,
    clicks              BIGINT        NOT NULL DEFAULT 0,
    spend               NUMERIC(14,2) NOT NULL DEFAULT 0,
    conversions         BIGINT        NOT NULL DEFAULT 0,
    currency            VARCHAR(3),
    fetched_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_response        CLOB,
    CONSTRAINT pk_ad_insight PRIMARY KEY (insight_id),
    CONSTRAINT uq_ad_insight_period UNIQUE (business_profile_id, provider, period_start, period_end),
    CONSTRAINT chk_ad_insight_provider CHECK (provider IN ('meta','tiktok'))
);

ALTER TABLE tbl_ad_insight
    ADD CONSTRAINT fk_ad_insight_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ad_insight_profile_period
    ON tbl_ad_insight (business_profile_id, period_start DESC);
