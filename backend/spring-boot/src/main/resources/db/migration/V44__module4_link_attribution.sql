-- ============================================================================
-- V44 — Module 4: trackable links, ad clicks, and hosted enquiries
--
-- Implements the foundation of
-- docs/superpowers/specs/2026-09-20-link-attribution-design.md.
--
-- WHY
--   V43's code proves "the Korea campaign worked" but can never say WHICH ad
--   creative worked, and depends on a human remembering to log the booking.
--   A link CeView owns the redirect for closes both gaps: the platform
--   substitutes its own ad id into the URL at click time, so the click itself
--   names the creative, and a hosted enquiry converts without the operator
--   touching anything.
--
-- WHY THE SLUG IS RANDOM AND THE CODE IS NOT
--   tbl_attribution_code.code is derived and quotable on purpose — a customer
--   says it out loud. A slug derived the same way would let anyone enumerate
--   every other operator's live campaigns by guessing market/category/date.
--   The slug is CSPRNG output over an unambiguous alphabet.
--
-- WHY NOT KEYED ON demand_alert_id
--   Same reason as V43, and more sharply: a slug is embedded in a running paid
--   ad. ForecastingService deletes and re-inserts alerts on every pipeline run,
--   so a cascading FK would break a live ad's link mid-campaign. The window
--   tuple is the key; demand_alert_id is a refreshed soft pointer.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_attribution_link (
    link_id             UUID        NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id UUID        NOT NULL,

    -- Soft pointer, not a FK. See header.
    demand_alert_id     UUID,

    category            TEXT        NOT NULL,
    target_market       TEXT        NOT NULL,

    -- 8 chars, CSPRNG, globally unique. This is what appears in the ad.
    slug                TEXT        NOT NULL,

    -- Where the redirect sends the traveller. NULL means "use CeView's hosted
    -- enquiry page" — the tier-1 / tier-2 switch, per campaign rather than
    -- per account.
    destination_url     TEXT,

    window_start        TIMESTAMPTZ NOT NULL,
    window_end          TIMESTAMPTZ NOT NULL,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT pk_attribution_link PRIMARY KEY (link_id),
    CONSTRAINT fk_attr_link_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_attr_link_window UNIQUE
        (business_profile_id, category, target_market, window_start),
    CONSTRAINT uq_attr_link_slug UNIQUE (slug)
);

COMMENT ON TABLE tbl_attribution_link IS
    'One trackable redirect per surge window, sibling of tbl_attribution_code.';
COMMENT ON COLUMN tbl_attribution_link.destination_url IS
    'Operator URL (tier 1), or NULL to use the CeView-hosted enquiry page (tier 2).';

CREATE INDEX IF NOT EXISTS idx_attr_link_profile_window
    ON tbl_attribution_link (business_profile_id, window_start DESC);

-- Clicks --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tbl_attribution_click (
    click_id             UUID        NOT NULL DEFAULT gen_random_uuid(),
    link_id              UUID        NOT NULL,
    business_profile_id  UUID        NOT NULL,

    -- Substituted by the ad platform at click time from the macros the operator
    -- pasted. All three NULL for an organic click — that is a real, reportable
    -- case, not an error, and the rollup buckets it explicitly rather than
    -- dropping it.
    external_campaign_id TEXT,
    external_adset_id    TEXT,
    external_ad_id       TEXT,

    platform             TEXT        NOT NULL DEFAULT 'UNKNOWN',

    -- Raw fbclid / ttclid. Stored only so a future Conversions-API tier can
    -- report the booking back to the platform; nothing reads it today. It
    -- cannot be decoded into an ad id — that is what the macros are for.
    click_token          TEXT,

    referrer             TEXT,
    user_agent           TEXT,

    -- Salted hash, never the raw address: enough to debounce repeat clicks and
    -- spot abuse, without retaining identifiable data on foreign travellers.
    ip_hash              TEXT,

    -- Whether clicked_at fell inside the link's window. A stale ad still
    -- redirects (404ing a real traveller would be worse); the click is just
    -- marked out-of-window so it can be excluded from campaign totals.
    in_window            BOOLEAN     NOT NULL DEFAULT TRUE,

    clicked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_attribution_click PRIMARY KEY (click_id),
    CONSTRAINT fk_attr_click_link FOREIGN KEY (link_id)
        REFERENCES tbl_attribution_link (link_id) ON DELETE CASCADE,
    CONSTRAINT fk_attr_click_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT chk_attr_click_platform CHECK (platform IN ('META','TIKTOK','UNKNOWN'))
);

