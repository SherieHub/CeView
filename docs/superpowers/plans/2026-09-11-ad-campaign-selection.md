# Ad Campaign Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ COMMITS ARE THE USER'S TO RUN.** `.claude/CLAUDE.md` forbids Claude from running `git commit` or `git push` in this repository under any circumstances. Every "Commit" step below shows the exact command **for the user to run**. An agent executing this plan stops at each commit step, states the task is complete and verified, and hands the command back.

**Goal:** Let an operator choose one Meta or TikTok **campaign** — instead of the whole ad account — as the source for the Performance screen's synced metrics, set from a picker in Settings → Platforms.

**Architecture:** The choice is stored on `AdPlatformConnection` (`external_campaign_id` / `external_campaign_name`, both nullable — null = whole account, today's behaviour). `AdPlatformClient` gains `listCampaigns(...)` and an optional `externalCampaignId` on `fetchInsights(...)` (added as a `default` overload so existing call sites are untouched). Two new endpoints mirror the existing account pair. The frontend adds an `AdCampaignPickerModal` and a "Reporting on" line on each active connection row.

**Tech Stack:** Spring Boot 3.3 / Java 17, JPA + Flyway + PostgreSQL (tests: H2, schema from entities, Flyway off), WebClient, JUnit 5 + MockMvc + Mockito + `okhttp3 mockwebserver` (already a test dependency), React 19 + TypeScript + Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-09-11-ad-campaign-selection-design.md`](../specs/2026-09-11-ad-campaign-selection-design.md)

---

## Conventions to follow

Read these before starting — the plan assumes them:

- **Entities** use Lombok `@Data` with `@PrePersist` assigning the UUID PK. Tests build the schema from the JPA entities (`spring.jpa.hibernate.ddl-auto=create-drop`, Flyway off — `src/test/resources/application.properties`), so a new `@Column` is exercised automatically and the Flyway SQL is **not** — it must be reviewed by eye against the entity.
- **The `db/h2` mirror set is hand-maintained and nine versions behind `db/migration`.** It is used only by the `h2` runtime profile. A `db/migration/VN` file has a `db/h2/VM` counterpart with a lower number (see the header comment in `db/h2/V18__ad_platform_connections.sql`).
- **Controller tests** mint a real JWT via `@Autowired JwtService` and send `Authorization: Bearer <token>`; there is no `@WithMockUser`. Copy the setup in `AdConnectionFlowTest`.
- **Tenant scoping** is always `currentBusinessProfile.resolveProfileId()`, never a client-supplied id.
- **Ad-platform client tests** use `MockWebServer`; the client is constructed with `server.url("/v21.0").toString()` as its base URL. Copy `MetaAdsClientInsightsTest` / `MetaAdsClientAccountsTest`. Response fixtures live in `src/test/resources/adplatform/`.
- **Backend test suite:** from `backend/spring-boot`, `./mvnw test`. Single class: `./mvnw test -Dtest=ClassName`. If an unrelated stale-compile error appears (`cannot find symbol JwtService` etc.), run `./mvnw clean test-compile` once, then retry.
- **Ignore IDE "cannot find symbol" diagnostics on Lombok accessors** — the IDE's annotation processor is broken in this repo; Maven is authoritative.
- **Frontend tests:** from `frontend`, `npm test -- --run <path>`. Type check: `npx tsc --noEmit`. Build: `npm run build`.
- **e2e:** from `e2e`, `npx playwright test tests/<file>`. They skip when the backend is not running.

---

## File structure

### Backend — modified

| File | Change |
|---|---|
| `module4/adconnections/AdConnectionDtos.java` | New `AdCampaignOption` record; `campaignName` added to `AdConnectionView` and `InsightSource` |
| `module4/adconnections/AdPlatformConnection.java` | `externalCampaignId` + `externalCampaignName` columns |
| `module4/adconnections/AdInsight.java` | `externalCampaignId` column (traceability) |
| `module4/adconnections/client/AdPlatformClient.java` | `listCampaigns(...)`; 5-arg `fetchInsights(...)`; 4-arg kept as a `default` overload |
| `module4/adconnections/client/MetaAdsClient.java` | `listCampaigns`; `fetchInsights` campaign filter |
| `module4/adconnections/client/TikTokAdsClient.java` | `listCampaigns`; `fetchInsights` campaign scoping |
| `module4/adconnections/AdConnectionService.java` | `selectCampaign(...)`; clear campaign fields in `storeGrant` and `selectAccount` |
| `module4/adconnections/AdConnectionController.java` | `GET /{provider}/campaigns`; `POST /{provider}/campaign`; `toView` passes `campaignName` |
| `module4/adconnections/AdInsightSyncService.java` | pass `conn.getExternalCampaignId()` to `fetchInsights`; populate `InsightSource.campaignName`; write `AdInsight.externalCampaignId` |
| `db/migration/V28__module4_ad_campaign_selection.sql` | **created** — the two connection columns + the insight column |
| `db/h2/V19__ad_campaign_selection.sql` | **created** — H2 mirror |

### Backend — test files touched

`AdInsightSyncServiceTest` (mock arity), `AdConnectionFlowTest` (new endpoint cases), plus new `MetaAdsClientCampaignsTest`, `TikTokAdsClientCampaignsTest`, and new insight-filter cases in `MetaAdsClientInsightsTest` / `TikTokAdsClientInsightsTest`. New fixtures `adplatform/meta-campaigns.json`, `adplatform/tiktok-campaigns.json`.

### Frontend — modified

| File | Change |
|---|---|
| `types.ts` | `AdCampaignOption`; `AdConnection.campaignName`; `AdInsightSource.campaignName?` |
| `services/apiClient.ts` | `adConnections.campaigns(...)`, `adConnections.selectCampaign(...)` |
| `services/fixtures/adConnections.ts` | `MOCK_AD_CAMPAIGNS`; `campaignName` on the Meta connection + insight source |
| `services/useAdConnections.ts` | expose `selectCampaign` (thin wrapper + `refresh`) |
| `components/settings/AdCampaignPickerModal.tsx` | **created** |
| `components/settings/AdAccountsSection.tsx` | "Reporting on" line + "Change" button on active rows |
| `components/settings/PlatformsSettings.tsx` | mount the campaign picker |
| `components/module-4/4.1-campaign-analytics/IngestionForm.tsx` | sync note names the campaign |
| `e2e/tests/settings-platforms.spec.ts` | fixture-mode coverage of the "Reporting on" row + picker |

### Frontend — test files touched

`components/settings/AdAccountPickerModal.test.tsx` sibling → new `AdCampaignPickerModal.test.tsx`; `AdAccountsSection.test.tsx` (new "Reporting on" cases); `IngestionForm.adSync.test.tsx` (campaign-name note); `useAdConnections.test.tsx` and any literal constructing an `AdConnection` (add `campaignName: null`).

---

# BACKEND

## Task 1: Migration + entity columns

**Files:**
- Create: `backend/spring-boot/src/main/resources/db/migration/V28__module4_ad_campaign_selection.sql`
- Create: `backend/spring-boot/src/main/resources/db/h2/V19__ad_campaign_selection.sql`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdPlatformConnection.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsight.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionPersistenceTest.java`

- [ ] **Step 1: Write the failing test**

Append to `AdConnectionPersistenceTest` (it already `@Autowired`s `AdPlatformConnectionRepository connectionRepo` and a `profileId`; match its existing `@BeforeEach` field names — if the class stores the id differently, adapt the first line):

```java
    @Test
    void persistsAndReadsBackTheSelectedCampaign() {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider("meta");
        conn.setAccessTokenEncrypted("enc");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        conn.setExternalAccountId("act_1");
        conn.setExternalCampaignId("cmp_123");
        conn.setExternalCampaignName("Dry-Season Promo");
        connectionRepo.saveAndFlush(conn);

        AdPlatformConnection reloaded = connectionRepo.findById(conn.getConnectionId()).orElseThrow();
        assertEquals("cmp_123", reloaded.getExternalCampaignId());
        assertEquals("Dry-Season Promo", reloaded.getExternalCampaignName());
    }
```

If `AdConnectionPersistenceTest` does not already expose a `profileId` field, add the standard setup from `AdConnectionFlowTest.setUp()` (create a `BusinessProfile`, save it, keep `profileId`).

- [ ] **Step 2: Run it, expect failure**

Run: `./mvnw test -Dtest=AdConnectionPersistenceTest`
Expected: FAIL — `cannot find symbol: method setExternalCampaignId`.

- [ ] **Step 3: Add the entity columns**

In `AdPlatformConnection.java`, after the `currency` field:

```java
    /** Null = report on the whole account (default). Non-null = one campaign only. */
    @Column(name = "external_campaign_id",   length = 128) private String externalCampaignId;
    @Column(name = "external_campaign_name", length = 255) private String externalCampaignName;
```

In `AdInsight.java`, after the `externalAccountId` field:

```java
    /** The campaign this cached row was scoped to, or null for a whole-account row. */
    @Column(name = "external_campaign_id", length = 128) private String externalCampaignId;
```

- [ ] **Step 4: Run it, expect pass**

Run: `./mvnw test -Dtest=AdConnectionPersistenceTest`
Expected: PASS (H2 builds the columns from the entity).

- [ ] **Step 5: Write the Postgres migration**

`db/migration/V28__module4_ad_campaign_selection.sql`:

```sql
-- ============================================================================
-- V28 — Module 4: report on one ad campaign instead of the whole account
--
-- WHY
--   An operator often runs several unrelated campaigns on one ad account. The
--   account total (V27's level=account fetch) mixes them into a single PES
--   score. These columns let the operator pin the sync to one campaign.
--
-- NULL is the unchanged default: no campaign chosen = whole account, exactly
-- as V27 shipped.
-- ============================================================================

ALTER TABLE tbl_ad_platform_connection
    ADD COLUMN IF NOT EXISTS external_campaign_id   TEXT,
    ADD COLUMN IF NOT EXISTS external_campaign_name TEXT;

COMMENT ON COLUMN tbl_ad_platform_connection.external_campaign_id IS
    'Platform campaign id to scope the sync to. NULL = whole account.';

ALTER TABLE tbl_ad_insight
    ADD COLUMN IF NOT EXISTS external_campaign_id TEXT;

COMMENT ON COLUMN tbl_ad_insight.external_campaign_id IS
    'Campaign this cached row was scoped to, or NULL for a whole-account row.';
```

- [ ] **Step 6: Write the H2 mirror**

`db/h2/V19__ad_campaign_selection.sql`:

```sql
-- H2 mirror of db/migration/V28__module4_ad_campaign_selection.sql
--
-- Numbered V19 because the h2 set's highest existing version is V18. Used only
-- by the `h2` runtime profile; tests build their schema from the JPA entities.

ALTER TABLE tbl_ad_platform_connection ADD COLUMN IF NOT EXISTS external_campaign_id   VARCHAR(128);
ALTER TABLE tbl_ad_platform_connection ADD COLUMN IF NOT EXISTS external_campaign_name VARCHAR(255);

ALTER TABLE tbl_ad_insight ADD COLUMN IF NOT EXISTS external_campaign_id VARCHAR(128);
```

- [ ] **Step 7: Commit**

```bash
git add backend/spring-boot/src/main/resources/db/migration/V28__module4_ad_campaign_selection.sql \
        backend/spring-boot/src/main/resources/db/h2/V19__ad_campaign_selection.sql \
        backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdPlatformConnection.java \
        backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsight.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionPersistenceTest.java
git commit -m "feat(module-4): add ad-campaign-selection columns (V28)"
```

---

## Task 2: DTOs + client interface

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionDtos.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/AdPlatformClient.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java` (signature only)
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java` (signature only)
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java` (`toView` arity)
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsightSyncService.java` (`InsightSource` arity + call the 5-arg)
- Modify: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightSyncServiceTest.java` (mock arity)

This task is a compile-only change — no behaviour yet. It exists so every later task builds on a green tree.

- [ ] **Step 1: Add `AdCampaignOption` and the `campaignName` fields**

In `AdConnectionDtos.java`, after `AdAccountOption`:

```java
    /** One selectable campaign, from GET /{provider}/campaigns. */
    public record AdCampaignOption(String id, String name, String status) {}
```

Add `String campaignName` as the **last** component of `AdConnectionView` and of `InsightSource`:

```java
    public record AdConnectionView(
            String provider,
            boolean configured,
            String status,
            String accountName,
            String currency,
            OffsetDateTime connectedAt,
            OffsetDateTime lastSyncedAt,
            String campaignName          // NEW — null = whole account
    ) {}
```

```java
    public record InsightSource(
            String provider,
            String accountName,
            long impressions,
            long clicks,
            BigDecimal spend,
            long conversions,
            String currency,
            String campaignName          // NEW — null = whole account
    ) {}
```

- [ ] **Step 2: Extend `AdPlatformClient`**

Replace the `fetchInsights` declaration in `AdPlatformClient.java` with:

```java
    /** The campaigns on one ad account. */
    List<AdCampaignOption> listCampaigns(String accessToken, String externalAccountId);

    /** Account-level metrics for one closed reporting period, inclusive of both dates. */
    default AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                        LocalDate periodStart, LocalDate periodEnd) {
        return fetchInsights(accessToken, externalAccountId, null, periodStart, periodEnd);
    }

    /**
     * As above, but scoped to a single campaign when {@code externalCampaignId}
     * is non-null.
     */
    AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                String externalCampaignId,
                                LocalDate periodStart, LocalDate periodEnd);
