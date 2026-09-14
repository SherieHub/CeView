# Marketing Attribution — Proving Campaigns Drive Bookings & Revenue

**Date:** 2026-09-14
**Status:** Approved design, ready for implementation planning
**Module:** Primarily 4 (Campaign Analytics & Reporting), with touches to 2 (surge alerts) and 3
(content generation)

---

## Problem

Module 4's Performance screen reports revenue, bookings, and new customers exactly as the
operator types them into `IngestionForm.tsx` — see
[`2026-09-06-ad-platform-connections-design.md`](2026-09-06-ad-platform-connections-design.md),
which solved ad-side metrics (impressions, clicks, spend, conversions) but explicitly left these
three as manual entry, since "the ad platforms don't know them."

That leaves CeView with no way to show an operator — or an operator to show a customer, investor,
or grant reviewer — that a given booking or peso of revenue actually came from a CeView-driven
campaign (forecast-triggered content, market-localized captions, compliance-cleared creative)
rather than from organic traffic, word of mouth, or a walk-in that would have happened anyway.
Self-reported totals with no link back to a specific campaign cannot establish that link, no
matter how accurate the totals are.

MSME operators in this space split roughly into two groups: some use a real booking platform
(FareHarbor is the dominant one for dive shops and tour operators specifically); many take
bookings informally over Messenger, phone, or walk-ins with no system at all. A design that only
works for one group covers a minority of CeView's actual user base.

## Goal

Every Module 2 surge alert produces a short, quotable **attribution code**. Module 3 weaves that
code into every caption generated for the alert. Operators — regardless of how they take bookings
— can tie redeemed bookings back to the code, either by logging them manually or, for
FareHarbor-connected accounts, having them synced automatically. Module 4's Performance screen
then shows both the directly-attributed bookings/revenue and a statistical lift comparison against
the operator's pre-campaign baseline, so the "proof" rests on two independent signals rather than
one number an operator could misremember or inflate.

## Non-goals

A configurable discount/incentive tied to the code (it is a pure tracking phrase — see Design
decisions). Per-post attribution codes (one code per surge alert, not per generated caption).
Booking-platform integrations beyond FareHarbor (Calendly, Google Forms, Checkfront, etc. are
future work, same pattern, separately scoped). Automatic organic publishing of captions — Module
3's `PlatformConnectionController`/`PublishingController` remain unimplemented; the code reaches
customers via whatever channel the operator already uses to post captions today. Changing
`CampaignRecord`'s schema or the existing ad-platform-connections feature.

---

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Attribution unit | One code per `DemandAlert` | The alert already spans the content generated for it and the window operators report against; matches how operators already think about "the Korea surge" as one thing |
| Code content | Pure tracking phrase, no discount | Avoids a pricing/config UI and keeps a real discount claim (which would need compliance validation against what the operator actually honors) out of scope |
| Redemption granularity | Per-event for manual entries, weekly aggregate for FareHarbor | Reconstructing which of a week's bookings used a code from memory is exactly the recall failure this feature exists to avoid — other systems (POS discount entry, referral platforms) always capture at the moment of the transaction, not in a batch later. FareHarbor bookings are read back from its own period-based insights call, so those stay weekly aggregates. |
| Evidence model | Two numbers shown side by side, not merged | Direct redemption count and statistical lift are different kinds of evidence; merging them into one score would hide which is corroborating which |
| Booking-platform scope | FareHarbor only, this spec | Dominant platform for CeView's dive-shop/tour-operator niche; other platforms are the same pattern, deferred (mirrors ads-only scoping in the prior ad-connections spec) |
| Manual redemption validation | Logged freely at event time; flagged (not blocked) if a week's rollup exceeds that week's total | A quick-log event predates knowing the week's `CampaignRecord` total, so it can't be validated against it at entry time. Blocking would also push operators toward under-logging; a rollup that exceeds the week's reported total is surfaced as a data-quality warning on the Performance screen instead. Word-of-mouth and walk-ins are expected to be bookings the code never captures — under 100% is normal and not flagged. |
| Lift baseline window | 4 complete weeks immediately before the alert window, fixed constant | Simple, consistent; no per-operator configuration surface to build or explain |
| Code collision handling | Deterministic from market + category + date, numeric suffix on collision | Alerts are already scoped to business + category + date, so collisions are rare but cheap to guard against |
| Content generation coupling | `demandAlertId` optional on `GenerateRequest` | Content generated outside the surge-alert flow (an operator generating captions ad hoc) continues to work with no code, unchanged from today |

