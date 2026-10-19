# Implementation Research — Conversion Capture (CVW-42)

**Date:** 2026-10-19
**Ticket:** CVW-42 — Implementation Research: Conversion Capture
**Source:** *CeView Expert Interview Validation Findings*, tab 2, recommendation #7
**Module:** 4 (Campaign Analytics & Reporting), touching 2 (alert mint) and 3 (caption generation)

> **Recommendation #7 (MCIA; MG Group) — Direct · Now · High.**
> "Capture conversions automatically before relying on AI insights: tracking links, promo codes
> tied to POS, booking data." Reason given: manual inputs are inaccurate and make insights
> unreliable.

This document answers three questions: what CeView already captures, what is missing relative to
the recommendation, and what to build next, in what order. It is research, not an approved spec —
the build items in §5 each need their own spec/plan before implementation.

> **Implementation status (2026-10-19):** build items 1–5 in §5 are implemented on branch
> `CVW-42-implementation-research-conversion-capture`, together with the follow-ups listed in §5.1.
> Items 6–8 (operator survey, FareHarbor, POS) are **not built**; §6 explains why each could not
> be completed in this session and what unblocks it. §2 below describes the state *before* this
> work.

---

## 1. Why this matters to the product

Module 4's PES score and the AI prescriptive report (`fastapi-sbert` `report_llm.py`,
`pes_report_agent`) are computed from `CampaignRecord` rows. Bookings, revenue, and new customers
on those rows are still typed in by the operator in `IngestionForm.tsx`. The experts' point is that
any AI recommendation built on recalled numbers inherits their error — so the report is only as
credible as the conversion data underneath it.

The three mechanisms the experts named map onto three evidence sources:

| Expert's term | CeView mechanism | Evidence it produces |
|---|---|---|
| Tracking links | `/r/{slug}` redirect + platform URL macros | Click → creative, automatically |
| Promo codes tied to POS | Attribution code (e.g. `KR-DIVE-0915`) + POS discount/note lookup | Booking → campaign, at point of sale |
| Booking data | Booking-platform sync (FareHarbor etc.) or CeView-hosted enquiry | Booking → campaign, from a system of record |

---

## 2. Current state (audited 2026-10-19 on this branch)

### Built and working

| Capability | Where | Notes |
|---|---|---|
| Attribution code minted per surge window | `module4/attribution/AttributionCode*`, `V43` / `db/h2/V20` | Keyed on `(profile, category, market, window_start)`, minted from `ForecastingService` |
| Tracking link minted per surge window | `module4/attribution/link/AttributionLinkService`, `V44` / `db/h2/V21` | CSPRNG 8-char slug |
| Public redirect + click capture | `RedirectController` (`GET /r/{slug}`), `ClickTrackingService`, `BotFilter`, `AttributionRateLimiter` | Records `external_ad_id` from Meta/TikTok macros, hashed IP, in-window flag |
| Ad URL with macros for pasting into ads | `AdUrlBuilder`, `frontend/.../AdUrlBlock.tsx` | |
| Tier-2 hosted enquiry → automatic conversion | `EnquiryController` (`POST /api/public/attribution/enquiries`), `EnquiryService`, `EnquiryPage.tsx`, `EnquiryInbox.tsx` | Writes enquiry + `source='LINK'` redemption + notification atomically. **This is the only path that currently records a conversion automatically.** |
| Per-creative performance rollup | `LinkPerformanceController`, `LinkAttributionQueryService`, `AttributionEvidenceSection.tsx` | Untagged clicks bucketed explicitly |
| Ad-side metrics sync (impressions/clicks/spend/pixel conversions) | `module4/adconnections` | Pixel conversions only exist if the operator has a pixel — most don't |
| Redemption table with source discriminator | `AttributionRedemption` (`MANUAL` / `FAREHARBOR` / `LINK`) | Schema is ready for all three sources |

### Designed but not built

From [`2026-09-14-marketing-attribution-design.md`](../superpowers/specs/2026-09-14-marketing-attribution-design.md)
and [`2026-09-20-link-attribution-design.md`](../superpowers/specs/2026-09-20-link-attribution-design.md):

