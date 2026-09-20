# Track 5 — Performance Rollup and Docs

**Spec:** [`2026-09-20-link-attribution-design.md`](../../specs/2026-09-20-link-attribution-design.md) (phases 5–6)
**Shared contract:** [`00-index.md`](00-index.md) — read it first
**Owns exclusively:** `LinkAttributionQueryService`, the creatives endpoint, the per-creative table,
the `LogBookingAction` click-match step, `docs/module-4` cross-links

---

## Goal

Answer the question the whole feature exists for: *which ad creative produced the bookings?*

Everything upstream collects data. This track is where the operator actually sees the answer and
changes where the next peso of ad spend goes. It is also where the feature's credibility is won or
lost: the numbers here get compared against Ads Manager, and a discrepancy the screen does not
explain will make the operator stop trusting all of it.

---

## Prerequisite

The foundation, already merged:

| What | Where |
|---|---|
| `countClicksByCreative` + `CreativeClickCount` projection | `AttributionClickRepository` |
| `findByAttributionClickIdIn` | `AttributionRedemptionRepository` |
| `CreativePerformance`, `LinkPerformanceResponse`, `UnconvertedClickResponse` | `AttributionLinkDtos` |
| Frontend types + fixtures | `frontend/types.ts`, `frontend/services/fixtures/attributionLinks.ts` |
| `apiClient.attributionLinks.performance` / `.unconvertedClicks` | `frontend/services/apiClient.ts` |

**You do not need Track 2's real clicks.** Seed `tbl_attribution_click` and
`tbl_attribution_redemption` rows directly in tests and in the H2 console. Build against seeded data
from day one rather than waiting.

`LogBookingAction` belongs to the complementary
[promo-code spec](../../specs/2026-09-14-marketing-attribution-design.md) and may not exist yet. If
it does not, build your click-match step as a self-contained component that can be dropped into it,
and say so in a comment — do not block on another spec.

---

## Modifications and implementations

### `LinkAttributionQueryService` — new, `module4/attribution/link/`

Produces `LinkPerformanceResponse` for one link:

1. `countClicksByCreative(linkId)` → clicks per `externalAdId` (null key = untagged).
2. Load the link's clicks, then `findByAttributionClickIdIn` for their redemptions.
3. Group conversions and revenue by the **click's** `externalAdId`.
4. Assemble rows plus totals.

**Keep the untagged bucket.** Clicks with a null `externalAdId` get their own row, labelled as
"Organic / untagged" or similar. They are real reach — an organic post, or a paid ad whose operator
pasted the bare link instead of the macro URL, which is the likeliest real-world outcome of this
whole feature. Dropping them would make CeView's click total disagree with the ad platform's, and
that discrepancy is exactly what destroys trust in the screen.

**Only `inWindow = true` clicks count** toward campaign totals. `countClicksByCreative` already
filters this; keep the same filter on the conversion side or the two halves will disagree.

**Revenue is separate from conversions, always.** A Track 4 enquiry counts as one conversion with
zero revenue. Never infer an amount from a conversion count, and never hide a conversion because its
revenue is zero.

Watch the N+1: load clicks and redemptions in bulk, not per creative.

### Endpoint

`GET /api/attribution/links/{linkId}/creatives` — JWT, tenant-scoped via
`findByLinkIdAndBusinessProfileId`. A link id belonging to another operator returns `404`, not
`403`. Add it to Track 3's `AttributionLinkController` if that has landed; otherwise your own
controller, and merge later.

### Performance screen — per-creative table

In `frontend/components/module-4/4.1-campaign-analytics/`. Follow the existing component patterns
there; consult the `tourism-app-branding` skill before styling.

Columns: creative, clicks, conversions, revenue. Sort by conversions descending — the operator's
actual question is "which one worked", and that ordering answers it without them reading.

**Placement matters as much as the table.** It sits *beside* the code-redemption and statistical-lift
panels, visibly labelled as a **different kind of evidence**. A machine-observed click-through is
not the same claim as an operator-reported code redemption; merging them into one number hides which
is corroborating which, and the spec's whole evidence model rests on keeping them apart.

States you must handle, all of which are in the fixtures already:

| State | Render |
|---|---|
| Normal creatives | the table |
| A creative with 0 clicks / 0 conversions | a row, not omitted — "we ran it and it did nothing" is the finding |
| The untagged bucket | its own row, labelled, never hidden |
| **Only** an untagged bucket | the table **plus** a prompt that the macro URL was probably not pasted — this is the diagnosable failure and the screen is the only place it surfaces |
| No clicks at all | an empty state, not a zeroed table |

