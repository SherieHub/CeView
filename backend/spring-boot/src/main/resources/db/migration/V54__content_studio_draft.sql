-- ============================================================================
-- V54 — Module 3.1: saved Content Studio drafts
--
-- WHY
--   Re-entering Content Studio regenerated every caption. A draft keeps the
--   generated options, the operator's edits and the content direction so they
--   can come back to them. Per operator (business profile) and market:
--     * kind 'auto'  — the working draft, upserted as the operator edits; at
--                      most one per (profile, market).
--     * kind 'named' — drafts the operator saved on purpose.
--
--   tbl_localized_promotional_content cannot hold this: it keeps only caption
--   option #1, appends a row per generate, and its approval_status is what
--   publishing reads.
--
--   payload_json is opaque JSON (a versioned object owned by the frontend).
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_content_studio_draft (
    draft_id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id UUID         NOT NULL,
    market              VARCHAR(60)  NOT NULL,
    kind                VARCHAR(10)  NOT NULL,
    name                VARCHAR(120) NOT NULL,
    demand_alert_id     UUID,
    payload_json        TEXT         NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_content_studio_draft PRIMARY KEY (draft_id),
    CONSTRAINT fk_content_studio_draft_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT chk_content_studio_draft_kind CHECK (kind IN ('auto', 'named'))
);

COMMENT ON TABLE tbl_content_studio_draft IS
    'Per-operator, per-market Content Studio drafts (auto-saved working draft + named drafts).';

-- One auto-saved working draft per operator per market.
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_studio_draft_auto
    ON tbl_content_studio_draft (business_profile_id, market)
    WHERE kind = 'auto';

CREATE INDEX IF NOT EXISTS idx_content_studio_draft_profile_market
    ON tbl_content_studio_draft (business_profile_id, market, updated_at DESC);