| Gap | Evidence | Impact |
|---|---|---|
| **No write path for `MANUAL` redemptions** | No `POST /api/attribution/redemptions`; no `AttributionRedemptionService`; no `LogBookingAction.tsx` | A Messenger/phone/walk-in booking quoting the code cannot be recorded at all. |
| **Tier-1 click matching is read-only and unmounted** | `GET /api/attribution/clicks/unconverted` exists; `ClickMatchStep.tsx` exists but is not rendered by any screen and has nothing to submit to | Clicks to an operator's own site never become conversions. |
| **Captions don't carry the code** | `ContentGenerationService` has no reference to the attribution code; `GenerateRequest` has no `demandAlertId` | Travellers never see the code, so even a perfect logging flow would capture almost nothing. |
| **No code listing endpoint** | No `GET /api/attribution/codes` | Operators can't see their active code to quote it or log against it. |
| **No lift computation** | No `AttributionLiftService` | The second, independent evidence signal is missing. |
| **No booking-platform sync** | No `FareHarborClient`, no `tbl_booking_platform_connection` | `FAREHARBOR` source is defined but nothing writes it. |
| **No POS integration** | Not designed anywhere | The expert's "promo codes tied to POS" is unaddressed. |

**Net:** the *capture* infrastructure (links, clicks, codes) is in place, but the *conversion* end
is closed for every booking channel except the hosted enquiry page.

---

## 3. Options evaluated

### 3.1 Tracking links (largely done)

Remaining work is only closing tier 1: let the operator attach a logged booking to a recent
unconverted click. The UI component and read endpoint exist; it needs the write endpoint (shared
with §3.2) and mounting in the log-a-booking flow.

Not recommended now: Meta/TikTok Conversions API ("tier 4") — needs a per-operator pixel/dataset
and a write scope beyond `ads_read`; most target operators have neither. A JS snippet for the
operator's own booking page ("tier 3") — most target operators don't own a booking page.

### 3.2 Promo codes at the point of sale

The code exists; three things are needed for it to produce conversions:

1. **Put it in front of travellers** — thread `demandAlertId` into content generation so every
   caption carries the code as a CTA (spec phase 2). Without this, nothing else here matters.
2. **Quick log at the moment of the booking** — `LogBookingAction` (spec phase 3). Still a manual
   input, but captured per-event at the time of sale rather than recalled weekly, which is the
   specific inaccuracy the experts flagged. Should be one tap from the dashboard/mobile.
3. **POS lookup (new, not yet specified)** — for operators with a cloud POS, read the code back
   from the POS automatically instead of asking staff to log it twice.

**POS landscape for Cebu MSMEs — needs validation with operators before committing.** Candidate
systems to survey:

| POS | Relevance | Integration notes (to verify) |
|---|---|---|
| Loyverse | Free tier, common with PH cafés/small retail | Public REST API exposes receipts and discounts; a CeView code could be set up as a named discount or receipt note and read back |
| Utak POS | PH-built, common with PH F&B | API availability unknown — must ask vendor |
| Square | Low PH penetration | Well-documented Orders API; low priority |
| None / cash book | Likely the majority of dive shops & tour operators | Quick log (item 2) is the only option |

Recommended approach: build the generic quick log first, then add **one** POS connector (likely
Loyverse) using the same connect/verify/`ACTIVE` lifecycle as `adconnections`, writing a new
`source='POS'` redemption row. Do not build POS before finding out from the pilot operators which
POS, if any, they actually use.

### 3.3 Booking data

| Option | Coverage | Effort | Recommendation |
|---|---|---|---|
| CeView-hosted enquiry (tier 2) | Any operator willing to point ads at it | Done | Promote as the default destination for operators without a booking site |
| FareHarbor sync | Dive shops / tour operators already on FareHarbor | Medium; needs signed partner/API agreement (lead time outside the codebase) | Keep as designed (spec phase 5), after the manual path |
| Other OTAs/booking engines (Klook, Bokun, Checkfront, Agoda/Booking.com for resorts) | Varies | Each is a separate integration; OTA APIs mostly don't expose per-booking promo data to the property | Survey operators first; defer |
| Messenger/WhatsApp booking capture | Majority channel for small Cebu operators | High; Meta Business messaging API + app review | Defer; covered by the quick log in the meantime |

