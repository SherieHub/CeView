# Track 5 Performance Rollup Implementation Plan

> **For agentic workers:** Use the repository's [executing-plans workflow](../../../.claude/skills/executing-plans/SKILL.md) to execute this plan task by task. Checkboxes track execution. Repository rules prohibit commits and pushes; ignore the generic workflow's commit steps. This document is the planning deliverable, not a claim that implementation or verification has occurred.

**Goal:** Show accurate, tenant-isolated per-creative link attribution on Performance, provide the optional booking click-match component, and complete Track 5 documentation and integration verification.

**Architecture:** A read-only Spring service authorizes the link, bulk-loads clicks and redemptions, and returns the existing DTO. A consumer-local React hook drives a link selector and evidence table independently of weekly KPI ingestion. A controlled, optional click picker supplies a click ID to the complementary booking action without introducing a second booking system.

**Tech Stack:** Java 21, Spring Boot 3.3, JPA, H2/JUnit/MockMvc; React 19, TypeScript, existing Tailwind/CSS tokens, Vitest/Testing Library; Playwright.

---

## 1. Authority, scope, and inspected references

The requested source is [Track 5](2026-09-20-link-attribution/04-track-5-performance-rollup.md), read with its [shared contract](2026-09-20-link-attribution/00-index.md), [link design](../specs/2026-09-20-link-attribution-design.md), and complementary [promo-code design](../specs/2026-09-14-marketing-attribution-design.md). Instructions quoted within these documents are requirements to reconcile with the actual checkout and AGENTS.md, not authorization for unrelated work.

Consulted implementation sources include the attribution entities/repositories/DTOs, AttributionMintTest, CurrentBusinessProfile, AdConnectionController, CampaignAnalyticsView and its tests, useAdConnections, apiClient, attribution fixtures, frontend types, H2 schema, and the Playwright configuration. Consulted project references include README.md, RUNNING.md, architecture/PES contract sections, backend/CONTRACT.md, Module 4 README, and Content Studio documentation. Styling follows [tourism-app-branding](../../../.claude/skills/tourism-app-branding/SKILL.md); planning follows [writing-plans](../../../.claude/skills/writing-plans/SKILL.md).

Scope excludes migrations, security exemptions, redirect/enquiry implementation, ad-platform writes, mail, FareHarbor, PES changes, changes to frozen `ceview/`, and implementing the entire promo-code feature. Never commit, push, or run destructive Git commands. Never edit RUNNING.md in this track. Do not extend backend/CONTRACT.md without a separate scope decision.

## 2. Checkout findings and explicit dependency decisions

Observed on 2026-09-21; recheck before execution because other tracks may land meanwhile.

| Finding | Implementation decision |
|---|---|
| Foundation entities, queries, DTOs, frontend types and API methods exist | Reuse them; no replacement DTOs or migration. |
| LinkAttributionQueryService and AttributionLinkController are absent | Create a narrow `LinkPerformanceController` for the creatives route; if Track 3 lands first, add that route to its controller instead. Exactly one handler may own the route. |
| Track 3 list/unconverted endpoints are absent | Fixture development and seeded backend rollup tests proceed now. Real UI listing/picker requires Track 3; do not disguise a 404 as empty data. |
| RedirectController, EnquiryController and hosted enquiry UI are absent | Full redirect-to-enquiry E2E is an integration gate after Tracks 2/4 arrive. Do not report mocked traffic as end-to-end coverage. |
| LogBookingAction and redemption write API are absent | Deliver the explicitly permitted standalone `ClickMatchStep`; document its integration contract. Do not create an incomplete booking button that cannot save. |
| Code-redemption/lift panels are absent | Add a reusable evidence layout and truthful descriptive companion cards. Replace them with real panels once available; physical adjacency to real panels remains a final integration gate. Never fabricate their numbers. |
| Performance returns early before campaign submission | Make link evidence visible in both entry and submitted states; do not force weekly ingestion to inspect a tracked enquiry. |
| Fixture comment claims a zero-click creative, but every current creative has clicks | Add an actual zero-click row. Explicitly create untagged-only and no-click test inputs; these are not currently supplied scenarios. |
| No creative inventory linked to attribution links exists | Real rollup can discover only creatives with observed clicks. Preserve zero-click rows supplied to the UI, but do not invent unseen creatives or infer them from account-wide ad metrics. |
| LINK redemption has `bookings` and `revenue` | Sum LINK `bookings` for conversions and BigDecimal revenue independently; normal enquiry/event writes use bookings=1. Add a bookings>1 test to lock this interpretation. |
| LINK covers both automatic enquiries and operator-matched bookings | Label the panel “Link-attributed evidence”; call clicks machine-observed and explain that conversions include enquiries and operator-matched bookings. Do not call every conversion a machine-confirmed booking. |
| LINK_ATTRIBUTION_SETUP.md is absent; RUNNING.md still says every screen/API is private | Track the setup guide and auth wording as owner follow-ups; final consistency cannot honestly be marked complete yet. |
| No tests have been run during planning | Historical pass/failure counts are reference information, not a verified baseline for this checkout. |