COMMENT ON TABLE tbl_attribution_click IS
    'One row per non-bot click on a tracked link. click_id is the cv= value passed downstream.';

-- The two read paths: "this operator's recent clicks" and "roll up by creative".
CREATE INDEX IF NOT EXISTS idx_attr_click_profile_time
    ON tbl_attribution_click (business_profile_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_attr_click_link_ad
    ON tbl_attribution_click (link_id, external_ad_id);

-- Hosted enquiries (tier 2) --------------------------------------------------
--
-- Its own table rather than columns on the click: this is the only place real
-- traveller PII lands, and it needs a retention policy the click table does not.

CREATE TABLE IF NOT EXISTS tbl_attribution_enquiry (
    enquiry_id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    click_id            UUID        NOT NULL,
    business_profile_id UUID        NOT NULL,

    contact_name        TEXT        NOT NULL,
    contact_value       TEXT        NOT NULL,
    party_size          INTEGER,
    requested_start     DATE,
    requested_end       DATE,
    message             TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_attribution_enquiry PRIMARY KEY (enquiry_id),
    CONSTRAINT fk_attr_enquiry_click FOREIGN KEY (click_id)
        REFERENCES tbl_attribution_click (click_id) ON DELETE CASCADE,
    CONSTRAINT fk_attr_enquiry_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    -- One enquiry per click: a traveller double-submitting the form should
    -- not create two bookings.
    CONSTRAINT uq_attr_enquiry_click UNIQUE (click_id)
);

COMMENT ON TABLE tbl_attribution_enquiry IS
    'Traveller-submitted booking enquiry from the CeView-hosted page. Holds PII; retention-scoped.';

CREATE INDEX IF NOT EXISTS idx_attr_enquiry_profile_time
    ON tbl_attribution_enquiry (business_profile_id, created_at DESC);

-- Seam with V43 --------------------------------------------------------------
--
-- A link-sourced conversion is NOT a new table: it is a redemption row with
-- source='LINK'. That is what makes code-attributed and link-attributed
-- bookings land in one rollup instead of two totals that can disagree.
--
-- The redemption learns its creative only through its click; denormalising the
-- ad id onto the redemption row would let the two drift apart.

ALTER TABLE tbl_attribution_redemption
    DROP CONSTRAINT IF EXISTS chk_attr_redemption_source;

ALTER TABLE tbl_attribution_redemption
    ADD CONSTRAINT chk_attr_redemption_source
        CHECK (source IN ('MANUAL','FAREHARBOR','LINK'));

ALTER TABLE tbl_attribution_redemption
    ADD COLUMN IF NOT EXISTS attribution_click_id UUID;

ALTER TABLE tbl_attribution_redemption
    DROP CONSTRAINT IF EXISTS fk_attr_redemption_click;

ALTER TABLE tbl_attribution_redemption
    ADD CONSTRAINT fk_attr_redemption_click FOREIGN KEY (attribution_click_id)
        REFERENCES tbl_attribution_click (click_id) ON DELETE SET NULL;

COMMENT ON COLUMN tbl_attribution_redemption.attribution_click_id IS
    'Set on LINK rows; NULL otherwise. Carries the ad creative through to the rollup.';

CREATE INDEX IF NOT EXISTS idx_attr_redemption_click
    ON tbl_attribution_redemption (attribution_click_id);