---

## 4. Data-quality guardrails

Whatever the source, keep the existing spec decisions:

- **One redemption table, one rollup.** New sources (`POS`) are new `source` values, not new tables.
- **Flag, don't block.** If a week's redemptions exceed its `CampaignRecord` total, surface a
  warning on the Performance screen.
- **Distinct evidence, not merged.** Direct redemptions, per-creative link conversions, and lift
  are shown side by side, labelled by type.
- **Report provenance to the AI.** Pass the share of bookings that came from automatic sources
  (`LINK`, `FAREHARBOR`, `POS`) vs. `MANUAL` into the PES report prompt, so the report can caveat
  its confidence instead of treating all numbers as equally reliable. This is the most direct
  answer to "before relying on AI insights".

---

## 5. Recommended build order

Each step is independently shippable and verifiable. Steps 1–3 close the loop for the majority of
operators with no third-party dependency.

| # | Item | Effort | Unblocks | Status |
|---|---|---|---|---|
| 1 | **Captions carry the code** — `demandAlertId` on `GenerateRequest`, code added to every caption before the compliance audit (marketing-attribution spec, phase 2) | S | Travellers see the code | **Done** |
| 2 | **Redemption write path** — `AttributionRedemptionService`, `GET /api/attribution/codes`, `POST /api/attribution/redemptions` (optional `clickId` → `source='LINK'`) | M | Manual + tier-1 conversions | **Done** |
| 3 | **`LogBookingAction` UI** — on the dashboard and Performance screen; mounts `ClickMatchStep` to attach to a click; `IngestionForm` shows the period's tracked bookings | M | Operators actually record conversions | **Done** |
| 4 | **Provenance into the AI report** — automatic-vs-manual share passed to `report_llm.py` and reflected in report wording | S | Experts' core concern | **Done** |
| 5 | **Lift** — `AttributionLiftService` + Performance card (spec phase 4) | M | Second independent signal | **Done** |
| 6 | **Operator survey** — which POS / booking platform do pilot operators use? | — | Decides 7 vs 8 | Not started — see §6 |
| 7 | **FareHarbor sync** (spec phase 5) — start the partner agreement early | L | Booking-platform data | Not built — see §6 |
| 8 | **First POS connector** (new spec; `source='POS'` migration widening the `CHECK`) | L | Promo codes tied to POS | Not built — see §6 |

### 5.1 What was built

