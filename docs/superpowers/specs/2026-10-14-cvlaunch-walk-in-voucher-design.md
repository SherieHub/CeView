# CVLAUNCH Walk-in Voucher

**Date:** 2026-10-14  
**Status:** Approved design; awaiting implementation planning  
**Module:** 4 (Campaign Analytics & Reporting), with a Module 3 caption CTA

## Goal

Turn the existing campaign attribution code into a limited launch incentive that
also measures walk-in conversion. The voucher is a fixed **PHP 50 off every
booking**, has no minimum spend, and may be redeemed by only the first **10**
eligible bookings for the owning business and campaign window.

The public code is **`CVLAUNCH`**. It should be used for the CeView launch
campaign only; forecast-driven codes retain their current derived names and
tracking-only behaviour.

## Rules

| Rule | Decision |
|---|---|
| Voucher code | `CVLAUNCH` |
| Discount | Fixed PHP 50.00 |
| Minimum booking value | None; eligible for every booking |
| Redemption cap | 10 successful manual walk-in redemptions per voucher |
| Validity | The voucher's configured campaign window |
| After the tenth redemption | Voucher is unavailable and the write endpoint returns a clear capacity error |
| Revenue | Store gross booking revenue and derive net revenue as `max(gross - 50, 0)` |
| Scope | The authenticated operator may read or redeem only vouchers belonging to their business profile |

`CVLAUNCH` is a real promotional offer, unlike the existing generic attribution
codes. It must therefore be presented in caption copy as: **“Show CVLAUNCH for
PHP 50 off your booking. First 10 redemptions only.”**

## Data model

Extend `tbl_attribution_code` so a code can be either tracking-only or a
voucher:

- `discount_amount NUMERIC(14,2) NULL` — `50.00` for CVLAUNCH; null for
  tracking-only codes.
- `redemption_limit BIGINT NULL` — `10` for CVLAUNCH; null means uncapped.
- `voucher_status TEXT NOT NULL` — `ACTIVE`, `EXHAUSTED`, or `EXPIRED`.

Add a `gross_revenue NUMERIC(14,2)` column to
`tbl_attribution_redemption`. Its existing `revenue` value becomes the net
revenue credited to the campaign for voucher redemptions. For a manual
CVLAUNCH redemption, `bookings` is always `1`, `gross_revenue` is the amount
entered by staff, and `revenue` is the calculated net amount.

The schema and entity changes need matching PostgreSQL and H2 Flyway
migrations. Existing attribution rows remain tracking-only: all new voucher
fields are null or use their safe default status.

## Redemption flow

1. An operator posts a launch caption that includes the fixed CVLAUNCH CTA.
2. A customer presents the code while making a walk-in booking.
3. Staff open Module 4's `LogBookingAction`, select CVLAUNCH, and enter the
   gross booking amount (and optionally backdate the booking time).
4. The backend authorizes the voucher against the current business profile,
   verifies it is within its validity window, and reserves a slot atomically.
5. If fewer than 10 manual CVLAUNCH redemptions exist, it creates the
   redemption record and returns its gross amount, PHP 50 discount, net
   amount, and the remaining-slot count.
6. On redemption 10, the response reports zero slots remaining. Subsequent
   attempts receive `409 voucher_redemption_limit_reached`; no redemption is
   written.

The cap must be enforced inside one database transaction. The preferred
implementation locks the voucher row (`SELECT … FOR UPDATE` / JPA pessimistic
write lock), counts successful manual redemptions for that code, then inserts
the redemption before committing. The UI's remaining-count indicator is
informational only and cannot be used as the enforcement mechanism.

## API and UI

Extend the existing attribution-code response with voucher metadata:

```json
{
  "code": "CVLAUNCH",
  "discountAmount": 50.00,
  "redemptionLimit": 10,
  "redemptionsUsed": 7,
  "redemptionsRemaining": 3,
  "voucherStatus": "ACTIVE"
}
```

The manual redemption request includes `attributionCodeId`, `grossRevenue`,
and optional `eventAt`. The service—not the client—calculates PHP 50 and the
net revenue. Return HTTP 409 for exhausted vouchers and HTTP 422 for invalid
gross revenue or an inactive/out-of-window voucher.

`LogBookingAction` displays “PHP 50 off · 3 of 10 remaining” while active,
requires the gross booking amount, and disables submission after exhaustion.
The Performance screen shows: redeemed count (`7 / 10`), voucher cost
(`PHP 350`), gross attributed revenue, net attributed revenue, and redemption
rate. These voucher metrics remain distinct from link attribution and
statistical lift.

## Tests

- Service: valid first and tenth redemptions; no-minimum-spend booking; net
  revenue never below zero; expiry and tenant checks.
- Concurrency: simultaneous redemption requests with one slot remaining create
  exactly one row; the other receives the capacity error.
- Controller: response amounts and error shapes (`409` exhausted, `422`
  invalid).
- Frontend: active, final-slot, and exhausted form states; Performance totals.

## Out of scope

Per-campaign voucher configuration, percentage discounts, stacking with other
offers, POS integration, refund/reversal handling, and automatic inclusion on
non-launch attribution codes are not part of this release.
