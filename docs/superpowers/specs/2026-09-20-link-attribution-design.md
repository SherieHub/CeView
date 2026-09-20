# Link Attribution — Tracking Which Ad Creative Produced a Booking

**Date:** 2026-09-20
**Status:** Approved design, ready for implementation planning
**Module:** Primarily 4 (Campaign Analytics & Reporting), with narrow touches to 2 (alert
creation) and 3 (Content Studio)

**Complements:** [`2026-09-14-marketing-attribution-design.md`](2026-09-14-marketing-attribution-design.md)
(promo codes, manual booking logging, FareHarbor). That spec stays as written. This one adds the
automatic path and is explicitly the *second* evidence source, not a replacement.

---

## Problem

[`2026-09-14-marketing-attribution-design.md`](2026-09-14-marketing-attribution-design.md) ties
bookings back to a campaign through a quotable promo code that a human reports. That covers the
Messenger/phone/walk-in bookings most Cebu MSMEs actually take, but it has two ceilings:

1. **It depends on recall and honesty.** The evidence is only as good as the operator's logging
   discipline.
2. **It cannot distinguish creatives.** One code per `DemandAlert` means an operator running three
   ad creatives off one alert learns that "the Korea campaign" worked, never *which image* worked.
   That second question is the one that changes where the next peso of ad spend goes.

Meanwhile [`2026-09-06-ad-platform-connections-design.md`](2026-09-06-ad-platform-connections-design.md)
pulls impressions/clicks/spend/conversions from Meta and TikTok, but those conversions are whatever
the operator's own pixel reports — and most CeView operators have no pixel. The ad platforms cannot
see a booking CeView never told them about.

There is no mechanism anywhere in the product by which a posted ad tells CeView that a booking
happened.

## Goal

Every Module 2 surge alert mints a short trackable link alongside its attribution code. The
operator pastes that link — with platform URL macros appended — into their Meta or TikTok ad.
CeView owns the redirect hop, so it records every click with the **specific ad creative** that
produced it. Bookings are then tied to those clicks either automatically (a traveller who submits a
CeView-hosted enquiry) or by the operator attaching a logged booking to a recent click. Module 4's
Performance screen reports bookings and revenue per creative, alongside the code-redemption and
statistical-lift figures the complementary spec defines.

## Non-goals

Sending conversions back to Meta/TikTok via their Conversions APIs (the "tier 4" path — it needs a
per-operator pixel/dataset id most operators lack, plus a write scope beyond today's `ads_read`
grant; separate spec). A JS snippet for operators to instrument their own booking pages ("tier 3";
separate spec). Email delivery of enquiries. Organic publishing of captions. Changing
`CampaignRecord`, the PES formula, or the existing ad-platform-connections feature. Any change to
the promo-code spec's own decisions (lift baseline, rollup warning semantics, FareHarbor).

---

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Relationship to the code spec | Complement, separate spec, three named seams | Matches how this repo already stacks specs (ad-connections → campaign-selection → live-week-metrics): each small and independently shippable. The code spec is approved with settled decisions; reopening it to add links would re-litigate them and produce a spec too large for one plan. |
| How "which creative" is determined | Platform URL macros (`{{ad.id}}`, `__CID__`), not the click token | `fbclid`/`ttclid` are opaque and cannot be decoded into an ad id. Macros are substituted by the platform at click time and are the only mechanism that names the creative. |
| Attribution unit | One link per surge *window*, sibling of the code | Same unit the code uses. Keyed on `(profile, category, market, window_start)` rather than on `demand_alert_id`, because alerts are deleted and re-inserted on every pipeline run — see *Why the window, not the alert*. Creative-level granularity comes from the macro, not from minting many links. |
| Slug generation | CSPRNG, 8 chars, unambiguous alphabet | Deliberately *unlike* the code. The code is derived and quotable by design; a derived slug would let anyone enumerate other operators' campaigns. |
| Conversion storage | A `source='LINK'` row in the code spec's `tbl_attribution_redemption`, not a new table | One rollup, not two competing booking totals. The code spec already shaped that table with a `source` discriminator. |
| Creative id carried via | `attribution_click_id` FK on the redemption row | A redemption knows its creative only through its click; denormalising the ad id onto the redemption would let the two disagree. |
| Tier 2 destination | CeView-hosted enquiry page, operator-selectable per link | A resort will not let CeView be its reservation system but will take a forwarded enquiry. Expressing it as the link's `destination_url` being NULL keeps it a per-campaign choice, not an account-wide mode. |
| Enquiry delivery | In-app notification only | The backend has no mail capability today (no `spring-boot-starter-mail`, no provider); `NotificationService` is in-app polling. Adding email means a new dependency and an SMTP secret for what is otherwise a self-contained feature. Deferred, with the risk stated below. |
| Redirect path | `/r/{slug}`, outside `/api` | `ProfileCompletionFilter` and the CORS config both assume `/api/**` is authenticated app traffic. Short paths also matter for something that has to fit inside an ad. |
| IP handling | Store `ip_hash`, never the raw IP | Enough to debounce and spot abuse; avoids retaining identifiable data on foreign travellers. |
| Untagged clicks | Explicit "organic / untagged" bucket | A click with no macros is real evidence of reach; silently dropping it would understate the link and confuse the totals. |
| Closed-window slug | Still redirects | A stale ad in the wild should not 404 a real traveller. The click is recorded and marked out-of-window. |

