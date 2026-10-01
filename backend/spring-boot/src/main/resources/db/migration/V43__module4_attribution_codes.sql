-- ============================================================================
-- V43 — Module 4: attribution codes and booking redemptions
--
-- Implements phase 1 of docs/superpowers/specs/2026-09-14-marketing-attribution-design.md
-- (that spec says "V28"; the Postgres set was already at V42 by the time this
-- landed, so the real number is V43).
--
-- WHY
--   Module 4 reports revenue, bookings and new customers exactly as the
--   operator types them into IngestionForm. Nothing ties a peso of that back to
--   a specific CeView-driven campaign. A short quotable code, minted per surge
--   alert and woven into every caption generated for it, gives the operator
--   something a customer can say out loud and staff can log at the counter.
--
-- WHY NOT KEYED ON demand_alert_id
--   The spec keys one code per DemandAlert via a UNIQUE FK. That is not safe
--   against how alerts are actually persisted: ForecastingService.persistDemandAlert
--   DELETES every existing alert for a (profile, category, market) triple and
--   re-inserts a fresh row on each pipeline run, so demand_alert_id changes
--   constantly. A FK would cascade-delete the code (and, in V44, the link whose
--   slug is already live inside a running ad) on every run.
--
--   The stable identity of "the Korea surge for dive shops opening 19 Oct" is
--   (business_profile_id, category, target_market, window_start). That tuple is
--   the unique key. demand_alert_id is kept as a plain, nullable pointer to the
--   currently-live alert row — refreshed on each mint, never enforced, never
--   cascading.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_attribution_code (
    attribution_code_id UUID        NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id UUID        NOT NULL,

    -- Soft pointer to the alert currently representing this window. Deliberately
    -- NOT a foreign key — see the header. May go stale when a pipeline run
    -- retires an alert without producing a replacement.
    demand_alert_id     UUID,

    category            TEXT        NOT NULL,
    target_market       TEXT        NOT NULL,

    -- Short, human-quotable, derived from market + category + window date, e.g.
    -- 'KR-DIVE-1019'. Derived on purpose: the operator has to be able to say it
    -- to a customer. Contrast tbl_attribution_link.slug, which is random
    -- precisely so it cannot be guessed.
    code                TEXT        NOT NULL,

    window_start        TIMESTAMPTZ NOT NULL,
    window_end          TIMESTAMPTZ NOT NULL,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT pk_attribution_code PRIMARY KEY (attribution_code_id),
    CONSTRAINT fk_attr_code_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_attr_code_window UNIQUE
        (business_profile_id, category, target_market, window_start),
    CONSTRAINT uq_attr_code_value UNIQUE (business_profile_id, code)
);

COMMENT ON TABLE tbl_attribution_code IS
    'One quotable promo/tracking code per surge window. Keyed on the window, not on the alert row.';
COMMENT ON COLUMN tbl_attribution_code.demand_alert_id IS
    'Currently-live alert for this window. Not a FK: alerts are deleted and re-inserted each run.';

CREATE INDEX IF NOT EXISTS idx_attr_code_profile_window
    ON tbl_attribution_code (business_profile_id, window_start DESC);

-- Redemptions ---------------------------------------------------------------
--
-- Two shapes in one table, distinguished by source:
--   MANUAL     — one row per booking, written the moment staff log it. event_at
--                set, period_* null.
--   FAREHARBOR — one row per synced week. period_* set, event_at null.
-- V44 adds a third, LINK, for bookings traced to a tracked ad click.

CREATE TABLE IF NOT EXISTS tbl_attribution_redemption (
    redemption_id       UUID          NOT NULL DEFAULT gen_random_uuid(),
    attribution_code_id UUID          NOT NULL,
    business_profile_id UUID          NOT NULL,

    source              TEXT          NOT NULL,

    -- MANUAL only: when the booking actually happened. Defaults to now at entry
    -- time, backdatable. NULL for aggregate sources.
    event_at            TIMESTAMPTZ,

    -- FAREHARBOR only: the synced week, matching IngestionForm's convention.
    period_start        DATE,
    period_end          DATE,

    bookings            BIGINT        NOT NULL DEFAULT 0,
    revenue             NUMERIC(14,2) NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,

    CONSTRAINT pk_attribution_redemption PRIMARY KEY (redemption_id),
    CONSTRAINT fk_attr_redemption_code FOREIGN KEY (attribution_code_id)
        REFERENCES tbl_attribution_code (attribution_code_id) ON DELETE CASCADE,
    CONSTRAINT fk_attr_redemption_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT chk_attr_redemption_source CHECK (source IN ('MANUAL','FAREHARBOR')),
    -- Only constrains aggregate rows: Postgres treats each NULL as distinct, so
    -- many MANUAL rows never collide here, while a FareHarbor re-sync updates
    -- rather than duplicates.
    CONSTRAINT uq_attr_redemption_period UNIQUE
        (attribution_code_id, period_start, period_end, source)
);

COMMENT ON TABLE tbl_attribution_redemption IS
    'Bookings attributed to a code. Per-event for MANUAL, weekly aggregate for synced sources.';

CREATE INDEX IF NOT EXISTS idx_attr_redemption_code_event
    ON tbl_attribution_redemption (attribution_code_id, event_at);
CREATE INDEX IF NOT EXISTS idx_attr_redemption_profile
    ON tbl_attribution_redemption (business_profile_id);
