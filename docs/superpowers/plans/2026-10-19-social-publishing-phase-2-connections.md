# Social Publishing — Phase 2 (account connections) Implementation Plan

> Implemented and locally verified as part of [the full completion plan](2026-10-19-social-publishing-completion.md). The Meta login-CSRF follow-up in amendment A1 is resolved through authenticated completion as approved by the user. Historical task checkboxes below are retained; current verification is recorded [here](2026-10-20-social-publishing-verification.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules (CLAUDE.md + lessons from Phase 1):**
> - **Never run `git commit`, `git push`, `git add`, `git stash`, `git checkout --`, `git reset`, `git clean`.** The user commits. A "Checkpoint" step means: stop and report the changed files.
> - **LF line endings.** The repo is LF. Editing tools on this machine can emit CRLF. After finishing, run `python "<scratchpad>/eolfix.py"` (path given in your task prompt) from the repo root; it must report `0 file(s) with unwanted CRLF`. Verify with `git diff --stat` that existing files show only the lines you meant to change (a whole-file diff means an EOL problem).
> - **Do not run `npm run build`** (it rewrites the tracked `frontend/dist/index.html`). Use `npx tsc --noEmit` and `npx vitest run`.
> - **Do not delete or rewrite `.playwright-mcp/`** (tracked files live there).

**Goal:** An operator can connect Facebook (Page), Instagram (the Page's linked business account) and TikTok through real OAuth, see accurate connection state in Settings → Platforms, and have Content Studio's publish picker reflect it. No publishing happens yet (Phase 3).

**Architecture:** One Meta login is shared with the existing Module 4 ads connection (`tbl_ad_platform_connection`, provider `meta`): its scope list is widened and the *granted* scopes are recorded. A new `tbl_publishing_account` stores what the Page/IG/TikTok publishing needs (Page token, IG user id, TikTok creator token). Facebook/Instagram status is derived from the Meta connection plus the chosen Page; TikTok has its own OAuth (`tiktok_creator` state) and callback. The frontend's `connectionsStore` switches from the unimplemented `/api/connections` to `/api/social-connections`.

**Tech Stack:** Spring Boot 3.3.4 (Maven), JPA/Flyway/Postgres, WebClient, JUnit 5 + MockWebServer + MockMvc; React 19 + TS + Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-social-publishing-design.md` (Phase 2). **Setup doc:** `docs/SOCIAL_PUBLISHING_SETUP.md` §B–C.

## Design decisions made while planning

1. **Meta stays one connection.** Facebook/Instagram "Connect" calls the existing `POST /api/ad-connections/meta/authorize` and returns through the existing public callback. No new Meta callback.
2. **Granted scopes, not requested scopes, are stored.** Right after the token exchange the client calls `GET /me/permissions`, so a user who unticks a permission gets `NEEDS_RECONNECT` instead of a failure at publish time.
3. **`AdProvider` enum is not extended** (it drives `AdConnectionController.list()`, insight sync, etc.). `AdConnectionService` gets `String`-keyed overloads of `mintState/consumeState` so TikTok's creator login can reuse `tbl_ad_oauth_state` with key `tiktok_creator`.
4. **Facebook + Instagram share one grant.** Disconnecting either revokes both publishing rows; the Meta ads connection is untouched.
5. **Page tokens** come from `GET /me/accounts` (a Page token derived from a long-lived user token does not expire) and are stored encrypted with the existing `TokenCipher`. The Instagram row stores the same Page token (IG publishing uses it).
6. **TikTok access tokens last ~24 h**; the refresh token is stored. Refreshing on demand is Phase 3 (where tokens are first used).
7. Statuses (derived, returned by `GET /api/social-connections`): `DISCONNECTED`, `NEEDS_RECONNECT`, `NEEDS_PAGE`, `NO_LINKED_INSTAGRAM` (Instagram only), `ACTIVE`.

## Not in this plan

- Calling Meta/TikTok revoke endpoints on disconnect (tokens are discarded locally; users can also remove the app in Facebook/TikTok settings).
- Paging through more than 100 Pages (`limit=100`).
- Publishing, token refresh, ads (Phases 3–4).

## File structure

**Backend create** (`backend/spring-boot/src/main/java/com/ceview/module3/social/`):
`PublishingAccount.java`, `PublishingAccountRepository.java`, `SocialPlatformException.java`, `SocialDtos.java`, `SocialConnectionService.java`, `SocialConnectionController.java`, `client/MetaGraphClient.java`, `client/TikTokContentClient.java`; migration `db/migration/V49__module3_publishing_account.sql`.
**Backend tests** (`src/test/java/com/ceview/module3/social/`): `PublishingAccountRepositoryTest`, `SocialConnectionServiceTest`, `SocialConnectionControllerTest`, `client/MetaGraphClientTest`, `client/TikTokContentClientTest`; plus `module4/adconnections/AdConnectionServiceProviderKeyTest`.
**Backend modify:** `module4/adconnections/AdConnectionService.java`, `module4/adconnections/client/MetaAdsClient.java` (+ `MetaAdsClientAuthorizeUrlTest`, `MetaAdsClientTokenTest`), `config/SecurityConfig.java`, `auth/ProfileCompletionFilter.java`, `application.yml`, `backend/.env.example`.
**Frontend create:** `services/navigation.ts`, `components/settings/PagePickerModal.tsx` (+test), `services/apiClient.connections.test.ts`.
**Frontend modify:** `types.ts`, `services/apiClient.ts`, `services/fixtures/connections.ts`, `services/connectionsStore.tsx` (+`connectionsStore.test.tsx`), `components/settings/PlatformsSettings.tsx` (+test).

Commands: backend `cd backend/spring-boot && export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.11.10-hotspot"; export PATH="$JAVA_HOME/bin:$PATH"; ./mvnw -q test -Dtest=<Class>`. Frontend `cd frontend && npx vitest run <path>`.

---

## Backend

### Task 1: Migration V49, `PublishingAccount`, repository

**Files:** Create `db/migration/V49__module3_publishing_account.sql`, `module3/social/PublishingAccount.java`, `module3/social/PublishingAccountRepository.java`; Test `module3/social/PublishingAccountRepositoryTest.java`.

- [ ] **Step 1: Write the failing test** — `PublishingAccountRepositoryTest.java`:

```java
package com.ceview.module3.social;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class PublishingAccountRepositoryTest {

    @Autowired private PublishingAccountRepository repo;

    @BeforeEach
    void clean() {
        repo.deleteAll();
    }

    private PublishingAccount account(UUID profileId, String platform) {
        PublishingAccount a = new PublishingAccount();
        a.setBusinessProfileId(profileId);
        a.setPlatform(platform);
        a.setExternalId("ext-" + platform);
        a.setDisplayName("Name " + platform);
        a.setAccessTokenEncrypted("SECRET-CIPHERTEXT");
        a.setStatus(PublishingAccount.STATUS_ACTIVE);
        return a;
    }

    @Test
    void findsOnlyTheCallersAccounts() {
        UUID mine = UUID.randomUUID();
        UUID theirs = UUID.randomUUID();
        repo.save(account(mine, "facebook"));
        repo.save(account(mine, "tiktok"));
        repo.save(account(theirs, "facebook"));

        assertThat(repo.findByBusinessProfileId(mine)).hasSize(2);
        assertThat(repo.findByBusinessProfileIdAndPlatform(mine, "facebook")).isPresent();
        assertThat(repo.findByBusinessProfileIdAndPlatform(mine, "instagram")).isEmpty();
        assertThat(repo.findByBusinessProfileId(theirs)).hasSize(1);
    }

    @Test
    void allowsOnlyOneRowPerProfileAndPlatform() {
        UUID profile = UUID.randomUUID();
        repo.saveAndFlush(account(profile, "facebook"));

        assertThatThrownBy(() -> repo.saveAndFlush(account(profile, "facebook")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void toStringNeverContainsTokens() {
        PublishingAccount a = account(UUID.randomUUID(), "tiktok");
        a.setRefreshTokenEncrypted("REFRESH-CIPHERTEXT");

        assertThat(a.toString()).doesNotContain("SECRET-CIPHERTEXT").doesNotContain("REFRESH-CIPHERTEXT");
    }
}
```

- [ ] **Step 2: Run it** — `./mvnw -q test -Dtest=PublishingAccountRepositoryTest`. Expected: FAIL (compile error: `PublishingAccount` missing).

- [ ] **Step 3: Migration** — `V49__module3_publishing_account.sql`:

```sql
-- ============================================================================
-- V49 — Module 3: publishing accounts (Facebook Page, Instagram, TikTok)
--
-- WHY
--   Publishing needs credentials the Module 4 ads grant does not hold: a Page
--   access token, the linked Instagram user id, a TikTok creator token. One row
--   per (profile, platform). Tokens are AES-GCM encrypted (common/crypto/TokenCipher)
--   and never returned by any endpoint.
--
--   Facebook and Instagram rows come from ONE Meta login (the ads connection in
--   tbl_ad_platform_connection, provider 'meta'); TikTok has its own OAuth.
--
-- The TikTok creator login reuses tbl_ad_oauth_state with provider 'tiktok_creator',
-- so that table's CHECK constraint is widened.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_publishing_account (
    account_id              UUID         NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id     UUID         NOT NULL,
    platform                VARCHAR(20)  NOT NULL,
    external_id             VARCHAR(128) NOT NULL,
    display_name            VARCHAR(255),
    access_token_encrypted  TEXT         NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,
    refresh_expires_at      TIMESTAMPTZ,
    scopes                  TEXT,
    status                  VARCHAR(30)  NOT NULL,
    connected_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ,

    CONSTRAINT pk_publishing_account PRIMARY KEY (account_id),
    CONSTRAINT fk_publishing_account_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_publishing_account_profile_platform UNIQUE (business_profile_id, platform),
    CONSTRAINT chk_publishing_account_platform CHECK (platform IN ('facebook', 'instagram', 'tiktok')),
    CONSTRAINT chk_publishing_account_status CHECK (status IN ('ACTIVE', 'NEEDS_RECONNECT', 'REVOKED'))
);

COMMENT ON TABLE tbl_publishing_account IS
    'Per-operator credentials for publishing to one platform. Tokens are AES-GCM encrypted.';

CREATE INDEX IF NOT EXISTS idx_publishing_account_profile
    ON tbl_publishing_account (business_profile_id);

ALTER TABLE tbl_ad_oauth_state DROP CONSTRAINT IF EXISTS chk_ad_state_provider;
ALTER TABLE tbl_ad_oauth_state
    ADD CONSTRAINT chk_ad_state_provider CHECK (provider IN ('meta', 'tiktok', 'tiktok_creator'));
```

- [ ] **Step 4: Entity** — `PublishingAccount.java`:

```java
package com.ceview.module3.social;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One operator's credentials for publishing to one platform (V49). Token fields hold
 * ciphertext from {@link com.ceview.common.crypto.TokenCipher}; they must never be copied
 * into a DTO or a log line.
 */
@Data
@Entity
@Table(
    name = "tbl_publishing_account",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_publishing_account_profile_platform",
        columnNames = {"business_profile_id", "platform"}))
public class PublishingAccount {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_NEEDS_RECONNECT = "NEEDS_RECONNECT";
    public static final String STATUS_REVOKED = "REVOKED";

    @Id
    @Column(name = "account_id")
    private UUID accountId;

    @Column(name = "business_profile_id", nullable = false) private UUID businessProfileId;
    @Column(name = "platform", nullable = false, length = 20) private String platform;
    @Column(name = "external_id", nullable = false, length = 128) private String externalId;
    @Column(name = "display_name", length = 255) private String displayName;

    @ToString.Exclude
    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    @ToString.Exclude
    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    @Column(name = "token_expires_at") private OffsetDateTime tokenExpiresAt;
    @Column(name = "refresh_expires_at") private OffsetDateTime refreshExpiresAt;

    @Column(name = "scopes", columnDefinition = "TEXT") private String scopes;
    @Column(name = "status", nullable = false, length = 30) private String status;

    @Column(name = "connected_at") private OffsetDateTime connectedAt;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at") private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (accountId == null) accountId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (status == null) status = STATUS_ACTIVE;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 5: Repository** — `PublishingAccountRepository.java`:

```java
package com.ceview.module3.social;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Every query is scoped by profile: there is no way to read another tenant's account. */
public interface PublishingAccountRepository extends JpaRepository<PublishingAccount, UUID> {

    List<PublishingAccount> findByBusinessProfileId(UUID businessProfileId);

    Optional<PublishingAccount> findByBusinessProfileIdAndPlatform(UUID businessProfileId, String platform);
}
```

- [ ] **Step 6: Run to verify it passes** — `./mvnw -q test -Dtest=PublishingAccountRepositoryTest`. Expected: 3 tests pass.
- [ ] **Step 7: EOL guard + Checkpoint.**

---

### Task 2: State tokens keyed by a provider string

**Files:** Modify `module4/adconnections/AdConnectionService.java`; Test `module4/adconnections/AdConnectionServiceProviderKeyTest.java`.

- [ ] **Step 1: Failing test** — `AdConnectionServiceProviderKeyTest.java`:

```java
package com.ceview.module4.adconnections;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The TikTok creator login (module3) reuses the OAuth state table under its own key. */
@SpringBootTest
class AdConnectionServiceProviderKeyTest {

    @Autowired private AdConnectionService service;

    @Test
    void aStateMintedForAKeyIsConsumedOnceForThatKey() {
        UUID profile = UUID.randomUUID();
        UUID state = service.mintState(profile, "tiktok_creator");

        assertThat(service.consumeState(state, "tiktok_creator")).isEqualTo(profile);
        assertThatThrownBy(() -> service.consumeState(state, "tiktok_creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already used");
    }

    @Test
    void aStateCannotBeConsumedForADifferentKey() {
        UUID state = service.mintState(UUID.randomUUID(), "tiktok_creator");

        assertThatThrownBy(() -> service.consumeState(state, "meta"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("different provider");
    }

    @Test
    void theEnumOverloadsStillWork() {
        UUID profile = UUID.randomUUID();
        UUID state = service.mintState(profile, AdProvider.META);

        assertThat(service.consumeState(state, AdProvider.META)).isEqualTo(profile);
    }
}
```

- [ ] **Step 2: Run** — `./mvnw -q test -Dtest=AdConnectionServiceProviderKeyTest`. Expected: FAIL (compile: no `mintState(UUID, String)`).

- [ ] **Step 3: Implement** — in `AdConnectionService.java`, replace the existing `mintState` and `consumeState` methods so the enum versions delegate to new `String` versions. The bodies stay identical except `provider.key()` becomes `providerKey`:

```java
    /** Creates the single-use token that carries this operator's identity through the un-authenticated callback. */
    @Transactional
    public UUID mintState(UUID businessProfileId, AdProvider provider) {
        return mintState(businessProfileId, provider.key());
    }

    /**
     * As above for callers whose login is not an {@link AdProvider} — e.g. the TikTok
     * <em>creator</em> login, key {@code tiktok_creator}. The key must satisfy
     * {@code chk_ad_state_provider} (V49).
     */
    @Transactional
    public UUID mintState(UUID businessProfileId, String providerKey) {
        // Opportunistic housekeeping — rows nobody came back for.
        stateRepo.deleteExpiredBefore(OffsetDateTime.now().minusDays(1));

        AdOAuthState state = new AdOAuthState();
        state.setBusinessProfileId(businessProfileId);
        state.setProvider(providerKey);
        state.setExpiresAt(OffsetDateTime.now().plus(STATE_TTL));
        return stateRepo.save(state).getState();
    }

    @Transactional
    public UUID consumeState(UUID state, AdProvider provider) {
        return consumeState(state, provider.key());
    }

    /** See the {@code AdProvider} overload for the atomic-burn rationale; unchanged here. */
    @Transactional
    public UUID consumeState(UUID state, String providerKey) {
        AdOAuthState row = stateRepo.findById(state)
                .orElseThrow(() -> new IllegalStateException("unknown oauth state"));

        if (row.getConsumedAt() != null) {
            throw new IllegalStateException("oauth state already used");
        }
        if (row.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalStateException("oauth state expired");
        }
        if (!row.getProvider().equals(providerKey)) {
            throw new IllegalStateException("oauth state was minted for a different provider");
        }

        int updated = stateRepo.markConsumedIfUnconsumed(state, OffsetDateTime.now());
        if (updated == 0) {
            // Someone else won the race (or it expired in the gap since the read above).
            throw new IllegalStateException("oauth state already used");
        }
        return row.getBusinessProfileId();
    }
```

Keep the existing long Javadoc on the enum `consumeState` (move it as-is above the enum overload). Do not change any other method in the file.

- [ ] **Step 4: Run** — `./mvnw -q test -Dtest='AdConnectionServiceProviderKeyTest,AdConnectionServiceTest,AdConnectionFlowTest,AdCallbackSecurityTest'`. Expected: all pass.
- [ ] **Step 5: EOL guard + Checkpoint.**

---

### Task 3: Meta — request the full scope list and record the *granted* scopes

**Files:** Modify `module4/adconnections/client/MetaAdsClient.java`, `…/test/…/client/MetaAdsClientAuthorizeUrlTest.java`, `…/client/MetaAdsClientTokenTest.java`.

Read the two tests and `MetaAdsClient.java` first. The current scope is the single constant `SCOPE = "ads_read"`; `buildAuthorizeUrl` sends it, and `exchangeCode` returns `new TokenGrant(longToken, null, expiresAt, SCOPE)`.

- [ ] **Step 1: Update/add tests (they fail first).**
  1. `MetaAdsClientAuthorizeUrlTest`: change the assertion `decoded.contains("scope=ads_read")` to assert the URL's decoded query contains every entry of `MetaAdsClient.REQUESTED_SCOPES` joined by commas:
     ```java
     assertTrue(decoded.contains("scope=" + String.join(",", MetaAdsClient.REQUESTED_SCOPES)), decoded);
     assertTrue(MetaAdsClient.REQUESTED_SCOPES.containsAll(MetaAdsClient.PUBLISH_SCOPES));
     assertTrue(MetaAdsClient.REQUESTED_SCOPES.contains("ads_read"));
     ```
  2. `MetaAdsClientTokenTest`: `exchangeCode` now makes a **third** request, `GET /me/permissions`. In every test in that class that calls `exchangeCode`, enqueue a third JSON response after the two existing ones. In the test that currently asserts `assertEquals("ads_read", grant.scopes())`, enqueue
     `{"data":[{"permission":"ads_read","status":"granted"},{"permission":"pages_show_list","status":"granted"},{"permission":"instagram_content_publish","status":"declined"}]}`
     and assert `assertEquals("ads_read,pages_show_list", grant.scopes());` (declined permissions are not recorded). Add:
     ```java
     @Test
     void failsWhenThePermissionsLookupFails() throws Exception {
         // short-lived token, long-lived token, then a 400 from /me/permissions
         server.enqueue(json("{\"access_token\":\"SHORT\"}"));
         server.enqueue(json("{\"access_token\":\"LONG\",\"expires_in\":5184000}"));
         server.enqueue(new MockResponse().setResponseCode(400).setBody("{\"error\":{\"message\":\"Invalid OAuth access token.\"}}"));

         AdPlatformException e = assertThrows(AdPlatformException.class, () -> client.exchangeCode("CODE"));

         assertFalse(e.getMessage().contains("LONG"), "the token must never appear in an error message");
     }
     ```
     (use the class's existing helper for building JSON responses; if it is named differently adapt the call).

- [ ] **Step 2: Run** `./mvnw -q test -Dtest='MetaAdsClientAuthorizeUrlTest,MetaAdsClientTokenTest'`. Expected: FAIL.

- [ ] **Step 3: Implement** in `MetaAdsClient.java`.
  1. Replace the `SCOPE` constant (and its doc comment) with:
     ```java
     /**
      * Everything the single Meta login asks for: ad reporting (Module 4), Page and
      * Instagram publishing (Module 3), ad creation, and post insights. Which of these the
      * operator actually grants is read back from /me/permissions after the exchange.
      */
     public static final List<String> REQUESTED_SCOPES = List.of(
             "ads_read", "ads_management", "business_management",
             "pages_show_list", "pages_read_engagement", "pages_manage_posts", "read_insights",
             "instagram_basic", "instagram_content_publish", "instagram_manage_insights");

     /** The subset a connection must hold before CeView will publish to a Page / Instagram account. */
     public static final Set<String> PUBLISH_SCOPES = Set.of(
             "pages_show_list", "pages_read_engagement", "pages_manage_posts",
             "instagram_basic", "instagram_content_publish");
     ```
     (`java.util.List`/`Set` are already imported.)
  2. In `buildAuthorizeUrl` change `.queryParam("scope", encode(SCOPE))` to `.queryParam("scope", encode(String.join(",", REQUESTED_SCOPES)))`.
  3. In `exchangeCode`, after the long-lived token and `expiresAt` are computed and before the final `log.info`/`return`, add:
     ```java
        String granted = grantedScopes(longToken);
        log.info("[Module4] Meta token exchanged, expires_at={}, granted={}", expiresAt, granted);
        return new TokenGrant(longToken, null, expiresAt, granted);
     ```
     and delete the old `log.info`/`return new TokenGrant(…, SCOPE)` lines. Add the helper:
     ```java
    /** The permissions the operator actually granted (they can untick some on Meta's dialog). */
    private String grantedScopes(String accessToken) {
        JsonNode response = getJson("/me/permissions", uri -> uri
                .queryParam("access_token", encode(accessToken)));
        List<String> granted = new ArrayList<>();
        JsonNode data = response.get("data");
        if (data != null && data.isArray()) {
            for (JsonNode p : data) {
                if ("granted".equals(text(p, "status")) && text(p, "permission") != null) {
                    granted.add(text(p, "permission"));
                }
            }
        }
        return String.join(",", granted);
    }
     ```
  4. Remove any remaining reference to `SCOPE`.

- [ ] **Step 4: Run** `./mvnw -q test -Dtest='MetaAdsClient*Test,AdConnection*Test'`. Expected: all pass.
- [ ] **Step 5: EOL guard + Checkpoint.**

---

### Task 4: `MetaGraphClient` — list Pages and their linked Instagram accounts

**Files:** Create `module3/social/SocialPlatformException.java`, `module3/social/client/MetaGraphClient.java`; Test `module3/social/client/MetaGraphClientTest.java`.

- [ ] **Step 1: Failing test** — `MetaGraphClientTest.java`:

```java
package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MetaGraphClientTest {

    private MockWebServer server;
    private MetaGraphClient client;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        client = new MetaGraphClient(server.url("/v21.0").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    private static MockResponse json(String body) {
        return new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(body);
    }

    @Test
    void parsesPagesWithAndWithoutALinkedInstagramAccount() {
        server.enqueue(json("""
            {"data":[
              {"id":"111","name":"Cebu Dive Co.","access_token":"PAGE-TOKEN-1",
               "instagram_business_account":{"id":"179","username":"cebu.dive"}},
              {"id":"222","name":"Mactan Cafe","access_token":"PAGE-TOKEN-2"}
            ]}"""));

        List<PageInfo> pages = client.listPages("USER-TOKEN");

        assertThat(pages).hasSize(2);
        assertThat(pages.get(0).id()).isEqualTo("111");
        assertThat(pages.get(0).name()).isEqualTo("Cebu Dive Co.");
        assertThat(pages.get(0).accessToken()).isEqualTo("PAGE-TOKEN-1");
        assertThat(pages.get(0).instagramId()).isEqualTo("179");
        assertThat(pages.get(0).instagramUsername()).isEqualTo("cebu.dive");
        assertThat(pages.get(1).instagramId()).isNull();
        assertThat(pages.get(1).instagramUsername()).isNull();
    }

    @Test
    void asksForTheFieldsItParsesAndSendsTheUserToken() throws Exception {
        server.enqueue(json("{\"data\":[]}"));

        client.listPages("USER-TOKEN");

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertThat(path).startsWith("/v21.0/me/accounts?");
        assertThat(path).contains("access_token=USER-TOKEN");
        assertThat(path).contains("instagram_business_account{id,username}");
        assertThat(path).contains("access_token,instagram_business_account");
    }

    @Test
    void anEmptyAccountYieldsAnEmptyList() {
        server.enqueue(json("{\"data\":[]}"));

        assertThat(client.listPages("USER-TOKEN")).isEmpty();
    }

    @Test
    void surfacesMetasErrorMessageWithoutLeakingTheToken() {
        server.enqueue(new MockResponse().setResponseCode(400)
                .setBody("{\"error\":{\"message\":\"Invalid OAuth access token.\",\"code\":190}}"));

        assertThatThrownBy(() -> client.listPages("USER-TOKEN-SECRET"))
                .isInstanceOf(SocialPlatformException.class)
                .hasMessageContaining("Invalid OAuth access token")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("USER-TOKEN-SECRET"));
    }

    @Test
    void pageInfoToStringNeverPrintsTheToken() {
        PageInfo page = new PageInfo("111", "Cebu Dive Co.", "PAGE-TOKEN-1", null, null);

        assertThat(page.toString()).doesNotContain("PAGE-TOKEN-1");
    }
}
```

- [ ] **Step 2: Run** `./mvnw -q test -Dtest=MetaGraphClientTest`. Expected: FAIL (classes missing).

- [ ] **Step 3: `SocialPlatformException.java`**

```java
package com.ceview.module3.social;

/**
 * Any failure talking to a social platform (Meta Graph, TikTok): transport, non-2xx, an
 * in-body error, or an unparseable payload. The message is shown to operators, so it must
 * never contain a token or a client secret.
 */
public class SocialPlatformException extends RuntimeException {

    public SocialPlatformException(String message) {
        super(message);
    }

    public SocialPlatformException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 4: `MetaGraphClient.java`**

```java
package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Meta Graph API calls for publishing: which Facebook Pages the operator administers and
 * which Instagram business account (if any) each is linked to.
 *
 * <p>Builds its own {@link WebClient} with an explicit timeout, like the ad-platform clients.
 * The Graph base URL is injected so tests can point it at a MockWebServer.
 */
@Component
public class MetaGraphClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    /**
     * One administered Page. {@code accessToken} is the Page token CeView publishes with
     * (null if Meta withheld it, i.e. the permission was not granted).
     */
    public record PageInfo(String id, String name, String accessToken,
                           String instagramId, String instagramUsername) {
        /** Never prints the token. */
        @Override
        public String toString() {
            return "PageInfo[id=" + id + ", name=" + name + ", instagramId=" + instagramId + "]";
        }
    }

    private final String graphBaseUrl;
    private final WebClient http = WebClient.builder().build();
    private final ObjectMapper mapper = new ObjectMapper();

    public MetaGraphClient(
            @Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v21.0}") String graphBaseUrl) {
        this.graphBaseUrl = graphBaseUrl;
    }

    /** The Pages this user token administers, with each Page's linked Instagram account. */
    public List<PageInfo> listPages(String userAccessToken) {
        URI uri = UriComponentsBuilder.fromUriString(graphBaseUrl + "/me/accounts")
                .queryParam("fields", encode("id,name,access_token,instagram_business_account{id,username}"))
                .queryParam("limit", 100)
                .queryParam("access_token", encode(userAccessToken))
                .build(true)
                .toUri();

        JsonNode root = get(uri);
        List<PageInfo> pages = new ArrayList<>();
        JsonNode data = root.get("data");
        if (data != null && data.isArray()) {
            for (JsonNode page : data) {
                JsonNode ig = page.get("instagram_business_account");
                pages.add(new PageInfo(
                        text(page, "id"),
                        text(page, "name"),
                        text(page, "access_token"),
                        ig == null ? null : text(ig, "id"),
                        ig == null ? null : text(ig, "username")));
            }
        }
        return pages;
    }

    private JsonNode get(URI uri) {
        String body;
        try {
            body = http.get().uri(uri).retrieve().bodyToMono(String.class).block(TIMEOUT);
        } catch (WebClientResponseException e) {
            throw new SocialPlatformException("Meta API " + e.getStatusCode() + ": "
                    + extractErrorMessage(e.getResponseBodyAsString()), e);
        } catch (Exception e) {
            // Deliberately does not interpolate the URI — it carries the access token.
            throw new SocialPlatformException("Meta API call failed: " + e.getClass().getSimpleName(), e);
        }
        try {
            return mapper.readTree(body == null ? "{}" : body);
        } catch (Exception e) {
            throw new SocialPlatformException("Meta returned a non-JSON response", e);
        }
    }

    private String extractErrorMessage(String body) {
        try {
            JsonNode error = mapper.readTree(body).get("error");
            if (error != null && error.get("message") != null) {
                return error.get("message").asText();
            }
        } catch (Exception ignored) {
            // fall through
        }
        return body == null || body.isBlank() ? "(empty body)" : "(unreadable error body)";
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
```

- [ ] **Step 5: Run** `./mvnw -q test -Dtest=MetaGraphClientTest`. Expected: 5 tests pass.
- [ ] **Step 6: EOL guard + Checkpoint.**

---

### Task 5: `TikTokContentClient` and its configuration

**Files:** Create `module3/social/client/TikTokContentClient.java`; Modify `application.yml`, `backend/.env.example`; Test `module3/social/client/TikTokContentClientTest.java`.

- [ ] **Step 1: Failing test** — `TikTokContentClientTest.java`:

```java
package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TikTokContentClientTest {

    private MockWebServer server;
    private TikTokContentClient client;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        String base = server.url("").toString().replaceAll("/$", "");
        client = new TikTokContentClient("KEY123", "SECRET456", base, base + "/v2/auth/authorize/",
                "https://tunnel.example.com");
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    private static MockResponse json(int code, String body) {
        return new MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body);
    }

    @Test
    void isConfiguredOnlyWithBothCredentials() {
        assertThat(client.isConfigured()).isTrue();
        assertThat(new TikTokContentClient("", "S", "http://x", "http://x/a", "https://t").isConfigured()).isFalse();
        assertThat(new TikTokContentClient("K", "", "http://x", "http://x/a", "https://t").isConfigured()).isFalse();
    }

    @Test
    void callbackUrlIsTheSocialConnectionsEndpoint() {
        assertThat(client.callbackUrl())
                .isEqualTo("https://tunnel.example.com/api/social-connections/tiktok/callback");
    }

    @Test
    void authorizeUrlCarriesKeyScopesRedirectAndState() {
        String url = URLDecoder.decode(client.buildAuthorizeUrl("STATE-1"), StandardCharsets.UTF_8);

        assertThat(url).contains("/v2/auth/authorize/?");
        assertThat(url).contains("client_key=KEY123");
        assertThat(url).contains("scope=user.info.basic,video.upload,video.list");
        assertThat(url).contains("response_type=code");
        assertThat(url).contains("redirect_uri=https://tunnel.example.com/api/social-connections/tiktok/callback");
        assertThat(url).contains("state=STATE-1");
        assertThat(url).doesNotContain("SECRET456");
    }

    @Test
    void exchangesTheCodeForATokenAndRecordsLifetimes() throws Exception {
        server.enqueue(json(200, """
            {"access_token":"ACCESS-1","expires_in":86400,"open_id":"OPEN-1",
             "refresh_token":"REFRESH-1","refresh_expires_in":31536000,
             "scope":"user.info.basic,video.upload","token_type":"Bearer"}"""));

        CreatorGrant grant = client.exchangeCode("CODE-1");

        assertThat(grant.accessToken()).isEqualTo("ACCESS-1");
        assertThat(grant.refreshToken()).isEqualTo("REFRESH-1");
        assertThat(grant.openId()).isEqualTo("OPEN-1");
        assertThat(grant.scopes()).isEqualTo("user.info.basic,video.upload");
        assertThat(grant.accessExpiresAt()).isNotNull();
        assertThat(grant.refreshExpiresAt()).isAfter(grant.accessExpiresAt());

        RecordedRequest request = server.takeRequest();
        assertThat(request.getMethod()).isEqualTo("POST");
        assertThat(request.getPath()).isEqualTo("/v2/oauth/token/");
        assertThat(request.getHeader("Content-Type")).startsWith("application/x-www-form-urlencoded");
        String body = URLDecoder.decode(request.getBody().readUtf8(), StandardCharsets.UTF_8);
        assertThat(body).contains("client_key=KEY123").contains("client_secret=SECRET456")
                .contains("code=CODE-1").contains("grant_type=authorization_code")
                .contains("redirect_uri=https://tunnel.example.com/api/social-connections/tiktok/callback");
    }

    @Test
    void anErrorBodyBecomesAnExceptionWithoutLeakingSecrets() {
        server.enqueue(json(400, "{\"error\":\"invalid_grant\",\"error_description\":\"Authorization code is expired.\"}"));

        assertThatThrownBy(() -> client.exchangeCode("CODE-1"))
                .isInstanceOf(SocialPlatformException.class)
                .hasMessageContaining("Authorization code is expired")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("SECRET456").doesNotContain("CODE-1"));
    }

    @Test
    void aResponseWithoutAnAccessTokenIsAnError() {
        server.enqueue(json(200, "{\"open_id\":\"OPEN-1\"}"));

        assertThatThrownBy(() -> client.exchangeCode("CODE-1")).isInstanceOf(SocialPlatformException.class);
    }

    @Test
    void readsTheDisplayNameWithABearerToken() throws Exception {
        server.enqueue(json(200, "{\"data\":{\"user\":{\"open_id\":\"OPEN-1\",\"display_name\":\"Cebu Dive\"}},\"error\":{\"code\":\"ok\"}}"));

        assertThat(client.fetchDisplayName("ACCESS-1")).isEqualTo("Cebu Dive");

        RecordedRequest request = server.takeRequest();
        assertThat(request.getHeader("Authorization")).isEqualTo("Bearer ACCESS-1");
        assertThat(URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8))
                .startsWith("/v2/user/info/?fields=open_id,display_name");
    }

    @Test
    void aFailedProfileLookupYieldsNullInsteadOfFailingTheConnection() {
        server.enqueue(json(401, "{\"error\":{\"code\":\"access_token_invalid\"}}"));

        assertThat(client.fetchDisplayName("ACCESS-1")).isNull();
    }
}
```

- [ ] **Step 2: Run** `./mvnw -q test -Dtest=TikTokContentClientTest`. Expected: FAIL (class missing).

- [ ] **Step 3: Implement `TikTokContentClient.java`**

```java
package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * TikTok for Developers — Login Kit + Content Posting API credentials for publishing.
 *
 * <p>This is NOT the TikTok For Business ads app ({@code TikTokAdsClient}); it is a separate
 * developer app with its own client key/secret ({@code ceview.social.tiktok.*}).
 * Token <em>refresh</em> arrives with publishing (Phase 3): access tokens last about a day.
 */
@Component
public class TikTokContentClient {

    private static final Logger log = LoggerFactory.getLogger(TikTokContentClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    /** Login Kit identity + Content Posting API (inbox upload) + reading the creator's videos. */
    public static final String SCOPE = "user.info.basic,video.upload,video.list";

    /** A creator login's tokens. {@code toString} never prints them. */
    public record CreatorGrant(String accessToken, String refreshToken,
                               OffsetDateTime accessExpiresAt, OffsetDateTime refreshExpiresAt,
                               String openId, String scopes) {
        @Override
        public String toString() {
            return "CreatorGrant[openId=" + openId + ", scopes=" + scopes + "]";
        }
    }

    private final String clientKey;
    private final String clientSecret;
    private final String apiBaseUrl;
    private final String authorizeUrl;
    private final String redirectBaseUrl;
    private final WebClient http = WebClient.builder().build();
    private final ObjectMapper mapper = new ObjectMapper();

    public TikTokContentClient(
            @Value("${ceview.social.tiktok.client-key:}") String clientKey,
            @Value("${ceview.social.tiktok.client-secret:}") String clientSecret,
            @Value("${ceview.social.tiktok.api-base-url:https://open.tiktokapis.com}") String apiBaseUrl,
            @Value("${ceview.social.tiktok.authorize-url:https://www.tiktok.com/v2/auth/authorize/}") String authorizeUrl,
            @Value("${ceview.adplatform.redirect-base-url:}") String redirectBaseUrl) {
        this.clientKey = clientKey;
        this.clientSecret = clientSecret;
        this.apiBaseUrl = apiBaseUrl;
        this.authorizeUrl = authorizeUrl;
        this.redirectBaseUrl = redirectBaseUrl;
    }

    public boolean isConfigured() {
        return notBlank(clientKey) && notBlank(clientSecret);
    }

    /** The exact redirect URI that must also be registered in the TikTok developer portal. */
    public String callbackUrl() {
        String base = redirectBaseUrl.endsWith("/")
                ? redirectBaseUrl.substring(0, redirectBaseUrl.length() - 1) : redirectBaseUrl;
        return base + "/api/social-connections/tiktok/callback";
    }

    public String buildAuthorizeUrl(String state) {
        // Pre-encode each value, then tell the builder not to re-encode (see MetaAdsClient for why).
        return UriComponentsBuilder.fromUriString(authorizeUrl)
                .queryParam("client_key", encode(clientKey))
                .queryParam("scope", encode(SCOPE))
                .queryParam("response_type", "code")
                .queryParam("redirect_uri", encode(callbackUrl()))
                .queryParam("state", encode(state))
                .build(true)
                .toUriString();
    }

    public CreatorGrant exchangeCode(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_key", clientKey);
        form.add("client_secret", clientSecret);
        form.add("code", code);
        form.add("grant_type", "authorization_code");
        form.add("redirect_uri", callbackUrl());

        String body;
        try {
            // exchangeToMono: TikTok reports OAuth failures as a JSON body on a 4xx — read it either way.
            body = http.post().uri(apiBaseUrl + "/v2/oauth/token/")
                    .body(BodyInserters.fromFormData(form))
                    .exchangeToMono(response -> response.bodyToMono(String.class))
                    .block(TIMEOUT);
        } catch (Exception e) {
            // Deliberately omits the request — it carries the client secret and the code.
            throw new SocialPlatformException("TikTok token call failed: " + e.getClass().getSimpleName(), e);
        }

        JsonNode json = parse(body);
        String error = text(json, "error");
        if (error != null && !error.isBlank()) {
            String description = text(json, "error_description");
            throw new SocialPlatformException("TikTok rejected the authorization: "
                    + (description != null ? description : error));
        }
        String accessToken = text(json, "access_token");
        if (accessToken == null) {
            throw new SocialPlatformException("TikTok returned no access token");
        }
        return new CreatorGrant(
                accessToken,
                text(json, "refresh_token"),
                expiry(json, "expires_in"),
                expiry(json, "refresh_expires_in"),
                text(json, "open_id"),
                text(json, "scope"));
    }

    /** The creator's display name, or null if the lookup fails (never fatal to the connection). */
    public String fetchDisplayName(String accessToken) {
        try {
            String body = http.get().uri(apiBaseUrl + "/v2/user/info/?fields=open_id,display_name")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve().bodyToMono(String.class).block(TIMEOUT);
            return text(parse(body).path("data").path("user"), "display_name");
        } catch (Exception e) {
            log.warn("[Module3] TikTok profile lookup failed: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    private JsonNode parse(String body) {
        try {
            return mapper.readTree(body == null ? "{}" : body);
        } catch (Exception e) {
            throw new SocialPlatformException("TikTok returned a non-JSON response", e);
        }
    }

    private static OffsetDateTime expiry(JsonNode json, String field) {
        JsonNode seconds = json.get(field);
        return seconds != null && seconds.isNumber() ? OffsetDateTime.now().plusSeconds(seconds.asLong()) : null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
```

- [ ] **Step 4: Config** — in `application.yml`, directly before the `  media:` block (under `ceview:`), add:

```yaml
  social:
    tiktok:
      # TikTok for Developers app (Login Kit + Content Posting API) — NOT the TikTok For Business
      # ads app above. Blank = the TikTok publishing connection reports "not configured".
      client-key: ${TIKTOK_CONTENT_CLIENT_KEY:}
      client-secret: ${TIKTOK_CONTENT_CLIENT_SECRET:}
```

In `backend/.env.example`, after the `MEDIA_*` block added in Phase 1, add:

```
# TikTok for Developers app (publishing) — docs/SOCIAL_PUBLISHING_SETUP.md §C. Separate from TIKTOK_APP_ID above.
# TIKTOK_CONTENT_CLIENT_KEY=
# TIKTOK_CONTENT_CLIENT_SECRET=
```

- [ ] **Step 5: Run** `./mvnw -q test -Dtest=TikTokContentClientTest`. Expected: 8 tests pass. (If `server.url("")` does not give a usable base on this MockWebServer version, build `base` from `"http://" + server.getHostName() + ":" + server.getPort()`.)
- [ ] **Step 6: EOL guard + Checkpoint.**

---

### Task 6: `SocialConnectionService` and DTOs

**Files:** Create `module3/social/SocialDtos.java`, `module3/social/SocialConnectionService.java`; Test `module3/social/SocialConnectionServiceTest.java`.

- [ ] **Step 1: DTOs** — `SocialDtos.java`:

```java
package com.ceview.module3.social;

import jakarta.validation.constraints.NotBlank;

import java.time.OffsetDateTime;

/** Request/response shapes for /api/social-connections. Nothing here carries a token. */
public final class SocialDtos {

    private SocialDtos() {}

    public static final String STATUS_DISCONNECTED = "DISCONNECTED";
    public static final String STATUS_NEEDS_RECONNECT = "NEEDS_RECONNECT";
    public static final String STATUS_NEEDS_PAGE = "NEEDS_PAGE";
    public static final String STATUS_NO_LINKED_INSTAGRAM = "NO_LINKED_INSTAGRAM";
    public static final String STATUS_ACTIVE = "ACTIVE";

    /**
     * One row of GET /api/social-connections.
     *
     * @param configured whether THIS SERVER has credentials for the platform's app
     * @param handle     the Page name, "@instagram_username", or TikTok display name
     */
    public record SocialConnectionView(String platform, boolean configured, String status,
                                       String handle, OffsetDateTime connectedAt) {}

    /** One selectable Facebook Page. */
    public record PageOption(String id, String name, String instagramUsername) {}

    public record SelectPageRequest(@NotBlank String pageId) {}
}
```

- [ ] **Step 2: Failing test** — `SocialConnectionServiceTest.java`:

```java
package com.ceview.module3.social;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.social.SocialDtos.PageOption;
import com.ceview.module3.social.SocialDtos.SocialConnectionView;
import com.ceview.module3.social.client.MetaGraphClient;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
class SocialConnectionServiceTest {

    private static final String ALL_PUBLISH_SCOPES =
            "ads_read,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";

    @Autowired private SocialConnectionService service;
    @Autowired private PublishingAccountRepository accountRepo;
    @Autowired private AdPlatformConnectionRepository metaRepo;
    @Autowired private TokenCipher cipher;
    @MockBean private MetaGraphClient graph;

    private UUID profile;

    @BeforeEach
    void setUp() {
        accountRepo.deleteAll();
        metaRepo.deleteAll();
        profile = UUID.randomUUID();
    }

    private void metaLogin(UUID profileId, String scopes, OffsetDateTime expiresAt) {
        AdPlatformConnection c = new AdPlatformConnection();
        c.setBusinessProfileId(profileId);
        c.setProvider("meta");
        c.setAccessTokenEncrypted(cipher.encrypt("USER-TOKEN"));
        c.setScopes(scopes);
        c.setTokenExpiresAt(expiresAt);
        c.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        metaRepo.save(c);
    }

    private SocialConnectionView row(List<SocialConnectionView> views, String platform) {
        return views.stream().filter(v -> v.platform().equals(platform)).findFirst().orElseThrow();
    }

    private static PageInfo page(String id, String name, String igId, String igUser) {
        return new PageInfo(id, name, "PAGE-TOKEN-" + id, igId, igUser);
    }

    @Test
    void aFreshProfileSeesAllThreePlatformsDisconnected() {
        List<SocialConnectionView> views = service.list(profile);

        assertThat(views).extracting(SocialConnectionView::platform)
                .containsExactly("facebook", "instagram", "tiktok");
        assertThat(views).allSatisfy(v -> assertThat(v.status()).isEqualTo("DISCONNECTED"));
    }

    @Test
    void anAdsOnlyMetaLoginNeedsAReconnectToPublish() {
        metaLogin(profile, "ads_read", null);

        List<SocialConnectionView> views = service.list(profile);

        assertThat(row(views, "facebook").status()).isEqualTo("NEEDS_RECONNECT");
        assertThat(row(views, "instagram").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void anExpiredMetaTokenNeedsAReconnect() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, OffsetDateTime.now().minusDays(1));

        assertThat(row(service.list(profile), "facebook").status()).isEqualTo("NEEDS_RECONNECT");
    }

    @Test
    void aPublishCapableMetaLoginWithoutAPageNeedsAPage() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, OffsetDateTime.now().plusDays(50));

        List<SocialConnectionView> views = service.list(profile);

        assertThat(row(views, "facebook").status()).isEqualTo("NEEDS_PAGE");
        assertThat(row(views, "instagram").status()).isEqualTo("NEEDS_PAGE");
    }

    @Test
    void listPagesReturnsOptionsWithoutTokens() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                page("111", "Cebu Dive Co.", "179", "cebu.dive"), page("222", "Mactan Cafe", null, null)));

        List<PageOption> pages = service.listPages(profile);

        assertThat(pages).containsExactly(
                new PageOption("111", "Cebu Dive Co.", "cebu.dive"), new PageOption("222", "Mactan Cafe", null));
    }

    @Test
    void listPagesWithoutAMetaLoginIsAConflict() {
        assertThatThrownBy(() -> service.listPages(profile))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void selectingAPageWithInstagramActivatesBothAndEncryptsTheToken() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive")));

        service.selectPage(profile, "111");

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("ACTIVE");
        assertThat(row(views, "facebook").handle()).isEqualTo("Cebu Dive Co.");
        assertThat(row(views, "instagram").status()).isEqualTo("ACTIVE");
        assertThat(row(views, "instagram").handle()).isEqualTo("@cebu.dive");

        PublishingAccount fb = accountRepo.findByBusinessProfileIdAndPlatform(profile, "facebook").orElseThrow();
        assertThat(fb.getExternalId()).isEqualTo("111");
        assertThat(fb.getAccessTokenEncrypted()).isNotEqualTo("PAGE-TOKEN-111");
        assertThat(cipher.decrypt(fb.getAccessTokenEncrypted())).isEqualTo("PAGE-TOKEN-111");
        PublishingAccount ig = accountRepo.findByBusinessProfileIdAndPlatform(profile, "instagram").orElseThrow();
        assertThat(ig.getExternalId()).isEqualTo("179");
        assertThat(cipher.decrypt(ig.getAccessTokenEncrypted())).isEqualTo("PAGE-TOKEN-111");
    }

    @Test
    void aPageWithoutALinkedInstagramLeavesInstagramNeedingALink() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("222", "Mactan Cafe", null, null)));

        service.selectPage(profile, "222");

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("ACTIVE");
        assertThat(row(views, "instagram").status()).isEqualTo("NO_LINKED_INSTAGRAM");
    }

    @Test
    void switchingToAPageWithoutInstagramRevokesTheOldInstagramRow() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                page("111", "Cebu Dive Co.", "179", "cebu.dive"), page("222", "Mactan Cafe", null, null)));
        service.selectPage(profile, "111");

        service.selectPage(profile, "222");

        assertThat(row(service.list(profile), "instagram").status()).isEqualTo("NO_LINKED_INSTAGRAM");
        assertThat(accountRepo.findByBusinessProfileIdAndPlatform(profile, "instagram").orElseThrow().getAccessTokenEncrypted())
                .isEmpty();
    }

    @Test
    void selectingAPageTheLoginCannotSeeIsRejected() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages(anyString())).thenReturn(List.of(page("111", "Cebu Dive Co.", null, null)));

        assertThatThrownBy(() -> service.selectPage(profile, "999"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(accountRepo.findAll()).isEmpty();
    }

    @Test
    void aPageMetaWithheldATokenForIsRejected() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages(anyString())).thenReturn(List.of(new PageInfo("111", "Cebu Dive Co.", null, null, null)));

        assertThatThrownBy(() -> service.selectPage(profile, "111"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void disconnectingFacebookRevokesBothRowsAndKeepsTheAdsConnection() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive")));
        service.selectPage(profile, "111");

        service.disconnect(profile, "facebook");

        List<SocialConnectionView> views = service.list(profile);
        assertThat(row(views, "facebook").status()).isEqualTo("NEEDS_PAGE");
        assertThat(row(views, "instagram").status()).isEqualTo("NEEDS_PAGE");
        assertThat(accountRepo.findByBusinessProfileId(profile))
                .allSatisfy(a -> {
                    assertThat(a.getStatus()).isEqualTo("REVOKED");
                    assertThat(a.getAccessTokenEncrypted()).isEmpty();
                });
        assertThat(metaRepo.findByBusinessProfileIdAndProvider(profile, "meta")).isPresent();
    }

    @Test
    void aTikTokGrantActivatesTheConnectionAndDisconnectClearsIt() {
        CreatorGrant grant = new CreatorGrant("ACCESS-1", "REFRESH-1",
                OffsetDateTime.now().plusDays(1), OffsetDateTime.now().plusDays(365), "OPEN-1", "user.info.basic");

        service.storeTikTokGrant(profile, grant, "Cebu Dive");

        SocialConnectionView tiktok = row(service.list(profile), "tiktok");
        assertThat(tiktok.status()).isEqualTo("ACTIVE");
        assertThat(tiktok.handle()).isEqualTo("Cebu Dive");
        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profile, "tiktok").orElseThrow();
        assertThat(cipher.decrypt(account.getAccessTokenEncrypted())).isEqualTo("ACCESS-1");
        assertThat(cipher.decrypt(account.getRefreshTokenEncrypted())).isEqualTo("REFRESH-1");

        service.disconnect(profile, "tiktok");

        assertThat(row(service.list(profile), "tiktok").status()).isEqualTo("DISCONNECTED");
    }

    @Test
    void reconnectingTikTokReplacesTheExistingRow() {
        CreatorGrant first = new CreatorGrant("A1", "R1", null, null, "OPEN-1", "s");
        CreatorGrant second = new CreatorGrant("A2", "R2", null, null, "OPEN-2", "s");

        service.storeTikTokGrant(profile, first, "First");
        service.storeTikTokGrant(profile, second, null);

        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profile, "tiktok").orElseThrow();
        assertThat(account.getExternalId()).isEqualTo("OPEN-2");
        assertThat(account.getDisplayName()).isEqualTo("TikTok account");
        assertThat(accountRepo.findByBusinessProfileId(profile)).hasSize(1);
    }

    @Test
    void anUnknownPlatformIsABadRequest() {
        assertThatThrownBy(() -> service.disconnect(profile, "myspace"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void anotherTenantSeesNothingOfMine() {
        metaLogin(profile, ALL_PUBLISH_SCOPES, null);
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(page("111", "Cebu Dive Co.", "179", "cebu.dive")));
        service.selectPage(profile, "111");

        List<SocialConnectionView> theirs = service.list(UUID.randomUUID());

        assertThat(theirs).allSatisfy(v -> assertThat(v.status()).isEqualTo("DISCONNECTED"));
    }
}
```

- [ ] **Step 3: Run** `./mvnw -q test -Dtest=SocialConnectionServiceTest`. Expected: FAIL (service missing).

- [ ] **Step 4: Implement `SocialConnectionService.java`**

```java
package com.ceview.module3.social;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module3.social.SocialDtos.PageOption;
import com.ceview.module3.social.SocialDtos.SocialConnectionView;
import com.ceview.module3.social.client.MetaGraphClient;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import com.ceview.module3.social.client.TikTokContentClient;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import com.ceview.module4.adconnections.client.MetaAdsClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Connection state for Facebook, Instagram and TikTok publishing.
 *
 * <p>Facebook and Instagram share one Meta login — the ads connection
 * ({@code tbl_ad_platform_connection}, provider {@code meta}) — plus the Page the operator
 * picks; their status is derived from both. TikTok has its own login.
 */
@Service
public class SocialConnectionService {

    private static final Logger log = LoggerFactory.getLogger(SocialConnectionService.class);

    public static final String FACEBOOK = "facebook";
    public static final String INSTAGRAM = "instagram";
    public static final String TIKTOK = "tiktok";
    private static final Set<String> PLATFORMS = Set.of(FACEBOOK, INSTAGRAM, TIKTOK);

    private final PublishingAccountRepository accountRepo;
    private final AdPlatformConnectionRepository metaRepo;
    private final TokenCipher cipher;
    private final MetaGraphClient graph;
    private final TikTokContentClient tiktok;
    private final AdProviderProperties adProps;

    public SocialConnectionService(PublishingAccountRepository accountRepo,
                                   AdPlatformConnectionRepository metaRepo,
                                   TokenCipher cipher,
                                   MetaGraphClient graph,
                                   TikTokContentClient tiktok,
                                   AdProviderProperties adProps) {
        this.accountRepo = accountRepo;
        this.metaRepo = metaRepo;
        this.cipher = cipher;
        this.graph = graph;
        this.tiktok = tiktok;
        this.adProps = adProps;
    }

    // ── reading ──────────────────────────────────────────────────────────────

    /** Always three rows, in a stable order, so the UI never has to guess. */
    @Transactional(readOnly = true)
    public List<SocialConnectionView> list(UUID profileId) {
        Map<String, PublishingAccount> accounts = accountRepo.findByBusinessProfileId(profileId).stream()
                .collect(Collectors.toMap(PublishingAccount::getPlatform, Function.identity()));
        Optional<AdPlatformConnection> meta = activeMeta(profileId);
        return List.of(
                metaView(FACEBOOK, meta, accounts),
                metaView(INSTAGRAM, meta, accounts),
                tiktokView(accounts.get(TIKTOK)));
    }

    private SocialConnectionView metaView(String platform, Optional<AdPlatformConnection> meta,
                                          Map<String, PublishingAccount> accounts) {
        boolean configured = adProps.isConfigured(AdProvider.META);
        if (meta.isEmpty()) {
            return view(platform, configured, SocialDtos.STATUS_DISCONNECTED, null, null);
        }
        if (!canPublish(meta.get())) {
            return view(platform, configured, SocialDtos.STATUS_NEEDS_RECONNECT, null, null);
        }
        PublishingAccount page = accounts.get(FACEBOOK);
        if (!isActive(page)) {
            return view(platform, configured, SocialDtos.STATUS_NEEDS_PAGE, null, null);
        }
        if (FACEBOOK.equals(platform)) {
            return view(platform, configured, SocialDtos.STATUS_ACTIVE, page.getDisplayName(), page.getConnectedAt());
        }
        PublishingAccount ig = accounts.get(INSTAGRAM);
        if (!isActive(ig)) {
            return view(platform, configured, SocialDtos.STATUS_NO_LINKED_INSTAGRAM, null, null);
        }
        return view(platform, configured, SocialDtos.STATUS_ACTIVE, ig.getDisplayName(), ig.getConnectedAt());
    }

    private SocialConnectionView tiktokView(PublishingAccount account) {
        boolean configured = tiktok.isConfigured();
        if (account == null || PublishingAccount.STATUS_REVOKED.equals(account.getStatus())) {
            return view(TIKTOK, configured, SocialDtos.STATUS_DISCONNECTED, null, null);
        }
        if (PublishingAccount.STATUS_NEEDS_RECONNECT.equals(account.getStatus())) {
            return view(TIKTOK, configured, SocialDtos.STATUS_NEEDS_RECONNECT, null, null);
        }
        return view(TIKTOK, configured, SocialDtos.STATUS_ACTIVE, account.getDisplayName(), account.getConnectedAt());
    }

    private static SocialConnectionView view(String platform, boolean configured, String status,
                                             String handle, OffsetDateTime connectedAt) {
        return new SocialConnectionView(platform, configured, status, handle, connectedAt);
    }

    private static boolean isActive(PublishingAccount a) {
        return a != null && PublishingAccount.STATUS_ACTIVE.equals(a.getStatus());
    }

    private Optional<AdPlatformConnection> activeMeta(UUID profileId) {
        return metaRepo.findByBusinessProfileIdAndProvider(profileId, AdProvider.META.key())
                .filter(c -> !AdPlatformConnection.STATUS_REVOKED.equals(c.getStatus()));
    }

    /** The login holds every publishing permission and has not expired. */
    private static boolean canPublish(AdPlatformConnection meta) {
        if (meta.getTokenExpiresAt() != null && meta.getTokenExpiresAt().isBefore(OffsetDateTime.now())) {
            return false;
        }
        Set<String> held = meta.getScopes() == null ? Set.of()
                : new HashSet<>(Arrays.asList(meta.getScopes().split("[,\\s]+")));
        return held.containsAll(MetaAdsClient.PUBLISH_SCOPES);
    }

    // ── Facebook Page / Instagram ────────────────────────────────────────────

    /** The Pages the Meta login administers, for the operator to choose from. */
    @Transactional(readOnly = true)
    public List<PageOption> listPages(UUID profileId) {
        AdPlatformConnection meta = requirePublishableMeta(profileId);
        try {
            return graph.listPages(cipher.decrypt(meta.getAccessTokenEncrypted())).stream()
                    .map(p -> new PageOption(p.id(), p.name(), p.instagramUsername()))
                    .toList();
        } catch (SocialPlatformException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    /**
     * Binds publishing to one Page (and its linked Instagram account, if any). The page id is
     * re-checked against what the login can really see — a posted id is never trusted.
     */
    @Transactional
    public void selectPage(UUID profileId, String pageId) {
        AdPlatformConnection meta = requirePublishableMeta(profileId);

        List<PageInfo> pages;
        try {
            pages = graph.listPages(cipher.decrypt(meta.getAccessTokenEncrypted()));
        } catch (SocialPlatformException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
        PageInfo chosen = pages.stream().filter(p -> pageId.equals(p.id())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "that Page is not available to this Meta connection"));
        if (chosen.accessToken() == null || chosen.accessToken().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Meta did not grant access to that Page — reconnect and allow Page access");
        }

        String encryptedPageToken = cipher.encrypt(chosen.accessToken());
        activate(profileId, FACEBOOK, chosen.id(), chosen.name(), encryptedPageToken, meta.getScopes());

        if (chosen.instagramId() != null) {
            activate(profileId, INSTAGRAM, chosen.instagramId(), "@" + chosen.instagramUsername(),
                    encryptedPageToken, meta.getScopes());
        } else {
            accountRepo.findByBusinessProfileIdAndPlatform(profileId, INSTAGRAM).ifPresent(this::revoke);
        }
        log.info("[Module3] profile={} chose Facebook Page {} (instagram linked: {})",
                profileId, chosen.id(), chosen.instagramId() != null);
    }

    private AdPlatformConnection requirePublishableMeta(UUID profileId) {
        AdPlatformConnection meta = activeMeta(profileId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "connect Meta first"));
        if (!canPublish(meta)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "reconnect Meta to grant the publishing permissions");
        }
        return meta;
    }

    // ── TikTok ───────────────────────────────────────────────────────────────

    /** Stores (or replaces) the TikTok creator login. {@code displayName} may be null. */
    @Transactional
    public void storeTikTokGrant(UUID profileId, CreatorGrant grant, String displayName) {
        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profileId, TIKTOK)
                .orElseGet(PublishingAccount::new);
        account.setBusinessProfileId(profileId);
        account.setPlatform(TIKTOK);
        account.setExternalId(grant.openId() != null ? grant.openId() : "unknown");
        account.setDisplayName(displayName != null && !displayName.isBlank() ? displayName : "TikTok account");
        account.setAccessTokenEncrypted(cipher.encrypt(grant.accessToken()));
        account.setRefreshTokenEncrypted(grant.refreshToken() == null ? null : cipher.encrypt(grant.refreshToken()));
        account.setTokenExpiresAt(grant.accessExpiresAt());
        account.setRefreshExpiresAt(grant.refreshExpiresAt());
        account.setScopes(grant.scopes());
        account.setStatus(PublishingAccount.STATUS_ACTIVE);
        account.setConnectedAt(OffsetDateTime.now());
        accountRepo.save(account);
        log.info("[Module3] stored TikTok creator grant for profile={}", profileId);
    }

    // ── disconnecting ────────────────────────────────────────────────────────

    /**
     * Discards the stored credentials. Facebook and Instagram are one grant, so disconnecting
     * either revokes both; the Meta ads connection is untouched.
     */
    @Transactional
    public void disconnect(UUID profileId, String platform) {
        if (!PLATFORMS.contains(platform)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown platform: " + platform);
        }
        List<String> targets = TIKTOK.equals(platform) ? List.of(TIKTOK) : List.of(FACEBOOK, INSTAGRAM);
        for (String target : targets) {
            accountRepo.findByBusinessProfileIdAndPlatform(profileId, target).ifPresent(this::revoke);
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void activate(UUID profileId, String platform, String externalId, String displayName,
                          String encryptedToken, String scopes) {
        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profileId, platform)
                .orElseGet(PublishingAccount::new);
        account.setBusinessProfileId(profileId);
        account.setPlatform(platform);
        account.setExternalId(externalId);
        account.setDisplayName(displayName);
        account.setAccessTokenEncrypted(encryptedToken);
        account.setRefreshTokenEncrypted(null);
        // A Page token minted from a long-lived user token does not expire.
        account.setTokenExpiresAt(null);
        account.setRefreshExpiresAt(null);
        account.setScopes(scopes);
        account.setStatus(PublishingAccount.STATUS_ACTIVE);
        account.setConnectedAt(OffsetDateTime.now());
        accountRepo.save(account);
    }

    private void revoke(PublishingAccount account) {
        account.setAccessTokenEncrypted("");
        account.setRefreshTokenEncrypted(null);
        account.setTokenExpiresAt(null);
        account.setRefreshExpiresAt(null);
        account.setStatus(PublishingAccount.STATUS_REVOKED);
        accountRepo.save(account);
    }
}
```

- [ ] **Step 5: Run** `./mvnw -q test -Dtest=SocialConnectionServiceTest`. Expected: 16 tests pass. Note `graph` is a `@MockBean`, so `MetaGraphClient`'s real bean is replaced; the real `TikTokContentClient` bean is used and is unconfigured by default.
- [ ] **Step 6: EOL guard + Checkpoint.**

---

### Task 7: `SocialConnectionController` and security wiring

**Files:** Create `module3/social/SocialConnectionController.java`; Modify `config/SecurityConfig.java`, `auth/ProfileCompletionFilter.java`; Test `module3/social/SocialConnectionControllerTest.java`.

- [ ] **Step 1: Failing test** — `SocialConnectionControllerTest.java`:

```java
package com.ceview.module3.social;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.social.client.MetaGraphClient;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import com.ceview.module3.social.client.TikTokContentClient;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import com.ceview.module4.adconnections.AdConnectionService;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.common.crypto.TokenCipher;
import com.ceview.testsupport.TestOperators;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "ceview.adplatform.frontend-base-url=http://localhost:5173",
        "ceview.adplatform.meta.app-id=test-meta-app",
        "ceview.adplatform.meta.app-secret=test-meta-secret"
})
class SocialConnectionControllerTest {

    private static final String PUBLISH_SCOPES =
            "ads_read,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private PublishingAccountRepository accountRepo;
    @Autowired private AdPlatformConnectionRepository metaRepo;
    @Autowired private AdConnectionService adConnectionService;
    @Autowired private TokenCipher cipher;
    @Autowired private TestOperators testOperators;
    @MockBean private MetaGraphClient graph;
    @MockBean private TikTokContentClient tiktok;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        accountRepo.deleteAll();
        metaRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorId = UUID.randomUUID();
        testOperators.create(operatorId);
        token = jwtService.issue(operatorId, "operator@example.com");
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();

        when(tiktok.isConfigured()).thenReturn(true);
    }

    private String bearer() {
        return "Bearer " + token;
    }

    private void metaLogin() {
        AdPlatformConnection c = new AdPlatformConnection();
        c.setBusinessProfileId(profileId);
        c.setProvider("meta");
        c.setAccessTokenEncrypted(cipher.encrypt("USER-TOKEN"));
        c.setScopes(PUBLISH_SCOPES);
        c.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        metaRepo.save(c);
    }

    @Test
    void listRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/social-connections")).andExpect(status().isUnauthorized());
    }

    @Test
    void listReportsAllThreePlatformsAndNeverLeaksTokens() throws Exception {
        metaLogin();
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                new PageInfo("111", "Cebu Dive Co.", "PAGE-TOKEN-SECRET", "179", "cebu.dive")));
        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"pageId\":\"111\"}")).andExpect(status().isOk());

        mvc.perform(get("/api/social-connections").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.platform=='facebook')].status").value("ACTIVE"))
                .andExpect(jsonPath("$[?(@.platform=='facebook')].handle").value("Cebu Dive Co."))
                .andExpect(jsonPath("$[?(@.platform=='instagram')].handle").value("@cebu.dive"))
                .andExpect(jsonPath("$[?(@.platform=='tiktok')].status").value("DISCONNECTED"))
                .andExpect(content().string(not(containsString("PAGE-TOKEN-SECRET"))))
                .andExpect(content().string(not(containsString("USER-TOKEN"))))
                .andExpect(content().string(not(containsString("ccessToken"))));
    }

    @Test
    void metaPagesIsAConflictBeforeMetaIsConnected() throws Exception {
        mvc.perform(get("/api/social-connections/meta/pages").header("Authorization", bearer()))
                .andExpect(status().isConflict());
    }

    @Test
    void metaPagesListsTheChoices() throws Exception {
        metaLogin();
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                new PageInfo("111", "Cebu Dive Co.", "T1", "179", "cebu.dive"),
                new PageInfo("222", "Mactan Cafe", "T2", null, null)));

        mvc.perform(get("/api/social-connections/meta/pages").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("111"))
                .andExpect(jsonPath("$[0].instagramUsername").value("cebu.dive"))
                .andExpect(jsonPath("$[1].instagramUsername").doesNotExist());
    }

    @Test
    void selectingAPageReturnsTheFreshConnectionList() throws Exception {
        metaLogin();
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(new PageInfo("222", "Mactan Cafe", "T2", null, null)));

        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"pageId\":\"222\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.platform=='facebook')].status").value("ACTIVE"))
                .andExpect(jsonPath("$[?(@.platform=='instagram')].status").value("NO_LINKED_INSTAGRAM"));
    }

    @Test
    void selectingAnUnknownPageIsABadRequest() throws Exception {
        metaLogin();
        when(graph.listPages(anyString())).thenReturn(List.of(new PageInfo("111", "X", "T", null, null)));

        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"pageId\":\"999\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void selectingWithoutAPageIdIsABadRequest() throws Exception {
        metaLogin();

        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void tiktokAuthorizeReturnsTheConsentUrl() throws Exception {
        when(tiktok.buildAuthorizeUrl(anyString())).thenReturn("https://www.tiktok.com/v2/auth/authorize/?client_key=K");

        mvc.perform(post("/api/social-connections/tiktok/authorize").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorizeUrl").value("https://www.tiktok.com/v2/auth/authorize/?client_key=K"));
    }

    @Test
    void tiktokAuthorizeIsUnavailableWhenTheServerHasNoCredentials() throws Exception {
        when(tiktok.isConfigured()).thenReturn(false);

        mvc.perform(post("/api/social-connections/tiktok/authorize").header("Authorization", bearer()))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void tiktokCallbackStoresTheGrantForTheOperatorWhoStartedItAndRedirects() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode("CODE-1")).thenReturn(new CreatorGrant(
                "ACCESS-1", "REFRESH-1", OffsetDateTime.now().plusDays(1), OffsetDateTime.now().plusDays(365), "OPEN-1", "s"));
        when(tiktok.fetchDisplayName("ACCESS-1")).thenReturn("Cebu Dive");

        // No Authorization header: the browser arrives straight from TikTok.
        mvc.perform(get("/api/social-connections/tiktok/callback").param("code", "CODE-1").param("state", state.toString()))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("http://localhost:5173/settings/platforms")))
                .andExpect(header().string("Location", containsString("social=tiktok")));

        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profileId, "tiktok").orElseThrow();
        assertThat(account.getDisplayName()).isEqualTo("Cebu Dive");
        assertThat(account.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void tiktokCallbackRejectsAReplayedState() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode("CODE-1")).thenReturn(new CreatorGrant("A", "R", null, null, "OPEN-1", "s"));
        mvc.perform(get("/api/social-connections/tiktok/callback").param("code", "CODE-1").param("state", state.toString()))
                .andExpect(status().isFound());

        mvc.perform(get("/api/social-connections/tiktok/callback").param("code", "CODE-1").param("state", state.toString()))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("social_error=invalid_state")));
    }

    @Test
    void tiktokCallbackRejectsAStateMintedForAnotherProvider() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "meta");

        mvc.perform(get("/api/social-connections/tiktok/callback").param("code", "CODE-1").param("state", state.toString()))
                .andExpect(header().string("Location", containsString("social_error=invalid_state")));
        assertThat(accountRepo.findAll()).isEmpty();
    }

    @Test
    void tiktokCallbackMapsOAuthErrorsToASafeBoundedCode() throws Exception {
        mvc.perform(get("/api/social-connections/tiktok/callback").param("error", "access_denied"))
                .andExpect(header().string("Location", containsString("social_error=access_denied")));

        mvc.perform(get("/api/social-connections/tiktok/callback").param("error", "<script>alert(1)</script>"))
                .andExpect(header().string("Location", containsString("social_error=consent_declined")))
                .andExpect(header().string("Location", not(containsString("script"))));
    }

    @Test
    void tiktokCallbackWithoutCodeOrStateRedirectsWithAnError() throws Exception {
        mvc.perform(get("/api/social-connections/tiktok/callback"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("social_error=missing_code_or_state")));
    }

    @Test
    void tiktokCallbackReportsAFailedTokenExchange() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode(anyString())).thenThrow(new SocialPlatformException("TikTok rejected the authorization"));

        mvc.perform(get("/api/social-connections/tiktok/callback").param("code", "BAD").param("state", state.toString()))
                .andExpect(header().string("Location", containsString("social_error=token_exchange_failed")));
        assertThat(accountRepo.findAll()).isEmpty();
    }

    @Test
    void disconnectRemovesTheConnection() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode(anyString())).thenReturn(new CreatorGrant("A", "R", null, null, "OPEN-1", "s"));
        mvc.perform(get("/api/social-connections/tiktok/callback").param("code", "C").param("state", state.toString()));

        mvc.perform(delete("/api/social-connections/tiktok").header("Authorization", bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/social-connections").header("Authorization", bearer()))
                .andExpect(jsonPath("$[?(@.platform=='tiktok')].status").value("DISCONNECTED"));
    }

    @Test
    void disconnectingAnUnknownPlatformIsABadRequest() throws Exception {
        mvc.perform(delete("/api/social-connections/myspace").header("Authorization", bearer()))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: Run** `./mvnw -q test -Dtest=SocialConnectionControllerTest`. Expected: FAIL (controller missing; the callback and PUT routes 404/401).

- [ ] **Step 3: Implement `SocialConnectionController.java`**

```java
package com.ceview.module3.social;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.social.SocialDtos.PageOption;
import com.ceview.module3.social.SocialDtos.SelectPageRequest;
import com.ceview.module3.social.SocialDtos.SocialConnectionView;
import com.ceview.module3.social.client.TikTokContentClient;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import com.ceview.module4.adconnections.AdConnectionDtos.AuthorizeUrlResponse;
import com.ceview.module4.adconnections.AdConnectionService;
import com.ceview.module4.adconnections.AdProviderProperties;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Facebook / Instagram / TikTok publishing connections.
 *
 * <p>Meta's login itself is {@code POST /api/ad-connections/meta/authorize} (one login for ads
 * and publishing); this controller adds choosing the Page, TikTok's own login, and the combined
 * status list. Every endpoint except the TikTok callback is JWT-authenticated and scoped to the
 * caller's profile; the callback carries its tenant in a single-use state token.
 */
@RestController
@RequestMapping("/api/social-connections")
public class SocialConnectionController {

    private static final Logger log = LoggerFactory.getLogger(SocialConnectionController.class);

    /** The state-table key for the TikTok creator login (see V49). */
    static final String TIKTOK_STATE_KEY = "tiktok_creator";

    /** OAuth error codes TikTok is known to send — safe to echo verbatim. */
    private static final Set<String> KNOWN_OAUTH_ERRORS = Set.of(
            "access_denied", "server_error", "temporarily_unavailable", "invalid_scope");

    private final CurrentBusinessProfile currentBusinessProfile;
    private final SocialConnectionService service;
    private final AdConnectionService stateService;
    private final TikTokContentClient tiktok;
    private final AdProviderProperties adProps;

    public SocialConnectionController(CurrentBusinessProfile currentBusinessProfile,
                                      SocialConnectionService service,
                                      AdConnectionService stateService,
                                      TikTokContentClient tiktok,
                                      AdProviderProperties adProps) {
        this.currentBusinessProfile = currentBusinessProfile;
        this.service = service;
        this.stateService = stateService;
        this.tiktok = tiktok;
        this.adProps = adProps;
    }

    @GetMapping
    public List<SocialConnectionView> list() {
        return service.list(currentBusinessProfile.resolveProfileId());
    }

    @GetMapping("/meta/pages")
    public List<PageOption> metaPages() {
        return service.listPages(currentBusinessProfile.resolveProfileId());
    }

    /** Chooses the Facebook Page (and its linked Instagram account); returns the fresh list. */
    @PutMapping("/meta/page")
    public List<SocialConnectionView> selectMetaPage(@Valid @RequestBody SelectPageRequest body) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        service.selectPage(profileId, body.pageId());
        return service.list(profileId);
    }

    @PostMapping("/tiktok/authorize")
    public AuthorizeUrlResponse tiktokAuthorize() {
        if (!tiktok.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SOCIAL_PROVIDER_NOT_CONFIGURED");
        }
        UUID state = stateService.mintState(currentBusinessProfile.resolveProfileId(), TIKTOK_STATE_KEY);
        return new AuthorizeUrlResponse(tiktok.buildAuthorizeUrl(state.toString()));
    }

    /**
     * TikTok's redirect target. Always answers with a 302 back to the frontend — never JSON —
     * because the caller is a browser mid-redirect. {@code error} is attacker-suppliable free
     * text on a public endpoint, so it is mapped to a bounded code before it reaches a URL.
     */
    @GetMapping("/tiktok/callback")
    public ResponseEntity<Void> tiktokCallback(@RequestParam(required = false) String code,
                                               @RequestParam(required = false) String state,
                                               @RequestParam(required = false) String error) {
        if (error != null && !error.isBlank()) {
            log.info("[Module3] TikTok callback returned an OAuth error: {}", error);
            return redirect("social_error", KNOWN_OAUTH_ERRORS.contains(error.toLowerCase())
                    ? error.toLowerCase() : "consent_declined");
        }
        if (code == null || code.isBlank() || state == null || state.isBlank()) {
            return redirect("social_error", "missing_code_or_state");
        }

        UUID profileId;
        try {
            profileId = stateService.consumeState(UUID.fromString(state), TIKTOK_STATE_KEY);
        } catch (IllegalArgumentException | IllegalStateException e) {
            log.info("[Module3] TikTok callback had an invalid state: {}", e.getMessage());
            return redirect("social_error", "invalid_state");
        }

        try {
            CreatorGrant grant = tiktok.exchangeCode(code);
            service.storeTikTokGrant(profileId, grant, tiktok.fetchDisplayName(grant.accessToken()));
        } catch (SocialPlatformException | IllegalStateException e) {
            log.warn("[Module3] TikTok token exchange failed: {}", e.getMessage());
            return redirect("social_error", "token_exchange_failed");
        }
        return redirect("social", "tiktok");
    }

    @DeleteMapping("/{platform}")
    public ResponseEntity<Void> disconnect(@PathVariable String platform) {
        service.disconnect(currentBusinessProfile.resolveProfileId(), platform);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<Void> redirect(String param, String value) {
        String url = UriComponentsBuilder.fromUriString(adProps.getFrontendBaseUrl())
                .path("/settings/platforms")
                .queryParam(param, value)
                .build()
                .toUriString();
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }
}
```

- [ ] **Step 4: Permit the callback** — in `config/SecurityConfig.java`, directly after the line `.requestMatchers("/api/ad-connections/*/callback").permitAll()` (the Phase 1 media permits follow it; keep their order), add:

```java
                // TikTok's publishing-login redirect: a browser arriving from TikTok with no JWT;
                // the tenant travels in the single-use state token (same model as the ads callback).
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/social-connections/tiktok/callback").permitAll()
```

In `auth/ProfileCompletionFilter.java` `isExempt`, extend the `||` chain (keep existing comments) with:

```java
            // TikTok publishing-login callback: a redirect from TikTok, not a UI call.
            || path.equals("/api/social-connections/tiktok/callback")
```

- [ ] **Step 5: Run** `./mvnw -q test -Dtest='SocialConnectionControllerTest,SocialConnectionServiceTest'`. Expected: 17 + 16 pass.
- [ ] **Step 6: Run the whole backend suite** `./mvnw -q test`. Expected: all pass (was 594 + new). Report totals.
- [ ] **Step 7: EOL guard + Checkpoint.**

---

## Frontend

### Task 8: Types, API client, connections store

**Files:** Modify `types.ts`, `services/apiClient.ts`, `services/fixtures/connections.ts`, `services/connectionsStore.tsx`, `services/connectionsStore.test.tsx`; Create `services/navigation.ts`, `services/apiClient.connections.test.ts`.

Read first: `services/connectionsStore.tsx`, `services/connectionsStore.test.tsx`, `services/apiClient.adConnections.test.ts` (copy its fetch-stubbing pattern), and `services/apiClient.ts` L464-475 (the `connections` block).

- [ ] **Step 1: Types** — in `frontend/types.ts`, replace the `PlatformConnection` interface with:

```ts
/** What the backend derives for a publishing platform (GET /api/social-connections). */
export type SocialStatus =
  | 'DISCONNECTED'
  | 'NEEDS_RECONNECT'
  | 'NEEDS_PAGE'
  | 'NO_LINKED_INSTAGRAM'
  | 'ACTIVE';

export interface PlatformConnection {
  platform: PlatformId;
  /** True only when status is ACTIVE — i.e. CeView can publish there. */
  connected: boolean;
  handle: string | null;
  connectedAt: string | null;
  /** Absent only in fixtures that predate the real backend. */
  status?: SocialStatus;
  /** Whether THIS SERVER has credentials for the platform's app. */
  configured?: boolean;
}

/** One Facebook Page the Meta login administers (GET /api/social-connections/meta/pages). */
export interface MetaPageOption {
  id: string;
  name: string;
  instagramUsername: string | null;
}
```

and append the wire type next to it (or at end of file):

```ts
/** GET /api/social-connections row. */
export interface SocialConnectionDto {
  platform: PlatformId;
  configured: boolean;
  status: SocialStatus;
  handle: string | null;
  connectedAt: string | null;
}
```

- [ ] **Step 2: Fixtures** — `services/fixtures/connections.ts`:

```ts
import type { PlatformConnection } from '../../types';

export const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z', status: 'ACTIVE', configured: true },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null, status: 'DISCONNECTED', configured: true },
  { platform: 'facebook', connected: true, handle: 'Cebu Dive Co.', connectedAt: '2026-04-12T00:00:00Z', status: 'ACTIVE', configured: true },
];
```
(keep the file's header comment).

- [ ] **Step 3: Failing API-client test** — `services/apiClient.connections.test.ts`. Mirror `apiClient.adConnections.test.ts` for how it stubs `fetch`/env and imports `apiClient`; write these cases:
  1. `connections.list()` GETs `/api/social-connections` and maps each DTO to a `PlatformConnection` with `connected === (status === 'ACTIVE')`, preserving `status`, `configured`, `handle`, `connectedAt`.
  2. `connections.tiktokAuthorize()` POSTs `/api/social-connections/tiktok/authorize` and returns the body.
  3. `connections.metaPages()` GETs `/api/social-connections/meta/pages`.
  4. `connections.selectMetaPage('111')` PUTs `/api/social-connections/meta/page` with JSON body `{"pageId":"111"}` and maps the returned list like case 1.
  5. `connections.disconnect('facebook')` DELETEs `/api/social-connections/facebook`.
  Run: `npx vitest run services/apiClient.connections.test.ts` → FAIL.

- [ ] **Step 4: Implement the client** — in `services/apiClient.ts` add `SocialConnectionDto, MetaPageOption` to the `from '../types'` import, then replace the whole `connections: { … },` block with:

```ts
  /**
   * Publishing connections (Facebook Page, Instagram, TikTok). Meta's login itself is
   * adConnections.authorize('meta') — one Meta login serves ads and publishing.
   */
  connections: {
    list: () =>
      USE_FIXTURES
        ? delay(MOCK_CONNECTIONS)
        : request<SocialConnectionDto[]>('/api/social-connections').then(toPlatformConnections),

    tiktokAuthorize: () =>
      USE_FIXTURES
        ? delay<{ authorizeUrl: string }>({ authorizeUrl: '#fixture-no-oauth' })
        : request<{ authorizeUrl: string }>('/api/social-connections/tiktok/authorize', { method: 'POST' }),

    metaPages: () =>
      USE_FIXTURES
        ? delay<MetaPageOption[]>([
            { id: 'page-1', name: 'Cebu Dive Co.', instagramUsername: 'cebu.dive' },
            { id: 'page-2', name: 'Mactan Cafe', instagramUsername: null },
          ])
        : request<MetaPageOption[]>('/api/social-connections/meta/pages'),

    /** Returns the fresh connection list. */
    selectMetaPage: (pageId: string) =>
      USE_FIXTURES
        ? delay(MOCK_CONNECTIONS)
        : request<SocialConnectionDto[]>('/api/social-connections/meta/page', {
            method: 'PUT',
            body: JSON.stringify({ pageId }),
          }).then(toPlatformConnections),

    disconnect: (platform: string) =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request<void>(`/api/social-connections/${platform}`, { method: 'DELETE' }),
  },
```

and, above the `apiClient` object (next to the other module-level helpers such as `toSession`), add:

```ts
function toPlatformConnections(dtos: SocialConnectionDto[]): PlatformConnection[] {
  return dtos.map((dto) => ({
    platform: dto.platform,
    connected: dto.status === 'ACTIVE',
    handle: dto.handle,
    connectedAt: dto.connectedAt,
    status: dto.status,
    configured: dto.configured,
  }));
}
```
(`PlatformConnection` is already imported in this file; add `SocialConnectionDto`, `MetaPageOption` to the import.) Run the new test → PASS.

- [ ] **Step 5: Navigation seam** — `services/navigation.ts`:

```ts
/**
 * The single place the app leaves for an OAuth consent screen. A separate module so tests can
 * mock it — jsdom cannot navigate.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
```

- [ ] **Step 6: Failing store tests** — in `services/connectionsStore.test.tsx` (read it first; adapt its provider/mocking pattern) cover:
  1. Loads `apiClient.connections.list()` into `connections`; `isConnected('facebook')` is true only for status ACTIVE; `statusOf(platform)` returns the row's status, `'DISCONNECTED'` for unknown.
  2. `connect('tiktok')` calls `apiClient.connections.tiktokAuthorize()` then `navigateTo(url)`.
  3. `connect('facebook')` and `connect('instagram')` call `apiClient.adConnections.authorize('meta')` then `navigateTo(url)`.
  4. In fixture mode (`authorizeUrl` starts with `#`) `connect` does NOT navigate and marks the platform (both Facebook and Instagram for Meta) `connected` locally.
  5. `disconnect('facebook')` calls `apiClient.connections.disconnect('facebook')`, then refetches the list, and fires `onDisconnect` listeners for **both** `facebook` and `instagram`; `disconnect('tiktok')` fires only `tiktok`.
  6. `refresh()` refetches the list.
  7. A 404 on the initial list sets `available` to false (existing behaviour; keep its test).
  Mock `./navigation` with `vi.mock('./navigation', () => ({ navigateTo: vi.fn() }))`. Run → FAIL.

- [ ] **Step 7: Implement the store** — rewrite the relevant parts of `services/connectionsStore.tsx` (keep the header comment, `available`, `onDisconnect`, listeners, `isNotAvailable` handling):

```ts
export interface ConnectionsStore {
  connections: PlatformConnection[] | null;
  /** False when the backend has no publishing-connections feature (404). */
  available: boolean;
  isConnected(platform: PlatformId): boolean;
  statusOf(platform: PlatformId): SocialStatus;
  /**
   * Starts the platform's OAuth login by navigating away (Facebook/Instagram share Meta's
   * login). Resolves without navigating in fixture mode, marking the platform connected locally.
   */
  connect(platform: PlatformId): Promise<void>;
  disconnect(platform: PlatformId): Promise<void>;
  /** Re-reads the list from the server. */
  refresh(): Promise<void>;
  onDisconnect(cb: (platform: PlatformId) => void): () => void;
}
```

Inside the provider:

```ts
  async function load(): Promise<void> {
    try {
      setConnections((await apiClient.connections.list()) as PlatformConnection[]);
    } catch (error) {
      setAvailable(!isNotAvailable(error));
      // Same reasoning as before: a failed fetch must not leave screens on a skeleton forever.
      setConnections([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function statusOf(platform: PlatformId): SocialStatus {
    return connections?.find((c) => c.platform === platform)?.status ?? 'DISCONNECTED';
  }

  function markConnectedLocally(platforms: PlatformId[]) {
    setConnections((prev) =>
      (prev ?? []).map((c) =>
        platforms.includes(c.platform)
          ? { ...c, connected: true, status: 'ACTIVE', handle: c.handle ?? 'Demo account', connectedAt: new Date().toISOString() }
          : c,
      ),
    );
  }

  async function connect(platform: PlatformId): Promise<void> {
    const { authorizeUrl } =
      platform === 'tiktok'
        ? await apiClient.connections.tiktokAuthorize()
        : await apiClient.adConnections.authorize('meta');
    if (authorizeUrl.startsWith('#')) {
      // Fixture mode: no OAuth to run.
      markConnectedLocally(platform === 'tiktok' ? ['tiktok'] : ['facebook', 'instagram']);
      return;
    }
    navigateTo(authorizeUrl);
  }

  async function disconnect(platform: PlatformId): Promise<void> {
    await apiClient.connections.disconnect(platform);
    await load();
    // Facebook and Instagram are one grant: disconnecting either disconnects both.
    const affected: PlatformId[] = platform === 'tiktok' ? ['tiktok'] : ['facebook', 'instagram'];
    affected.forEach((p) => listeners.current.forEach((cb) => cb(p)));
  }
```
Add `import { navigateTo } from './navigation';` and `SocialStatus` to the type import; include `statusOf`, `connect`, `disconnect`, `refresh: load` in the memoised value (dependencies `[connections, available]`). Delete the old `nowISO` helper if now unused. Run the store tests → PASS.

- [ ] **Step 8: Fix other callers** — run `npx tsc --noEmit`; fix every compile error from the changed `connect` signature or removed `apiClient.connections.connect` (other tests that mock `useConnections` or `apiClient.connections` may need `statusOf`/`refresh` added to their mocks). Then run `npx vitest run services components/module-3 components/settings` and fix expected breakages in test files only when the failure is due to the intentional API change (report each).
- [ ] **Step 9: EOL guard + Checkpoint.**

---

### Task 9: `PagePickerModal` and the Platforms settings screen

**Files:** Create `components/settings/PagePickerModal.tsx` (+ `PagePickerModal.test.tsx`); Modify `components/settings/PlatformsSettings.tsx` (+ `PlatformsSettings.test.tsx`).

Read first: `components/settings/AdAccountPickerModal.tsx` (+test) — `PagePickerModal` mirrors it — and all of `PlatformsSettings.tsx` / its test.

- [ ] **Step 1: Failing test** — `PagePickerModal.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PagePickerModal from './PagePickerModal';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';

const metaPagesMock = vi.fn();
const selectMetaPageMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    connections: {
      metaPages: (...args: unknown[]) => metaPagesMock(...args),
      selectMetaPage: (...args: unknown[]) => selectMetaPageMock(...args),
    },
  },
}));

function renderPicker(onSelected = vi.fn(), onClose = vi.fn()) {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <PagePickerModal onClose={onClose} onSelected={onSelected} />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  metaPagesMock.mockReset().mockResolvedValue([
    { id: '111', name: 'Cebu Dive Co.', instagramUsername: 'cebu.dive' },
    { id: '222', name: 'Mactan Cafe', instagramUsername: null },
  ]);
  selectMetaPageMock.mockReset().mockResolvedValue([]);
});

describe('PagePickerModal', () => {
  it('lists the Pages with their linked Instagram account, or a hint when there is none', async () => {
    renderPicker();

    expect(await screen.findByText('Cebu Dive Co.')).toBeInTheDocument();
    expect(screen.getByText('Instagram: @cebu.dive')).toBeInTheDocument();
    expect(screen.getByText('Mactan Cafe')).toBeInTheDocument();
    expect(screen.getByText('No Instagram account linked')).toBeInTheDocument();
  });

  it('keeps the confirm button disabled until a Page is picked', async () => {
    renderPicker();
    await screen.findByText('Cebu Dive Co.');

    expect(screen.getByRole('button', { name: /use this page/i })).toBeDisabled();
  });

  it('submits the chosen Page and reports success', async () => {
    const onSelected = vi.fn();
    renderPicker(onSelected);

    fireEvent.click(await screen.findByText('Cebu Dive Co.'));
    fireEvent.click(screen.getByRole('button', { name: /use this page/i }));

    await waitFor(() => expect(selectMetaPageMock).toHaveBeenCalledWith('111'));
    await waitFor(() => expect(onSelected).toHaveBeenCalled());
  });

  it('shows a helpful message when the account administers no Pages', async () => {
    metaPagesMock.mockResolvedValue([]);
    renderPicker();

    expect(await screen.findByText(/no facebook pages/i)).toBeInTheDocument();
  });

  it('shows a reconnect hint when loading the Pages fails', async () => {
    metaPagesMock.mockRejectedValue(new Error('boom'));
    renderPicker();

    expect(await screen.findByText(/could not load your pages/i)).toBeInTheDocument();
  });

  it('does not close when saving fails, and lets the user try again', async () => {
    selectMetaPageMock.mockRejectedValue(new Error('nope'));
    const onSelected = vi.fn();
    renderPicker(onSelected);

    fireEvent.click(await screen.findByText('Cebu Dive Co.'));
    fireEvent.click(screen.getByRole('button', { name: /use this page/i }));

    await waitFor(() => expect(selectMetaPageMock).toHaveBeenCalled());
    expect(onSelected).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: /use this page/i })).toBeEnabled());
  });
});
```

Run `npx vitest run components/settings/PagePickerModal.test.tsx` → FAIL.

- [ ] **Step 2: Implement** `PagePickerModal.tsx`:

```tsx
/**
 * Which Facebook Page should CeView publish to?
 *
 * One Meta login can administer several Pages, and the Instagram business account CeView
 * publishes to is the one linked to the chosen Page — so the operator picks, rather than
 * the code assuming the first is right.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import type { MetaPageOption } from '../../types';

export default function PagePickerModal({
  onClose,
  onSelected,
}: {
  onClose: () => void;
  onSelected: () => void;
}) {
  const [pages, setPages] = useState<MetaPageOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // The modal can be dismissed (Cancel, Escape, scrim) while saving is in flight.
  const cancelledRef = useRef(false);
  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    apiClient.connections
      .metaPages()
      .then((list) => {
        if (!cancelled) setPages(list);
      })
      .catch(() => {
        if (!cancelled) {
          setPages([]);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.connections.selectMetaPage(selected);
      if (cancelledRef.current) return;
      showToast('Facebook Page connected');
      onSelected();
    } catch {
      if (cancelledRef.current) return;
      showToast('Could not save that Page. Try again.');
    } finally {
      if (!cancelledRef.current) setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Choose a Facebook Page">
      {pages === null && (
        <div className="flex items-center gap-2 py-6">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          <span className="body-sm">Loading your Pages…</span>
        </div>
      )}

      {loadFailed && (
        <p className="body-sm py-4">
          Could not load your Pages. The connection may have expired — reconnect Facebook and try again.
        </p>
      )}

      {pages !== null && !loadFailed && pages.length === 0 && (
        <p className="body-sm py-4">
          No Facebook Pages are available on this login. You need to be an admin of a Page to publish to
          it — create one or ask for access, then reconnect.
        </p>
      )}

      {pages !== null && pages.length > 0 && (
        <div className="flex flex-col gap-2 py-2" role="radiogroup" aria-label="Facebook Pages">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              role="radio"
              aria-checked={selected === page.id}
              onClick={() => setSelected(page.id)}
              className={`flex items-center justify-between rounded-lg border p-3 text-left ${
                selected === page.id
                  ? 'border-[var(--color-mint-primary)]'
                  : 'border-[var(--color-gray-light)]'
              }`}
            >
              <span className="font-semibold text-navy-dark">{page.name}</span>
              <span className="body-xs text-[var(--color-text-muted)]">
                {page.instagramUsername ? `Instagram: @${page.instagramUsername}` : 'No Instagram account linked'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" className="btn-outline--sm" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={confirm} disabled={!selected || saving}>
          Use this Page
        </button>
      </div>
    </Modal>
  );
}
```

Run the picker test → PASS (6 tests).

- [ ] **Step 3: Failing settings tests** — update `PlatformsSettings.test.tsx`. The `useConnections` mock must now expose `statusOf` and `refresh`:

```tsx
const connectMock = vi.fn();
const disconnectMock = vi.fn();
const refreshMock = vi.fn();
let connections: PlatformConnection[] | null = CONNECTIONS;
let available = true;

vi.mock('../../services/connectionsStore', () => ({
  useConnections: () => ({
    connections,
    available,
    isConnected: (platform: string) => connections?.find((c) => c.platform === platform)?.connected ?? false,
    statusOf: (platform: string) => connections?.find((c) => c.platform === platform)?.status ?? 'DISCONNECTED',
    connect: (...args: unknown[]) => connectMock(...args),
    disconnect: (...args: unknown[]) => disconnectMock(...args),
    refresh: (...args: unknown[]) => refreshMock(...args),
    onDisconnect: () => () => {},
  }),
}));
```
Set `CONNECTIONS` to include `status` and `configured: true` per row, and extend the `apiClient` mock with `connections: { metaPages: () => Promise.resolve([]), selectMetaPage: () => Promise.resolve([]) }`. **Delete** the tests of the fake two-step modal (redirecting → scope grant, Cancel) and replace them with:

```tsx
describe('PlatformsSettings — real connections', () => {
  it('starts the real login when Connect is pressed (no fake consent modal)', async () => {
    renderSettings();

    fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0]);

    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
    expect(connectMock.mock.calls[0]).toHaveLength(1); // connect(platform) — no handle argument
    expect(screen.queryByText(/grant scope/i)).not.toBeInTheDocument();
  });

  it('says so when a platform cannot be connected because the server has no credentials', () => {
    connections = CONNECTIONS.map((c) => (c.platform === 'tiktok' ? { ...c, configured: false } : c));
    renderSettings();

    const tiktokRow = screen.getByText('TikTok').closest('li') as HTMLElement;
    expect(within(tiktokRow).getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('asks for a Page after the Meta login, and opens the picker', async () => {
    connections = CONNECTIONS.map((c) =>
      c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
    renderSettings();

    expect(screen.getByText(/choose which facebook page/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Page' }));

    expect(await screen.findByText('Choose a Facebook Page')).toBeInTheDocument();
  });

  it('offers a reconnect when permissions changed', async () => {
    connections = CONNECTIONS.map((c) =>
      c.platform === 'instagram' ? { ...c, connected: false, status: 'NEEDS_RECONNECT' as const } : c);
    renderSettings();

    const row = screen.getByText('Instagram').closest('li') as HTMLElement;
    expect(within(row).getByText(/permissions changed/i)).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Reconnect' }));

    await waitFor(() => expect(connectMock).toHaveBeenCalledWith('instagram'));
  });

  it('tells the user to link an Instagram business account and lets them check again', async () => {
    connections = CONNECTIONS.map((c) =>
      c.platform === 'instagram' ? { ...c, connected: false, status: 'NO_LINKED_INSTAGRAM' as const } : c);
    renderSettings();

    expect(screen.getByText(/link an instagram business account/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('shows the friendly error and strips the query when TikTok sends the user back with social_error', async () => {
    window.history.replaceState({}, '', '/settings/platforms?social_error=access_denied&platform=tiktok');
    renderSettings();

    expect(await screen.findByText('Connection cancelled.')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('confirms a TikTok connection when the user comes back with ?social=tiktok', async () => {
    window.history.replaceState({}, '', '/settings/platforms?social=tiktok');
    renderSettings();

    expect(await screen.findByText('Connected to TikTok')).toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('opens the Page picker after returning from Meta when no Page is chosen yet', async () => {
    connections = CONNECTIONS.map((c) =>
      c.platform === 'facebook' ? { ...c, connected: false, status: 'NEEDS_PAGE' as const } : c);
    window.history.replaceState({}, '', '/settings/platforms?adconnect=meta');
    renderSettings();

    expect(await screen.findByText('Choose a Facebook Page')).toBeInTheDocument();
  });
});
```
(import `within` from Testing Library; reset `window.history` to `/` in `afterEach`.) Keep the existing tests for Verified/handle/skeleton/disconnect/unavailable, updating their assumptions where the row copy changed. Run `npx vitest run components/settings/PlatformsSettings.test.tsx` → the new tests FAIL.

- [ ] **Step 4: Implement the screen changes** in `PlatformsSettings.tsx`:
  1. **Remove** the fake flow: the `SCOPES` array, `REDIRECT_DELAY_MS`, `ModalStep`, the `modalStep`/`connectingPlatform` modal state, the `redirecting` effect, `closeModal`, `grantScope`, the whole `<Modal …>` block at the bottom, and now-unused icon imports (`Eye`, `FileEdit`, `ShieldCheck`, `Modal`). Update the file's header comment: connect now runs real OAuth (Meta shared with ads; TikTok separate).
  2. **Imports/state:** `import PagePickerModal from './PagePickerModal';`, destructure `statusOf, refresh` from `useConnections()`, and add
     ```tsx
     const [connectingPlatform, setConnectingPlatform] = useState<PlatformId | null>(null);
     const [pageOpen, setPageOpen] = useState(false);
     // True between landing back from Meta and the connection list arriving.
     const [metaReturn, setMetaReturn] = useState(false);
     ```
  3. **Messages:** extend the error table's usage so it also serves `social_error` (same codes: `access_denied`, `consent_declined`, `missing_code_or_state`, `invalid_state`, `token_exchange_failed`).
  4. **Return-parameter effect** (replace the existing one):
     ```tsx
     useEffect(() => {
       const params = new URLSearchParams(window.location.search);
       const adConnected = params.get('adconnect');
       const adFailed = params.get('adconnect_error');
       const socialConnected = params.get('social');
       const socialFailed = params.get('social_error');

       if (adConnected === 'meta') {
         setMetaReturn(true); // decided once the connection list has loaded (below)
       } else if (adConnected === 'tiktok') {
         setPickerProvider('tiktok');
       } else if (socialConnected === 'tiktok') {
         showToast('Connected to TikTok');
         void refresh();
       }

       const failed = adFailed ?? socialFailed;
       if (failed) {
         showToast(AD_CONNECT_ERROR_MESSAGES[failed] ?? 'Could not complete the connection. Try again.');
       }

       if (adConnected || adFailed || socialConnected || socialFailed) {
         window.history.replaceState({}, '', window.location.pathname);
       }
     }, [showToast, refresh]);

     // Back from Meta's login: pick the Page first if publishing still needs one, otherwise the ad account.
     useEffect(() => {
       if (!metaReturn || connections === null) return;
       setMetaReturn(false);
       if (statusOf('facebook') === 'NEEDS_PAGE') setPageOpen(true);
       else setPickerProvider('meta');
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [metaReturn, connections]);
     ```
  5. **Connect/disconnect handlers:**
     ```tsx
     async function startConnect(platform: PlatformId) {
       setConnectingPlatform(platform);
       try {
         await connect(platform); // navigates away to the consent screen
       } catch {
         showToast(`Could not start the ${PLATFORM_LABELS[platform]} connection. Try again.`);
       } finally {
         setConnectingPlatform(null);
       }
     }
     ```
     (keep `handleDisconnect`).
  6. **Row copy helper** (module level):
     ```tsx
     function rowSubtitle(status: SocialStatus, handle: string | null | undefined): string {
       switch (status) {
         case 'ACTIVE': return handle || 'Connected';
         case 'NEEDS_PAGE': return 'Choose which Facebook Page to publish to';
         case 'NEEDS_RECONNECT': return 'Permissions changed — reconnect to keep publishing';
         case 'NO_LINKED_INSTAGRAM': return 'Link an Instagram business account to your Page, then check again';
         default: return 'Not connected';
       }
     }
     ```
     (import `SocialStatus` from `../../types`.)
  7. **Row rendering** — replace the `platforms.map` body:
     ```tsx
     {platforms.map((platform) => {
       const status = statusOf(platform);
       const conn = connections.find((c) => c.platform === platform);
       const notSetUp = conn?.configured === false;
       return (
         <li key={platform} className="pf-row">
           <PlatformLogo platform={platform} />
           <div className="pf-row-text">
             <p className="pf-row-name">{PLATFORM_LABELS[platform]}</p>
             <p className="pf-row-sub">{rowSubtitle(status, conn?.handle)}</p>
           </div>
           {status === 'ACTIVE' ? (
             <div className="pf-row-actions">
               <span className="pf-pill">Verified</span>
               <span className="pf-divider" aria-hidden="true" />
               <button type="button" className="pf-text-btn" onClick={() => handleDisconnect(platform)}>
                 Disconnect
               </button>
             </div>
           ) : status === 'NEEDS_PAGE' ? (
             <button type="button" className="pf-connect" onClick={() => setPageOpen(true)}>
               Choose Page
             </button>
           ) : status === 'NO_LINKED_INSTAGRAM' ? (
             <div className="pf-row-actions">
               <button type="button" className="pf-connect" onClick={() => void refresh()}>
                 Check again
               </button>
               <span className="pf-divider" aria-hidden="true" />
               <button type="button" className="pf-text-btn" onClick={() => handleDisconnect(platform)}>
                 Disconnect
               </button>
             </div>
           ) : (
             <button
               type="button"
               className="pf-connect"
               disabled={!available || notSetUp || connectingPlatform === platform}
               title={notSetUp ? 'This server has no credentials for this platform yet' : undefined}
               onClick={() => startConnect(platform)}
             >
               {status === 'NEEDS_RECONNECT' ? 'Reconnect' : (<><Plus size={16} aria-hidden="true" />Connect</>)}
             </button>
           )}
         </li>
       );
     })}
     ```
  8. **Mount the picker** next to the ad picker:
     ```tsx
     {pageOpen && (
       <PagePickerModal
         onClose={() => setPageOpen(false)}
         onSelected={() => {
           setPageOpen(false);
           void refresh();
         }}
       />
     )}
     ```
  9. Update the header comment and the "Connection state here gates which platforms Content Studio can publish to" copy only if it is now inaccurate (it is not).
  Run `npx vitest run components/settings` → PASS.

- [ ] **Step 5: Whole-suite check** — `npx vitest run` and `npx tsc --noEmit`; fix only breakages caused by this change (e.g. tests that mock `useConnections` without `statusOf`/`refresh`) and report each. Do **not** run `npm run build`.
- [ ] **Step 6: EOL guard + Checkpoint.**

---

### Task 10: Full verification (controller runs this, not a subagent)

- [ ] Backend `./mvnw -q test` all green; frontend `npx vitest run` all green; `npx tsc --noEmit` clean; EOL guard clean.
- [ ] **Postgres boot:** start `docker compose up -d postgres` (backend/), boot Spring against it (as in Phase 1 verification). Flyway must apply **V49** and Hibernate `validate` must pass with the new entity; confirm `\d tbl_publishing_account` and that `chk_ad_state_provider` now allows `tiktok_creator`.
- [ ] **Live API checks (curl, seeded operator):** `GET /api/social-connections` → 3 rows `DISCONNECTED`, `tiktok.configured=false`; `POST /tiktok/authorize` → 503; restart with `TIKTOK_CONTENT_CLIENT_KEY/SECRET` set → returns a `tiktok.com/v2/auth/authorize/` URL with `client_key`, the three scopes, the `redirect_uri` and a `state` that exists in `tbl_ad_oauth_state` with provider `tiktok_creator`; `GET /tiktok/callback` with a bad state / `error=access_denied` / no params → 302 to `/settings/platforms?social_error=…` (no JWT needed); with `META_APP_ID/SECRET` set, `POST /api/ad-connections/meta/authorize` → URL whose `scope` lists all ten permissions.
- [ ] **UI states in a real browser:** insert rows with psql (`tbl_ad_platform_connection` provider `meta` with publish scopes; then `tbl_publishing_account` facebook/instagram ACTIVE) and screenshot-verify Settings → Platforms for `NEEDS_RECONNECT` (ads-only scope), `NEEDS_PAGE`, `NO_LINKED_INSTAGRAM`, `ACTIVE`; route-mock `/api/social-connections/meta/pages` and `PUT …/meta/page` in Playwright to exercise the Page picker; confirm Content Studio's Publish modal enables exactly the ACTIVE platforms. Remove the psql rows afterwards.
- [ ] **Cannot be verified without real Meta/TikTok developer credentials and a public HTTPS callback:** the actual consent screens and token exchanges (covered by MockWebServer tests). Say so plainly in the report.

---

## Amendments from the Phase 2 backend review (these supersede the task text where they conflict)

**A1 — TikTok login CSRF (Important).** The OAuth `state` identified the CeView profile that started the flow, not the browser that approved it, so an attacker could have a victim approve the attacker's flow and receive the victim's tokens. Fix: the public callback no longer finalises the grant.
- `GET /api/social-connections/tiktok/callback` (public, unchanged route) only validates inputs and **302-redirects to the SPA** with the code and state: success → `/settings/platforms?tiktok_code=<code>&state=<state>`; error cases unchanged (`social_error=<bounded code>`). It performs **no** DB writes and **no** outbound calls, and logs only the mapped code, never the raw `error` parameter.
- New authenticated `POST /api/social-connections/tiktok/complete` with JSON body `{code, state}` (both `@NotBlank`). It consumes the state (key `tiktok_creator`), and **rejects (403) unless the state's profile equals the caller's profile** (resolved from the JWT); then exchanges the code, fetches the display name, stores the grant, and returns the fresh `List<SocialConnectionView>`. Invalid/used/expired state → 400 `invalid_state`; exchange failure → 502; `DataIntegrityViolationException` from a concurrent finish → 409. A mismatched-profile state is burned (consumed) — safe by default.
- Frontend: `apiClient.connections.tiktokComplete(code, state)`; `PlatformsSettings` reads `tiktok_code` + `state` on mount, **strips the URL immediately** with `history.replaceState`, calls it, then toasts "Connected to TikTok" (or the failure message) and refreshes. `?social=tiktok` is no longer produced.
- Known follow-up (needs a product decision, NOT changed here): the existing Meta ads callback (`AdConnectionController.callback`) has the same weakness and now carries publish scopes.

**A2 — Meta reconnect / disconnect must revoke publishing rows (Important).** In `module4/adconnections` add `MetaConnectionResetEvent(UUID businessProfileId)` (a record). `AdConnectionService` gets `ApplicationEventPublisher` and publishes it from `storeGrant` when the provider is META and from `disconnect` when the provider is META. `SocialConnectionService` handles it with a synchronous `@EventListener` that revokes the profile's facebook and instagram rows (status REVOKED, tokens cleared) — so a reconnect (possibly as a different Facebook user) forces choosing a Page again and old Page tokens are not kept. Tests: reconnecting Meta (`storeGrant`) revokes ACTIVE Page rows and the list shows `NEEDS_PAGE`; disconnecting Meta revokes them and the list shows `DISCONNECTED`; TikTok rows are untouched.

**A3 — Smaller fixes.**
1. Never log the raw `error` query parameter (log the mapped code).
2. Instagram handle: `@username`, falling back to `"Instagram account"` when Graph omits the username (never `@null`).
3. No DB transaction across Graph calls: remove `@Transactional` from `listPages`; in `selectPage` read the Meta connection and call Graph outside any transaction, then write both rows inside one short `TransactionTemplate` transaction.
4. Meta error code 190 (invalid/expired token) → `MetaGraphClient` throws `SocialPlatformException` with `isAuthFailure() == true`; `SocialConnectionService.listPages/selectPage` map it to **409** "Meta session expired — reconnect" (other Graph failures stay 502).
5. TikTok status: `NEEDS_RECONNECT` when `refreshExpiresAt` is in the past or when stored `scopes` is non-null and lacks `video.upload`.
6. `AdConnectionService.mintState(UUID, String)` allow-lists keys (`meta`, `tiktok`, `tiktok_creator`); anything else → `IllegalArgumentException`.
7. Docs: `docs/SOCIAL_PUBLISHING_SETUP.md` gets a note that social connections need Postgres (the H2 "Path B" profile has no V48/V49 tables) and that pages beyond the first 100 are not listed.
8. Tests to add: callback performs no DB write/exchange and redirects with code+state; `complete` happy path / foreign-profile 403 / replay 400 / exchange failure 502 / unauthenticated 401; `canPublish` with space-separated and blank scopes; a `MetaAdsClientTokenTest` assertion that the third request path is `/me/permissions` carrying the long-lived token; a Graph 190 → 409 test.

---

## Self-review against the spec

- **Spec Phase 2:** Meta unified login with full scopes (Task 3), Page selection + Instagram discovery (Tasks 4, 6, 7, 9), TikTok creator OAuth + callback + permit (Tasks 5, 7), `tbl_publishing_account` + state-key widening (Tasks 1–2), `GET/POST/PUT/DELETE /api/social-connections` (Task 7), `NEEDS_RECONNECT` for old ads-only Meta rows (Task 6), frontend rewire of `connections` + Platforms screen without fake delay/modal (Tasks 8–9). `PlatformConnectionController.md` documented `/api/platform-connections` — superseded by `/api/social-connections` (update that doc when the phase ships).
- **Type consistency:** statuses `DISCONNECTED|NEEDS_RECONNECT|NEEDS_PAGE|NO_LINKED_INSTAGRAM|ACTIVE` are identical in `SocialDtos`, `SocialConnectionService`, the frontend `SocialStatus`, and the tests. `SocialConnectionView`/`SocialConnectionDto`/`PlatformConnection` fields match. `PageInfo`→`PageOption`→`MetaPageOption` carry `instagramUsername` consistently. State key `"tiktok_creator"` is the same in V49, the controller constant, and tests.
