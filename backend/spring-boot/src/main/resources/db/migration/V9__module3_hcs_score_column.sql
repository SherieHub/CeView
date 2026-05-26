-- ─── V9: Submodule 3.3 — HCS (Heuristic Compliance Score) column ──────────────
-- Adds hcs_score to tbl_compliance_evaluation_result and
-- tbl_compliance_revision_history to record the deterministic rule-based
-- component of OMCS per FR3.25.3.
--
-- OMCS formula (FR3.25.4):
--   OMCS = (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)
--
-- V6 added cas_score, vas_score, omcs_score (old formula 0.4/0.6).
-- V9 adds hcs_score so the full three-component breakdown is persisted.
-- Previously stored omcs_score values are left as-is (no back-fill needed:
-- old rows simply have hcs_score = NULL, readable as "pre-HCS evaluation").

ALTER TABLE tbl_compliance_evaluation_result
    ADD COLUMN IF NOT EXISTS hcs_score FLOAT;

ALTER TABLE tbl_compliance_revision_history
    ADD COLUMN IF NOT EXISTS hcs_score FLOAT;
