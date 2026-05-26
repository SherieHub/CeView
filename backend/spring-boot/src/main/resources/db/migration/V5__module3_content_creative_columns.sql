-- V5: Module 3 table enrichment for Submodule 3.1 and 3.2 persistence
-- Adds columns needed for full content/creative/compliance storage.

-- ─── Submodule 3.1: Localized Promotional Content ────────────────────────────
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN IF NOT EXISTS hashtags           TEXT,
    ADD COLUMN IF NOT EXISTS cta               TEXT,
    ADD COLUMN IF NOT EXISTS tone_suggestion   TEXT,
    ADD COLUMN IF NOT EXISTS framework         VARCHAR(120),
    ADD COLUMN IF NOT EXISTS source            VARCHAR(40),
    ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ;

-- ─── Submodule 3.2: Creative Direction Output ────────────────────────────────
ALTER TABLE tbl_creative_direction_output
    ADD COLUMN IF NOT EXISTS platform_recommendations TEXT,
    ADD COLUMN IF NOT EXISTS visual_tone              TEXT,
    ADD COLUMN IF NOT EXISTS approved_at              TIMESTAMPTZ;

-- ─── Module 3 shared: Compliance Evaluation Result ───────────────────────────
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN IF NOT EXISTS selected_market  VARCHAR(60),
    ADD COLUMN IF NOT EXISTS caption          TEXT,
    ADD COLUMN IF NOT EXISTS aligned_items    TEXT,
    ADD COLUMN IF NOT EXISTS gap_items        TEXT,
    ADD COLUMN IF NOT EXISTS score            INT,
    ADD COLUMN IF NOT EXISTS source           VARCHAR(40);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_content_profile_market
    ON tbl_localized_promotional_content(business_profile_id, selected_market);

CREATE INDEX IF NOT EXISTS idx_content_approval
    ON tbl_localized_promotional_content(business_profile_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_creative_profile_market
    ON tbl_creative_direction_output(business_profile_id, selected_market);

CREATE INDEX IF NOT EXISTS idx_compliance_profile
    ON tbl_compliance_evaluation_result(business_profile_id, evaluated_at DESC);
