-- Structured Business Story & UVP inputs.
--
-- Operators now answer short questions instead of writing free prose. The frontend composes the
-- answers into fixed template paragraphs (frontend/components/module-1/structured-profile/
-- profileTemplates.ts) and saves those paragraphs in the existing business_description / uvp
-- columns, which the AI services keep reading unchanged. The answers are stored here so they can be
-- re-edited, and *_edited records that the operator hand-edited a paragraph, so the template no
-- longer overwrites it.
--
-- Profiles written before this change have prose but no answers: their paragraphs are marked
-- hand-edited so nothing rewrites them until the operator fills in the answers and regenerates.

ALTER TABLE tbl_business_profile
    ADD COLUMN IF NOT EXISTS story_business_type TEXT,
    ADD COLUMN IF NOT EXISTS story_location      TEXT,
    ADD COLUMN IF NOT EXISTS story_experience    TEXT,
    ADD COLUMN IF NOT EXISTS story_facilities    TEXT,
    ADD COLUMN IF NOT EXISTS uvp_distinguisher   TEXT,
    ADD COLUMN IF NOT EXISTS uvp_supporting_fact TEXT,
    ADD COLUMN IF NOT EXISTS uvp_guest_benefit   TEXT,
    ADD COLUMN IF NOT EXISTS description_edited  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS uvp_edited          BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tbl_business_profile
   SET description_edited = TRUE
 WHERE business_description IS NOT NULL AND TRIM(business_description) <> '';

UPDATE tbl_business_profile
   SET uvp_edited = TRUE
 WHERE uvp IS NOT NULL AND TRIM(uvp) <> '';
