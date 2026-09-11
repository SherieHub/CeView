-- H2 mirror of db/migration/V28__module4_ad_campaign_selection.sql
--
-- Numbered V19 because the h2 set's highest existing version is V18. Used only
-- by the `h2` runtime profile; tests build their schema from the JPA entities.

ALTER TABLE tbl_ad_platform_connection ADD COLUMN IF NOT EXISTS external_campaign_id   VARCHAR(128);
ALTER TABLE tbl_ad_platform_connection ADD COLUMN IF NOT EXISTS external_campaign_name VARCHAR(255);

ALTER TABLE tbl_ad_insight ADD COLUMN IF NOT EXISTS external_campaign_id VARCHAR(128);
