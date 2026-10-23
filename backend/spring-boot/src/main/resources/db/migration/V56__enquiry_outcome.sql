-- The operator's decision on a hosted-form enquiry.
--
-- A traveller's submit records one booking at zero revenue (EnquiryService.submit) so the lead shows
-- up in the evidence immediately. NEW means the operator has not looked at it yet; BOOKED lets them
-- enter the real bookings/revenue on that redemption, and DECLINED removes the booking again while
-- the enquiry row stays behind as the record of what was asked.

ALTER TABLE tbl_attribution_enquiry
    ADD COLUMN IF NOT EXISTS outcome    VARCHAR(16) NOT NULL DEFAULT 'NEW',
    ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ;

ALTER TABLE tbl_attribution_enquiry
    ADD CONSTRAINT chk_attr_enquiry_outcome
    CHECK (outcome IN ('NEW', 'BOOKED', 'DECLINED'));
