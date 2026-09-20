# Link Attribution — Parallel Work Split

**Spec:** [`specs/2026-09-20-link-attribution-design.md`](../../specs/2026-09-20-link-attribution-design.md)
**Complements:** [`specs/2026-09-14-marketing-attribution-design.md`](../../specs/2026-09-14-marketing-attribution-design.md)
(promo codes — the fallback path for bookings a link can never see)

The foundation is **already merged into the working tree**. Tracks 2–5 below can start immediately
and in any order. They share no files with each other.

| Track | Plan | Owns |
|---|---|---|
| 2 | [`01-track-2-redirect-and-click-capture.md`](01-track-2-redirect-and-click-capture.md) | `RedirectController`, `ClickTrackingService`, `BotFilter` |
| 3 | [`02-track-3-operator-surfaces.md`](02-track-3-operator-surfaces.md) | `AttributionLinkController`, Content Studio Ad URL block |
| 4 | [`03-track-4-hosted-enquiry.md`](03-track-4-hosted-enquiry.md) | `EnquiryService`/`EnquiryController`, public enquiry page |
| 5 | [`04-track-5-performance-rollup.md`](04-track-5-performance-rollup.md) | `LinkAttributionQueryService`, per-creative table, docs, e2e |

Each track plan carries its own goal, prerequisites, implementation detail, test design, definition
of done, manual exploration instructions, and the exact verification commands with expected
baselines.

Two cross-track agreements, and nothing else: Tracks 2 and 4 agree the **path of the hosted enquiry
page**, and Track 4 reuses Track 2's **rate-limit mechanism** rather than building a second one.

### Documentation ownership

Each track documents what it builds. Docs are the **one place the tracks can collide**, because
`RUNNING.md` is a single file every track has a reason to touch — so it is split by *section*, not
by file. Stay inside your own rows.

| Track | Owns | Must not touch |
|---|---|---|
| 2 | `RUNNING.md` **§5** (env vars) and **§10** (troubleshooting); `backend/.env.example` | Any other `RUNNING.md` section |
| 3 | `LINK_ATTRIBUTION_SETUP.md` (new, repo root); `docs/module-3/screens/content-studio.md` | `RUNNING.md` entirely |
| 4 | `RUNNING.md` **§6** (auth) and **§7** (smoke test); the spec's Components amendment | `RUNNING.md` §5/§10 |
| 5 | `docs/module-4/README.md`; the final cross-document consistency pass | `RUNNING.md` entirely |

**Track 4's docs task is not cosmetic.** `RUNNING.md` §6 currently states that every screen is
gated behind Sign In and every `/api/**` route requires a JWT. The public enquiry endpoint and page
break both halves of that sentence. Left unamended, a teammate auditing the security posture either
trusts a false statement or "fixes" the exemption and breaks every live ad.

`backend/CONTRACT.md` covers neither ad connections nor this feature. That is a known, accepted gap
recorded in `AD_PLATFORM_SETUP.md` §10 — no track fills it unilaterally.

---

## What the foundation already gives you

Read this before starting. It is the contract between the four tracks, and it exists so you never
have to wait on another track's JPA mapping, migration number, or security config.

### Migrations — all of them, done. Do not add more.

| File | Contents |
|---|---|
| `db/migration/V43__module4_attribution_codes.sql` | `tbl_attribution_code`, `tbl_attribution_redemption` |
| `db/migration/V44__module4_link_attribution.sql` | `tbl_attribution_link`, `tbl_attribution_click`, `tbl_attribution_enquiry`, widens `redemption.source` to include `LINK` and adds `attribution_click_id` |
| `db/h2/V20__attribution_codes.sql`, `db/h2/V21__link_attribution.sql` | H2 mirrors for the `h2` runtime profile |

If you need a schema change, **say so rather than adding V45** — two tracks each adding a V45 is the
one merge conflict this split is designed to prevent.

### Entities and repositories

`com.ceview.module4.attribution` — `AttributionCode`, `AttributionRedemption`, `AttributionWindow`,
`AttributionCodeService`, and their repositories.

`com.ceview.module4.attribution.link` — `AttributionLink`, `AttributionClick`, `AttributionEnquiry`,
`AttributionLinkService`, `SlugGenerator`, `AdUrlBuilder`, `AttributionLinkDtos`, and their
repositories.

Repository query methods for all four tracks are already declared. If one is missing, add it —
repositories are the one shared file where additive changes rarely conflict.

### Security

`SecurityConfig` and `ProfileCompletionFilter` already exempt `/r/**` and
`/api/public/attribution/**`. Do not touch either file.

### Frontend

`frontend/types.ts` has `AttributionLink`, `AttributionLinkUrls`, `UnconvertedClick`,
`CreativePerformance`, `LinkPerformance`, `AttributionEnquiryInput`.
`apiClient.attributionLinks` has `list`, `setDestination`, `performance`, `unconvertedClicks`,
fixture-backed. `services/fixtures/attributionLinks.ts` holds the mock data — including an
**untagged** creative row and a **zero-click** creative row, both of which your UI must render.

### Two invariants you must not break