```

Add the import `import com.ceview.module4.adconnections.AdConnectionDtos.AdCampaignOption;`.

- [ ] **Step 3: Update the two client signatures (bodies unchanged for now)**

In `MetaAdsClient.java`, change the `fetchInsights` signature to the 5-arg form and add a stub `listCampaigns`:

```java
    @Override
    public AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                       String externalCampaignId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        // (existing body unchanged — externalCampaignId is wired in Task 4)
```

```java
    @Override
    public List<AdCampaignOption> listCampaigns(String accessToken, String externalAccountId) {
        throw new UnsupportedOperationException("implemented in Task 3");
    }
```

Do the exact same in `TikTokAdsClient.java` (rename its second param stays `advertiserId`; add `String externalCampaignId` in the same position; stub `listCampaigns` — implemented in Task 5). Add the `AdCampaignOption` import to both.

- [ ] **Step 4: Fix the two internal callers**

`AdConnectionController.toView(...)` — both `new AdConnectionView(...)` calls get a trailing argument:

```java
        if (conn == null) {
            return new AdConnectionView(provider.key(), configured,
                    AdConnectionDtos.STATUS_DISCONNECTED, null, null, null, null, null);
        }
        return new AdConnectionView(
                provider.key(), configured, conn.getStatus(),
                conn.getExternalAccountName(), conn.getCurrency(),
                conn.getConnectedAt(), conn.getLastSyncedAt(),
                conn.getExternalCampaignName());
```

`AdInsightSyncService.sync(...)` — the `new InsightSource(...)` call gets a trailing `conn.getExternalCampaignName()`, and the `client.fetchInsights(...)` call becomes the 5-arg form with `conn.getExternalCampaignId()`:

```java
                AdInsightData data = client.fetchInsights(
                        connectionService.accessTokenOf(conn),
                        conn.getExternalAccountId(),
                        conn.getExternalCampaignId(),
                        periodStart, periodEnd);
```

```java
                sources.add(new InsightSource(provider.key(), conn.getExternalAccountName(),
                        data.impressions(), data.clicks(), data.spend(), data.conversions(),
                        conn.getCurrency(), conn.getExternalCampaignName()));
```

- [ ] **Step 5: Fix the sync-service test mock arity**

In `AdInsightSyncServiceTest.java`, replace every occurrence of
`fetchInsights(anyString(), any(), any(), any())` with
`fetchInsights(anyString(), any(), any(), any(), any())` (17 lines — `Edit` with `replace_all`).

- [ ] **Step 6: Compile + run the ad-connection tests**

Run: `./mvnw test -Dtest='Ad*,MetaAds*,TikTokAds*'`
Expected: PASS — no behaviour changed. The MockWebServer insight tests still call the 4-arg `fetchInsights`, which now delegates through the `default` method.

- [ ] **Step 7: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/
git add backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightSyncServiceTest.java
git commit -m "feat(module-4): ad-campaign DTOs and client interface"
```

---

## Task 3: `MetaAdsClient.listCampaigns`

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java`
- Create: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientCampaignsTest.java`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-campaigns.json`

- [ ] **Step 1: Write the fixture**

`src/test/resources/adplatform/meta-campaigns.json`:

```json
{
  "data": [
    { "id": "23851234567890123", "name": "Dry-Season Promo", "status": "ACTIVE" },
    { "id": "23851234567890124", "name": "Always-On Brand", "status": "PAUSED" }
  ],
  "paging": { "cursors": { "before": "A", "after": "B" } }
}
```

- [ ] **Step 2: Write the failing test**

`MetaAdsClientCampaignsTest.java` (copy the `MockWebServer` setup from `MetaAdsClientAccountsTest` verbatim — same `fixture(...)`, `json(...)`, `@BeforeEach`, `@AfterEach`):

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdCampaignOption;
import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientCampaignsTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientCampaignsTest.class.getResourceAsStream("/adplatform/" + name)) {
            assertNotNull(in, "missing test fixture: " + name);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private MockResponse json(String body) {
        return new MockResponse().setResponseCode(200)
                .setHeader("Content-Type", "application/json").setBody(body);
    }

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        AdProviderProperties props = new AdProviderProperties();
        props.getMeta().setAppId("APP123");
        props.getMeta().setAppSecret("SECRET456");
        props.setRedirectBaseUrl("https://tunnel.example.com");
        String base = server.url("/v21.0").toString();
        client = new MetaAdsClient(props, base, base + "/dialog/oauth");
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void parsesIdNameAndStatus() throws Exception {
        server.enqueue(json(fixture("meta-campaigns.json")));

        List<AdCampaignOption> campaigns = client.listCampaigns("TOKEN", "act_111");

        assertEquals(2, campaigns.size());
        assertEquals("23851234567890123", campaigns.get(0).id());
        assertEquals("Dry-Season Promo", campaigns.get(0).name());
        assertEquals("ACTIVE", campaigns.get(0).status());
        assertEquals("PAUSED", campaigns.get(1).status());
    }

    @Test
    void requestsTheAccountsCampaignsWithTheTokenAndFields() throws Exception {
        server.enqueue(json(fixture("meta-campaigns.json")));

        client.listCampaigns("TOKEN", "act_111");

        RecordedRequest request = server.takeRequest();
        String path = java.net.URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/act_111/campaigns"), path);
        assertTrue(path.contains("fields=id,name,status"), path);
        assertTrue(path.contains("access_token=TOKEN"), path);
    }

    @Test
    void surfacesAnApiErrorAsAPlatformException() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(400)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"error\":{\"message\":\"Unsupported get request\",\"code\":100}}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.listCampaigns("TOKEN", "act_111"));
        assertTrue(e.getMessage().contains("Unsupported get request"), e.getMessage());
    }
}
```

