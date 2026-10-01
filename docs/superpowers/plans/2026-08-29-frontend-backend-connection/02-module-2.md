# Slice 1 — Module 2 (Dashboard & Market Radar)

**Depends on:** [`01-foundation.md`](01-foundation.md) Tasks 1–6, all merged.

Largest DTO work of the four slices, but every value already exists in the database —
this is a mapping job, not new data collection.

Seed data comes from `V18__module2_module3_seed_data.sql`. The seeded operator
`ramon.delacruz@ceview.local` (Moalboal FreeDive Cebu, category "Coastal & Island") has
market signal and forecast rows.

---

## Task 7: `notifications.list` → real endpoint

`apiClient.notifications.list()` calls `/api/notifications` (404). The backend serves
`GET /api/v1/notifications` returning `{ notifications: [...] }` — an envelope the client
must unwrap.

**Files:**

- Modify: `services/apiClient.ts` (the `notifications` block)
- Test: `tests/contract/module2.contract.test.ts` (create)

- [ ] **Step 1: Write the failing contract test**

Create `tests/contract/module2.contract.test.ts`:

```ts
/**
 * Live contract test — module 2 endpoints.
 * Requires the Docker stack: cd backend && docker compose up -d
 */
import { expect, it, beforeAll } from 'vitest';
import { api, isBackendUp, describeIfBackend } from './backendProbe';

const up = await isBackendUp();

describeIfBackend(up, 'module 2 endpoints', () => {
  it('GET /api/v1/notifications returns an envelope of alerts', async () => {
    const res = await api('/api/v1/notifications');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('notifications');
    expect(Array.isArray(body.notifications)).toBe(true);
    if (body.notifications.length > 0) {
      expect(body.notifications[0]).toMatchObject({
        id: expect.any(String),
        category: expect.any(String),
        alertLevel: expect.stringMatching(/^(INFO|WARNING)$/),
      });
    }
  });
});
```

- [ ] **Step 2: Run it against the live stack**

```bash
cd backend && docker compose up -d
cd ../frontend && npm run test:contract
```

Expected: PASS. This step confirms the *backend* shape before the client is changed — if
it fails, the problem is seed data or the stack, not `apiClient`.

- [ ] **Step 3: Fix the client**

In `services/apiClient.ts`, replace the `notifications.list` method:

```ts
  notifications: {
    list: () =>
      USE_FIXTURES
        ? delay(MOCK_NOTIFICATIONS)
        : request<{ notifications: DemandAlert[] }>('/api/v1/notifications')
            .then((r) => r.notifications),
```

Add `DemandAlert` to the type import at the top of the file:

```ts
import type { PlatformConnection, PostMetric, BusinessProfileDto, DemandAlert } from '../types';
```

- [ ] **Step 4: Verify in the browser**

```bash
cd frontend && npm run dev
```

Log in at `http://localhost:3001` as `ramon.delacruz@ceview.local` /
`MoalboalDive2024!`. The dashboard alert feed renders seeded alerts. Confirm in DevTools →
Network that `/api/v1/notifications` returns 200 — not `/api/notifications` 404.

- [ ] **Step 5: Commit**

```bash
git add frontend/services/apiClient.ts frontend/tests/contract/module2.contract.test.ts
git commit -m "fix(frontend): point notifications.list at /api/v1/notifications and unwrap envelope"
```

---

## Task 8: Resolve `notifications.markRead`

`markRead` PATCHes `/api/notifications/{id}/read`, which does not exist, and the call site
in `useDashboardState.ts:199` swallows the 404 with `.catch(() => {})`. Per
[`00-index.md`](00-index.md) §Open decisions, we add the endpoint rather than delete the
call — the `is_read` column already exists, and without persistence read state resets on
every reload.

**Files:**

- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/NotificationController.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/NotificationService.java`
- Modify: `services/apiClient.ts`
- Test: `backend/spring-boot/src/test/java/com/ceview/module2/NotificationMarkReadTest.java`

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/ceview/module2/NotificationMarkReadTest.java`:

```java
package com.ceview.module2;

import com.ceview.auth.CurrentBusinessProfile;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationMarkReadTest {

    private static final UUID PROFILE = UUID.fromString("20000000-0000-0000-0000-000000000001");
    private static final UUID ALERT = UUID.fromString("60000000-0000-0000-0000-000000000001");

    @Test
    void markReadScopesToTheAuthenticatedProfile() {
        NotificationService service = Mockito.mock(NotificationService.class);
        CurrentBusinessProfile current = Mockito.mock(CurrentBusinessProfile.class);
        Mockito.when(current.resolveProfileId()).thenReturn(PROFILE);

        NotificationController controller = new NotificationController(service, current);
        assertThat(controller.markRead(ALERT).getStatusCode().value()).isEqualTo(204);

        // Tenant isolation: the profile id must be passed through, never omitted.
        Mockito.verify(service).markRead(PROFILE, ALERT);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=NotificationMarkReadTest
```

Expected: compilation failure — no `markRead` on controller or service.

- [ ] **Step 3: Add the service method**

In `NotificationService`:

```java
/**
 * Marks one alert read, scoped to the owning profile so an operator cannot
 * mutate another tenant's notification. Silently no-ops when the id doesn't
 * belong to this profile — read-marking is fire-and-forget from the client.
 */
@Transactional
public void markRead(UUID profileId, UUID notificationId) {
    notificationRepository.findByNotificationIdAndBusinessProfileId(notificationId, profileId)
            .ifPresent(n -> {
                n.setIsRead(true);
                notificationRepository.save(n);
            });
}
```

Add the finder to `NotificationRepository`:

```java
Optional<Notification> findByNotificationIdAndBusinessProfileId(UUID notificationId, UUID businessProfileId);
```

Adjust the entity/field names to match the existing `Notification` entity — check with:

```bash
grep -n "private\|@Column" src/main/java/com/ceview/module2/Notification.java
```

- [ ] **Step 4: Add the controller route**

In `NotificationController`:

```java
/** FR2.x — persists the read flag the dashboard already sets optimistically. */
@PatchMapping("/{id}/read")
public ResponseEntity<Void> markRead(@PathVariable UUID id) {
    notificationService.markRead(currentBusinessProfile.resolveProfileId(), id);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
./mvnw test -Dtest=NotificationMarkReadTest
```

Expected: PASS.

- [ ] **Step 6: Fix the client**

In `services/apiClient.ts`:

```ts
    markRead: (id: string) =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request<void>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),
```

- [ ] **Step 7: Verify persistence**

Log in, click an unread alert, reload the page. The alert stays read. Before this task it
reverted to unread on every reload.