---

## Architecture

### Flow

```
1. Module 2 fires a DemandAlert
   → DemandAlertService creates the alert AND its tbl_attribution_code row
     in the same transaction (code derived from market + category + windowOpenDate)

2. Operator opens Content Studio from the alert notification
   POST /api/content/generate  { ..., demandAlertId }
   → ContentGenerationService resolves the alert's code
   → LangGraph caption prompt is required to include it as a CTA
   → generated captions pass through the existing 3.3 compliance audit unchanged
   → operator copies/posts captions through whatever channel they already use

3a. Informal bookings — "Log a booking" quick-entry action
    → available wherever an active code exists (dashboard + Performance
      screen), not gated behind the weekly ingestion cycle
    → staff record a redemption AT THE MOMENT it happens: pick the code
      (or "no code"), optional peso amount, defaults to now (backdatable)
    → each tap writes one tbl_attribution_redemption event row immediately
    → IngestionForm's "Attributed to code" sub-section becomes a read-only
      rollup of that week's logged events, still capped for display
      against the week's CampaignRecord totals

3b. FareHarbor bookings — Settings → Connections → "Connect FareHarbor"
    → same connect/verify/ACTIVE lifecycle as Meta/TikTok ad connections
    → IngestionForm "Sync bookings" button
    → fetch the week's FareHarbor bookings, filter to ones carrying a
      matching attribution code, prefill the redemption sub-section
      (tagged FAREHARBOR-sourced, overridable, override drops the tag)

4. Performance screen, per attribution code with redemption data
   → "Directly attributed": sum of tbl_attribution_redemption bookings/revenue
   → "Contextual lift": window's CampaignRecord bookings/revenue vs. the
     4-week pre-window average, shown as a % delta
   → both labeled explicitly as distinct kinds of evidence
```

### Package placement

New package `com.ceview.module4.attribution` for the code/redemption entities, repositories, and
service — it is Module 4's Performance screen that ultimately reads and displays this data, same
placement logic as `com.ceview.module4.adconnections`. `DemandAlertService` (Module 2) gains one
new call into this package to create the code; `ContentGenerationService` (Module 3) gains one
read from it to fetch the code for a given alert. Neither module takes a broader dependency on the
other.

### Compliance

No changes to `ComplianceController`/the OMCS audit pipeline. The attribution code is inserted
into the caption text before the existing audit step runs, so it is evaluated exactly like any
other claim already in the caption — a pure tracking phrase with no discount language attached
introduces no new claim category to validate.

---

## Data model

One Flyway migration, `V28__module4_marketing_attribution.sql`, following the conventions from
`V27__module4_ad_platform_connections.sql`.

### `tbl_attribution_code`

One row per `DemandAlert`.

| Column | Notes |
|---|---|
| `attribution_code_id` | UUID PK |
| `demand_alert_id` | FK → `tbl_demand_alert`, `UNIQUE` |
| `business_profile_id` | denormalized, for tenant-scoped reads |
| `code` | short human-quotable string, e.g. `KR-DIVE-0915` |
| `window_start`, `window_end` | `windowOpenDate` through `windowOpenDate` + 14 days (constant) |
| `created_at` | |

### `tbl_attribution_redemption`

Two shapes in one table, distinguished by `source`:

| Column | Notes |
|---|---|
| `redemption_id` | UUID PK |
| `attribution_code_id` | FK |
| `business_profile_id` | |
| `source` | `CHECK IN ('MANUAL','FAREHARBOR')` |
| `event_at TIMESTAMPTZ` | **MANUAL only** — set to the moment staff logged it (defaults to now, backdatable); NULL for FAREHARBOR rows |
| `period_start DATE`, `period_end DATE` | **FAREHARBOR only** — the synced week, matching `IngestionForm`'s convention; NULL for MANUAL rows |
| `bookings BIGINT`, `revenue NUMERIC(14,2)` | a MANUAL row is usually `bookings = 1`; a FAREHARBOR row is that week's synced total |
| `created_at`, `updated_at` | |