- [ ] **Step 3: Run it, expect failure**

Run: `./mvnw test -Dtest=MetaAdsClientCampaignsTest`
Expected: FAIL — `UnsupportedOperationException: implemented in Task 3`.

- [ ] **Step 4: Implement `listCampaigns`**

Replace the stub in `MetaAdsClient.java`. It mirrors `listAccounts` — same cursor-follow loop, `getAbsoluteJson`, `MAX_PAGES` cap:

```java
    @Override
    public List<AdCampaignOption> listCampaigns(String accessToken, String externalAccountId) {
        List<AdCampaignOption> campaigns = new ArrayList<>();

        JsonNode page = getJson("/" + externalAccountId + "/campaigns", uri -> uri
                .queryParam("fields", "id,name,status")
                .queryParam("limit", 200)
                .queryParam("access_token", accessToken));

        int pageCount = 1;
        while (page != null) {
            JsonNode data = page.get("data");
            if (data != null && data.isArray()) {
                for (JsonNode c : data) {
                    campaigns.add(new AdCampaignOption(
                            text(c, "id"), text(c, "name"), text(c, "status")));
                }
            }
            String next = page.path("paging").path("next").asText(null);
            if (next == null || next.isBlank()) break;
            if (campaigns.size() > 2000) {
                log.warn("[Module4] Meta campaign paging exceeded 2000 rows; stopping");
                break;
            }
            if (pageCount >= MAX_PAGES) {
                log.warn("[Module4] Meta campaign paging exceeded {} pages; stopping", MAX_PAGES);
                break;
            }
            page = getAbsoluteJson(next);
            pageCount++;
        }
        return campaigns;
    }
```

- [ ] **Step 5: Run it, expect pass**

Run: `./mvnw test -Dtest=MetaAdsClientCampaignsTest`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientCampaignsTest.java \
        backend/spring-boot/src/test/resources/adplatform/meta-campaigns.json
git commit -m "feat(module-4): MetaAdsClient.listCampaigns"
```

---

## Task 4: `MetaAdsClient.fetchInsights` campaign filter

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java`
- Modify: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientInsightsTest.java`

- [ ] **Step 1: Write the failing test**

Append to `MetaAdsClientInsightsTest`:

```java
    @Test
    void scopesTheRequestToOneCampaignWhenGivenACampaignId() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        client.fetchInsights("TOKEN", "act_111", "23851234567890123", START, END);

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/act_111/insights"), path);
        assertTrue(path.contains("level=account"), path);
        assertTrue(path.contains("\"field\":\"campaign.id\""), path);
        assertTrue(path.contains("\"value\":[\"23851234567890123\"]"), path);
    }

    @Test
    void sendsNoFilteringParamForAWholeAccountFetch() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        client.fetchInsights("TOKEN", "act_111", null, START, END);

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertFalse(path.contains("filtering="), path);
    }
```

- [ ] **Step 2: Run them, expect failure**

Run: `./mvnw test -Dtest=MetaAdsClientInsightsTest`
Expected: FAIL — `scopesTheRequestToOneCampaignWhenGivenACampaignId` fails (no `campaign.id` in the path).

- [ ] **Step 3: Wire the filter into `fetchInsights`**

Replace the whole `MetaAdsClient.fetchInsights` method with this — the only change from Task 2's version is the request-building lambda; the parsing below it is byte-for-byte the current code:

```java
    @Override
    public AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                       String externalCampaignId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        String timeRange = "{\"since\":\"" + periodStart + "\",\"until\":\"" + periodEnd + "\"}";

        JsonNode response = getJson("/" + externalAccountId + "/insights", uri -> {
            uri.queryParam("level", "account")
               .queryParam("fields", "impressions,clicks,spend,actions")
               .queryParam("time_range", encode(timeRange))
               .queryParam("access_token", encode(accessToken));
            if (externalCampaignId != null && !externalCampaignId.isBlank()) {
                // Meta applies this server-side; the response is still one row,
                // so data.get(0) below is unchanged.
                String filtering = "[{\"field\":\"campaign.id\",\"operator\":\"IN\",\"value\":[\""
                        + externalCampaignId + "\"]}]";
                uri.queryParam("filtering", encode(filtering));
            }
            return uri;
        });

        JsonNode data = response.get("data");
        if (data == null || !data.isArray() || data.isEmpty()) {
            log.info("[Module4] Meta returned no insight rows for {} {}..{}",
                     externalAccountId, periodStart, periodEnd);
            return new AdInsightData(0, 0, BigDecimal.ZERO, 0, null, response.toString());
        }

        JsonNode row = data.get(0);
        return new AdInsightData(
                asLong(row, "impressions"),
                asLong(row, "clicks"),
                asDecimal(row, "spend"),
                countConversions(row.get("actions")),
                null,
                response.toString());
    }
```

Note the `getJson(...)` second argument is currently a `java.util.function.UnaryOperator<UriComponentsBuilder>` — the lambda must `return uri;` (a block body), which is why the braces are added.

- [ ] **Step 4: Run the full insights test, expect pass**

Run: `./mvnw test -Dtest=MetaAdsClientInsightsTest`
Expected: PASS — all cases including the two new ones and the untouched originals.

- [ ] **Step 5: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientInsightsTest.java
git commit -m "feat(module-4): scope Meta insights to one campaign"
```

---

## Task 5: `TikTokAdsClient.listCampaigns`

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java`
- Create: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/TikTokAdsClientCampaignsTest.java`
- Create: `backend/spring-boot/src/test/resources/adplatform/tiktok-campaigns.json`

- [ ] **Step 1: Write the fixture**

`src/test/resources/adplatform/tiktok-campaigns.json`:

```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "list": [
      { "campaign_id": "1790000000000000001", "campaign_name": "Dry-Season Promo", "operation_status": "ENABLE" },
      { "campaign_id": "1790000000000000002", "campaign_name": "Always-On Brand", "operation_status": "DISABLE" }
    ],
    "page_info": { "page": 1, "page_size": 1000, "total_number": 2, "total_page": 1 }
  }
}
```

- [ ] **Step 2: Write the failing test**

`TikTokAdsClientCampaignsTest.java` — copy the `MockWebServer` setup from `TikTokAdsClientInsightsTest` (same `fixture`, `json`, `@BeforeEach` constructing `new TikTokAdsClient(props, base, base + "/portal/auth")` — check that file for the exact constructor args and `props` setters it uses):

```java
    @Test
    void parsesIdNameAndStatus() throws Exception {
        server.enqueue(json(fixture("tiktok-campaigns.json")));

        List<AdCampaignOption> campaigns = client.listCampaigns("TOKEN", "7000000000000000001");

        assertEquals(2, campaigns.size());
        assertEquals("1790000000000000001", campaigns.get(0).id());
        assertEquals("Dry-Season Promo", campaigns.get(0).name());
        assertEquals("ENABLE", campaigns.get(0).status());
    }

    @Test
    void sendsTheAdvertiserIdAndTokenHeader() throws Exception {
        server.enqueue(json(fixture("tiktok-campaigns.json")));

        client.listCampaigns("TOKEN", "7000000000000000001");

        RecordedRequest request = server.takeRequest();
        assertTrue(request.getPath().contains("/campaign/get/"), request.getPath());
        assertTrue(request.getPath().contains("advertiser_id=7000000000000000001"), request.getPath());
        assertEquals("TOKEN", request.getHeader("Access-Token"));
    }

    @Test
    void surfacesANonZeroCodeAsAPlatformException() throws Exception {
        server.enqueue(json("{\"code\":40001,\"message\":\"Invalid advertiser_id\"}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.listCampaigns("TOKEN", "bad"));
        assertTrue(e.getMessage().contains("40001"), e.getMessage());
    }
```

