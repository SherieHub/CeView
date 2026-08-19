-- Adds Google identity linkage to tbl_msme_operator for "Sign in with Google".
-- profile-completeness and auth-provider are deliberately NOT stored as separate
-- columns: they're derived (contact_number IS NOT NULL / google_uid IS NOT NULL)
-- so they can never drift from the data they depend on. See MsmeOperator#isProfileCompleted.

ALTER TABLE tbl_msme_operator ADD COLUMN google_uid VARCHAR(128);

CREATE UNIQUE INDEX ux_msme_operator_google_uid ON tbl_msme_operator (google_uid);