Label click and conversion counts as a **floor, not a census**. In-app browsers and tracking
prevention strip URL parameters; undercounting is expected and normal. One short line of copy saying
so prevents the operator concluding the numbers are broken.

### `LogBookingAction` click-match step

An optional "was this from an ad click?" step listing unconverted in-window clicks from
`unconvertedClicks(from, to)`. Choosing one sets `clickId` on the redemption, making it
`source='LINK'` and carrying the creative into this rollup.

"None of these" must be a first-class option. Most bookings genuinely are not from a tracked click,
and an operator who feels pushed into picking one will poison the data this track reports.

*(Documentation is its own section below — you own the Module 4 surface.)*

---

## Testing

### `LinkAttributionQueryServiceTest`

Seed clicks and redemptions directly.

| Case | Asserts |
|---|---|
| Three creatives with differing conversions | correct per-creative split; sorted by conversions desc |
| Clicks with null `externalAdId` | one untagged row, counted, not dropped |
| A creative with clicks but no conversions | present with zeros |
| A `LINK` redemption with `revenue = 0` | counted as a conversion, revenue stays 0 |
| `inWindow = false` clicks | excluded from both clicks and conversions |
| Totals | equal the sum of rows, untagged included |
| A `MANUAL` redemption with no `clickId` | not attributed to any creative |
| Another operator's link | `404` via the endpoint |

### Frontend — Vitest

- Table renders normal, zero-click, untagged, untagged-only and empty states.
- The untagged-only state shows the macro prompt.
- The floor-not-census caveat is present.
- Click-match step lists candidates and offers "none of these"; selecting one passes the `clickId`.

---

## Documentation

You own the **Module 4** surface, and you land last, so you also own the final consistency pass.

### `docs/module-4/README.md` — a new feature section