- [ ] **Step 3: Run it, expect failure**

Run: `./mvnw test -Dtest=TikTokAdsClientCampaignsTest`
Expected: FAIL — `UnsupportedOperationException: implemented in Task 5`.

- [ ] **Step 4: Implement `listCampaigns`**

Replace the stub in `TikTokAdsClient.java`, using the existing `get(...)` + `unwrap(...)` helpers:

```java
    @Override
    public List<AdCampaignOption> listCampaigns(String accessToken, String advertiserId) {
        JsonNode data = unwrap(get("/campaign/get/", accessToken, uri -> uri
                .queryParam("advertiser_id", encode(advertiserId))
                .queryParam("fields", encode("[\"campaign_id\",\"campaign_name\",\"operation_status\"]"))
                .queryParam("page_size", 1000)));

        List<AdCampaignOption> campaigns = new ArrayList<>();
        JsonNode list = data.get("list");
        if (list != null && list.isArray()) {
            for (JsonNode c : list) {
                String id = text(c, "campaign_id");
                if (id == null) continue;
                campaigns.add(new AdCampaignOption(id, text(c, "campaign_name"),
                        text(c, "operation_status")));
            }
        }
        return campaigns;
    }
```

*(Single page of up to 1000: a TikTok advertiser with more campaigns than that is not a realistic MSME case, and `listAccounts` in this client does not page either.)*

- [ ] **Step 5: Run it, expect pass**

Run: `./mvnw test -Dtest=TikTokAdsClientCampaignsTest`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/TikTokAdsClientCampaignsTest.java \
        backend/spring-boot/src/test/resources/adplatform/tiktok-campaigns.json
git commit -m "feat(module-4): TikTokAdsClient.listCampaigns"
```

---

## Task 6: `TikTokAdsClient.fetchInsights` campaign scoping

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java`
- Modify: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/TikTokAdsClientInsightsTest.java`

- [ ] **Step 1: Write the failing test**

Append to `TikTokAdsClientInsightsTest`:

```java
    @Test
    void scopesTheReportToOneCampaignWhenGivenACampaignId() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        client.fetchInsights("TOKEN", "7000000000000000001", "1790000000000000001", START, END);

        RecordedRequest request = server.takeRequest();
        String path = java.net.URLDecoder.decode(request.getPath(), java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(path.contains("data_level=AUCTION_CAMPAIGN"), path);
        assertTrue(path.contains("campaign_id"), path);
        assertTrue(path.contains("campaign_ids"), path);
        assertTrue(path.contains("1790000000000000001"), path);
    }

    @Test
    void usesAdvertiserLevelForAWholeAccountFetch() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        client.fetchInsights("TOKEN", "7000000000000000001", null, START, END);

        RecordedRequest request = server.takeRequest();
        String path = java.net.URLDecoder.decode(request.getPath(), java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(path.contains("data_level=AUCTION_ADVERTISER"), path);
        assertFalse(path.contains("campaign_ids"), path);
    }
```

- [ ] **Step 2: Run them, expect failure**

Run: `./mvnw test -Dtest=TikTokAdsClientInsightsTest`
Expected: FAIL — the campaign case still sends `AUCTION_ADVERTISER`.

- [ ] **Step 3: Branch `fetchInsights` on the campaign id**

Replace the whole `TikTokAdsClient.fetchInsights` method with this — only the request lambda changes; `unwrap` + the `list.get(0).path("metrics")` parse are the current code:

```java
    @Override
    public AdInsightData fetchInsights(String accessToken, String advertiserId,
                                       String externalCampaignId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        boolean byCampaign = externalCampaignId != null && !externalCampaignId.isBlank();
        String dataLevel  = byCampaign ? "AUCTION_CAMPAIGN" : "AUCTION_ADVERTISER";
        String dimensions = byCampaign ? "[\"campaign_id\"]" : "[\"advertiser_id\"]";

        JsonNode envelope = get("/report/integrated/get/", accessToken, uri -> {
            uri.queryParam("advertiser_id", encode(advertiserId))
               .queryParam("report_type", encode("BASIC"))
               .queryParam("data_level", encode(dataLevel))
               .queryParam("dimensions", encode(dimensions))
               .queryParam("metrics", encode("[\"impressions\",\"clicks\",\"spend\",\"conversion\"]"))
               .queryParam("start_date", encode(periodStart.toString()))
               .queryParam("end_date", encode(periodEnd.toString()))
               .queryParam("page_size", 100);
            if (byCampaign) {
                String filtering = "[{\"field_name\":\"campaign_ids\",\"filter_type\":\"IN\","
                        + "\"filter_value\":\"[\\\"" + externalCampaignId + "\\\"]\"}]";
                uri.queryParam("filtering", encode(filtering));
            }
            return uri;
        });

        String raw = envelope.toString();
        JsonNode data = unwrap(envelope);

        JsonNode list = data.get("list");
        if (list == null || !list.isArray() || list.isEmpty()) {
            log.info("[Module4] TikTok returned no report rows for {} {}..{}",
                     advertiserId, periodStart, periodEnd);
            return new AdInsightData(0, 0, BigDecimal.ZERO, 0, null, raw);
        }

        JsonNode metrics = list.get(0).path("metrics");
        return new AdInsightData(
                parseLong(text(metrics, "impressions")),
                parseLong(text(metrics, "clicks")),
                parseDecimal(text(metrics, "spend")),
                parseLong(text(metrics, "conversion")),
                null,
                raw);
    }
```

The `get(...)` second argument is a `java.util.function.UnaryOperator<UriComponentsBuilder>`, so the lambda block must `return uri;`.

- [ ] **Step 4: Run it, expect pass**

Run: `./mvnw test -Dtest=TikTokAdsClientInsightsTest`
Expected: PASS — new and existing cases.

- [ ] **Step 5: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/TikTokAdsClientInsightsTest.java
git commit -m "feat(module-4): scope TikTok report to one campaign"
```

---

## Task 7: `AdConnectionService.selectCampaign` + clearing on account change

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionService.java`
- Modify: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionServiceTest.java`

- [ ] **Step 1: Write the failing tests**

Append to `AdConnectionServiceTest` (it `@Autowired`s `AdConnectionService service` / `connectionRepo` and has a `profileId` in `@BeforeEach` — reuse them; `activate(...)` helper equivalent may already exist, otherwise inline `storeGrant` + `selectAccount`):

```java
    @Test
    void selectCampaignPinsTheConnectionToOneCampaign() {
        service.storeGrant(profileId, AdProvider.META, new TokenGrant("T", null, null, "s"));
        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_1", "Acct", "PHP"));

        service.selectCampaign(profileId, AdProvider.META,
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Dry-Season Promo", "ACTIVE"));

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals("cmp_1", conn.getExternalCampaignId());
        assertEquals("Dry-Season Promo", conn.getExternalCampaignName());
        assertEquals(AdPlatformConnection.STATUS_ACTIVE, conn.getStatus());
    }

    @Test
    void selectCampaignWithNullClearsBackToWholeAccount() {
        service.storeGrant(profileId, AdProvider.META, new TokenGrant("T", null, null, "s"));
        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_1", "Acct", "PHP"));
        service.selectCampaign(profileId, AdProvider.META,
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE"));

        service.selectCampaign(profileId, AdProvider.META, null);

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertNull(conn.getExternalCampaignId());
        assertNull(conn.getExternalCampaignName());
    }

    @Test
    void selectCampaignBeforeAnAccountIsChosenIsRejected() {
        service.storeGrant(profileId, AdProvider.META, new TokenGrant("T", null, null, "s"));

        assertThrows(IllegalStateException.class, () -> service.selectCampaign(profileId,
                AdProvider.META, new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE")));
    }

    @Test
    void changingTheAdAccountClearsAPreviouslySelectedCampaign() {
        service.storeGrant(profileId, AdProvider.META, new TokenGrant("T", null, null, "s"));
        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_1", "Acct 1", "PHP"));
        service.selectCampaign(profileId, AdProvider.META,
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE"));

        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_2", "Acct 2", "PHP"));

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertNull(conn.getExternalCampaignId(), "a campaign from the old account must not carry over");
    }
```

Add imports as needed (`AdConnectionDtos`, `TokenGrant`, `static org.junit.jupiter.api.Assertions.*`).

- [ ] **Step 2: Run them, expect failure**

Run: `./mvnw test -Dtest=AdConnectionServiceTest`
Expected: FAIL — `cannot find symbol: method selectCampaign`.

- [ ] **Step 3: Implement**

In `AdConnectionService.java`, add after `selectAccount`:

```java
    /**
     * Pins the connection to one campaign, or clears the pin when {@code campaign}
     * is null (report on the whole account again).
     *
     * @throws IllegalStateException if no ad account has been chosen yet — a
     *         campaign only makes sense within a selected account
     */
    @Transactional
    public AdPlatformConnection selectCampaign(UUID businessProfileId, AdProvider provider,
                                               AdConnectionDtos.AdCampaignOption campaign) {
        AdPlatformConnection conn = requireConnection(businessProfileId, provider);
        if (conn.getExternalAccountId() == null) {
            throw new IllegalStateException(
                    "choose an ad account before choosing a campaign for " + provider.key());
        }
        if (campaign == null) {
            conn.setExternalCampaignId(null);
            conn.setExternalCampaignName(null);
        } else {
            conn.setExternalCampaignId(campaign.id());
            conn.setExternalCampaignName(campaign.name());
        }
        log.info("[Module4] {} reporting scope set for profile={}: {}",
                 provider.key(), businessProfileId,
                 campaign == null ? "whole account" : "campaign " + campaign.id());
        return connectionRepo.save(conn);
    }
```

In `selectAccount(...)`, after setting the account fields, clear any stale campaign:

```java
        conn.setExternalAccountId(account.id());
        conn.setExternalAccountName(account.name());
        conn.setCurrency(account.currency() == null ? null : account.currency().toUpperCase());
        // A campaign belongs to the account it was chosen from — dropping the
        // account invalidates it.
        conn.setExternalCampaignId(null);
        conn.setExternalCampaignName(null);
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
```

In `storeGrant(...)`, alongside the existing `setExternalAccountId(null)` etc. block, add:

```java
        conn.setExternalCampaignId(null);
        conn.setExternalCampaignName(null);
```

- [ ] **Step 4: Run it, expect pass**

Run: `./mvnw test -Dtest=AdConnectionServiceTest`
Expected: PASS — including the pre-existing cases.

- [ ] **Step 5: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionService.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionServiceTest.java
git commit -m "feat(module-4): AdConnectionService.selectCampaign"
```

---

## Task 8: Controller — `GET /{provider}/campaigns` + `POST /{provider}/campaign`

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionDtos.java`
- Modify: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionFlowTest.java`

- [ ] **Step 1: Write the failing tests**

Append to `AdConnectionFlowTest`:

```java
    @Test
    void campaignsListsWhatTheAccountCanSee() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption("act_1", "Dive Ads", "PHP")));
        mvc.perform(post("/api/ad-connections/meta/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalAccountId\":\"act_1\"}"))
           .andExpect(status().isOk());
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Dry-Season Promo", "ACTIVE"),
                new AdConnectionDtos.AdCampaignOption("cmp_2", "Brand", "PAUSED")));

        mvc.perform(get("/api/ad-connections/meta/campaigns")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2))
           .andExpect(jsonPath("$[0].id").value("cmp_1"))
           .andExpect(jsonPath("$[0].status").value("ACTIVE"));
    }

    @Test
    void campaignsIs409WhenNoAccountIsSelectedYet() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));

        mvc.perform(get("/api/ad-connections/meta/campaigns")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isConflict());
    }

    @Test
    void selectingACampaignRecordsItOnTheConnection() throws Exception {
        activateMetaWithAccount("act_1");
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Dry-Season Promo", "ACTIVE")));

        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":\"cmp_1\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.campaignName").value("Dry-Season Promo"));

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("cmp_1", conn.getExternalCampaignId());
    }

    @Test
    void selectingACampaignTheAccountCannotSeeIsRejected() throws Exception {
        activateMetaWithAccount("act_1");
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE")));

        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":\"cmp_SOMEONE_ELSE\"}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void postingANullCampaignIdClearsBackToWholeAccount() throws Exception {
        activateMetaWithAccount("act_1");
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE")));
        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":\"cmp_1\"}"))
           .andExpect(status().isOk());

        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":null}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.campaignName").doesNotExist());

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertNull(conn.getExternalCampaignId());
    }
```

Add a helper to the test class:

```java
    private void activateMetaWithAccount(String accountId) throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption(accountId, "Dive Ads", "PHP")));
        mvc.perform(post("/api/ad-connections/meta/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalAccountId\":\"" + accountId + "\"}"))
           .andExpect(status().isOk());
    }
```

- [ ] **Step 2: Run them, expect failure**

Run: `./mvnw test -Dtest=AdConnectionFlowTest`
Expected: FAIL — 404 on `/campaigns` and `/campaign` (routes don't exist).

- [ ] **Step 3: Add the request DTO**

In `AdConnectionDtos.java`, after `SelectAccountRequest`:

```java
    /** POST /{provider}/campaign request body. A null id clears the selection. */
    public record SelectCampaignRequest(String externalCampaignId) {}
```

- [ ] **Step 4: Implement the endpoints**

In `AdConnectionController.java`, add imports for `AdCampaignOption` and `SelectCampaignRequest`, then add after `selectAccount(...)`:

```java
    /** GET /{provider}/campaigns — the campaigns on the connection's selected ad account. */
    @GetMapping("/{provider}/campaigns")
    public List<AdCampaignOption> campaigns(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        return listCampaignsFor(p, currentBusinessProfile.resolveProfileId());
    }

    /** POST /{provider}/campaign — pins the sync to one campaign, or clears it with a null id. */
    @PostMapping("/{provider}/campaign")
    public AdConnectionView selectCampaign(@PathVariable String provider,
                                           @RequestBody(required = false) SelectCampaignRequest body) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        UUID profileId = currentBusinessProfile.resolveProfileId();

        String campaignId = body == null ? null : body.externalCampaignId();
        if (campaignId == null || campaignId.isBlank()) {
            return toView(p, service.selectCampaign(profileId, p, null));
        }

        // Re-fetch and match, exactly as selectAccount guards against an
        // arbitrary posted id.
        AdCampaignOption chosen = listCampaignsFor(p, profileId).stream()
                .filter(c -> campaignId.equals(c.id()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "that campaign is not available on this ad account"));

        return toView(p, service.selectCampaign(profileId, p, chosen));
    }
```

Add the private helper next to `listAccountsFor`:

```java
    private List<AdCampaignOption> listCampaignsFor(AdProvider p, UUID profileId) {
        AdPlatformConnection conn;
        try {
            conn = service.requireConnection(profileId, p);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        if (conn.getExternalAccountId() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "choose an ad account before choosing a campaign");
        }
        try {
            return clientFor(p).listCampaigns(service.accessTokenOf(conn), conn.getExternalAccountId());
        } catch (AdPlatformException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }
```

The non-null-id branch is safe because `listCampaignsFor` runs first and 409s when no account is selected. The null-id branch reaches `service.selectCampaign` directly, so wrap its `IllegalStateException` (raised when no account is selected) to a 409 — use this exact form for that branch:

```java
        if (campaignId == null || campaignId.isBlank()) {
            try {
                return toView(p, service.selectCampaign(profileId, p, null));
            } catch (IllegalStateException e) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
            }
        }
```

- [ ] **Step 5: Run it, expect pass**

Run: `./mvnw test -Dtest=AdConnectionFlowTest`
Expected: PASS — new and existing cases.

- [ ] **Step 6: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java \
        backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionDtos.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionFlowTest.java
git commit -m "feat(module-4): campaign list + select endpoints"
```

---

## Task 9: Sync writes the campaign scope

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsightSyncService.java`
- Modify: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightSyncServiceTest.java`

The wiring landed in Task 2 (the 5-arg call + `InsightSource.campaignName`). This task adds the `AdInsight.externalCampaignId` write and locks the behaviour with tests.

- [ ] **Step 1: Write the failing test**

Append to `AdInsightSyncServiceTest` (add the imports `com.ceview.module4.adconnections.AdInsight`, `org.mockito.ArgumentCaptor`, `org.mockito.Mockito` if not present):

```java
    @Test
    void syncsAgainstTheSelectedCampaignAndRecordsItOnTheCachedRow() {
        activate(AdProvider.META, "act_1", "PHP");
        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        conn.setExternalCampaignId("cmp_1");
        conn.setExternalCampaignName("Dry-Season Promo");
        connectionRepo.save(conn);

        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(100, 10, new BigDecimal("50.00"), 2, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        // the campaign id reached the client
        ArgumentCaptor<String> campaignArg = ArgumentCaptor.forClass(String.class);
        Mockito.verify(metaClient).fetchInsights(anyString(), any(), campaignArg.capture(), any(), any());
        assertEquals("cmp_1", campaignArg.getValue());

        // the source names it
        assertEquals("Dry-Season Promo", response.sources().get(0).campaignName());

        // the cached row records the scope
        AdInsight cached = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(profileId, "meta", START, END)
                .orElseThrow();
        assertEquals("cmp_1", cached.getExternalCampaignId());
    }

    @Test
    void aWholeAccountSyncLeavesTheCampaignScopeNull() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(100, 10, new BigDecimal("50.00"), 2, null, "{}"));

        syncService.sync(profileId, START, END);

        AdInsight cached = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(profileId, "meta", START, END)
                .orElseThrow();
        assertNull(cached.getExternalCampaignId());
    }
```

- [ ] **Step 2: Run them, expect failure**

