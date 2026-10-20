# CVLAUNCH Walk-in Voucher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tenant-scoped CVLAUNCH voucher worth PHP 50, valid for every booking and capped atomically at ten manual redemptions.

**Architecture:** Extend the existing Module 4 attribution-code and redemption records with voucher terms and gross revenue. A transactional redemption service locks the tenant-owned voucher row before counting and inserting. A controller exposes active voucher state and manual redemption; the React performance surface shows voucher availability and attributed totals.

**Tech Stack:** Spring Boot 3/JPA/Flyway/PostgreSQL/H2, React/TypeScript/Vitest.

---

### Task 1: Persist voucher terms and redemption gross value

**Files:**
- Create: `backend/spring-boot/src/main/resources/db/migration/V45__cvlaunch_walk_in_voucher.sql`
- Create: `backend/spring-boot/src/main/resources/db/h2/V21__cvlaunch_walk_in_voucher.sql`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/attribution/AttributionCode.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/attribution/AttributionRedemption.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/attribution/CvLaunchVoucherTest.java`

- [ ] Write a failing integration test that creates CVLAUNCH with `discountAmount=50`, `redemptionLimit=10`, then saves a manual redemption with gross and net revenue.
- [ ] Run `./mvnw test -Dtest=CvLaunchVoucherTest` and confirm the schema/entity assertion fails before the fields exist.
- [ ] Add nullable `discount_amount` and `redemption_limit`, a non-null voucher status default, and nullable `gross_revenue` in both Flyway variants; map the fields as `BigDecimal`, `Long`, `String`, and `BigDecimal` in the entities.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Enforce the ten-redemption cap in a service

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/attribution/AttributionCodeRepository.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/attribution/AttributionRedemptionRepository.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/attribution/VoucherRedemptionService.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/attribution/CvLaunchVoucherTest.java`

- [ ] Write failing tests for: first manual redemption calculates `max(gross-50,0)`; the tenth succeeds and exhausts the voucher; the eleventh is rejected; another business cannot redeem the code.
- [ ] Run the focused test and confirm failures are caused by the absent service.
- [ ] Add a pessimistic tenant-scoped code lookup, a manual-redemption count query, and `VoucherRedemptionService.redeem(profileId, codeId, grossRevenue, eventAt)`. Inside a transaction, lock the code, validate active/window terms, count MANUAL rows, insert one row with `bookings=1`, and mark the code exhausted after redemption ten.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Expose operator voucher state and redemption

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/attribution/VoucherController.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/attribution/CvLaunchVoucherTest.java`

- [ ] Write failing MockMvc tests for `GET /api/attribution/vouchers` and `POST /api/attribution/vouchers/{id}/redeem`, including a 409 exhausted response.
- [ ] Run the focused test and confirm the endpoints are not mapped.
- [ ] Add current-profile authorization, voucher state DTOs (`redemptionsUsed`, `redemptionsRemaining`, gross/net amounts), and error mapping: 409 for exhausted, 422 for invalid input/window.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: Show the voucher in Module 4

**Files:**
- Modify: `frontend/types.ts`
- Modify: `frontend/services/apiClient.ts`
- Modify: `frontend/components/module-4/4.1-campaign-analytics/AttributionEvidenceSection.tsx`
- Create: `frontend/components/module-4/4.1-campaign-analytics/CvLaunchVoucherCard.tsx`
- Create: `frontend/components/module-4/4.1-campaign-analytics/CvLaunchVoucherCard.test.tsx`

- [ ] Write a failing UI test for an active card displaying “PHP 50 off”, “3 of 10 remaining”, and gross/net totals, plus an exhausted state.
- [ ] Run `npm test -- CvLaunchVoucherCard.test.tsx` and confirm it fails because the component is missing.
- [ ] Add API types/client methods, the card, and mount it as code-redemption evidence. The client submits only gross revenue; the server remains authoritative for discount/net calculations.
- [ ] Re-run the focused UI test and `npm run build`.

### Task 5: Verify the whole feature

**Files:** none

- [ ] Run `./mvnw test -Dtest=CvLaunchVoucherTest`.
- [ ] Run `npm test -- CvLaunchVoucherCard.test.tsx`.
- [ ] Run `npm run build` from `frontend`.
- [ ] Compare changes against `docs/superpowers/specs/2026-10-14-cvlaunch-walk-in-voucher-design.md`; report any unimplemented out-of-scope items explicitly.
