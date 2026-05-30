-- V6 (H2): Submodule 3.3 compliance scoring — TIMESTAMP not TIMESTAMPTZ, CLOB not TEXT

ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN cas_score            FLOAT;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN vas_score            FLOAT;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN omcs_score           FLOAT;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN compliance_threshold VARCHAR(80);
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN revision_number      INT DEFAULT 1;
ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN mismatches           CLOB;

CREATE TABLE IF NOT EXISTS tbl_compliance_revision_history (
    revision_id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    business_profile_id  UUID,
    original_eval_id     UUID,
    selected_market      VARCHAR(60),
    revision_number      INT NOT NULL,
    submitted_caption    CLOB,
    cas_score            FLOAT,
    omcs_score           FLOAT,
    compliance_threshold VARCHAR(80),
    submitted_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id) ON DELETE CASCADE
);