Run: `./mvnw test -Dtest=AdInsightSyncServiceTest`
Expected: FAIL — `cached.getExternalCampaignId()` is null in the first test (the sync never writes it).

- [ ] **Step 3: Write the campaign id onto the cached row**

In `AdInsightSyncService.upsertInsight(...)`, after `insight.setExternalAccountId(conn.getExternalAccountId());`:

```java
        insight.setExternalCampaignId(conn.getExternalCampaignId());
```

- [ ] **Step 4: Run it, expect pass**

Run: `./mvnw test -Dtest=AdInsightSyncServiceTest`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsightSyncService.java \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightSyncServiceTest.java
git commit -m "feat(module-4): record the campaign scope on synced insight rows"
```

---

## Task 10: Backend green sweep

- [ ] **Step 1: Run the whole backend suite**

Run: `cd backend/spring-boot && ./mvnw clean test`
Expected: `BUILD SUCCESS`, 0 failures. If `AdConnectionListTest.neverLeaksTokensToTheClient` or any view assertion trips on the new `campaignName` field, adjust that assertion to include the field (it must still assert no token/`*Encrypted` value appears).

- [ ] **Step 2: Hand back for commit if anything was adjusted**

```bash
git add backend/spring-boot/src/test/java/com/ceview/module4/adconnections/
git commit -m "test(module-4): adjust ad-connection assertions for campaignName"
```

(Skip if Step 1 was clean.)

---

# FRONTEND

## Task 11: Types

**Files:**
- Modify: `frontend/types.ts`
- Modify: `frontend/services/fixtures/adConnections.ts`
- Modify: any test literal constructing a full `AdConnection` — at least `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx` and `frontend/services/useAdConnections.test.tsx`

- [ ] **Step 1: Add the types**

In `types.ts`, add `campaignName` to `AdConnection` (after `currency`):

```ts
export interface AdConnection {
  provider: AdProvider;
  configured: boolean;
  status: AdConnectionStatus;
  accountName: string | null;
  currency: string | null;
  /** null = reporting on the whole account; a name = pinned to that campaign. */
  campaignName: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}
```

Add a new interface after `AdAccountOption`:

```ts
export interface AdCampaignOption {
  id: string;
  name: string | null;
  status: string | null;
}
```

Add `campaignName` to `AdInsightSource` (optional — the backend always sends it, but existing test literals omit it):

```ts
export interface AdInsightSource {
  provider: AdProvider;
  accountName: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  currency: string | null;
  campaignName?: string | null;
}
```

- [ ] **Step 2: Update the fixtures**

In `services/fixtures/adConnections.ts`:

```ts
export const MOCK_AD_CONNECTIONS: AdConnection[] = [
  {
    provider: 'meta',
    configured: true,
    status: 'ACTIVE',
    accountName: 'Cebu Dive Co. Ads',
    currency: 'PHP',
    campaignName: 'Dry-Season Promo',
    connectedAt: '2026-08-20T02:14:00Z',
    lastSyncedAt: '2026-09-06T01:00:00Z',
  },
  {
    provider: 'tiktok',
    configured: true,
    status: 'DISCONNECTED',
    accountName: null,
    currency: null,
    campaignName: null,
    connectedAt: null,
    lastSyncedAt: null,
  },
];
```

Add, after `MOCK_AD_ACCOUNTS`:

```ts
import type { AdCampaignOption } from '../../types';

export const MOCK_AD_CAMPAIGNS: AdCampaignOption[] = [
  { id: 'cmp_1', name: 'Dry-Season Promo', status: 'ACTIVE' },
  { id: 'cmp_2', name: 'Always-On Brand', status: 'PAUSED' },
];
```

Add `campaignName: 'Dry-Season Promo'` to the single entry in `MOCK_AD_INSIGHTS.sources`.

- [ ] **Step 3: Fix test literals**

In `IngestionForm.adSync.test.tsx`, add `campaignName: null` to the `ACTIVE_META` object. Grep the frontend for other `AdConnection` object literals and add `campaignName: null` where the compiler flags one:

Run: `cd frontend && npx tsc --noEmit`
Expected: only errors about missing `campaignName` on `AdConnection` literals — fix each by adding `campaignName: null`. Re-run until clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/types.ts frontend/services/fixtures/adConnections.ts \
        frontend/components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx \
        frontend/services/useAdConnections.test.tsx
git commit -m "feat(module-4): ad-campaign frontend types + fixtures"
```

---

## Task 12: apiClient + hook

**Files:**
- Modify: `frontend/services/apiClient.ts`
- Modify: `frontend/services/useAdConnections.ts`
- Modify: `frontend/services/apiClient.adConnections.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `services/apiClient.adConnections.test.ts` (match its existing style — it mocks `fetch` / `request`; copy the shape of the `selectAccount` test already there):

```ts
  it('selectCampaign POSTs the campaign id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MOCK_AD_CONNECTIONS[0]));
    await apiClient.adConnections.selectCampaign('meta', 'cmp_1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/ad-connections/meta/campaign'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ externalCampaignId: 'cmp_1' }) }),
    );
  });

  it('selectCampaign(null) clears the selection', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MOCK_AD_CONNECTIONS[0]));
    await apiClient.adConnections.selectCampaign('meta', null);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/ad-connections/meta/campaign'),
      expect.objectContaining({ body: JSON.stringify({ externalCampaignId: null }) }),
    );
  });
```

*(If the existing test file uses helper names other than `fetchMock` / `jsonResponse`, use whatever it already defines.)*

- [ ] **Step 2: Run it, expect failure**

Run: `npm test -- --run services/apiClient.adConnections.test.ts`
Expected: FAIL — `apiClient.adConnections.selectCampaign is not a function`.

- [ ] **Step 3: Implement**

In `apiClient.ts`, add the `AdCampaignOption` import alongside the other ad-type imports and `MOCK_AD_CAMPAIGNS` to the fixtures import. Add to the `adConnections` object, after `selectAccount`:

```ts
    campaigns: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay<AdCampaignOption[]>(MOCK_AD_CAMPAIGNS)
        : request<AdCampaignOption[]>(`/api/ad-connections/${provider}/campaigns`),

    selectCampaign: (provider: AdProvider, externalCampaignId: string | null) =>
      USE_FIXTURES
        ? delay<AdConnection>({ ...MOCK_AD_CONNECTIONS[0], campaignName: externalCampaignId ? 'Dry-Season Promo' : null })
        : request<AdConnection>(`/api/ad-connections/${provider}/campaign`, {
            method: 'POST',
            body: JSON.stringify({ externalCampaignId }),
          }),
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm test -- --run services/apiClient.adConnections.test.ts`
Expected: PASS.

- [ ] **Step 5: Expose `selectCampaign` from the hook**

In `useAdConnections.ts`, add to `AdConnectionsState`:

```ts
  selectCampaign(provider: AdProvider, campaignId: string | null): Promise<void>;
```

and in the hook body, after `disconnect`:

```ts
  const selectCampaign = useCallback(
    async (provider: AdProvider, campaignId: string | null) => {
      await apiClient.adConnections.selectCampaign(provider, campaignId);
      await refresh();
    },
    [refresh],
  );
```

Add `selectCampaign` to the returned object.

- [ ] **Step 6: Run the hook's test**

Run: `npm test -- --run services/useAdConnections.test.tsx`
Expected: PASS (unchanged behaviour; new method is additive).

- [ ] **Step 7: Commit**

```bash
git add frontend/services/apiClient.ts frontend/services/useAdConnections.ts \
        frontend/services/apiClient.adConnections.test.ts
git commit -m "feat(module-4): adConnections.campaigns + selectCampaign client"
```

---

## Task 13: `AdCampaignPickerModal`

**Files:**
- Create: `frontend/components/settings/AdCampaignPickerModal.tsx`
- Create: `frontend/components/settings/AdCampaignPickerModal.test.tsx`

- [ ] **Step 1: Write the failing test**

`AdCampaignPickerModal.test.tsx` (adapt `AdAccountPickerModal.test.tsx` — same mock structure):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdCampaignPickerModal from './AdCampaignPickerModal';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';

const campaignsMock = vi.fn();
const selectCampaignMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      campaigns: (...a: unknown[]) => campaignsMock(...a),
      selectCampaign: (...a: unknown[]) => selectCampaignMock(...a),
    },
  },
}));

function renderPicker(onDone = vi.fn()) {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <AdCampaignPickerModal provider="meta" onClose={vi.fn()} onSelected={onDone} />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  campaignsMock.mockReset();
  selectCampaignMock.mockReset();
  selectCampaignMock.mockResolvedValue({});
  campaignsMock.mockResolvedValue([
    { id: 'cmp_1', name: 'Dry-Season Promo', status: 'ACTIVE' },
    { id: 'cmp_2', name: 'Always-On Brand', status: 'PAUSED' },
  ]);
});

describe('AdCampaignPickerModal', () => {
  it('offers "Whole account" plus every campaign', async () => {
    renderPicker();
    expect(await screen.findByText('Dry-Season Promo')).toBeInTheDocument();
    expect(screen.getByText(/whole account/i)).toBeInTheDocument();
    expect(screen.getByText('Always-On Brand')).toBeInTheDocument();
  });

  it('submits the chosen campaign id', async () => {
    const onSelected = vi.fn();
    renderPicker(onSelected);
    fireEvent.click(await screen.findByText('Dry-Season Promo'));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(selectCampaignMock).toHaveBeenCalledWith('meta', 'cmp_1'));
    await waitFor(() => expect(onSelected).toHaveBeenCalled());
  });

  it('sends null when "Whole account" is chosen', async () => {
    renderPicker();
    fireEvent.click(await screen.findByText(/whole account/i));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(selectCampaignMock).toHaveBeenCalledWith('meta', null));
  });

  it('surfaces a load failure', async () => {
    campaignsMock.mockRejectedValue(new Error('502'));
    renderPicker();
    expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm test -- --run components/settings/AdCampaignPickerModal.test.tsx`
