-- H2 mirror of db/migration/V47.
ALTER TABLE tbl_localized_promotional_content
    ADD COLUMN IF NOT EXISTS generated_caption_en CLOB;
