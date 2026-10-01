-- V25 — Remove stored Naver content.
--
-- (Plan Task 29 names this V24; renumbered to V25 because Lane A's
--  V24__module2_fix_msr_source_recency_index.sql already occupies that slot.)
--
-- Naver was dropped as a generation target in Task 26. Its captions were never
-- model output: two hardcoded Korean strings were injected on the success path of
-- every generate call (routers/content.py:177-182, pre-removal). Rows written
-- before that change are therefore canned text, and any query that does not
-- filter by platform would still surface them.
--
-- Data only — the platform column carries no CHECK constraint or enum, so
-- nothing structural needs to change.

DO $$
DECLARE removed INT;
BEGIN
    DELETE FROM tbl_localized_promotional_content WHERE platform = 'naver';
    GET DIAGNOSTICS removed = ROW_COUNT;
    RAISE NOTICE 'V25: removed % hardcoded Naver content rows', removed;
END $$;