These dependency gates do not prevent Tasks 1–7. They do prevent claiming the entire cross-track definition of done until the named integrations are present and verified.

## 3. File map

Paths below are repository-relative and exact. The checkout root is `C:/Users/Sherielyn/Desktop/CeView`.

| Action | File | Responsibility |
|---|---|---|
| Create | `backend/spring-boot/src/main/java/com/ceview/module4/attribution/link/LinkAttributionQueryService.java` | Authorized bulk rollup |
| Create, unless Track 3 controller exists | `backend/spring-boot/src/main/java/com/ceview/module4/attribution/link/LinkPerformanceController.java` | JWT creatives endpoint only |
| Modify only if already landed | `backend/spring-boot/src/main/java/com/ceview/module4/attribution/link/AttributionLinkController.java` | Alternative home for that same route |
| Create | `backend/spring-boot/src/test/java/com/ceview/module4/attribution/link/LinkAttributionQueryServiceTest.java` | Persisted-data behavior |
| Create | `backend/spring-boot/src/test/java/com/ceview/module4/attribution/link/LinkAttributionQueryServiceBulkTest.java` | Query count and authorization short circuit |
| Create | `backend/spring-boot/src/test/java/com/ceview/module4/attribution/link/LinkPerformanceControllerTest.java` | Real JWT/tenant HTTP behavior |
| Modify | `frontend/services/fixtures/attributionLinks.ts` | Genuine zero-click row; preserve current data |
| Modify | `frontend/services/apiClient.ts` | Encode click-picker date query values |
| Create | `frontend/services/attributionLinks.test.ts` | Fixture/API URL contract |
| Create or extend if Track 3 creates it | `frontend/services/useAttributionLinks.ts` | Consumer-local list/loading/error/refresh state |
| Create | `frontend/services/useLinkPerformance.ts` | Selected-link request lifecycle |
| Create | `frontend/services/useLinkPerformance.test.tsx` | Request races/errors/reset |
| Create | `frontend/components/module-4/4.1-campaign-analytics/CreativePerformanceTable.tsx` | Pure accessible table and explanatory copy |
| Create | `frontend/components/module-4/4.1-campaign-analytics/CreativePerformanceTable.test.tsx` | Required table states |
| Create | `frontend/components/module-4/4.1-campaign-analytics/LinkAttributionPanel.tsx` | Link selection and request states |
| Create | `frontend/components/module-4/4.1-campaign-analytics/LinkAttributionPanel.test.tsx` | Selection, retry, errors, no-links state |
| Create | `frontend/components/module-4/4.1-campaign-analytics/AttributionEvidenceSection.tsx` | Responsive layout with distinct evidence areas |
| Modify | `frontend/components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` | Evidence accessible before/after ingestion |
| Modify | `frontend/components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.test.tsx` | Entry/full state integration and existing mock repair |
| Create | `frontend/components/module-4/4.1-campaign-analytics/ClickMatchStep.tsx` | Optional controlled click selection |
| Create | `frontend/components/module-4/4.1-campaign-analytics/ClickMatchStep.test.tsx` | Candidates, none, reset, API failures |
| Modify only if landed | `frontend/components/shared/LogBookingAction.tsx` | Pass selected clickId in booking write request |
| Modify | `docs/module-4/README.md` | Feature section and Screens table |
| Modify | `docs/module-4/screens/performance.md` | New evidence behavior, limitations, picker integration |
| Create | `docs/module-4/screens/link-attribution.md` | Module 4 link evidence and public-page documentation |
| Create | `docs/superpowers/plans/2026-09-20-link-attribution/05-track-5-integration-verification.md` | Owner issues, integration gates, executed results |
| Create after upstream routes are available | `e2e/tests/link-attribution.spec.ts` | Real redirect → enquiry → Performance journey |
| Create | `e2e/fixtures/link-attribution-h2.sql` | Disposable local test link/code provisioning, not migration |

No frontend type changes should be necessary. Avoid repository changes unless a demonstrated tenant/query need requires an additive scoped method.

## 4. Data contract and expected arithmetic

The endpoint returns the existing `LinkPerformanceResponse(linkId, slug, totalClicks, totalConversions, totalRevenue, creatives)` unchanged. Each creative uses `externalAdId`, `adLabel`, `untagged`, `clicks`, `conversions`, `revenue`.

