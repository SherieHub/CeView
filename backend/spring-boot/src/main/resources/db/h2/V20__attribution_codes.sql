-- H2 mirror of db/migration/V43__module4_attribution_codes.sql
--
-- NOTE ON THIS MIRROR SET: db/h2 is hand-maintained and uses divergent version
-- numbers (this file mirrors V43 but is numbered V20 because the h2 set's
-- highest existing version is V19). It is used ONLY by the `h2` runtime
-- profile — tests build their schema from the JPA entities with Flyway disabled
-- (src/test/resources/application.properties).
--
-- Differences forced by H2: no gen_random_uuid() default (the entity's
-- @PrePersist assigns the id), TEXT -> CLOB/VARCHAR, and no COMMENT ON.

CREATE TABLE IF NOT EXISTS tbl_attribution_code (
    attribution_code_id UUID         NOT NULL,
    business_profile_id UUID         NOT NULL,
    demand_alert_id     UUID,
    category            VARCHAR(120) NOT NULL,
    target_market       VARCHAR(120) NOT NULL,
    code                VARCHAR(64)  NOT NULL,
    window_start        TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end          TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_attribution_code PRIMARY KEY (attribution_code_id),
    CONSTRAINT uq_attr_code_window UNIQUE
        (business_profile_id, category, target_market, window_start),
    CONSTRAINT uq_attr_code_value UNIQUE (business_profile_id, code)
);

ALTER TABLE tbl_attribution_code
    ADD CONSTRAINT fk_attr_code_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attr_code_profile_window
    ON tbl_attribution_code (business_profile_id, window_start DESC);

CREATE TABLE IF NOT EXISTS tbl_attribution_redemption (
    redemption_id       UUID          NOT NULL,
    attribution_code_id UUID          NOT NULL,
    business_profile_id UUID          NOT NULL,
    source              VARCHAR(30)   NOT NULL,
    event_at            TIMESTAMP WITH TIME ZONE,
    period_start        DATE,
    period_end          DATE,
    bookings            BIGINT        NOT NULL DEFAULT 0,
    revenue             NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_attribution_redemption PRIMARY KEY (redemption_id),
    CONSTRAINT chk_attr_redemption_source CHECK (source IN ('MANUAL','FAREHARBOR')),
    CONSTRAINT uq_attr_redemption_period UNIQUE
        (attribution_code_id, period_start, period_end, source)
);

ALTER TABLE tbl_attribution_redemption
    ADD CONSTRAINT fk_attr_redemption_code FOREIGN KEY (attribution_code_id)
    REFERENCES tbl_attribution_code (attribution_code_id) ON DELETE CASCADE;

ALTER TABLE tbl_attribution_redemption
    ADD CONSTRAINT fk_attr_redemption_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attr_redemption_code_event
    ON tbl_attribution_redemption (attribution_code_id, event_at);
CREATE INDEX IF NOT EXISTS idx_attr_redemption_profile
    ON tbl_attribution_redemption (business_profile_id);
