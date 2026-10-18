-- Records when an operator's contact_number was verified by SMS OTP (Firebase Phone Auth).
-- NULL = unverified (legacy / seeded accounts, or Firebase not configured).
ALTER TABLE tbl_msme_operator ADD COLUMN phone_verified_at TIMESTAMP WITH TIME ZONE;