---

## Architecture

### Flow

```
1. Alert fires (module2/submodule22/ForecastingService)
   → AttributionCodeService mints the code      [code spec, phase 1]
   → AttributionLinkService mints a link slug    [this spec]
     same transaction, both keyed to demandAlertId

2. Operator opens Content Studio from the alert
   POST /api/content/generate { ..., demandAlertId }
   → resolves BOTH the code and the link for that alert
   → the caption carries the code as a CTA and the link as its destination
   → Content Studio shows an "Ad URL" block: the slug plus the platform
     macro string, one-click copy, for pasting into Meta/TikTok ad-level
     URL parameters

3. Traveller clicks the ad
   GET /r/{slug}?cmp=..&set=..&ad=..&fbclid=..     [public, no JWT]
   → bot filter, write tbl_attribution_click, 302 to the destination
     with ?cv={clickId} appended

4a. Tier 1 — destination is the operator's own URL
    → the click sits unconverted; it is an ad-attributed *click*, no more
    → when the operator logs a booking (code spec's LogBookingAction),
      CeView offers same-window unconverted clicks to attach it to
    → attaching writes a redemption row with source='LINK'

4b. Tier 2 — destination is NULL, so the link points at CeView's enquiry page
    → traveller submits name / contact / dates / party size
    → CeView writes the enquiry, a source='LINK' redemption, and an in-app
      notification, atomically. No operator action required.

5. Performance screen
   → per creative: clicks, conversions, revenue, grouped by external_ad_id
   → shown alongside the code-redemption and statistical-lift panels the
     code spec defines, labelled as distinct kinds of evidence
```

### The three seams with the code spec

1. **Widened `source` enum** on `tbl_attribution_redemption`, plus a nullable
   `attribution_click_id`. Owned by this spec's migration.
2. **The alert transaction.** `ForecastingService` calls both mint services in one transaction.
   This spec's service is added beside the code spec's, not wrapped around it.
3. **The Performance evidence panel.** The code spec designed it to show distinct evidence side by
   side; this spec adds the per-creative table as a third panel within it.

### Package placement

`com.ceview.module4.attribution.link`, a sibling of the code spec's
`com.ceview.module4.attribution` and the same placement logic as
`com.ceview.module4.adconnections`: Module 4's Performance screen is what ultimately reads this
data. Module 2 gains one call into it; Module 3 gains one read.

### Prerequisite

**The code spec's phase 1 must land first.** Links piggyback on the alert-mint transaction and the
tenant-scoping pattern of `tbl_attribution_code`. Nothing in this spec can be verified without it.

### Why the window, not the alert — an amendment to the code spec

The code spec keys one code per `DemandAlert` through a `UNIQUE` foreign key, and this spec
originally did the same for links. **That is not safe against how alerts are actually persisted.**

[`ForecastingService.persistDemandAlert`](../../../backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java)
deletes every existing alert for a `(profile, category, market)` triple and re-inserts a fresh row
on each pipeline run — the delete-then-maybe-reinsert that stops the alert feed accumulating
duplicates. `demand_alert_id` therefore changes constantly. A cascading FK would:

- delete the operator's code on every run, invalidating a code already printed on a posted caption; and
- delete the link on every run, **404ing every click on an ad already live in market.**

The stable identity of "the Korea surge for resorts opening 19 Oct" is
`(business_profile_id, category, target_market, window_start)`. That tuple is the unique key for
both tables. `demand_alert_id` is kept as a plain, nullable, non-FK pointer to whichever alert row
currently represents the window, refreshed on each mint.

