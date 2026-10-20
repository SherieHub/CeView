-- H2 mirror of db/migration/V45.
-- H2 2.x does not support multiple comma-separated ADD COLUMN clauses in a single ALTER TABLE,
-- so each column is its own statement (same as V17's mirror of the Google identity migration).

ALTER TABLE tbl_msme_operator
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE tbl_msme_operator
    ADD COLUMN IF NOT EXISTS created_before_verification BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tbl_msme_operator SET created_before_verification = TRUE;

CREATE TABLE IF NOT EXISTS tbl_email_code (
    code_id      UUID PRIMARY KEY,
    operator_id  UUID         NOT NULL REFERENCES tbl_msme_operator (operator_id) ON DELETE CASCADE,
    purpose      VARCHAR(32)  NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
    email        VARCHAR(255) NOT NULL,
    code_hash    VARCHAR(100) NOT NULL,
    attempts     INT          NOT NULL DEFAULT 0,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at  TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS ix_email_code_operator_purpose_created
    ON tbl_email_code (operator_id, purpose, created_at);
