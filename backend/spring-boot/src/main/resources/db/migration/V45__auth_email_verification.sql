-- Email verification for password and Google sign-up.
--
-- email_verified_at: NULL until the operator proves they own the address (6-digit code, or a
-- Google token with email_verified=true). It is deliberately left NULL for every existing row,
-- seeded demo operators included — everyone must verify once. See MsmeOperator#isEmailVerified.
--
-- created_before_verification: marks accounts that existed when this migration ran. Registering
-- over an unverified account is only allowed for accounts created AFTER this feature shipped
-- (fresh sign-ups that never verified), so a pre-existing real account with data can never be
-- taken over. The backfill below flips the flag for every current row; new rows default FALSE.

ALTER TABLE tbl_msme_operator ADD COLUMN email_verified_at TIMESTAMPTZ NULL;
ALTER TABLE tbl_msme_operator ADD COLUMN created_before_verification BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tbl_msme_operator SET created_before_verification = TRUE;

CREATE TABLE tbl_email_code (
    code_id      UUID PRIMARY KEY,
    operator_id  UUID         NOT NULL REFERENCES tbl_msme_operator (operator_id) ON DELETE CASCADE,
    purpose      VARCHAR(32)  NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
    -- The address the code was mailed to; a code is only valid while it still matches the
    -- operator's current email, so changing email invalidates codes sent to the old address.
    email        VARCHAR(255) NOT NULL,
    code_hash    VARCHAR(100) NOT NULL,
    attempts     INT          NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL,
    expires_at   TIMESTAMPTZ  NOT NULL,
    consumed_at  TIMESTAMPTZ  NULL
);

CREATE INDEX ix_email_code_operator_purpose_created
    ON tbl_email_code (operator_id, purpose, created_at);
