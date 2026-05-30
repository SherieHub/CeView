-- V13 (H2 test schema): drop legacy CAS/VAS/HCS compliance persistence.
--
-- Mirrors db/migration/V16 for the Postgres profile. The compliance audit is now
-- a stateless LangGraph omcs_agent that persists nothing, so the evaluation-result
-- and revision-history tables (created here by V6) are removed. Forward-only.

DROP TABLE IF EXISTS tbl_compliance_revision_history CASCADE;
DROP TABLE IF EXISTS tbl_compliance_evaluation_result CASCADE;
