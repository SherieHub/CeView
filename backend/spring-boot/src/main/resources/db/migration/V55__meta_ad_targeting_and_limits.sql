-- Meta paid-ad targeting and per-business spend limits.
--
-- Targeting the ad set carries, beyond the country: the market's language, up to 10 Meta interests
-- (id + name, kept as JSON) and whether Meta may widen the audience (Advantage+). Countries and
-- locales are derived on the server from the forecast market, never taken from the client.
ALTER TABLE tbl_social_post
    ADD COLUMN IF NOT EXISTS ad_locales VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ad_interests_json TEXT,
    ADD COLUMN IF NOT EXISTS ad_advantage_audience BOOLEAN NOT NULL DEFAULT FALSE;

-- One row per business: the most it allows a single ad to spend per day, and in total across all of
-- its active CeView ads. Amounts are minor units of the Meta ad account's currency, so a limit saved
-- under another currency is ignored (treated as not set) rather than reinterpreted.
CREATE TABLE IF NOT EXISTS tbl_ad_spend_limit (
    business_profile_id UUID         NOT NULL,
    currency            VARCHAR(3)   NOT NULL,
    max_daily_minor     BIGINT       NOT NULL,
    max_total_minor     BIGINT       NOT NULL,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_ad_spend_limit PRIMARY KEY (business_profile_id),
    CONSTRAINT fk_ad_spend_limit_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT chk_ad_spend_limit_positive CHECK (max_daily_minor > 0 AND max_total_minor > 0),
    CONSTRAINT chk_ad_spend_limit_total_covers_daily CHECK (max_total_minor >= max_daily_minor)
);

COMMENT ON TABLE tbl_ad_spend_limit IS
    'Per-business daily and total ceilings for CeView-created Meta ads, in the ad account currency (minor units).';