| Piece | Where |
|---|---|
| Code resolution for captions: the alert's code when its market matches, else the market's live-or-upcoming window; localised call-to-action appended to every caption option | `AttributionCodeService.findForContent`, `module3/submodule31/AttributionCodeCaptions` |
| Codes use ISO country prefixes (`KR-`, `JP-`, `US-`) instead of clipped market ids (`KO-`, `JA-`) | `AttributionCodeService.deriveCode` |
| Log, list and undo bookings; per-code split by capture kind | `AttributionController`, `AttributionRedemptionService` — `/api/attribution/codes`, `/redemptions` |
| "More tracked than reported" flag per code (compares in-window tracked bookings with the operator's reported weeks) | `CodeSummary.trackedExceedsReported`, shown in `CodeRedemptionPanel` |
| Tracked bookings for a reporting period, shown under the weekly form's Bookings field, with a warning when the typed total is lower | `GET /api/attribution/tracked`, `IngestionForm` |
| Statistical lift: per-week bookings and revenue during the window vs. the 28 days before; short baselines flagged, missing data reported as a status rather than a number | `AttributionLiftService`, `GET /api/attribution/lift/{codeId}`, `StatisticalLiftPanel` |
| Booking provenance passed to the AI report, which must state tracked vs. self-reported | `PrescriptiveReportController`, `fastapi-sbert` `report_llm._provenance_context` |
| "Log a booking" quick entry on the dashboard | `QuickLogBooking` (mounted in `DashboardView`) |
| Content Studio sends the picked alert's id with the generate request | `ContentStudioView` |
| Local H2 test seed uses the pipeline's market ids (`korea`/`japan`/`usa`), so seeded codes appear in captions | `e2e/fixtures/h2-seed/V900__link_attribution_seed.sql` |

Known limitation of lift: if the operator submits the same week twice, both records count. The
weekly form does not prevent duplicate periods today; deduplicating is a change to Module 4's
ingestion, not to attribution.

## 6. Not built in this session — and why

Everything above could be built and verified entirely inside the repository. The three remaining
items cannot: each depends on information or access that only exists outside the codebase.

### 6.1 Operator survey (item 6)

**Why not:** it is not software work. It means asking the pilot operators which POS and booking
systems they actually use (FareHarbor, Bokun, Klook, Loyverse, Utak, a cash book, nothing). Only
the team can contact them.

**Why it matters:** it decides whether items 7 and 8 are worth building at all, and which POS to
start with. Building either first risks a connector no pilot operator can use.

**Unblocked by:** a short survey of the current pilot operators. Record the answers in this
document.

### 6.2 FareHarbor booking sync (item 7)

**Why not:** the code could be written against FareHarbor's public documentation, but it could not
be *verified*. Production API access requires a signed FareHarbor partner/API agreement, and no
test company or API credentials were available in this session. An integration built only from
documentation, with request and response shapes never seen from the real service, would very
likely need rework on first contact — and shipping it would suggest a capability that has not
actually been proven.

**What is already in place:** the redemption table already accepts `source='FAREHARBOR'` weekly
rows, the rollups and provenance already count them as *automatic*, and the
ad-platform-connections feature provides the connect/verify/encrypted-credential pattern to copy.

**Unblocked by:** (1) the survey confirming at least one pilot operator uses FareHarbor, and (2) a
FareHarbor test company or partner API credentials. Start the partner agreement early; it has a
lead time outside the codebase.

### 6.3 POS connector (item 8)

**Why not:** the blocker is *which* POS, not the code. Cebu MSMEs use a mix (Loyverse, Utak,
others, or no POS at all), and the API availability of some (e.g. Utak) is unknown. Building a
connector before the survey answers would likely target the wrong system. As with FareHarbor,
there was also no real POS account to test against.

**What is already in place:** codes are quotable and could be entered as a POS discount name or
receipt note; adding `source='POS'` is a one-line `CHECK` widening plus a new connector, and the
rollups already treat any non-manual source as tracked.

**Unblocked by:** the survey naming a POS that several pilot operators share, confirmation that it
has a usable API, and a test account. Then write a spec (it is not covered by the existing
marketing-attribution spec).

### Out of scope by design (unchanged)

Sending conversions back to Meta/TikTok (Conversions API), a tracking snippet for operators' own
booking pages, automatic Messenger/WhatsApp capture, and emailing enquiries remain non-goals of the
existing specs; see §3.1 and the link-attribution spec.

## 7. Open questions

1. Which POS and booking platforms do the current pilot operators actually use? (Blocks 7/8; see §6.1.)
2. Should the code carry a small discount to motivate travellers to quote it? The current spec
   says no (pure tracking phrase, avoids compliance claims); the experts' "promo code" wording may
   imply an incentive. Needs a product decision.
3. Render free-tier cold starts on `/r/{slug}` (30 s+) will lose clicks — does tracking-link
   capture need the paid plan or the AWS deployment before it can be relied upon in a pilot?
4. MCIA recommendation #1 (validate against nationality arrival data) is a demand-side check; is
   conversion data expected to feed back into forecast validation too, or only Module 4?

## 8. References

- [`2026-09-14-marketing-attribution-design.md`](../superpowers/specs/2026-09-14-marketing-attribution-design.md) — codes, manual redemption, lift, FareHarbor
- [`2026-09-20-link-attribution-design.md`](../superpowers/specs/2026-09-20-link-attribution-design.md) — links, clicks, enquiries
- [`2026-09-06-ad-platform-connections-design.md`](../superpowers/specs/2026-09-06-ad-platform-connections-design.md) — connection lifecycle pattern to reuse
- [`LINK_ATTRIBUTION_SETUP.md`](../../LINK_ATTRIBUTION_SETUP.md), [`AD_PLATFORM_SETUP.md`](../../AD_PLATFORM_SETUP.md)
