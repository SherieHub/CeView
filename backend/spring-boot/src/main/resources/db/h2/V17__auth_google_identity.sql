-- H2 mirror of db/migration/V19.
-- H2 2.x does not support multiple comma-separated ADD COLUMN clauses in a
-- single ALTER TABLE — split into one statement per column (matches V8's mirror).

ALTER TABLE tbl_msme_operator
    ADD COLUMN IF NOT EXISTS google_uid VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS ux_msme_operator_google_uid
    ON tbl_msme_operator (google_uid);
