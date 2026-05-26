-- V6: Submodule 3.3 — Multimodal Compliance Analysis scoring columns + revision history

-- ─── Extend tbl_compliance_evaluation_result ─────────────────────────────────
-- V5 added: caption, aligned_items, gap_items, score, source, selected_market
-- V6 adds the three sub-scores and revision tracking required by FR3.25 and FR3.29

ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN IF NOT EXISTS cas_score            FLOAT,
    ADD COLUMN IF NOT EXISTS vas_score            FLOAT,
    ADD COLUMN IF NOT EXISTS omcs_score           FLOAT,
    ADD COLUMN IF NOT EXISTS compliance_threshold VARCHAR(80),
    ADD COLUMN IF NOT EXISTS revision_number      INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS mismatches           TEXT;

-- ─── Revision history (FR3.29) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tbl_compliance_revision_history (
    revision_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_profile_id  UUID REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE,
    original_eval_id     UUID REFERENCES tbl_compliance_evaluation_result(evaluation_id) ON DELETE SET NULL,
    selected_market      VARCHAR(60),
    revision_number      INT NOT NULL,
    submitted_caption    TEXT,
    cas_score            FLOAT,
    omcs_score           FLOAT,
    compliance_threshold VARCHAR(80),
    submitted_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_compliance_eval_profile_market
    ON tbl_compliance_evaluation_result(business_profile_id, selected_market, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_revision_profile
    ON tbl_compliance_revision_history(business_profile_id, submitted_at DESC);