Mint is consequently **idempotent per window**: a rerun finds the existing row, re-points it at the
new alert, and leaves the code string and the slug untouched. `AttributionMintTest
.aPipelineRerunKeepsTheSameCodeAndSlug` is the regression guard.

This amends the code spec's data model. That spec is otherwise unchanged; its decision table,
lift baseline, rollup semantics and FareHarbor design all stand.

### Migration numbering

The code spec states `V28` and `db/h2/V19`. Both are stale: Postgres is at **V42**
(`V42__module4_ad_campaign_selection.sql`) and the H2 mirror is at **V19**
(`V19__ad_campaign_selection.sql`). The code spec is therefore **V43 / h2 V20**, and this spec is
**V44 / h2 V21**.

---

## Data model

`V44__module4_link_attribution.sql` plus H2 mirror `db/h2/V21__link_attribution.sql`, following
the commented-WHY convention of `V41__module4_ad_platform_connections.sql`.

### `tbl_attribution_link`

One row per `DemandAlert`.

| Column | Notes |
|---|---|
| `link_id` | UUID PK |
| `demand_alert_id` | **Not a FK.** A nullable pointer to the alert currently representing this window, refreshed on each mint — see *Why the window, not the alert* below |
| `category`, `target_market` | part of the window key; `target_market` is not on `DemandAlert` (it lives on `ForecastResult.targetMarket`) so it is denormalised here |
| `business_profile_id` | denormalised, for tenant-scoped reads |
| `slug` | `UNIQUE`, 8 chars, CSPRNG over an unambiguous alphabet |
| `destination_url` | the operator's own URL (tier 1), or NULL = use the CeView enquiry page (tier 2) |
| `window_start`, `window_end` | mirrors the code's 14-day window |
| `created_at` | |

### `tbl_attribution_click`

One row per non-bot click.

| Column | Notes |
|---|---|
| `click_id` | UUID PK — this is the `cv=` value |
| `link_id` | FK |
| `business_profile_id` | denormalised, for tenant-scoped reads |
| `external_campaign_id`, `external_adset_id`, `external_ad_id` | from the macros; all nullable — an organic click has none |
| `platform` | `CHECK IN ('META','TIKTOK','UNKNOWN')`, inferred from which macro set resolved |
| `click_token` | raw `fbclid`/`ttclid`, nullable; stored only for a future Conversions-API tier, unused today |
| `referrer`, `user_agent` | nullable, truncated |
| `ip_hash` | salted hash, never the raw IP |
| `in_window` | whether `clicked_at` fell inside the link's window |
| `clicked_at` | |

Indexed on `(business_profile_id, clicked_at)` and `(link_id, external_ad_id)` — the two read
paths are "this operator's recent clicks" and "roll up by creative."

### `tbl_attribution_enquiry`

Tier 2 only. Its own table rather than columns on the click, because it is the only place real
traveller PII lands and it needs a retention policy the click table does not.

| Column | Notes |
|---|---|
| `enquiry_id` | UUID PK |
| `click_id` | FK, `UNIQUE` |
| `business_profile_id` | |
| `contact_name`, `contact_value` | traveller-supplied |
| `party_size` | nullable |
| `requested_start`, `requested_end` | nullable dates |
| `message` | nullable, length-capped |
| `created_at` | |

### Changes to the code spec's `tbl_attribution_redemption`

```sql
ALTER TABLE tbl_attribution_redemption
    DROP CONSTRAINT IF EXISTS tbl_attribution_redemption_source_check,
    ADD CONSTRAINT tbl_attribution_redemption_source_check
        CHECK (source IN ('MANUAL','FAREHARBOR','LINK')),
    ADD COLUMN IF NOT EXISTS attribution_click_id UUID NULL
        REFERENCES tbl_attribution_click(click_id);
```

`attribution_click_id` is set on `LINK` rows and NULL otherwise. It is what carries the creative
through to the Performance rollup.

**Deliberate omission:** no `conversion` table. A conversion *is* a redemption row with
`source='LINK'`. That is what makes both paths land in one rollup instead of two competing totals.

---

## Components