`UNIQUE (attribution_code_id, period_start, period_end, source)` — only constrains FAREHARBOR rows
(Postgres treats each NULL as distinct, so multiple MANUAL rows never collide on it); a FareHarbor
re-sync updates rather than duplicates, same pattern as `tbl_ad_insight`. The weekly rollup shown
in `IngestionForm` and on the Performance screen sums MANUAL rows whose `event_at` falls in the
week alongside any FAREHARBOR row for that week.

### `tbl_booking_platform_connection`

One row per (business profile, provider — currently only `'fareharbor'`). Same shape as
`tbl_ad_platform_connection`: encrypted API key (FareHarbor's Bookings API authenticates via API
key + company shortname, not OAuth — confirmed against live docs at implementation time, same
caveat the ad-platform spec carried for Meta/TikTok specifics), `external_account_id`
(company shortname), `status CHECK IN ('ACTIVE','REVOKED')`, `connected_at`, `last_synced_at`.

### H2 mirror

`db/h2/V19__module4_marketing_attribution.sql`, same rationale as the ad-connections H2 mirror —
not needed for tests (Flyway disabled there) but required for the `h2` runtime profile.

---

## Components

| Component | Responsibility |
|---|---|
| `AttributionCodeService` | Creates a code alongside a new `DemandAlert`; resolves a code for a given alert id |
| `AttributionRedemptionService` | Persists a MANUAL event the moment it's logged; upserts FareHarbor-synced weekly rows; rolls up a week's MANUAL events + any FAREHARBOR row for display |
| `FareHarborClient` | Bookings API: list bookings for an account/date range, filtering by promo/custom-field code |
| `AttributionLiftService` | Computes the 4-week pre-window baseline vs. window totals from existing `CampaignRecord` rows |
| `AttributionController` | Endpoints below |

