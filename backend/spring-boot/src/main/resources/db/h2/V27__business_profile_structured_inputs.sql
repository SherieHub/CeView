-- H2 mirror of db/migration/V57__business_profile_structured_inputs.sql.

ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS story_business_type TEXT;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS story_location      TEXT;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS story_experience    TEXT;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS story_facilities    TEXT;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS uvp_distinguisher   TEXT;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS uvp_supporting_fact TEXT;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS uvp_guest_benefit   TEXT;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS description_edited  BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS uvp_edited          BOOLEAN DEFAULT FALSE NOT NULL;

UPDATE tbl_business_profile
   SET description_edited = TRUE
 WHERE business_description IS NOT NULL AND TRIM(business_description) <> '';

UPDATE tbl_business_profile
   SET uvp_edited = TRUE
 WHERE uvp IS NOT NULL AND TRIM(uvp) <> '';