1. Resolve `findByLinkIdAndBusinessProfileId(linkId, profileId)` before any click access. Missing and foreign links both throw 404.
2. Execute `countClicksByCreative(linkId)` once. Its existing query excludes out-of-window clicks and includes null keys.
3. Load this authorized link's clicks once. Keep `inWindow=true` and the matching profile. Link authorization scopes the existing link-ID-only query; reject inconsistent stored tenant IDs rather than exposing them.
4. Fetch redemptions for that eligible click-ID set once; skip an empty IN-list. Include only LINK rows belonging to the same profile. Join by click ID, never by the redemption's code/ad label or alert ID.
5. Normalize null/blank creative IDs to the same untagged bucket on both sides. Use a null-capable map; `Collectors.groupingBy` is unsafe for a null classifier.
6. Sum bookings and revenue independently. Do not filter revenue=0. Do not filter redemption eventAt against the click window: eligibility here is the click's persisted inWindow flag.
7. Sort conversions descending, then externalAdId ascending with null last. Return stable order on ties.
8. Compute totals from the completed rows. Use long for counts and BigDecimal for money; do not round through double.
9. Label tagged IDs `Ad <id>` because there is no local creative-name catalog. Label untagged `Organic / untagged`. Do not call external platforms to resolve names.

Canonical seeded result:

| Bucket | Eligible clicks | LINK bookings | Revenue |
|---|---:|---:|---:|
| ad-A | 3 | 2 | 1500.50 |
| ad-B | 2 | 1 | 0.00 |
| ad-C | 1 | 0 | 0.00 |
| null | 2 | 1 | 250.00 |
| Total | 8 | 4 | 1750.50 |

Also seed one out-of-window ad-A click with a 999.00 redemption, a MANUAL row without clickId, a second operator's link/click/redemption, and another same-tenant link. None may affect these totals. Expected row order: ad-A, ad-B, untagged, ad-C.

## 5. Ordered implementation tasks

### Task 1 — Establish the execution baseline and reconcile incoming tracks

- [ ] Read AGENTS.md, implement-task and verification-before-completion workflows before code changes. Recheck the file map and incoming working-tree changes; preserve others' edits.
- [ ] Create the integration-verification document with entries for the missing Track 3 APIs/setup guide, Tracks 2/4 journey, real evidence siblings, and optional booking parent.
- [ ] Run the current suites once and retain full output plus failing test identities. Compare subsequent failures by test name and cause, not just failure count.

Run from repository root in separate PowerShell commands:

```powershell
git status --short
```