### Endpoints

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/api/attribution/codes` | JWT | Active codes for the operator, with window and redemption-to-date summary |
| `POST` | `/api/attribution/redemptions` | JWT | Logs one MANUAL redemption event (code, optional revenue, `eventAt` defaulting to now) |
| `GET` | `/api/attribution/redemptions?periodStart&periodEnd` | JWT | Rolled-up MANUAL + FAREHARBOR totals per code for a week, for `IngestionForm`'s display |
| `POST` | `/api/booking-connections/fareharbor/connect` | JWT | Stores encrypted API key + company shortname, status → ACTIVE |
| `DELETE` | `/api/booking-connections/fareharbor` | JWT | Discards credentials, status → REVOKED |
| `GET` | `/api/booking-connections/fareharbor/sync` | JWT | Fetches and upserts the week's code-matched bookings |
| `GET` | `/api/attribution/lift/{attributionCodeId}` | JWT | Direct-attributed totals + pre-window baseline comparison |

Changes to existing endpoints: `ContentController.GenerateRequest` gains optional
`UUID demandAlertId`.

---

## Frontend

- **`types.ts`** — `AttributionCode`, `AttributionRedemption`, `AttributionLiftSummary`,
  `BookingPlatformConnection`.
- **`apiClient.ts`** — an `attribution` group and a `bookingConnections` group, same
  `USE_FIXTURES ? delay(MOCK) : request(path)` shape as `adConnections`.
- **`components/settings/BookingConnectionsSection.tsx`** — FareHarbor connect/disconnect,
  rendered in the same Settings area as `AdAccountsSection`, under its own heading.
- **`components/shared/LogBookingAction.tsx`** — the quick-entry control (code select, optional
  revenue, optional backdate), reachable from the dashboard and the Performance screen, wherever
  an active attribution code exists. Not gated behind the weekly ingestion flow.
- **`IngestionForm.tsx`** — an "Attributed to code" sub-section that now *displays* the week's
  rolled-up MANUAL + FAREHARBOR totals (read-only, sourced from `GET /api/attribution/redemptions`)
  rather than accepting direct entry, plus a "Sync bookings" button parallel to "Sync from ad
  accounts," shown only when at least one FareHarbor connection is ACTIVE.
- **Performance screen** — per-code card showing directly-attributed totals and the lift
  percentage, explicitly labeled as distinct evidence types.
- **Content Studio** — when opened from a surge-alert notification, passes `demandAlertId`
  through to `/api/content/generate` (a small addition to the existing generate call, not a new
  flow).

No new context provider — each consumer fetches what it needs via a `useAttributionCodes()` /
`useBookingConnections()` hook, matching `useAdConnections()`.

---

## Testing

**Backend**

- `AttributionCodeServiceTest` — code creation alongside a `DemandAlert`, deterministic
  derivation, collision suffixing.
- `AttributionRedemptionServiceTest` — a MANUAL event persists immediately with `event_at` set;
  the weekly rollup correctly sums MANUAL events + a FAREHARBOR row for the same week; a rollup
  exceeding the week's `CampaignRecord` total surfaces a warning rather than being rejected;
  FareHarbor upsert idempotency.
- `FareHarborClientTest` — MockWebServer against recorded JSON in
  `src/test/resources/bookingplatform/`; asserts request shape and code-matching filter logic.
- `AttributionLiftServiceTest` — baseline computation against seeded `CampaignRecord` history,
  including the edge case of fewer than 4 prior weeks of data.
- `AttributionControllerTest` — MockMvc with a minted JWT; tenant scoping; validation error shape.

**Frontend** — Vitest for the apiClient groups, `LogBookingAction`'s quick-entry flow, the
`IngestionForm` rollup display, sync prefill and override-drops-tag behavior, and the Performance
screen's per-code display including the over-the-week-total warning state.

**e2e** — Playwright cannot drive real FareHarbor OAuth/API-key setup end to end; a fixture-mode
spec covers the settings UI states and the manual redemption flow only, stated plainly in the spec
file rather than implying full coverage.

---

## Build order

Each phase ends somewhere independently verifiable.

1. **Foundation** — migration (both sets), entities, repositories, `AttributionCodeService`
   wired into `DemandAlertService`.
   *Verify: a new surge alert produces a matching `tbl_attribution_code` row.*
2. **Content generation coupling** — `demandAlertId` on `GenerateRequest`, code threaded into the
   LangGraph prompt.
   *Verify: content generated from an alert notification includes the code in every caption; ad
   hoc generation (no alert) is unaffected.*
3. **Manual redemption** — `AttributionRedemptionService`, `LogBookingAction` quick-entry
   endpoint/component, rollup endpoint, `IngestionForm` display.
   *Verify: an event logged from the quick-entry action appears immediately in that week's
   `IngestionForm` rollup; a rollup exceeding the week's totals shows the warning state.*
4. **Lift display** — `AttributionLiftService`, endpoint, Performance screen card.
   *Verify: a code with redemption history shows both direct totals and a lift percentage against
   seeded prior-week data.*
5. **FareHarbor** — `FareHarborClient`, `tbl_booking_platform_connection`, connect/disconnect,
   sync endpoint, `BookingConnectionsSection`, `IngestionForm` sync button.
   *Verify: a real FareHarbor sandbox account's code-tagged bookings populate the redemption
   sub-section.*
6. **Documentation** — extend `AD_PLATFORM_SETUP.md` or add a parallel setup doc for FareHarbor
   credentials; cross-link from this spec and `docs/module-4/README.md`.

## Acceptance

- `./mvnw test` and `npm test` green; `npm run build` clean.
- A new `DemandAlert` always produces exactly one `tbl_attribution_code` row.
- A logged booking event appears in that week's rollup immediately, without waiting for the
  weekly `IngestionForm` submission.
- A week's rolled-up redemptions exceeding that week's `CampaignRecord` totals surfaces a visible
  warning on the Performance screen rather than being silently accepted or rejected.
- A second operator's JWT returns only that operator's codes, redemptions, and connections.
- Performance screen shows direct-attributed and lift numbers as visibly distinct, not merged.
- The backend boots with no FareHarbor credentials configured and nothing else regresses.

## Known external constraints

- FareHarbor requires a signed partner/API agreement for production API access; sandbox/test
  company access may be sufficient for development but production rollout has a lead time outside
  the codebase.
- A brand-new or low-volume FareHarbor account may return zero or few code-tagged bookings even
  when the integration works correctly — this is correct behavior, not a defect (same caveat as
  the ad-platform-connections spec).
- The lift baseline is only as meaningful as an operator's `CampaignRecord` history — a business
  with fewer than 4 prior weeks of data gets a shorter, explicitly-labeled baseline window rather
  than a fabricated one.