| Component | Responsibility |
|---|---|
| `AttributionLinkService` | Mints the slug inside `ForecastingService`'s alert transaction; resolves a link by alert id; builds the macro-suffixed ad URL string per platform |
| `ClickTrackingService` | Bot filtering, click persistence, destination URL assembly |
| `BotFilter` | User-agent deny-list (`facebookexternalhit`, `TikTokBot`, `Bytespider`, headless signatures) plus a same-`ip_hash`-same-slug debounce. Deliberately conservative: over-filtering loses evidence, under-filtering inflates every number on the Performance screen |
| `RedirectController` | `GET /r/{slug}` — public |
| `EnquiryService` / `EnquiryController` | Tier 2 submission; writes enquiry + `LINK` redemption atomically, and exposes a tenant-scoped `GET /api/attribution/enquiries` for the operator — see the note below |
| `LinkAttributionQueryService` | Per-creative rollup: clicks, conversions, revenue grouped by `external_ad_id`, with an explicit untagged bucket |
| `AttributionLinkController` | The authenticated endpoints below |

> **Correction (2026-09-20, during foundation implementation).** This spec said the enquiry "raises
> an in-app notification". **There is no generic notification store.**
> `NotificationService.getNotificationsForProfile` reads `tbl_demand_alert` directly, and
> `getKeywordTrendNotifications` reads `tbl_keyword_trend_alert`; `NotificationDto` is shaped around
> markets and alerts (`market`, `trend`, `upliftPct`) and fits an enquiry badly.
>
> Enquiries instead follow the `keyword-trends` precedent: a third notification source backed by its
> own table, surfaced through its own tenant-scoped endpoint `GET /api/attribution/enquiries` with
> its own DTO. `tbl_attribution_enquiry` already exists, so this is a read path, not schema. Detail
> in [`plans/2026-09-20-link-attribution/03-track-4-hosted-enquiry.md`](../plans/2026-09-20-link-attribution/03-track-4-hosted-enquiry.md).

