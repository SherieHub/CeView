-- V5 (H2): Module 3 table enrichment for Submodule 3.1 and 3.2 persistence
-- H2 differences: TIMESTAMP not TIMESTAMPTZ, CLOB not TEXT, no IF NOT EXISTS on ALTER.

-- ─── Submodule 3.1: Localized Promotional Content ────────────────────────────
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN hashtags           CLOB;
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN cta                CLOB;
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN tone_suggestion    CLOB;
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN framework          VARCHAR(120);
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN source             VARCHAR(40);
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN approved_at        TIMESTAMP;

-- ─── Submodule 3.2: Creative Direction Output ────────────────────────────────
ALTER TABLE tbl_creative_direction_output
    ADD COLUMN platform_recommendations CLOB;
ALTER TABLE tbl_creative_direction_output
    ADD COLUMN visual_tone              CLOB;
ALTER TABLE tbl_creative_direction_output
    ADD COLUMN approved_at              TIMESTAMP;

-- ─── Module 3 shared: Compliance Evaluation Result ───────────────────────────
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN selected_market  VARCHAR(60);
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN caption          CLOB;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN aligned_items    CLOB;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN gap_items        CLOB;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN score            INT;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN source           VARCHAR(40);