Expected: FAIL — cannot resolve `./AdCampaignPickerModal`.

- [ ] **Step 3: Implement the component**

`AdCampaignPickerModal.tsx` — structurally a copy of `AdAccountPickerModal.tsx` with a "Whole account" pseudo-option pinned at the top and `selectCampaign` instead of `selectAccount`:

```tsx
/**
 * Which campaign should CeView report on for this ad account?
 *
 * An operator often runs several campaigns at once — a seasonal push and an
 * always-on brand campaign, say. The whole-account total mixes them into one
 * PES score; picking a campaign here scopes every future sync to just that one.
 * "Whole account" clears the pin.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import type { AdCampaignOption, AdProvider } from '../../types';

const PROVIDER_LABELS: Record<AdProvider, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
};

const WHOLE_ACCOUNT = '__whole_account__';

export default function AdCampaignPickerModal({
  provider,
  onClose,
  onSelected,
}: {
  provider: AdProvider;
  onClose: () => void;
  onSelected: () => void;
}) {
  const [campaigns, setCampaigns] = useState<AdCampaignOption[] | null>(null);
  const [selected, setSelected] = useState<string>(WHOLE_ACCOUNT);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient.adConnections
      .campaigns(provider)
      .then((list) => { if (!cancelled) setCampaigns(list); })
      .catch(() => { if (!cancelled) { setCampaigns([]); setLoadFailed(true); } });
    return () => { cancelled = true; };
  }, [provider]);

  async function confirm() {
    setSaving(true);
    try {
      await apiClient.adConnections.selectCampaign(
        provider,
        selected === WHOLE_ACCOUNT ? null : selected,
      );
      if (cancelledRef.current) return;
      showToast('Reporting scope updated');
      onSelected();
    } catch {
      if (cancelledRef.current) return;
      showToast('Could not save that. Try again.');
    } finally {
      if (!cancelledRef.current) setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${PROVIDER_LABELS[provider]} — what to report on`}>
      {campaigns === null && (
        <div className="flex items-center gap-2 py-6">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          <span className="body-sm">Loading campaigns…</span>
        </div>
      )}

      {loadFailed && (
        <p className="body-sm py-4">
          Could not load the campaigns for this ad account. It may have been disconnected —
          reconnect and try again.
        </p>
      )}

      {campaigns !== null && !loadFailed && (
        <div className="flex flex-col gap-2 py-2" role="radiogroup" aria-label="Reporting scope">
          <ScopeRow
            label="Whole account"
            sub="Every campaign, summed"
            checked={selected === WHOLE_ACCOUNT}
            onPick={() => setSelected(WHOLE_ACCOUNT)}
          />
          {campaigns.map((c) => (
            <ScopeRow
              key={c.id}
              label={c.name ?? c.id}
              sub={c.status ?? ''}
              checked={selected === c.id}
              onPick={() => setSelected(c.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" className="btn-outline--sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={confirm} disabled={saving}>
          Save
        </button>
      </div>
    </Modal>
  );
}

function ScopeRow({
  label, sub, checked, onPick,
}: { label: string; sub: string; checked: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onPick}
      className={`flex items-center justify-between rounded-lg border p-3 text-left ${
        checked ? 'border-[var(--color-mint-primary)]' : 'border-[var(--color-gray-light)]'
      }`}
    >
      <span className="font-semibold text-navy-dark">{label}</span>
      <span className="body-xs text-[var(--color-text-muted)]">{sub}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm test -- --run components/settings/AdCampaignPickerModal.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/settings/AdCampaignPickerModal.tsx \
        frontend/components/settings/AdCampaignPickerModal.test.tsx
git commit -m "feat(module-4): AdCampaignPickerModal"
```

---

## Task 14: "Reporting on" row + wiring

**Files:**
- Modify: `frontend/components/settings/AdAccountsSection.tsx`
- Modify: `frontend/components/settings/PlatformsSettings.tsx`
- Create: `frontend/components/settings/AdAccountsSection.test.tsx` (if it does not already exist; otherwise modify)

- [ ] **Step 1: Write the failing test**

`AdAccountsSection.test.tsx` — render with a mocked `useAdConnections` returning one `ACTIVE` Meta connection with `campaignName: 'Dry-Season Promo'` and assert the row shows it and a "Change" control; and a second case with `campaignName: null` showing "Whole account". Follow the mock style of `IngestionForm.adSync.test.tsx` (`vi.mock('../../services/useAdConnections', ...)`).

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdAccountsSection from './AdAccountsSection';
import { ToastProvider } from '../shared/Toast';
import type { AdConnection } from '../../types';

let connections: AdConnection[] | null = [];
const disconnectMock = vi.fn();

vi.mock('../../services/useAdConnections', () => ({
  useAdConnections: () => ({
    connections, error: null,
    hasActive: (connections ?? []).some((c) => c.status === 'ACTIVE'),
    forProvider: (p: string) => (connections ?? []).find((c) => c.provider === p) ?? null,
    refresh: async () => {}, disconnect: disconnectMock, selectCampaign: async () => {},
  }),
}));
vi.mock('../../services/apiClient', () => ({ apiClient: { adConnections: {} } }));

function activeMeta(over: Partial<AdConnection> = {}): AdConnection {
  return {
    provider: 'meta', configured: true, status: 'ACTIVE',
    accountName: 'Cebu Dive Co. Ads', currency: 'PHP', campaignName: null,
    connectedAt: '2026-08-20T00:00:00Z', lastSyncedAt: null, ...over,
  };
}

function renderSection() {
  return render(
    <ToastProvider>
      <AdAccountsSection onConnected={vi.fn()} onChangeCampaign={vi.fn()} />
    </ToastProvider>,
  );
}

beforeEach(() => { disconnectMock.mockReset(); });

describe('AdAccountsSection — reporting scope', () => {
  it('shows the pinned campaign name on an active connection', () => {
    connections = [activeMeta({ campaignName: 'Dry-Season Promo' })];
    renderSection();
    expect(screen.getByText(/reporting on/i)).toHaveTextContent('Dry-Season Promo');
  });

  it('shows "Whole account" when no campaign is pinned', () => {
    connections = [activeMeta({ campaignName: null })];
    renderSection();
    expect(screen.getByText(/reporting on/i)).toHaveTextContent(/whole account/i);
  });

  it('calls onChangeCampaign when "Change" is clicked', () => {
    const onChangeCampaign = vi.fn();
    connections = [activeMeta()];
    render(
      <ToastProvider>
        <AdAccountsSection onConnected={vi.fn()} onChangeCampaign={onChangeCampaign} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /change/i }));
    expect(onChangeCampaign).toHaveBeenCalledWith('meta');
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm test -- --run components/settings/AdAccountsSection.test.tsx`
Expected: FAIL — `onChangeCampaign` prop does not exist; no "Reporting on" text.

- [ ] **Step 3: Add the prop and the row content**

In `AdAccountsSection.tsx`, add `onChangeCampaign` to the component's props:

```tsx
export default function AdAccountsSection({
  onConnected,
  onChangeCampaign,
}: {
  onConnected: (provider: AdProvider) => void;
  onChangeCampaign: (provider: AdProvider) => void;
}) {
```

Pass it into each `AdConnectionRow`:

```tsx
          <AdConnectionRow
            key={connection.provider}
            connection={connection}
            busy={busy === connection.provider}
            onConnect={() => startConnect(connection.provider)}
            onChooseAccount={() => onConnected(connection.provider)}
            onChangeCampaign={() => onChangeCampaign(connection.provider)}
            onDisconnect={() => handleDisconnect(connection.provider)}
          />
```

In `AdConnectionRow`, accept `onChangeCampaign` and, when `isActive`, render a reporting-scope line under the status line:

```tsx
      {isActive && (
        <div className="mt-1 flex items-center gap-2">
          <p className="body-xs text-[var(--color-text-muted)]">
            Reporting on: <span className="font-semibold text-navy-dark">
              {connection.campaignName ?? 'Whole account'}
            </span>
          </p>
          <button type="button" className="btn-link text-xs" onClick={onChangeCampaign}>
            Change
          </button>
        </div>
      )}
```

Place this inside the left-hand `<div>` block (the one holding the provider name and `statusLine`), so it sits with the text, not the action buttons. If `btn-link` is not a class in the codebase, use `className="text-xs underline text-[var(--color-cyan-deep)]"`.

- [ ] **Step 4: Wire the modal in `PlatformsSettings.tsx`**

Add state and mount the picker alongside the existing account picker:

```tsx
import AdCampaignPickerModal from './AdCampaignPickerModal';
```

```tsx
  const [campaignPickerProvider, setCampaignPickerProvider] = useState<AdProvider | null>(null);
```

Pass the handler to the section:

```tsx
        <AdAccountsSection
          key={adRefreshKey}
          onConnected={setPickerProvider}
          onChangeCampaign={setCampaignPickerProvider}
        />
```

Mount the modal near `AdAccountPickerModal`:

```tsx
      {campaignPickerProvider && (
        <AdCampaignPickerModal
          provider={campaignPickerProvider}
          onClose={() => setCampaignPickerProvider(null)}
          onSelected={() => {
            setCampaignPickerProvider(null);
            setAdRefreshKey((k) => k + 1);
          }}
        />
      )}
```

- [ ] **Step 5: Run the section test + the existing platforms tests**

Run: `npm test -- --run components/settings/`
Expected: PASS — the new `AdAccountsSection.test.tsx` and every existing settings test (the `AdAccountsSection` prop is now required; if another test renders it without `onChangeCampaign`, add `onChangeCampaign={vi.fn()}` there).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/settings/AdAccountsSection.tsx \
        frontend/components/settings/AdAccountsSection.test.tsx \
        frontend/components/settings/PlatformsSettings.tsx
git commit -m "feat(module-4): reporting-scope row + campaign picker wiring"
```

---

## Task 15: Ingestion note names the campaign

**Files:**
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx`
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `IngestionForm.adSync.test.tsx` (its `SUMMARY` source already has `accountName`; add a variant with `campaignName`):

```tsx
  it('names the campaign in the sync note when the source is campaign-scoped', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockResolvedValue({
      ...SUMMARY,
      sources: [{ ...SUMMARY.sources[0], campaignName: 'Dry-Season Promo' }],
    });

    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /sync from ad accounts/i }));

    expect(await screen.findByText(/Dry-Season Promo/)).toBeInTheDocument();
    expect(screen.getByText(/Filled from Meta (Dry-Season Promo)\./)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx`
Expected: FAIL — the note reads "Filled from Meta." without the campaign.

- [ ] **Step 3: Include the campaign name in the note**

In `IngestionForm.tsx`, in `syncFromAdAccounts`, replace the success-note line:

```ts
      if (summary.warnings.length === 0) {
        const names = summary.sources.map((s) =>
          s.campaignName
            ? `${PROVIDER_LABELS[s.provider]} · ${s.campaignName}`
            : PROVIDER_LABELS[s.provider],
        );
        setSyncNote(`Filled from ${names.join(' and ')}.`);
      }
```

- [ ] **Step 4: Run it, expect pass**

Run: `npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx`
Expected: PASS — new and existing cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx \
        frontend/components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx
git commit -m "feat(module-4): name the campaign in the ad-sync note"
```

---

## Task 16: e2e coverage

**Files:**
- Modify: `e2e/tests/settings-platforms.spec.ts`

- [ ] **Step 1: Add a fixture-mode test in the "Platforms — ad accounts" describe block**

Using that block's existing `mockAdConnections(page, rows)` helper and `connection(over)` factory, add:

```ts
  test('an active connection shows its reporting scope and opens the campaign picker', async ({ page }) => {
    await mockAdConnections(page, [
      connection({ provider: 'meta', status: 'ACTIVE', accountName: 'Cebu Dive Co. Ads',
                   currency: 'PHP', campaignName: 'Dry-Season Promo' }),
    ]);
    await page.route('**/api/ad-connections/meta/campaigns', (route) =>
      route.fulfill({ json: [
        { id: 'cmp_1', name: 'Dry-Season Promo', status: 'ACTIVE' },
        { id: 'cmp_2', name: 'Always-On Brand', status: 'PAUSED' },
      ] }));

    await page.goto('/settings/platforms');
    const card = adAccountsCard(page);
    await expect(card.getByText(/reporting on/i)).toContainText('Dry-Season Promo');

    await card.getByRole('button', { name: /change/i }).click();
    await expect(page.getByRole('radio', { name: /whole account/i })).toBeVisible();
    await expect(page.getByText('Always-On Brand')).toBeVisible();
  });
```

Add `campaignName` to the test file's local `AdConnection` type and its `connection(...)` factory default (`campaignName: null`).

- [ ] **Step 2: Run it**

Run (from `e2e`, with the fixture frontend served per that spec's setup): `npx playwright test tests/settings-platforms.spec.ts`
Expected: PASS — the new test and all existing ones. If the backend is not running the file skips; run it in the environment the other settings-platforms tests run in.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/settings-platforms.spec.ts
git commit -m "test(e2e): campaign reporting-scope row and picker"
```

---

## Task 17: Frontend green sweep

- [ ] **Step 1: Full checks**

Run, from `frontend`:
```
npx tsc --noEmit
npm test -- --run
npm run build
```
Expected: no type errors, all suites pass, build succeeds.

- [ ] **Step 2: Manual check in fixtures mode**

Run: `cd frontend && VITE_USE_FIXTURES=true npm run dev`, open `http://localhost:3001/settings/platforms`.
Confirm: the Meta row shows **"Reporting on: Dry-Season Promo"** with a **Change** link; clicking it opens the picker with **Whole account** + two campaigns; picking one and saving updates the row. Then open `/performance`, submit the ingestion form's **Sync from ad accounts**, and confirm the note reads **"Filled from Meta (Dry-Season Promo)"**

- [ ] **Step 3: Hand back for the final commit if Step 1 required fixes**

```bash
git add frontend/
git commit -m "chore(module-4): frontend green sweep for ad-campaign selection"
```

(Skip if Steps 1–2 were clean.)

---

## Self-review notes (already applied)

- **Spec coverage:** data model → Task 1; `AdCampaignOption` + `campaignName` DTOs → Task 2; Meta `listCampaigns` / filter → Tasks 3–4; TikTok `listCampaigns` / scoping → Tasks 5–6; `selectCampaign` + clear-on-account-change → Task 7; two endpoints + re-validation + null-clears → Task 8; sync passes the id + writes it + names the source → Tasks 2 & 9; frontend types/apiClient/hook → Tasks 11–12; picker → Task 13; "Reporting on" row → Task 14; sync note → Task 15; e2e → Task 16. Error handling (409 no-account, 400 unknown id, 502 provider error, zeros for no-delivery) is covered in Tasks 6/8.
- **Signature consistency:** `fetchInsights(accessToken, externalAccountId, externalCampaignId, periodStart, periodEnd)` used identically in the interface, both clients, `AdInsightSyncService`, and every mock. `selectCampaign(businessProfileId, provider, AdCampaignOption|null)` consistent between service and controller. Frontend `selectCampaign(provider, string|null)` consistent between `apiClient` and the hook.
- **Non-goals honoured:** no ad-set/ad level, no multi-select, no scheduled poll, no historical backfill (Task 9's second test asserts a whole-account re-sync just leaves the scope null).

---

## Revision 2026-09-11 — picker moved to the Performance screen

Tasks 1–10 (backend) shipped as written. On the frontend the picker was relocated from Settings → Platforms to the Performance ingestion form, beside "Sync from ad accounts", with a choose-at-sync-and-remember model. See the spec's *Revision 2026-09-11* section. Concrete deltas to Tasks 11–16:

- **Task 11** — `AdConnection` also gains `campaignId: string | null`; `AdConnectionView` gains `campaignId` on the backend (`toView` passes `conn.getExternalCampaignId()`).
- **Task 13 (`AdCampaignPickerModal`)** — dropped. The file and its test are deleted.
- **Task 14 (Settings "Reporting on" row)** — dropped. `AdAccountsSection` loses the `onChangeCampaign` prop and the reporting-scope line; `PlatformsSettings` loses the campaign-picker state/mount. `AdAccountsSection.test.tsx` asserts *no* reporting-scope control is rendered.
- **Task 15 → the real Task 15** — `IngestionForm` renders one `<select>` per `ACTIVE` connection (`aria-label="‹Provider› campaign"`, `Whole account` + fetched campaigns, initial value = saved `campaignId`). On Sync it `POST`s `/{provider}/campaign` for each changed selection, `refresh()`es, then calls `/insights` unchanged. The sync note still names the campaign from `InsightSource.campaignName`.
- **Task 16 (e2e)** — the Settings-picker e2e test is removed; the ingestion-form selector is covered by Vitest only (no Performance-screen e2e spec exists to extend).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