From `backend/spring-boot`:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
Test-Path "$env:JAVA_HOME\bin\java.exe"
.\mvnw.cmd -o test
```

From `frontend`:

```powershell
npm test
npx tsc --noEmit
```

If offline Maven dependencies are unavailable, report that as infrastructure and retry without `-o` when network dependency retrieval is possible. Do not treat compilation failure as a known test failure. Historical references: backend 355 tests/8 failures/4 errors; frontend 555 passing; two TypeScript errors in DemandForecastChart.tsx and CalendarView.tsx. Exact current results supersede those counts.

### Task 2 — Seeded rollup tests, then the bulk query service

**Files:** the service and two service test files from the file map.

- [ ] Build `@SpringBootTest` transactional tests using actual repositories, a fresh business profile, and code/link mint services. Seed clicks/redemptions directly; do not depend on redirect/enquiry endpoints. Use rollback per test rather than deleting shared profile tables.
- [ ] Seed the canonical dataset above, flush persistence, invoke `performance(profileId, linkId)`, and assert every row and total, including BigDecimal comparison using `compareTo` or AssertJ numeric comparison.
- [ ] Add independently named tests for untagged-only, empty link, no-conversion creative, zero-revenue conversion, out-of-window exclusion, MANUAL/FAREHARBOR exclusion, other link/profile exclusion, blank creative ID normalization, bookings aggregation, decimal arithmetic, and deterministic ties.
- [ ] Run the new class; confirm failure is missing service/behavior, not broken setup.
- [ ] Implement the following service core with imports for Java collections/UUID/BigDecimal, Spring annotations/status exception, and the existing attribution classes. Use constructor injection; a private accumulator can stay in this file.

```java
@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class LinkAttributionQueryService {
    private final AttributionLinkRepository links;
    private final AttributionClickRepository clicks;
    private final AttributionRedemptionRepository redemptions;

    public LinkAttributionQueryService(AttributionLinkRepository links,
            AttributionClickRepository clicks,
            AttributionRedemptionRepository redemptions) {
        this.links = links;
        this.clicks = clicks;
        this.redemptions = redemptions;
    }

    private static String key(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static final class Bucket {
        long clicks;
        long conversions;
        BigDecimal revenue = BigDecimal.ZERO;
    }

    public AttributionLinkDtos.LinkPerformanceResponse performance(
            UUID profileId, UUID linkId) {
        var link = links.findByLinkIdAndBusinessProfileId(linkId, profileId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Attribution link not found"));
        Map<String, Bucket> buckets = new HashMap<>();
        for (var count : clicks.countClicksByCreative(linkId)) {
            buckets.computeIfAbsent(key(count.getAdId()), k -> new Bucket())
                    .clicks += count.getClicks();
        }
        Map<UUID, AttributionClick> eligible = new HashMap<>();
        for (var click : clicks.findByLinkIdOrderByClickedAtDesc(linkId)) {
            if (!profileId.equals(click.getBusinessProfileId())) {
                throw new IllegalStateException("Attribution click tenant mismatch");
            }
            if (click.isInWindow()) eligible.put(click.getClickId(), click);
        }
        if (!eligible.isEmpty()) {
            var rows = redemptions.findByAttributionClickIdIn(
                    new ArrayList<>(eligible.keySet()));
            for (var redemption : rows) {
                if (!profileId.equals(redemption.getBusinessProfileId())) {
                    throw new IllegalStateException("Attribution redemption tenant mismatch");
                }
                if (!AttributionRedemption.SOURCE_LINK.equals(redemption.getSource())) continue;
                var click = eligible.get(redemption.getAttributionClickId());
                if (click == null) continue;
                var bucket = buckets.computeIfAbsent(key(click.getExternalAdId()), k -> new Bucket());
                bucket.conversions += redemption.getBookings();
                bucket.revenue = bucket.revenue.add(redemption.getRevenue());
            }
        }
        var rows = buckets.entrySet().stream().map(entry -> {
            String adId = entry.getKey();
            var b = entry.getValue();
            return new AttributionLinkDtos.CreativePerformance(adId,
                    adId == null ? "Organic / untagged" : "Ad " + adId,
                    adId == null, b.clicks, b.conversions, b.revenue);
        }).sorted(Comparator.comparingLong(AttributionLinkDtos.CreativePerformance::conversions)
                .reversed().thenComparing(AttributionLinkDtos.CreativePerformance::externalAdId,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        return new AttributionLinkDtos.LinkPerformanceResponse(linkId, link.getSlug(),
                rows.stream().mapToLong(AttributionLinkDtos.CreativePerformance::clicks).sum(),
                rows.stream().mapToLong(AttributionLinkDtos.CreativePerformance::conversions).sum(),
                rows.stream().map(AttributionLinkDtos.CreativePerformance::revenue)
                        .reduce(BigDecimal.ZERO, BigDecimal::add), rows);
    }
}
```

- [ ] Add Mockito bulk tests verifying one link lookup, one count query, one click load, and one redemption load regardless of creative count; an empty link never calls `findByAttributionClickIdIn`. Unauthorized lookup must short-circuit all click/redemption queries.
- [ ] Run both new test classes and AttributionMintTest. Expected: all focused tests pass. The query plan is at most four reads, independent of the number of creatives; no per-row DB/API lookups.

```powershell
.\mvnw.cmd -o test '-Dtest=LinkAttributionQueryServiceTest,LinkAttributionQueryServiceBulkTest,AttributionMintTest'
```

Import `org.springframework.transaction.annotation.Isolation`. The read transaction uses REPEATABLE_READ so the count projection and eligible-click load see a consistent snapshot even while new clicks arrive. Verify on PostgreSQL as well as H2 when the integration environment is available; unit tests alone do not establish database isolation behavior. This transaction owns the HTTP read path and must not be invoked inside a pre-existing weaker-isolation write transaction.

### Task 3 — JWT-scoped creatives endpoint

**Files:** LinkPerformanceController and LinkPerformanceControllerTest, or the already-landed Track 3 controller.

- [ ] Follow `AdConnectionFlowTest`/`SecurityLockdownVerificationTest` for actual JWT construction, complete operator profiles, and MockMvc configuration. Keep security filters enabled.
- [ ] Assert own-link 200 with the existing DTO, foreign-link 404, unknown-link 404, unauthenticated 401, and malformed UUID 400. Compare foreign/unknown error shapes; neither reveals the slug or creative data.
- [ ] Implement one route with the authenticated profile resolver, never a client-supplied tenant field:

```java
@RestController
@RequestMapping("/api/attribution/links")
public class LinkPerformanceController {
    private final CurrentBusinessProfile currentProfile;
    private final LinkAttributionQueryService queries;

    public LinkPerformanceController(CurrentBusinessProfile currentProfile,
            LinkAttributionQueryService queries) {
        this.currentProfile = currentProfile;
        this.queries = queries;
    }

    @GetMapping("/{linkId}/creatives")
    public AttributionLinkDtos.LinkPerformanceResponse performance(@PathVariable UUID linkId) {
        return queries.performance(currentProfile.resolveProfileId(), linkId);
    }
}
```

- [ ] If Track 3 exists, put the same method/dependencies in its controller instead of creating this class. Confirm Spring starts without duplicate mappings. Preserve its list, PATCH and unconverted-click behavior.
- [ ] Run focused endpoint/service tests. Expected: all pass, with no changes to SecurityConfig or ProfileCompletionFilter.

```powershell
.\mvnw.cmd -o test '-Dtest=LinkPerformanceControllerTest,LinkAttributionQueryServiceTest,LinkAttributionQueryServiceBulkTest'
```

### Task 4 — Correct fixtures and establish frontend request behavior

**Files:** fixture, apiClient, attributionLinks.test, useAttributionLinks, useLinkPerformance and its tests.

- [ ] Add a separate row to MOCK_CREATIVES; preserve the existing 94-click/zero-conversion row:

```ts
{
  externalAdId: '120216',
  adLabel: 'Unclicked creative — KR',
  untagged: false,
  clicks: 0,
  conversions: 0,
  revenue: 0,
},
```

- [ ] Define explicit test inputs for untagged-only (one null-ID row, positive clicks), empty (`creatives: []`, all totals zero), and only-zero rows. Fixture helpers must return fresh arrays/objects; tests must not mutate global shared fixture rows.
- [ ] Add a request URL test using ISO dates with `+08:00`. Encode both query values in the existing API method:

```ts
`/api/attribution/clicks/unconverted?${new URLSearchParams({ from, to }).toString()}`
```

- [ ] Implement/reuse `useAttributionLinks` without adding a provider. Its contract is `links: AttributionLink[] | null`, `error: unknown | null`, `refresh(): Promise<void>`. Reset errors on retries; distinguish loaded-empty from failed. Ignore completions after unmount.
- [ ] Implement the selected-link hook with `data`, `loading`, `error`, `refresh`; clear previous data immediately when the selection changes. Use an effect-local cancellation flag or request generation counter. A slow request for link A must never overwrite B.

```ts
export interface LinkPerformanceState {
  data: LinkPerformance | null;
  loading: boolean;
  error: unknown | null;
  refresh(): void;
}
// Signature: useLinkPerformance(linkId: string | null): LinkPerformanceState
```

- [ ] Test no request for null selection, success, failure, retry, unmount, and A→B out-of-order completion using controllable promises. Never convert failed requests into a zero-result table or fetch fixture data in real mode.
- [ ] Run focused frontend tests. Expected: new contract/hook cases pass.

```powershell
npx vitest run services/attributionLinks.test.ts services/useLinkPerformance.test.tsx
```

### Task 5 — Pure per-creative table and exact evidence copy

**Files:** CreativePerformanceTable.tsx and its test.

- [ ] Write tests first for normal data, conversions-descending order, tie stability, clicks with zero conversions, a zero-click row alongside observed rows, null-ID labeling, untagged-only prompt, empty state, and floor copy. Assert totals include the untagged row.
- [ ] Accept `performance: LinkPerformance`. Sort a copied row array, never props. Do not filter rows by nonzero clicks, conversions or revenue.
- [ ] Use these rendering rules and strings:

```ts
const rows = [...performance.creatives].sort((a, b) =>
  b.conversions - a.conversions ||
  (a.externalAdId === b.externalAdId ? 0 :
    a.externalAdId === null ? 1 : b.externalAdId === null ? -1 :
    a.externalAdId.localeCompare(b.externalAdId))
);
const hasObservedClicks = rows.some(row => row.clicks > 0);
const onlyUntagged = hasObservedClicks &&
  rows.filter(row => row.clicks > 0).every(row => row.untagged);
const pesos = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
```

The tie comparator returns zero if both IDs are null; assert that behavior. If all supplied rows have zero clicks, render “No tracked clicks yet” rather than a zeroed table. If any clicks exist, retain every supplied row, including zero-click creatives. A genuinely tagged click-free row must not suppress an untagged-only diagnostic.

| Location | Exact copy |
|---|---|
| Heading | Link-attributed evidence |
| Subheading | Machine-observed clicks; conversions include enquiries and operator-matched bookings. |
| Columns | Creative · Clicks · Conversions · Revenue |
| Untagged label | Organic / untagged |
| Untagged-only message | All tracked clicks arrived without a creative ID. If you ran paid ads, the bare link may have been pasted instead of the platform-specific ad URL. Copy the Meta or TikTok ad URL from Content Studio. Organic traffic can also appear here. |
| Caveat | Click and conversion counts are a floor, not a census. In-app browsers and tracking prevention can remove tracking parameters. |
| Conversion explanation | An enquiry counts as one conversion; revenue stays ₱0.00 until an amount is recorded. |
| Empty state | No tracked clicks yet. Share this campaign's ad URL to begin collecting link-attributed evidence. |

- [ ] Render a semantic table with caption/column headers, numeric alignment, visible total row, and a horizontally scrollable wrapper at narrow widths. Use existing card, heading, body, radius, and color tokens; preserve keyboard focus. No hardcoded brand colors or new chart library.
- [ ] Test PHP formatting, fallback `Ad <id>` when adLabel is missing, unchanged input row order, and long-ID wrapping/overflow behavior in browser review.

```powershell
npx vitest run components/module-4/4.1-campaign-analytics/CreativePerformanceTable.test.tsx
```

### Task 6 — Link selection and Performance evidence layout

**Files:** LinkAttributionPanel, AttributionEvidenceSection, CampaignAnalyticsView, associated tests.

- [ ] LinkAttributionPanel loads links once per consumer. Select the first returned link initially; display a labeled selector with category, market, date window and slug so overlapping campaigns are distinguishable. Fetch only the selected link's performance.
- [ ] Add local loading text, `ApiErrorPanel`, a Retry button, “No tracked campaign links yet” for a successful empty list, and the separate “No tracked clicks yet” table state. On refresh, retain a selection only if it still belongs to the returned list. Never guess a link ID or silently use MOCK_LINKS in real mode.
- [ ] Test list/performance failures separately, retry, multiple links, selection changes, stale results, and no-links. A failed link request must leave other Performance areas usable.
- [ ] Add a section that accepts optional real code/lift nodes, keeping source labels separate:

```tsx
type AttributionEvidenceSectionProps = {
  codeEvidence?: React.ReactNode;
  liftEvidence?: React.ReactNode;
};
// Layout: grid gap-6 xl:grid-cols-3; each child min-w-0.
// First card: <LinkAttributionPanel />.
// Second heading: “Code-redemption evidence”.
// Third heading: “Statistical lift”.
```

Absent companion cards use text only: “Code-redemption evidence is not available in this build. It records operator-reported codes from Messenger, phone and walk-in bookings.” and “Statistical lift is not available in this build. It compares campaign results with the pre-campaign baseline.” Do not display 0, calculate lift from unrelated chart data, or imply these informational cards satisfy final real-panel integration.

- [ ] Render the evidence section in the entry branch above the ingestion form and in the submitted branch after the KPI strip. Keep existing KPI/report computation intact. When practical, share the section outside the conditional branches so it does not remount on submission; do not restructure unrelated dashboard cards.
- [ ] Extend existing test mocks with attributionLinks list/performance methods. Update the “only ingestion form” test to assert ingestion plus evidence and still no computed PES/trends. Test evidence persists after submit and after “New submission”.
- [ ] When real code/lift panels land, pass them as the two sibling nodes keyed to the same stable window tuple. Never join by transient demandAlertId or sum the three evidence presentations into a new score. LINK redemptions may already contribute to broader redemption totals; explain overlap rather than double-counting them.

```powershell
npx vitest run components/module-4/4.1-campaign-analytics/LinkAttributionPanel.test.tsx components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.test.tsx
```

### Task 7 — Optional, embeddable booking click-match step

**Files:** ClickMatchStep and its test; parent LogBookingAction only if available.

- [ ] Use this controlled contract; IDs and dates are supplied by the parent booking context:

```ts
export interface ClickMatchStepProps {
  linkId: string;
  from: string;
  to: string;
  value: string | null;
  onChange(clickId: string | null): void;
}
```

- [ ] Fetch `apiClient.attributionLinks.unconvertedClicks(from, to)` when the window changes; retain only matching linkId candidates. The server owns tenant, inWindow, and unconverted eligibility. Date bounds must come from the selected campaign window, not an arbitrary “recent” default. Respect Track 3's documented date-bound convention.
- [ ] Render a fieldset/legend “Was this from an ad click? (optional)”, radio candidates showing label/ID, platform and Asia/Manila timestamp, and a first-class “None of these” radio (`value=null`). Do not preselect a candidate. Use “Organic / untagged” for null IDs; do not expose IP hashes, click tokens or traveller contact details.
- [ ] Show loading, no-candidate and error states without blocking the parent from logging without a match. On link/window change invalidate the old selection; clear selection if it disappears after refresh. Ignore stale response completions and disable stale candidates while fetching.
- [ ] Add this code comment at the export while the parent is missing:

```ts
/**
 * Track 5's optional click-match step for the promo-code LogBookingAction.
 * The parent is not implemented in this checkout. Mount with the selected
 * campaign's link/window and submit a non-null value as the redemption clickId.
 * Selecting “None of these” leaves the existing manual booking path unchanged.
 */
```

- [ ] Test candidate selection calls onChange with exactly its clickId, None calls null, candidates from another link are absent, loading/error/empty preserve the None option, and window changes cannot submit a stale click.
- [ ] If the parent and write API have landed, mount the component there and include optional `clickId` in the payload. Verify server-side owned click lookup, matching code/link window tuple, `inWindow=true`, duplicate redemption rejection, and `source=LINK` with `attributionClickId` set. Client-supplied `source` must not be authoritative. Clearing the picker preserves MANUAL behavior. Coordinate any missing backend validation with that write-path owner; never claim callback tests prove persistence.

```powershell
npx vitest run components/module-4/4.1-campaign-analytics/ClickMatchStep.test.tsx
```

### Task 8 — Module 4 documentation and owner-specific consistency review

**Files:** Module 4 README/performance/link-attribution docs and integration-verification record.

- [ ] Insert this feature section immediately after “Ad platform connections”:

```markdown
## Link attribution

Link attribution records tracked ad clicks and groups conversions and revenue by creative on Performance, including an explicit Organic / untagged bucket. Ad connections read metrics the platform already has; link attribution records an enquiry or matched booking the platform never knew about. The link evidence complements the promo-code path, which reaches Messenger, phone and walk-in bookings that tracked links cannot observe.

It does not send conversions back to ad platforms, instrument external booking pages, or treat an enquiry as confirmed revenue. Counts are a floor, not a census.

Design: [Link attribution](../superpowers/specs/2026-09-20-link-attribution-design.md).
Complementary design: [Promo-code attribution](../superpowers/specs/2026-09-14-marketing-attribution-design.md).
Developer setup: [LINK_ATTRIBUTION_SETUP.md](../../LINK_ATTRIBUTION_SETUP.md).
```

- [ ] Add a Screens row for “Performance — link-attributed evidence” at `/performance`, pointing to the new screen doc. Add the public enquiry page row using the actual Track 4 route from its router after it lands; follow the redirect destination to verify it. Do not invent `/enquiry` or promise an unimplemented route.
- [ ] Document selector/window scope, all states, zero-revenue enquiry meaning, observed-ID inventory limitation, distinct evidence labels, and standalone picker integration in the screen docs. Do not write operator setup instructions owned by Track 3.
- [ ] Read RUNNING.md, LINK_ATTRIBUTION_SETUP.md, Module 4 README and Content Studio screen doc together. Check tier 1=external destination/manual match; tier 2=null destination/hosted enquiry/in-app notification; three strings=`linkUrl` (bare link), `metaAdUrl` (Meta ad URL), `tiktokAdUrl` (TikTok ad URL). Check consistency with actual AdUrlBuilder output.
- [ ] Validate each relative Markdown path and target heading in these four documents and the new Module 4 docs. Resolve relative paths from the containing document, not the repository root. Check fragments separately from file existence. Missing guide/route links remain explicit unresolved gates until the owner lands them.
- [ ] Record owner, file/section, observed wording and required correction for every conflict. Current known items: RUNNING.md §6 blanket JWT/login statement (Track 4), setup guide absent (Track 3), and Content Studio ad URL documentation absent (Track 3). Also record existing RUNNING.md Playwright server-start wording conflict with its current webServer config if still present. Edit only Track 5-owned documents; do not silently repair RUNNING.md.
- [ ] Remove forthcoming wording only for functionality that exists. Historical spec/plan status is not runtime documentation and must not be rewritten to falsely claim completion. Close all relevant owner issues or clearly report them; source allows filing cross-owner issues, but do not call contradictory docs consistent.

### Task 9 — Real integration and Playwright journey

**Files:** e2e fixture SQL, new Playwright spec, verification record. Depends on Tracks 2/3/4.

- [ ] Recheck actual public route, request fields, JWT setup and Track 3 APIs. Run against a disposable local H2 database and fixture-disabled frontend, not a deployed service or shared business data.
- [ ] Provision one test-only code and sibling hosted link for the seeded operator, using the same `(profile, category, market, window_start)` and a currently open window. Supply explicit UUIDs, slug, timestamps and required columns; destination is NULL. Do not create a migration or a production test endpoint. The H2 SQL file is for console execution against the running server: another `jdbc:h2:mem:ceview` process would create a different database.
- [ ] Use a unique slug/code per test run or remove only explicitly recorded test IDs in foreign-key order (enquiries → redemptions → clicks → links → codes). Never delete the operator or all attribution rows. Playwright records baseline counts so assertions remain robust to repeated runs; dedicated data avoids parallel-user interference.
- [ ] Begin unauthenticated at the real `/r/{slug}?cmp=e2e-campaign&set=e2e-set&ad=e2e-creative&fbclid=e2e-token`; use a normal browser user agent. Assert redirect to the actual hosted page and a valid `cv` UUID. Do not intercept/mock redirect, enquiry or performance responses.
- [ ] Complete and submit the public enquiry UI. Assert acknowledgement and no login requirement. Use test-only contact text; never real traveller data.
- [ ] Authenticate as the owning seeded operator using the existing login test pattern, visit Performance without submitting weekly data, choose the seeded link, and assert `Ad e2e-creative` gained one click and one conversion while revenue remains zero.
- [ ] Reload and assert persistence. Assert candidate endpoint no longer offers the converted click. If the notification surface has landed, verify the enquiry is visible to the owner there as well.
- [ ] In a separate authenticated context for a second seeded operator, GET the first link's creatives endpoint and assert 404; also confirm the link is absent from their selector.
- [ ] Add an untagged journey with its own fresh link so debounce does not suppress it. Confirm the Organic / untagged row and diagnostic prompt. Do not use arbitrary sleeps to beat debounce; use distinct test links.
- [ ] Use existing `e2e/playwright.config.ts`: real frontend on 3012 with fixtures disabled. Ensure backend CORS includes its origin and public redirect frontend-base configuration points at that server. Do not assume 3001 from the source manual commands applies to this runner.
- [ ] Run the spec without skip/fixme. Fail loudly on missing prerequisites when intentionally running this integration target; record “blocked by missing upstream” rather than presenting a skipped run as passed.

```powershell
# From e2e, with the backend running and disposable fixture provisioned:
npx playwright test tests/link-attribution.spec.ts --workers=1
```

This journey starts from a seeded link, as Track 5 requests. Foundation mint behavior remains covered by AttributionMintTest; do not claim this E2E also drove the forecasting pipeline from alert creation unless it actually did.

### Task 10 — Manual decision test and final verification

- [ ] In fixture mode, inspect desktop and narrow/mobile layouts, keyboard selection, focus, readable numeric columns, zero-click row, zero-revenue conversion and explicit evidence labels. Render the test variants for untagged-only and empty state; do not mistake the default fixture for coverage of every variant.
- [ ] In a disposable real backend, seed the canonical matrix. Verify exact rows/totals; flip the out-of-window flag on an otherwise converted click and confirm both click and conversion contribution disappear. Preserve/restore only the test dataset.
- [ ] Show untagged-only data and confirm the next action is clear: check the platform-specific ad URL in Content Studio. Organic traffic must not be framed as an error.
- [ ] Verify real code/lift siblings when available. Ask a person unfamiliar with the implementation which creative deserves more spend and which should stop. Record their response; do not substitute an automated assertion for this usability check. Conversions include enquiries, so interpret spend decisions with revenue and the stated evidence limitations.
- [ ] Run focused tests followed by final full verification from the proper directories:

```powershell
# backend/spring-boot
.\mvnw.cmd -o test '-Dtest=LinkAttributionQueryServiceTest,LinkAttributionQueryServiceBulkTest,LinkPerformanceControllerTest,AttributionMintTest'
.\mvnw.cmd -o test
```

```powershell
# frontend
npm test
npx vitest run
npx tsc --noEmit
$env:VITE_USE_FIXTURES = 'false'
npm run build
```

`npm test` excludes contract tests; unfiltered Vitest is listed separately because the source requests it. Report any environment-dependent contract failures distinctly. Restore the prior shell fixture setting after build. All new tests must pass. Known failures are acceptable only when matched to the recorded baseline with no new regression.

- [ ] Re-run the cross-document link/terminology review after upstream docs arrive. Record exact commands, results, failing test identities, browser checks and remaining integration gates in the verification record.
- [ ] Inspect `git diff --check`, `git diff --stat`, and working-tree status. Confirm no migration/security/PES/legacy changes and no RUNNING.md edits. Do not commit or push.
- [ ] Report what is implemented, what tests ran, and any still-open dependencies. “Track 5 complete” requires the gates below, not merely green isolated component tests.

## 6. Acceptance traceability and release gates

| Source requirement | Implementation | Proof / completion gate |
|---|---|---|
| Three creative split | Task 2 | Canonical persisted matrix and order assertions |
| Untagged retained and totals correct | Tasks 2, 5 | Null/blank bucket test, row/total UI assertions |
| Out-of-window excluded on both sides | Task 2 | Seeded converted late click contributes nothing |
| Zero revenue still converts | Tasks 2, 5, 9 | ad-B booking and real enquiry checks |
| No per-creative N+1 | Task 2 | Four-read upper bound, mock interaction test |
| JWT and foreign link 404 | Tasks 3, 9 | Filter-enabled MockMvc and second-operator E2E |
| Zero-click row remains visible when supplied | Tasks 4, 5 | Actual fixture row plus render test |
| No clicks renders empty | Task 5 | Empty array and only-zero rows tested |
| Untagged-only diagnostic | Tasks 5, 9 | Component assertion and real untagged journey |
| Counts are a floor | Task 5 | Exact caveat visible in normal and empty states |
| Distinct evidence beside code/lift | Task 6 | Layout tests now; real companion-panel integration before final signoff |
| Optional click match and None | Task 7 | Controlled selection tests; permitted standalone fallback documented |
| clickId produces LINK redemption | Task 7 | Parent/write-path integration when available; callback alone is not persistence proof |
| Module 4 feature boundary/cross-links | Task 8 | README prose and resolved link checks |
| Screens include evidence and public enquiry | Task 8 | Actual route verified after Track 4 lands |
| Four-doc consistency | Task 8 | Missing docs/owner contradictions closed or explicitly filed and reported |
| Real redirect → enquiry → attribution | Task 9 | Non-mocked Playwright run after upstream tracks |
| Operator can interpret the screen | Task 10 | Manual decision feedback recorded |
| Frontend green; backend no worse | Tasks 1, 10 | Fresh baseline comparison, not stale counts |
| No migration; ownership respected | Task 10 | Final diff audit |

## 7. Execution handoff

Implementation order is Tasks 1–7, then documentation and available integration work in Tasks 8–10. Independent seeded work proceeds while missing upstream pieces remain recorded. Recheck dependency availability at each integration boundary; adapt to newly landed files instead of creating duplicates. This plan does not authorize implementing whole missing tracks to make a checklist appear complete.

The planning pass creates only this document. No application code, migrations, tests, or runtime documentation have been changed, and no test outcome is claimed.