Add one after "Ad platform connections", written the same way that section is: what it does in two
or three sentences, what it deliberately does not do, a link to the design spec, and a link to the
developer setup guide (Track 3's `LINK_ATTRIBUTION_SETUP.md`).

Be explicit about the boundary readers will otherwise get wrong: **ad connections read metrics the
platform already has; link attribution produces a booking the platform never knew about.** They look
adjacent and are not the same mechanism. Say so, and note that link attribution complements — never
replaces — the promo-code path in
[`2026-09-14-marketing-attribution-design.md`](../../specs/2026-09-14-marketing-attribution-design.md),
because codes are the only thing that reaches Messenger, phone and walk-in bookings.

Also update that file's **Screens** table with the Performance screen's new panel, and add a row for
Track 4's public enquiry page — it is a Module 4 surface even though no operator ever logs into it.

### The final consistency pass

By the time you land, three other tracks will have edited docs independently. Before calling this
done, read the four documents together — `RUNNING.md`, `LINK_ATTRIBUTION_SETUP.md`,
`docs/module-4/README.md`, `docs/module-3/screens/content-studio.md` — and check:

- No two of them describe the same thing differently (especially the tier-1/tier-2 wording and what
  the three copyable strings are called).
- Every cross-link resolves. Relative paths from `docs/module-4/` and from the repo root differ, and
  this is where they break.
- Nothing still describes the feature as planned or forthcoming.

Fix what you find, or file it — do not leave a contradiction for the next reader to arbitrate.

### What you do *not* document

`RUNNING.md` belongs to Tracks 2 (§5, §10) and 4 (§6, §7); raise inconsistencies with them rather
than editing those sections. Operator instructions are Track 3's.

`backend/CONTRACT.md` does not cover ad-connections either — a known, accepted gap, recorded in
`AD_PLATFORM_SETUP.md` §10. Extending it to both features at once is reasonable follow-up work but
is **not** in this track's scope; if you take it on, say so explicitly rather than folding it in.

---

## Definition of done

- [ ] Seeded clicks and conversions across three ad ids produce the correct per-creative split.
- [ ] Untagged clicks appear as their own labelled row and are included in totals.
- [ ] Out-of-window clicks are excluded from both halves consistently.
- [ ] A zero-revenue conversion counts as a conversion.
- [ ] Another operator's `linkId` returns `404`.
- [ ] The table sits beside the code and lift panels, labelled as distinct evidence — not merged.
- [ ] Untagged-only renders a diagnosable prompt, not a silent zero.
- [ ] Counts are labelled as a floor, not a census.
- [ ] "None of these" is available in the click-match step.
- [ ] `docs/module-4/README.md` has a feature section, states the boundary against ad connections
      and the promo-code path, and lists the new Performance panel and the public enquiry page.
- [ ] The four-document consistency pass is done: no contradictions, every cross-link resolves,
      nothing still reads as forthcoming.
- [ ] You edited no section of `RUNNING.md` owned by Tracks 2 or 4.
- [ ] `npm test` green; backend failures no worse than the 12 pre-existing.
- [ ] No new migration.

---

## Manual exploration and testing

The thing to check by hand is whether an operator can read the screen and **make a decision** from
it. That is not assertable.

### Fixture mode first

```powershell
cd frontend
$env:VITE_USE_FIXTURES = "true"
npm run dev     # http://localhost:3001
```

`fixtures/attributionLinks.ts` already contains the awkward cases: a zero-click creative and an
untagged bucket with one conversion. Both must render sensibly before you go near real data.

### Against the real backend

```powershell
# terminal 1
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd backend\spring-boot
& "$env:JAVA_HOME\bin\java.exe" -jar target\ceview-backend-0.1.0.jar `
    --spring.profiles.active=h2 --ceview.cors.allowed-origins=http://localhost:3001

# terminal 2
cd frontend
$env:VITE_USE_FIXTURES = "false"
npm run dev
```

Log in as `ramon.delacruz@ceview.local` / `MoalboalDive2024!`. Seed data via the H2 console
(http://localhost:8080/h2, JDBC `jdbc:h2:mem:ceview`, user `sa`, no password): one link, then clicks
across three `external_ad_id` values plus a few with `external_ad_id` NULL, then redemptions with
`source='LINK'` pointing at some of those click ids. Track 2's plan has the link SQL.

### Walk these by hand

1. **The split.** Confirm the three creatives show the shares you seeded and that the ordering puts
   the winner first.
2. **Untagged.** Confirm the NULL-`external_ad_id` clicks appear as their own labelled row and are
   included in the total — not silently dropped.
3. **Untagged only.** Delete the tagged clicks and reload. Confirm you get the macro prompt, not a
   table of zeros. **This is the single most important manual check on this track**: it is the most
   likely real-world state and the only place it is diagnosable.
4. **Zero-click creative.** Confirm it stays visible. "We ran it and nothing happened" is a finding.
5. **Zero-revenue conversion.** Insert a `LINK` redemption with `revenue = 0` (what a Track 4
   enquiry produces). Confirm conversions increments and revenue stays 0.
6. **Out-of-window.** Flip a click's `in_window` to `FALSE`. Confirm both its click and its
   conversion drop out together — a half-applied filter here is a silent inconsistency.
7. **Evidence separation.** Look at the full Performance screen. Can you tell at a glance which
   numbers are machine-observed and which are operator-reported? If not, the labelling has failed
   and the spec's evidence model is broken.
8. **Cross-tenant.** As a second seeded operator, `curl` the creatives endpoint with Ramon's
   `linkId`. Expect `404`.
9. **The decision test.** Show the screen to someone who has not read this plan. Ask: *"Which ad
   should they spend more on, and which should they stop?"* If they cannot answer in a few seconds,
   the table is not doing its job.

---

## Automated testing for verification

```powershell
cd backend\spring-boot
.\mvnw.cmd -o test -Dtest='LinkAttributionQueryServiceTest'
.\mvnw.cmd -o test

cd ..\..\frontend
npx vitest run
npx tsc --noEmit
npm run build
```

**Backend baseline:** `Tests run: 355, Failures: 8, Errors: 4` — 12 pre-existing failures in
`EconomyInsightForexTest`, `EnsureFreshForecastTest`, `MacroInputProvenanceTest`,
`MarketDataIngestionJobForecastTriggerTest`, `DemandAlertRulesTest`, `ReferenceProfileIsolationTest`.
Yours must not add a 13th.

**Frontend baseline:** 555 passing, 0 failing — keep it fully green. `tsc --noEmit` has 2
pre-existing errors in `DemandForecastChart.tsx` and `CalendarView.tsx`; add none.

### End-to-end (yours to own)

Unlike the ad-platform specs, this feature is fully coverable end to end — no third party is
involved. Once Tracks 2 and 4 have landed, add a Playwright spec in [`e2e/`](../../../../e2e/)
walking link → redirect → enquiry → per-creative attribution. It is the only test that proves the
four tracks actually compose, and this track is the natural owner because it sits at the end of the
chain.