1. **The window tuple is the key, not `demandAlertId`.** Alerts are deleted and re-inserted on
   every forecasting run. `demand_alert_id` is a refreshed non-FK pointer. Never add a FK to it,
   and never mint per alert — a slug is live inside a running paid ad.
2. **A link conversion is a redemption row with `source='LINK'`**, carrying
   `attribution_click_id`. Do not add a separate conversions table; the whole point is one rollup.

---

## Track 2 — Redirect and click capture

**Files you own:** `RedirectController`, `ClickTrackingService`, `BotFilter`, and their tests.

Build `GET /r/{slug}`: resolve the slug, filter bots, write an `AttributionClick`, `302` to the
destination with `?cv={clickId}` appended. A link with a null `destinationUrl` points at Track 4's
hosted page — coordinate only on that path string, nothing else.

Parse the macros into `externalCampaignId` / `externalAdsetId` / `externalAdId` from `cmp` / `set` /
`ad`, and infer `platform` from which macro set resolved. `AdUrlBuilder` shows the exact strings
operators paste.

Things that are easy to get wrong here:

- A destination that already has a query string must get `&cv=`, not a second `?`.
- An unknown slug 404s; a **closed-window** slug still redirects, with `inWindow = false`. 404ing a
  real traveller because their ad is stale is worse than recording a late click.
- Hash the IP. Never persist the raw address.
- Unsubstituted macros arrive literally — a click whose `ad` param is still the string
  `{{ad.id}}` is untagged, not a creative named `{{ad.id}}`.
- Be conservative in `BotFilter`: over-filtering loses evidence, under-filtering inflates every
  number on the Performance screen.

**Done when:** a hand-built macro URL produces a click row with the right ad id and lands on the
destination.

---

## Track 3 — Operator surfaces

**Files you own:** `AttributionLinkController`, the Content Studio "Ad URL" block, and their tests.

Endpoints: `GET /api/attribution/links`, `PATCH /api/attribution/links/{linkId}` (sets
`destinationUrl`; null or blank means hosted), `GET /api/attribution/clicks/unconverted`. Use
`AttributionLinkService.urlsFor()` for the three copyable strings. Every read is tenant-scoped via
`findByLinkIdAndBusinessProfileId` — a link id alone must never resolve cross-tenant.

**The Content Studio block is the highest-risk surface in the whole feature.** If an operator pastes
the bare link instead of the macro URL, every click arrives untagged and per-creative attribution
silently collapses to campaign level. The block needs the platform-specific string, a copy button,
and one plain line saying where in Ads Manager it goes. Treat the copy as part of the work, not
decoration.

**Done when:** an operator can copy a working ad URL and change their destination.

---

## Track 4 — Hosted enquiry (tier 2)

**Files you own:** `EnquiryService`, `EnquiryController`, the public enquiry page, and their tests.

`POST /api/public/attribution/enquiries` is **unauthenticated**. `clickId` (the `cv=` value) is the
only thing tying a submission to an ad and the only thing stopping the endpoint being posted to
blind — so validate that it resolves *and* is in-window, not merely that it is a UUID. Rate limit on
IP hash.

One transaction writes the `AttributionEnquiry`, a `source='LINK'` redemption carrying
`attributionClickId`, and an in-app notification. `existsByClickId` enforces one enquiry per click,
so a double-submit cannot book twice.

**There is no email.** The backend has no mail capability and adding one is out of scope; enquiries
surface through the existing in-app notification path. The risk that an operator misses one is
stated in the spec — do not solve it by pulling in a mail dependency.

The page is public: no app chrome, no login, no operator data beyond the business name.

**Done when:** a submitted enquiry appears as a notification and as a `LINK` redemption.

---

## Track 5 — Performance rollup and docs

**Files you own:** `LinkAttributionQueryService`, the creatives endpoint, the per-creative table,
the `LogBookingAction` click-match step, `docs/module-4` cross-links.

`GET /api/attribution/links/{linkId}/creatives` returns `LinkPerformanceResponse`.
`AttributionClickRepository.countClicksByCreative` gives clicks per `externalAdId`; join conversions
and revenue through `AttributionRedemption.attributionClickId`.

**Keep the untagged bucket.** Clicks with a null `externalAdId` are real reach and get their own
row. Dropping them would make CeView's totals disagree with the ad platform's, which is exactly the
kind of discrepancy that destroys an operator's trust in the whole screen.

On the Performance screen, the per-creative table sits **beside** the code-redemption and lift
panels, visibly labelled as a different kind of evidence — machine-observed clicks are not the same
claim as an operator-reported redemption, and merging them hides which is corroborating which.

You do not need Track 2's real clicks: seed rows directly.

**Done when:** seeded clicks and conversions across three ad ids produce the correct per-creative
split.

---

## Verification

`./mvnw test` and `npm test`. **The backend suite is already red on `ph2-dev`** — 12 pre-existing
failures in `EconomyInsightForexTest`, `EnsureFreshForecastTest`, `MacroInputProvenanceTest`,
`MarketDataIngestionJobForecastTriggerTest`, `DemandAlertRulesTest` and
`ReferenceProfileIsolationTest`, none related to this feature. Compare against that baseline rather
than expecting green. The frontend suite is fully green (555 passing) — keep it that way.