### Endpoints

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/r/{slug}` | **public** | `302` to the destination with `?cv={clickId}`; `404` on unknown slug; a closed-window slug still redirects |
| `POST` | `/api/public/attribution/enquiries` | **public** | Tier 2 submission, keyed by a valid in-window `cv` click id |
| `GET` | `/api/attribution/links` | JWT | The operator's links: slug, window, destination, ready-to-paste ad URL per platform |
| `PATCH` | `/api/attribution/links/{linkId}` | JWT | Set or change `destination_url` — this is the tier-1 / tier-2 switch |
| `GET` | `/api/attribution/links/{linkId}/creatives` | JWT | Per-`external_ad_id` rollup for the Performance panel |
| `GET` | `/api/attribution/clicks/unconverted` | JWT | Candidate clicks for the manual-match flow, windowed |

Changed elsewhere: the code spec's `POST /api/attribution/redemptions` gains an optional
`clickId`; supplying it sets `source='LINK'` and links the redemption to that click.

### Security plumbing

Two new `permitAll` matchers in `SecurityConfig` (`/r/**`, `/api/public/attribution/**`) and
matching `ProfileCompletionFilter.isExempt` entries — the same two-line pattern the ad OAuth
callback already needed, and for the same reason: the request arrives from a browser with no
`Authorization` header.

Both public endpoints are IP-hash rate limited. The enquiry endpoint additionally requires a
valid, in-window `cv` click id, so it cannot be posted to blind.

---

## Frontend

- **`types.ts`** — `AttributionLink`, `AttributionClick`, `CreativePerformance`, `AttributionEnquiry`.
- **`apiClient.ts`** — an `attributionLinks` group, same `USE_FIXTURES ? delay(MOCK) : request(path)`
  shape as `adConnections`.
- **Content Studio** — an "Ad URL" block beside the generated caption: the slug, the per-platform
  macro string, a copy button, and a short line saying where in Ads Manager it goes. **This is the
  highest-risk surface in the feature**: if the operator does not paste the macros, every click
  arrives with a NULL ad id and the per-creative story collapses to campaign level.
- **Performance screen** — a per-creative table (creative, clicks, conversions, revenue) inside the
  evidence panel, beside the code-redemption and lift figures.
- **`LogBookingAction`** (code spec's component) — gains an optional "was this from an ad click?"
  step listing unconverted in-window clicks.
- **Enquiry page** — a public, unauthenticated route rendering the tier 2 form, styled with the
  operator's business name. No app chrome, no login.

No new context provider — a `useAttributionLinks()` hook per consumer, matching `useAdConnections()`.

---

## Testing

**Backend**

- `AttributionLinkServiceTest` — a slug is minted in the same transaction as the alert and its
  code; slugs are unique and non-sequential across many mints; the ad URL string carries the right
  macro syntax for Meta vs TikTok.
- `ClickTrackingServiceTest` — macros parsed into the three id columns; all-NULL ids for an organic
  click; `fbclid` captured; IP hashed, not stored; bot user-agents rejected; same-ip-same-slug
  debounce.
- `RedirectControllerTest` — MockMvc, unauthenticated: correct 302 with `cv=` appended; a
  destination that already has a query string does not get a malformed second `?`; unknown slug
  404s; a closed-window slug still redirects and records `in_window = false`.
- `EnquiryControllerTest` — a valid `cv` writes enquiry + `LINK` redemption + notification
  atomically; an unknown or out-of-window `cv` is rejected; the rate limit trips.
- `LinkAttributionQueryServiceTest` — the rollup groups by `external_ad_id`, and NULL-id clicks
  collapse into an explicit untagged bucket rather than vanishing.
- `AttributionLinkControllerTest` — MockMvc with a minted JWT; a second operator's JWT cannot read
  or PATCH another operator's link, and cannot resolve a slug it does not own.

**Frontend** — Vitest for the apiClient group, the Content Studio ad-URL block's copy behaviour,
the per-creative Performance table including the untagged bucket and the empty state, the public
enquiry form's validation, and `LogBookingAction`'s click-match step.

**e2e** — unlike the ad-platform specs, this one is fully coverable end to end because no third
party is involved: a Playwright spec walks alert → link → redirect → enquiry → Performance
attribution.

---

## Build order

Each phase ends somewhere independently verifiable.

0. **Prerequisite** — the code spec's phase 1 (`tbl_attribution_code`, `AttributionCodeService`,
   the `ForecastingService` hook).
1. **Foundation** — V44 + H2 mirror, entities, repositories, `AttributionLinkService` wired into
   `ForecastingService`, shared DTOs, SecurityConfig and `ProfileCompletionFilter` exemptions,
   frontend types and apiClient group with fixtures.
   *Verify: a new alert produces exactly one link row alongside its code row.*
2. **Redirect** — `RedirectController`, `ClickTrackingService`, `BotFilter`.
   *Verify: a hand-built macro URL produces a click row with the right ad id and lands on the
   destination.*
3. **Operator surfaces** — links endpoints, Content Studio ad-URL block, destination PATCH.
   *Verify: an operator can copy a working ad URL and change their destination.*
4. **Tier 2 enquiry** — enquiry table, public endpoint, hosted page, in-app notification.
   *Verify: a submitted enquiry appears as a notification and as a `LINK` redemption.*
5. **Performance rollup** — query service, endpoint, per-creative table, `LogBookingAction` match
   step.
   *Verify: seeded clicks and conversions across three ad ids produce the correct per-creative
   split.*
6. **Documentation** — cross-link from `docs/module-4/README.md`; an operator-facing note on
   pasting the ad URL.

## Acceptance

- `./mvnw test` and `npm test` green; `npm run build` clean.
- Every new `DemandAlert` yields exactly one `tbl_attribution_link` row, sibling to its code row.
- A macro-tagged click resolves to a specific creative; an untagged click is visibly bucketed, not
  dropped.
- A second operator's JWT sees none of this operator's links, clicks, or enquiries.
- Bookings logged via code and via link land in one rollup, with their source visible.
- The backend boots and the redirect works with no ad platform connected.

## Known risks and external constraints

- **Render free-tier cold start.** `render.yaml` runs the Spring service on `plan: free`, which
  spins down when idle. A traveller hitting a cold `/r/{slug}` waits 30+ seconds and bounces — and
  it will be cold exactly when a surge ad first runs. This is blocking for real-world use and needs
  either an always-warm plan or a separate always-on redirect service. Stated here because it is an
  infrastructure decision, not a code change.
- **The operator may not paste the macros.** Then every click lands untagged and the feature
  degrades to campaign-level attribution. Mitigated by the Content Studio copy block, not solved.
- **In-app-only enquiry delivery.** A resort that does not open CeView daily misses an enquiry,
  which is a lost booking. Email is deferred to its own spec.
- **Click loss is expected.** In-app browsers and tracking prevention strip or degrade URL
  parameters. Click and conversion counts are a floor, never a census, and should be labelled as
  such in the UI.
- **Instagram captions do not linkify.** For Instagram the link realistically lives on the ad's CTA
  button or in link-in-bio, not in the caption body. Module 3's caption copy should not promise
  otherwise.