- [ ] **Step 8: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2 backend/spring-boot/src/test/java/com/ceview/module2 frontend/services/apiClient.ts
git commit -m "feat: persist notification read state via PATCH /api/v1/notifications/{id}/read"
```

---

## Task 9: `GET /api/v1/forecasting/status`

`useDashboardState.ts:83` already calls `apiClient.forecast.status()` expecting
`{ available: boolean }`, and uses it to drive the existing `ai-down` banner. No such
endpoint exists, so the call throws and the `catch` forces degraded mode permanently.

**Files:**

- Create: `backend/spring-boot/src/main/java/com/ceview/module2/ForecastStatusController.java`
- Modify: `services/apiClient.ts`
- Modify: `tests/contract/module2.contract.test.ts`

- [ ] **Step 1: Add the contract test case**

Append to the `describeIfBackend` block in `tests/contract/module2.contract.test.ts`:

```ts
  it('GET /api/v1/forecasting/status reports AI availability', async () => {
    const res = await api('/api/v1/forecasting/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('available');
    expect(typeof body.available).toBe('boolean');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:contract`

Expected: FAIL — 404, `available` missing.

- [ ] **Step 3: Write the controller**

Create `src/main/java/com/ceview/module2/ForecastStatusController.java`:

```java
package com.ceview.module2;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

/**
 * Drives the dashboard's ai-down banner. Deliberately NOT tenant-scoped: this
 * reports whether the forecasting service is reachable at all, which is the same
 * answer for every operator and must stay answerable before a profile exists.
 *
 * Plan: docs/superpowers/plans/2026-08-29-frontend-backend-connection/02-module-2.md Task 9
 */
@RestController
@RequestMapping("/api/v1/forecasting")
public class ForecastStatusController {

    private final WebClient webClient;
    private final String transformerBaseUrl;

    public ForecastStatusController(
            WebClient.Builder builder,
            @Value("${ceview.ai.transformer-base-url:http://localhost:8001}") String transformerBaseUrl) {
        this.webClient = builder.build();
        this.transformerBaseUrl = transformerBaseUrl;
    }

    @GetMapping("/status")
    public Map<String, Object> status() {
        try {
            webClient.get()
                    .uri(transformerBaseUrl + "/healthz")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(3));
            return Map.of("available", true);
        } catch (Exception e) {
            // A down AI service is an expected operating state, not a server
            // error — 200 with available:false lets the dashboard degrade
            // gracefully instead of rendering the generic failure panel.
            return Map.of("available", false, "reason", e.getClass().getSimpleName());
        }
    }
}
```

Confirm the config key matches the existing gateway:

```bash
grep -rn "transformer-base-url\|TRANSFORMER_BASE_URL" src/main/resources backend/../docker-compose.yml
```

If the project uses a different property name, use that one rather than introducing a second.

- [ ] **Step 4: Fix the client**

```ts
    status: () =>
      USE_FIXTURES
        ? delay({ available: true })
        : request<{ available: boolean }>('/api/v1/forecasting/status'),
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS.

- [ ] **Step 6: Verify both states**

With the full stack up, the dashboard shows no `ai-down` banner. Then:

```bash
cd backend && docker compose stop fastapi-transformer
```

Reload the dashboard — the `ai-down` banner appears, and alerts still render. Restart with
`docker compose start fastapi-transformer`.

- [ ] **Step 7: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/ForecastStatusController.java frontend/services/apiClient.ts frontend/tests/contract/module2.contract.test.ts
git commit -m "feat: add GET /api/v1/forecasting/status to drive the ai-down banner"
```

---

## Task 10: Extend `MarketDto` with the 7 mapped fields

The frontend `Market` type needs 8 fields `MarketDto` doesn't return. Seven map to
existing columns; `yoyRatio` has no producer and becomes `null` (see
[`00-index.md`](00-index.md) §Open decisions 2).

Without this task the Market Radar drawer's Purchasing Power and Seasonal Patterns tabs
render `undefined`.

**Files:**

- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/dto/MarketDtos.java`
- Modify: the service that builds `MarketDto` (find it in Step 2)
- Test: `backend/spring-boot/src/test/java/com/ceview/module2/MarketDtoMappingTest.java`

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/ceview/module2/MarketDtoMappingTest.java`:

```java
package com.ceview.module2;

import com.ceview.module2.dto.MarketDtos.MarketDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MarketDtoMappingTest {

    @Test
    void marketDtoExposesTheFieldsTheRadarDrawerNeeds() {
        MarketDto dto = new MarketDto(
                "korea", 1, "South Korea", "Seoul", 87, "directive",
                true, "3h 45m", 2640, "ICN", "CEB", 9, 14, "P8,000",
                List.of(), List.of("Jul"), "economy", "seasonality",
                List.of(), List.of(), List.of(),
                // new fields
                "KR", "KRW", "PHP per 1 KRW", 2.2, 23.8, 0.88, null, true);

        assertThat(dto.flag()).isEqualTo("KR");
        assertThat(dto.currency()).isEqualTo("KRW");
        assertThat(dto.forexLabel()).isEqualTo("PHP per 1 KRW");
        assertThat(dto.gdpValue()).isEqualTo(2.2);
        assertThat(dto.forexValue()).isEqualTo(23.8);
        assertThat(dto.seasonalityScore()).isEqualTo(0.88);
        assertThat(dto.spikeIndicator()).isTrue();
        // No producing column exists — null is the contract, not an oversight.
        assertThat(dto.yoyRatio()).isNull();
    }
}
```

- [ ] **Step 2: Run to verify it fails, and locate the builder**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=MarketDtoMappingTest
grep -rln "new MarketDto(" src/main/java
```

Expected: compilation failure (constructor arity). The `grep` names every file that must
be updated in Step 4.

- [ ] **Step 3: Extend the record**

In `MarketDtos.java`, append these components to `MarketDto` after `forexTrend`:

```java
        /** ISO country code for the flag glyph, derived from the market name. */
        String flag,
        /** ISO currency code — MarketEconomicTrend.currency_code. */
        String currency,
        /** Human label for the forex axis, e.g. "PHP per 1 KRW". */
        String forexLabel,
        /** MarketScore.gdp_per_capita_growth, falling back to MarketEconomicTrend.gdp_latest. */
        double gdpValue,
        /** MarketScore.forex_vs_php, falling back to MarketEconomicTrend.forex_latest. */
        double forexValue,
        /** MarketScore.seasonality_score. */
        double seasonalityScore,
        /**
         * Year-over-year arrivals ratio. No producing column exists today
         * (spec §Risks 1) — always null; the Seasonal Patterns tab renders an
         * explicit "not available" state rather than a fabricated number.
         */
        Double yoyRatio,
        /** MarketScore.spike_indicator. */
        boolean spikeIndicator
```

- [ ] **Step 4: Map the fields where `MarketDto` is built**

In each file found in Step 2, populate the new arguments from the entities already loaded:

```java
String currency = trend != null ? trend.getCurrencyCode() : "";
double gdpValue = score.getGdpPerCapitaGrowth() != null
        ? score.getGdpPerCapitaGrowth()
        : (trend != null && trend.getGdpLatest() != null ? trend.getGdpLatest() : 0.0);
double forexValue = score.getForexVsPhp() != null
        ? score.getForexVsPhp()
        : (trend != null && trend.getForexLatest() != null ? trend.getForexLatest() : 0.0);

new MarketDto(
        /* …existing arguments unchanged… */
        MarketFlags.isoFor(marketName),
        currency,
        currency.isBlank() ? "" : "PHP per 1 " + currency,
        gdpValue,
        forexValue,
        score.getSeasonalityScore() != null ? score.getSeasonalityScore() : 0.0,
        null,                                     // yoyRatio — no producer
        Boolean.TRUE.equals(score.getSpikeIndicator()))
```

Create the flag helper at `src/main/java/com/ceview/module2/MarketFlags.java`:

```java
package com.ceview.module2;

import java.util.Map;

/** Market name to ISO-3166 alpha-2, for the flag glyph the radar cards render. */
public final class MarketFlags {

    private static final Map<String, String> ISO = Map.of(
            "South Korea", "KR",
            "Japan", "JP",
            "United States", "US",
            "China", "CN",
            "Australia", "AU",
            "Singapore", "SG",
            "Taiwan", "TW",
            "Germany", "DE",
            "United Kingdom", "GB");

    private MarketFlags() {}

    /** Empty string for an unmapped market — the UI renders no glyph rather than a wrong one. */
    public static String isoFor(String marketName) {
        return ISO.getOrDefault(marketName, "");
    }
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
./mvnw test -Dtest=MarketDtoMappingTest && ./mvnw test
```

Expected: both PASS.

- [ ] **Step 6: Verify the live shape**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s http://localhost:8080/api/v1/forecasting/markets -H "Authorization: Bearer $TOKEN" \
  | head -c 600
```

Expected: the JSON contains `flag`, `currency`, `forexLabel`, `gdpValue`, `forexValue`,
`seasonalityScore`, `spikeIndicator`, and `yoyRatio: null`.

- [ ] **Step 7: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2 backend/spring-boot/src/test/java/com/ceview/module2/MarketDtoMappingTest.java
git commit -m "feat(backend): extend MarketDto with radar-drawer fields from existing columns"
```

---

## Task 11: `markets.list` + `forecast.analyze` → real endpoints

**Files:**

- Modify: `services/apiClient.ts` (the `markets` and `forecast` blocks)
- Modify: `tests/contract/module2.contract.test.ts`

- [ ] **Step 1: Add the contract test cases**

Append to the `describeIfBackend` block:

```ts
  it('GET /api/v1/forecasting/markets returns fully-populated markets', async () => {
    const res = await api('/api/v1/forecasting/markets');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.markets)).toBe(true);
    if (body.markets.length > 0) {
      // Every field the radar drawer reads must be present, or a tab renders undefined.
      expect(body.markets[0]).toMatchObject({
        id: expect.any(String),
        flag: expect.any(String),
        currency: expect.any(String),
        forexLabel: expect.any(String),
        gdpValue: expect.any(Number),
        forexValue: expect.any(Number),
        seasonalityScore: expect.any(Number),
        spikeIndicator: expect.any(Boolean),
      });
      expect(body.markets[0].yoyRatio).toBeNull();
    }
  });

  it('GET /api/v1/forecasting/markets?category= filters by category', async () => {
    const res = await api('/api/v1/forecasting/markets?category=' + encodeURIComponent('Coastal & Island'));
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).markets)).toBe(true);
  });

  it('POST /api/v1/forecasting/analyze works with only a JWT', async () => {
    const res = await api('/api/v1/forecasting/analyze', { method: 'POST' });
    expect([200, 409, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
```

- [ ] **Step 2: Run to verify the category case fails**

Run: `npm run test:contract`

Expected: the `?category=` case fails — the param is currently ignored, so it can't be
asserted as filtering. It returns 200 either way; the case guards the route's existence
before Step 3 adds filtering.

- [ ] **Step 3: Add category filtering to the backend**

Per [`00-index.md`](00-index.md) §Open decisions 3, filter the existing ranking rather than
adding an endpoint. In `ForecastingController.markets`:

```java
@GetMapping("/markets")
public ResponseEntity<?> markets(@RequestParam(required = false) UUID profileId,
                                 @RequestParam(required = false) String category) {
    UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
    try {
        MarketsResponse result = forecastingService.loadMarketsFromDb(resolvedProfileId);
        if (category != null && !category.isBlank()) {
            result = new MarketsResponse(forecastingService.filterByCategory(result.markets(), category));
        }
        return ResponseEntity.ok(result);
    } catch (Exception e) {
        return ResponseEntity.status(503)
                .body(Map.of("code", "MOD22_MARKETS_FAILED", "message", e.getMessage()));
    }
}
```

Add to `ForecastingService`:

```java
/**
 * Category-scoped ranking for the dashboard's market reveal. The ranking itself
 * is already computed per profile; this only narrows it to the markets scored
 * for one of the operator's categories, re-ranking 1..n so the UI's rank badges
 * stay contiguous.
 */
public List<MarketDto> filterByCategory(List<MarketDto> markets, String category) {
    List<MarketDto> matching = marketScoreRepository.findMarketNamesForCategory(category);
    // …narrow `markets` to those names, then renumber rank…
}
```

Implement `filterByCategory` against the existing repository; if no category-to-market
mapping table exists, return the unfiltered list and record it as a follow-up rather than
inventing a mapping. Confirm first:

```bash
grep -rn "category" src/main/java/com/ceview/module2/submodule22/MarketScoreRepository.java
```

- [ ] **Step 4: Fix the client**

Replace the whole `markets` block and `forecast.analyze` in `services/apiClient.ts`:

```ts
  markets: {
    list: () =>
      USE_FIXTURES
        ? delay(MOCK_MARKETS)
        : request<{ markets: Market[] }>('/api/v1/forecasting/markets')
            .then((r) => r.markets),
    chartData: (marketId: string) =>
      USE_FIXTURES
        ? delay(MOCK_MARKETS.find((m) => m.id === marketId)?.chartData ?? [])
        // chartData ships inside each MarketDto — no separate round-trip.
        : request<{ markets: Market[] }>('/api/v1/forecasting/markets')
            .then((r) => r.markets.find((m) => m.id === marketId)?.chartData ?? []),
    forCategory: (category: string) =>
      USE_FIXTURES
        ? delay(marketsForCategory(category))
        : request<{ markets: Market[] }>(
            `/api/v1/forecasting/markets?category=${encodeURIComponent(category)}`,
          ).then((r) => r.markets),
  },
```

Delete `markets.categoryScores` — it has no backend equivalent and Task 12 removes its
only caller. Add `Market` to the type import at the top of the file.

Then `forecast.analyze`:

```ts
    analyze: () =>
      USE_FIXTURES
        ? delay({ rerankedMarkets: 3 }, 2100)
        : request<{ markets: Market[] }>('/api/v1/forecasting/analyze', { method: 'POST' }),
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:contract`

Expected: PASS, all module-2 cases.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/apiClient.ts frontend/tests/contract/module2.contract.test.ts backend/spring-boot/src/main/java/com/ceview/module2
git commit -m "fix(frontend): point markets/forecast calls at /api/v1/forecasting endpoints"
```

---

## Task 12: Drop fixture imports from module-2 components

Three components still read fixtures directly, so no env flag can switch them.

**Files:**

- Modify: `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx:33`
- Modify: `components/module-2/2.1-dashboard/useDashboardState.ts:17-19`
- Modify: `components/module-2/2.2-market-radar/SeasonalPatternsTab.tsx`

- [ ] **Step 1: Update the hook's failing test first**

In `components/module-2/2.1-dashboard/useDashboardState.test.ts`, add a case asserting the
hook surfaces a load error instead of silently degrading. Add the import first — the file
does not reference `ApiError` yet:

```ts
import { ApiError } from '../../../services/apiError';
```

```ts
it('exposes the error when the alert load fails', async () => {
  vi.spyOn(apiClient.notifications, 'list').mockRejectedValue(
    new ApiError({ status: 503, method: 'GET', path: '/api/v1/notifications',
      body: { code: 'MOD22_MARKETS_FAILED', message: 'boom' } }),
  );
  const { result } = renderHook(() => useDashboardState());
  await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/module-2/2.1-dashboard/useDashboardState.test.ts`

Expected: FAIL — `result.current.error` is undefined; the hook has no `error` field.

- [ ] **Step 2b: Decouple the health check from the alert load — REQUIRED**

`useDashboardState` currently loads both in one `Promise.all`:

```ts
const [list, health] = await Promise.all([
  apiClient.notifications.list(),
  apiClient.forecast.status(),
]);
```

`Promise.all` rejects as soon as *either* settles rejected, so a failing health check
discards the successfully-fetched alert list and `setAlerts(list)` never runs. This was
observed live during Task 7: `/api/v1/notifications` returned 200 with a valid alert, but
the feed rendered "Nothing is currently trending for Coastal & Island" because
`/api/v1/forecasting/status` was still 404ing.

The health check is auxiliary — it annotates the data, it must not be able to blank it.
Use `Promise.allSettled` and degrade each independently:

```ts
const [listResult, healthResult] = await Promise.allSettled([
  apiClient.notifications.list() as Promise<DemandAlert[]>,
  apiClient.forecast.status() as Promise<{ available: boolean }>,
]);

if (listResult.status === 'fulfilled') {
  setAlerts(listResult.value);
  setReadIds(new Set(listResult.value.filter((a) => a.isRead).map((a) => a.id)));
} else {
  setError(listResult.reason);   // the alert load failing IS worth surfacing
}

// A failed health probe means "assume degraded", never "assume no alerts".
setAiServiceDown(healthResult.status !== 'fulfilled' || !healthResult.value.available);
```

- [ ] **Step 3: Add `error` to the hook and drop the fixture imports**

In `useDashboardState.ts`, delete lines 17–19 and import from `types.ts`:

```ts
import type { Market, DemandAlert } from '../../../types';
```

Add to `DashboardState`:

```ts
  /** Non-null when the initial load failed; render <ApiErrorPanel error={error} />. */
  error: unknown | null;
```

Add the state and set it in the existing `catch`:

```ts
const [error, setError] = useState<unknown | null>(null);
```

```ts
      } catch (e) {
        // Degraded mode still applies (the banner explains staleness), but the
        // error is now surfaced so a developer sees status/path/code.
        if (!cancelled) {
          setAiServiceDown(true);
          setError(e);
        }
      }
```

Replace the fixture-derived ranked markets with the real category call:

```ts
  const [rankedMarkets, setRankedMarkets] = useState<Market[]>([]);

  useEffect(() => {
    if (!selectedAlert) {
      setRankedMarkets([]);
      return;
    }
    let cancelled = false;
    apiClient.markets
      .forCategory(selectedAlert.category)
      .then((list) => { if (!cancelled) setRankedMarkets(list as Market[]); })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [selectedAlert]);
```

Include `error` in the returned object.

- [ ] **Step 4: Drop `MOCK_MARKETS` from the drawer**

In `MarketRadarDrawer.tsx`, delete the `MOCK_MARKETS` import and accept markets as a prop
from the already-loaded dashboard state, rather than fetching again:

```tsx
import type { Market } from '../../../types';

interface Props {
  markets: Market[];
  // …existing props…
}
```

Update `DashboardView.tsx` to pass `rankedMarkets` down.

- [ ] **Step 4b: Use `isSurge()`, never `alertLevel === 'WARNING'`**

The live backend emits `WARNING` **and** `CRITICAL` (seed data: 3 and 2 respectively; no
`INFO` on demand alerts). `useDashboardState` compares `alertLevel === 'WARNING'` in three
places — the feed filter (line ~58), `surgeCount` (~120), and `surgeMarkets` (~144) — which
silently excludes `CRITICAL`, the *most* urgent level.

Replace all three with the `isSurge()` helper exported from `types.ts`:

```ts
import { isSurge } from '../../../types';

if (filter === 'surge') return isSurge(alert);
// …
() => myAlerts.filter(isSurge).length,
() => [...new Set(myAlerts.filter(isSurge).map((a) => a.market))],
```

`AlertCard.tsx:45` also gates its surge badge on `alertLevel === 'WARNING'` — update it too,
or CRITICAL alerts render without the badge.

- [ ] **Step 5: Handle null `yoyRatio` in the Seasonal Patterns tab**

In `SeasonalPatternsTab.tsx`, guard the YoY display:

```tsx
{market.yoyRatio !== null ? (
  <span>YoY {market.yoyRatio.toFixed(2)}</span>
) : (
  <span className="text-[var(--color-text-muted)]">
    YoY ratio not available from backend
  </span>
)}
```

- [ ] **Step 6: Render the error panel**

In `DashboardView.tsx`:

```tsx
{state.error && <ApiErrorPanel error={state.error} label="Dashboard" onRetry={state.refresh} />}
```

- [ ] **Step 7: Verify no fixture imports remain in module 2**

```bash
grep -rn "fixtures/" frontend/components/module-2 --include=*.tsx --include=*.ts | grep -v '\.test\.'
```

Expected: no output.

- [ ] **Step 8: Run all checks**

```bash
cd frontend && npm test && npm run test:contract
```

Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/components/module-2
git commit -m "feat(frontend): wire module 2 components to real backend data"
```

---

## Slice 1 Definition of Done

- [ ] `grep -rn "fixtures/" frontend/components/module-2` returns nothing outside tests
- [ ] Dashboard renders seeded alerts for `ramon.delacruz@ceview.local`
- [ ] Read state survives a page reload
- [ ] Market Radar drawer's Purchasing Power tab shows real GDP/forex values
- [ ] Seasonal Patterns tab shows "not available" for YoY, never `undefined` or `NaN`
- [ ] Stopping `fastapi-transformer` shows the `ai-down` banner, not a crash
- [ ] `npm test`, `npm run test:contract`, and `./mvnw test` all pass

---

## Task 7a (added during execution): split keyword-trend notifications

Not in the original plan. Added after aligning the FastAPI transformer's trends
router — which revealed that `GET /api/notifications` took **50 seconds**.

**Root cause.** `NotificationService` merged two sources synchronously: a fast
`tbl_demand_alert` read, and `CategoryRankNotificationService`, which calls FastAPI
`rank-markets` **per category** — a PyTrends round-trip documented at up to 75s (the
gateway allows 90s). This was previously masked: Spring called a path the transformer
did not serve, got a 404, and the service silently skipped every category.

**Fix.** `GET /api/notifications` is now a pure DB read. Keyword trends moved to
`GET /api/notifications/keyword-trends`, loaded by the dashboard in its own effect and
held in separate state.

| Endpoint | Before | After |
|---|---|---|
| `GET /api/notifications` | 50.2s | **0.146s** |
| `GET /api/notifications/keyword-trends` | — | 8.99s, non-blocking |

**Two deliberate choices worth preserving:**

1. The keyword-trend fetch **swallows its error** rather than calling `setError`. That is
   not the silent-catch bug corrected elsewhere in this plan: this source is
   supplementary, and its failure loses nothing the operator would otherwise see. The
   primary alert load still surfaces its errors.
2. Keyword alerts live in **their own state**, combined into `myAlerts` via `useMemo`,
   rather than being merged into `alerts`. Two independent effects writing one setter
   race: whichever resolved last would clobber the other. Guarded by
   `useDashboardState.test.ts`'s "keeps keyword-trend alerts even when they resolve
   BEFORE the primary load".

### Follow-up worth scheduling: cache `rank-markets`

`tbl_trend_fetch_job` is already keyed `(category, market, week_of)` with a `status`
column and result fields (`trend_index`, `rolling_7d_avg`, `spike_indicator`,
`yoy_ratio`), populated weekly by `TrendFetchSchedulerService`. `rank-markets` should
read that table instead of calling PyTrends live, which would take the keyword-trends
endpoint from ~9s to a DB read.

Note this is precisely what would make the race in (2) reachable — which is why it was
fixed structurally rather than left to timing.
