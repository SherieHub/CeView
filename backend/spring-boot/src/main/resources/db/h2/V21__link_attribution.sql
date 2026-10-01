-- H2 mirror of db/migration/V44__module4_link_attribution.sql
--
-- Mirrors V44 but is numbered V21 to continue the h2 set's own sequence. Used
-- ONLY by the `h2` runtime profile; tests build their schema from the JPA
-- entities with Flyway disabled.
--
-- Differences forced by H2: no gen_random_uuid() default, TEXT -> CLOB/VARCHAR,
-- no COMMENT ON, and constraint changes issued as separate ALTER statements.

CREATE TABLE IF NOT EXISTS tbl_attribution_link (
    link_id             UUID         NOT NULL,
    business_profile_id UUID         NOT NULL,
    demand_alert_id     UUID,
    category            VARCHAR(120) NOT NULL,
    target_market       VARCHAR(120) NOT NULL,
    slug                VARCHAR(32)  NOT NULL,
    destination_url     CLOB,
    window_start        TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end          TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_attribution_link PRIMARY KEY (link_id),
    CONSTRAINT uq_attr_link_window UNIQUE
        (business_profile_id, category, target_market, window_start),
    CONSTRAINT uq_attr_link_slug UNIQUE (slug)
);

ALTER TABLE tbl_attribution_link
    ADD CONSTRAINT fk_attr_link_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attr_link_profile_window
    ON tbl_attribution_link (business_profile_id, window_start DESC);

CREATE TABLE IF NOT EXISTS tbl_attribution_click (
    click_id             UUID        NOT NULL,
    link_id              UUID        NOT NULL,
    business_profile_id  UUID        NOT NULL,
    external_campaign_id VARCHAR(128),
    external_adset_id    VARCHAR(128),
    external_ad_id       VARCHAR(128),
    platform             VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    click_token          CLOB,
    referrer             CLOB,
    user_agent           CLOB,
    ip_hash              VARCHAR(128),
    in_window            BOOLEAN     NOT NULL DEFAULT TRUE,
    clicked_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_attribution_click PRIMARY KEY (click_id),
    CONSTRAINT chk_attr_click_platform CHECK (platform IN ('META','TIKTOK','UNKNOWN'))
);

ALTER TABLE tbl_attribution_click
    ADD CONSTRAINT fk_attr_click_link FOREIGN KEY (link_id)
    REFERENCES tbl_attribution_link (link_id) ON DELETE CASCADE;

ALTER TABLE tbl_attribution_click
    ADD CONSTRAINT fk_attr_click_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attr_click_profile_time
    ON tbl_attribution_click (business_profile_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_attr_click_link_ad
    ON tbl_attribution_click (link_id, external_ad_id);

CREATE TABLE IF NOT EXISTS tbl_attribution_enquiry (
    enquiry_id          UUID         NOT NULL,
    click_id            UUID         NOT NULL,
    business_profile_id UUID         NOT NULL,
    contact_name        VARCHAR(200) NOT NULL,
    contact_value       VARCHAR(200) NOT NULL,
    party_size          INTEGER,
    requested_start     DATE,
    requested_end       DATE,
    message             CLOB,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_attribution_enquiry PRIMARY KEY (enquiry_id),
    CONSTRAINT uq_attr_enquiry_click UNIQUE (click_id)
);

ALTER TABLE tbl_attribution_enquiry
    ADD CONSTRAINT fk_attr_enquiry_click FOREIGN KEY (click_id)
    REFERENCES tbl_attribution_click (click_id) ON DELETE CASCADE;

ALTER TABLE tbl_attribution_enquiry
    ADD CONSTRAINT fk_attr_enquiry_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attr_enquiry_profile_time
    ON tbl_attribution_enquiry (business_profile_id, created_at DESC);

-- Seam with V20: a link-sourced conversion is a redemption row, not a new table.

ALTER TABLE tbl_attribution_redemption
    DROP CONSTRAINT IF EXISTS chk_attr_redemption_source;

ALTER TABLE tbl_attribution_redemption
    ADD CONSTRAINT chk_attr_redemption_source
        CHECK (source IN ('MANUAL','FAREHARBOR','LINK'));

ALTER TABLE tbl_attribution_redemption
    ADD COLUMN IF NOT EXISTS attribution_click_id UUID;

ALTER TABLE tbl_attribution_redemption
    ADD CONSTRAINT fk_attr_redemption_click FOREIGN KEY (attribution_click_id)
    REFERENCES tbl_attribution_click (click_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attr_redemption_click
    ON tbl_attribution_redemption (attribution_click_id);
