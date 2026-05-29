-- V16: Submodule 3.3 — drop legacy CAS/VAS/HCS compliance persistence.
--
-- The compliance audit was reimplemented as a stateless LangGraph omcs_agent
-- (POST /api/v1/compliance/omcs-analyze → /internal/omcs/analyze). The new path
-- persists nothing, so the evaluation-result and revision-history tables created
-- by V5/V6 (and altered by V9) are no longer used. Forward-only removal.
--
-- Revision-history references evaluation_result via FK; CASCADE drops the
-- dependent constraints and indexes in either order.

DROP TABLE IF EXISTS tbl_compliance_revision_history CASCADE;
DROP TABLE IF EXISTS tbl_compliance_evaluation_result CASCADE;
