# Ad Platform Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ COMMITS ARE THE USER'S TO RUN.** `.claude/CLAUDE.md` forbids Claude from running `git commit` or `git push` in this repository under any circumstances. Every "Commit" step below shows the exact command **for the user to run**. An agent executing this plan must stop at each commit step, state that the task is complete and verified, and hand the command back rather than running it.

**Goal:** Let an MSME operator OAuth-connect their Meta Ads and TikTok Ads accounts, pick which ad account to report on, and pull that period's impressions, clicks, spend, and conversions into Module 4's campaign ingestion form.

**Architecture:** A new `com.ceview.module4.adconnections` package owns three tables — a per-provider connection holding AES-GCM-encrypted tokens, a short-lived OAuth `state` row that carries tenancy through the un-authenticated callback redirect, and an insight cache. Two `AdPlatformClient` implementations (Meta Graph API, TikTok Business API) are the only code that talks to the outside world. The frontend gains an "Ad Accounts" section in Settings → Platforms and a "Sync" button in the Performance ingestion form.

**Tech Stack:** Spring Boot 3.3.4 / Java 17 (note: `pom.xml` sets `java.version` to 17, not 21), JPA + Flyway + PostgreSQL, WebClient, JUnit 5 + MockMvc + Mockito + okhttp3 MockWebServer (new), React 19 + TypeScript + Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-06-ad-platform-connections-design.md`](../specs/2026-09-06-ad-platform-connections-design.md)

---

## File structure

**Backend — created**

| File | Responsibility |
|---|---|
| `common/crypto/TokenCipher.java` | AES-GCM encrypt/decrypt of a single string. Nothing else. |
| `module4/adconnections/AdProvider.java` | Enum of the two providers + key parsing. |
| `module4/adconnections/AdProviderProperties.java` | Per-provider credentials and the two base URLs; `isConfigured`. |
| `module4/adconnections/AdConnectionDtos.java` | All request/response records, one file, mirroring `AnalyticsDtos`. |
| `module4/adconnections/AdPlatformConnection.java` | Connection entity. |
| `module4/adconnections/AdOAuthState.java` | State-token entity. |
| `module4/adconnections/AdInsight.java` | Cached insight entity. |
| `module4/adconnections/AdPlatformConnectionRepository.java` | |
| `module4/adconnections/AdOAuthStateRepository.java` | |
| `module4/adconnections/AdInsightRepository.java` | |
| `module4/adconnections/client/AdPlatformClient.java` | Provider-agnostic interface. |
| `module4/adconnections/client/MetaAdsClient.java` | Graph API calls + parsing. |
| `module4/adconnections/client/TikTokAdsClient.java` | Business API calls + parsing. |
| `module4/adconnections/AdConnectionService.java` | State lifecycle, token exchange, account selection, disconnect. |
| `module4/adconnections/AdInsightSyncService.java` | Fan-out, upsert, aggregate, currency reconciliation. |
| `module4/adconnections/AdConnectionController.java` | The seven endpoints. |
| `db/migration/V27__module4_ad_platform_connections.sql` | Postgres schema. |
| `db/h2/V18__ad_platform_connections.sql` | H2 runtime-profile mirror. |

**Backend — modified**

| File | Change |
|---|---|
| `pom.xml` | Add `okhttp3 mockwebserver` (test scope). |
| `config/SecurityConfig.java:41-43` | `permitAll` the callback path. |
| `auth/ProfileCompletionFilter.java:75-77` | Exempt the callback path. |
| `resources/application.yml` | New `ceview.security.token-encryption-key` and `ceview.adplatform.*` block. |
| `test/resources/application.properties` | Stub values so the context starts. |

**Frontend — created**

`services/fixtures/adConnections.ts`, `services/useAdConnections.ts`, `components/settings/AdAccountsSection.tsx`, `components/settings/AdAccountPickerModal.tsx`, plus a `.test.tsx` beside each component.

**Frontend — modified**

`types.ts` (new ad types only — `PlatformId`/`PlatformConnection` untouched), `services/apiClient.ts` (new `adConnections` group), `components/settings/PlatformsSettings.tsx` (render the section, handle return query params), `components/module-4/4.1-campaign-analytics/IngestionForm.tsx` (sync button, prefill, currency labels).

**e2e — modified:** `e2e/tests/settings-platforms.spec.ts` gains fixture-mode coverage of the ad-account rows. The OAuth round-trip itself is not e2e-testable (the consent screen is on the platform's own domain) and is verified by hand.

**Root docs:** `AD_PLATFORM_SETUP.md` created; `RUNNING.md`, `README.md`, and the two Module 3 backend specs get cross-references.

---

## Conventions to follow

Read these before starting — the plan assumes them:

- **Entities** use Lombok `@Data` with `@PrePersist` filling the UUID PK, per `module2/submodule21/TrendFetchJob.java:26-78`. Status values are `public static final String` constants that match the SQL `CHECK` constraint.
- **Tenant scoping** is always `currentBusinessProfile.resolveProfileId()`, never a client-supplied id — see `module4/engagement/EngagementMetricsController.java:66`.
- **Controller tests** mint a real JWT via `@Autowired JwtService` and send `Authorization: Bearer <token>`; there is no `@WithMockUser` anywhere in this repo. Copy the setup in `test/java/com/ceview/module4/engagement/MetricsTenantScopingTest.java:36-70`.
- **Tests build the schema from entities** (`spring.jpa.hibernate.ddl-auto=create-drop`, Flyway off — `test/resources/application.properties:13,19`). A new `@Entity` is covered automatically; the Flyway SQL is *not* exercised by any test, so it must be reviewed by eye against the entity.
- **Outbound HTTP clients** build their own `WebClient` with explicit timeouts rather than using the shared `fastapiClient` bean — see `module2/submodule21/ExternalMarketDataClient.java:27-33`.
- **Run the backend test suite** from `backend/spring-boot` with `./mvnw test`. Single class: `./mvnw test -Dtest=ClassName`.
- **Run frontend tests** from `frontend` with `npm test -- --run`. Single file: `npm test -- --run path/to/file.test.ts`.
- **Run e2e tests** from `e2e` with `npx playwright test`. They skip themselves when the backend is not running (`tests/support/stack.ts`).

---

## Phase 1 — Foundation

Ends with: the app boots with and without credentials, and `GET /api/ad-connections` reports both providers as unconfigured.

### Task 1: TokenCipher

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/common/crypto/TokenCipher.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/common/crypto/TokenCipherTest.java`

- [ ] **Step 1: Write the failing test**

Create `TokenCipherTest.java`:

```java
package com.ceview.common.crypto;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class TokenCipherTest {

    /** A fixed 256-bit key so the test is deterministic. */
    private static final String KEY = Base64.getEncoder()
            .encodeToString("0123456789abcdef0123456789abcdef".getBytes());

    private final TokenCipher cipher = new TokenCipher(KEY);

    @Test
    void roundTripsAValue() {
        String plaintext = "EAAJj9ZBv-a-long-looking-access-token";
        assertEquals(plaintext, cipher.decrypt(cipher.encrypt(plaintext)));
    }

    @Test
    void producesDifferentCiphertextForTheSamePlaintext() {
        // A random IV per call means an attacker with DB access cannot tell that
        // two operators connected the same account.
        assertNotEquals(cipher.encrypt("same"), cipher.encrypt("same"));
    }

    @Test
    void rejectsTamperedCiphertext() {
        String encrypted = cipher.encrypt("secret");
        byte[] raw = Base64.getDecoder().decode(encrypted);
        raw[raw.length - 1] ^= 0x01;                       // flip one bit of the tag
        String tampered = Base64.getEncoder().encodeToString(raw);

        assertThrows(IllegalStateException.class, () -> cipher.decrypt(tampered));
    }

    @Test
    void rejectsAKeyOfTheWrongLength() {
        String shortKey = Base64.getEncoder().encodeToString("too-short".getBytes());
        assertThrows(IllegalArgumentException.class, () -> new TokenCipher(shortKey));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=TokenCipherTest`
Expected: compilation failure — `cannot find symbol: class TokenCipher`.

- [ ] **Step 3: Write the implementation**

Create `TokenCipher.java`:

```java
package com.ceview.common.crypto;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Symmetric encryption for third-party OAuth tokens at rest.
 *
 * <p>AES-256-GCM. A fresh 12-byte IV is generated per call and prepended to the
 * ciphertext, so the stored value is {@code base64(iv || ciphertext || tag)} and
 * two encryptions of the same token never look alike.
 *
 * <p>GCM is authenticated: a tampered value fails to decrypt rather than
 * returning corrupted plaintext, which is why {@link #decrypt} can promise that
 * whatever it returns is what was stored.
 *
 * <p>This is deliberately not a Spring {@code @Component} — it is constructed by
 * {@code AdConnectionsConfig} only when a key is configured, so environments
 * without one start cleanly (the same shape as {@code FirebaseConfig}).
 */
public class TokenCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private static final int KEY_LENGTH_BYTES = 32;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    /**
     * @param base64Key a Base64-encoded 256-bit key. Generate one with:
     *                  {@code openssl rand -base64 32}
     * @throws IllegalArgumentException if the key is absent or not 32 bytes once decoded
     */
    public TokenCipher(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            throw new IllegalArgumentException("token encryption key is not configured");
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(base64Key);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("token encryption key is not valid Base64", e);
        }
        if (decoded.length != KEY_LENGTH_BYTES) {
            throw new IllegalArgumentException(
                    "token encryption key must decode to " + KEY_LENGTH_BYTES
                    + " bytes (256-bit), got " + decoded.length);
        }
        this.key = new SecretKeySpec(decoded, "AES");
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            random.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("failed to encrypt token", e);
        }
    }

    public String decrypt(String encrypted) {
        try {
            byte[] combined = Base64.getDecoder().decode(encrypted);
            if (combined.length <= IV_LENGTH_BYTES) {
                throw new IllegalStateException("ciphertext too short to contain an IV");
            }
            byte[] iv = new byte[IV_LENGTH_BYTES];
            byte[] ciphertext = new byte[combined.length - IV_LENGTH_BYTES];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH_BYTES);
            System.arraycopy(combined, IV_LENGTH_BYTES, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            // Includes AEADBadTagException — tampering or the wrong key.
            throw new IllegalStateException("failed to decrypt token", e);
        }
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=TokenCipherTest`
Expected: `Tests run: 4, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/common/crypto/TokenCipher.java \
        backend/spring-boot/src/test/java/com/ceview/common/crypto/TokenCipherTest.java
git commit -m "feat(module4): add AES-GCM TokenCipher for third-party OAuth tokens"
```

---

### Task 2: AdProvider enum and provider configuration

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdProvider.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdProviderProperties.java`
- Modify: `backend/spring-boot/src/main/resources/application.yml`
- Modify: `backend/spring-boot/src/test/resources/application.properties`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdProviderPropertiesTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdProviderPropertiesTest.java`:

```java
package com.ceview.module4.adconnections;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AdProviderPropertiesTest {

    private AdProviderProperties props(String metaId, String metaSecret,
                                       String tiktokId, String tiktokSecret) {
        AdProviderProperties p = new AdProviderProperties();
        p.getMeta().setAppId(metaId);
        p.getMeta().setAppSecret(metaSecret);
        p.getTiktok().setAppId(tiktokId);
        p.getTiktok().setAppSecret(tiktokSecret);
        return p;
    }

    @Test
    void reportsConfiguredOnlyWhenBothIdAndSecretArePresent() {
        AdProviderProperties p = props("123", "shh", "456", "");
        assertTrue(p.isConfigured(AdProvider.META));
        assertFalse(p.isConfigured(AdProvider.TIKTOK));
    }

    @Test
    void treatsBlankAsUnconfigured() {
        // application.yml gives these an empty-string default so placeholder
        // resolution succeeds without credentials — blank must not read as set.
        AdProviderProperties p = props("  ", "shh", "", "");
        assertFalse(p.isConfigured(AdProvider.META));
    }

    @Test
    void parsesProviderKeysCaseInsensitivelyAndRejectsUnknown() {
        assertEquals(AdProvider.META, AdProvider.fromKey("meta"));
        assertEquals(AdProvider.TIKTOK, AdProvider.fromKey("TikTok"));
        assertThrows(IllegalArgumentException.class, () -> AdProvider.fromKey("naver"));
    }

    @Test
    void buildsTheCallbackUrlFromTheRedirectBase() {
        AdProviderProperties p = props("1", "2", "3", "4");
        p.setRedirectBaseUrl("https://abc123.ngrok-free.app");
        assertEquals("https://abc123.ngrok-free.app/api/ad-connections/meta/callback",
                     p.callbackUrl(AdProvider.META));
    }

    @Test
    void stripsATrailingSlashFromTheRedirectBase() {
        // A trailing slash produces a double-slash URL that will not match the
        // redirect URI registered with the platform — an error whose message
        // ("URL blocked") does not point at the cause.
        AdProviderProperties p = props("1", "2", "3", "4");
        p.setRedirectBaseUrl("https://abc123.ngrok-free.app/");
        assertEquals("https://abc123.ngrok-free.app/api/ad-connections/tiktok/callback",
                     p.callbackUrl(AdProvider.TIKTOK));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdProviderPropertiesTest`
Expected: compilation failure — `cannot find symbol: class AdProviderProperties`.

- [ ] **Step 3: Write the enum**

Create `AdProvider.java`:

```java
package com.ceview.module4.adconnections;

/**
 * The two ad platforms CeView can pull campaign metrics from.
 *
 * <p>{@link #key()} is the lowercase string used in URL paths, the
 * {@code provider} column, and the frontend's {@code AdProvider} union type —
 * it must stay in sync with the {@code chk_ad_conn_provider} CHECK constraint
 * in V27.
 *
 * <p>Meta covers Facebook <em>and</em> Instagram ad placements: one ad account
 * runs both, and the insights call breaks them down by {@code publisher_platform}.
 * That is why there is no separate Instagram provider here.
 */
public enum AdProvider {

    META("meta"),
    TIKTOK("tiktok");

    private final String key;

    AdProvider(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    /** @throws IllegalArgumentException for any key that is not a known provider */
    public static AdProvider fromKey(String key) {
        for (AdProvider p : values()) {
            if (p.key.equalsIgnoreCase(key)) return p;
        }
        throw new IllegalArgumentException("unknown ad provider: " + key);
    }
}
```

- [ ] **Step 4: Write the properties class**

Create `AdProviderProperties.java`:

```java
package com.ceview.module4.adconnections;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Credentials and URLs for the ad-platform OAuth flow, bound from
 * {@code ceview.adplatform.*} in application.yml.
 *
 * <p>Every value has an empty-string default so the application starts without
 * ad credentials configured — {@link #isConfigured} is what decides whether a
 * provider's endpoints do anything, mirroring how {@code FirebaseConfiguredCondition}
 * treats a blank credentials JSON.
 */
@Component
@ConfigurationProperties(prefix = "ceview.adplatform")
public class AdProviderProperties {

    /** Public HTTPS base that the platforms redirect back to — a tunnel URL in local dev. */
    private String redirectBaseUrl = "";

    /** Where the callback sends the browser once the grant is stored. */
    private String frontendBaseUrl = "";

    private final Credentials meta = new Credentials();
    private final Credentials tiktok = new Credentials();

    public static class Credentials {
        private String appId = "";
        private String appSecret = "";

        public String getAppId() { return appId; }
        public void setAppId(String appId) { this.appId = appId; }
        public String getAppSecret() { return appSecret; }
        public void setAppSecret(String appSecret) { this.appSecret = appSecret; }
    }

    public Credentials forProvider(AdProvider provider) {
        return provider == AdProvider.META ? meta : tiktok;
    }

    public boolean isConfigured(AdProvider provider) {
        Credentials c = forProvider(provider);
        return notBlank(c.getAppId()) && notBlank(c.getAppSecret());
    }

    /** The exact redirect URI that must also be registered with the platform. */
    public String callbackUrl(AdProvider provider) {
        String base = redirectBaseUrl.endsWith("/")
                ? redirectBaseUrl.substring(0, redirectBaseUrl.length() - 1)
                : redirectBaseUrl;
        return base + "/api/ad-connections/" + provider.key() + "/callback";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    public String getRedirectBaseUrl() { return redirectBaseUrl; }
    public void setRedirectBaseUrl(String v) { this.redirectBaseUrl = v; }
    public String getFrontendBaseUrl() { return frontendBaseUrl; }
    public void setFrontendBaseUrl(String v) { this.frontendBaseUrl = v; }
    public Credentials getMeta() { return meta; }
    public Credentials getTiktok() { return tiktok; }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdProviderPropertiesTest`
Expected: `Tests run: 5, Failures: 0, Errors: 0`.

- [ ] **Step 6: Add the configuration block**

In `backend/spring-boot/src/main/resources/application.yml`, insert after the `ceview.firebase` block (before `cors:`), keeping the existing two-space indentation under `ceview:`:

```yaml
  security:
    # Base64-encoded 256-bit key encrypting third-party ad-platform OAuth tokens
    # at rest (see common/crypto/TokenCipher). Blank in environments that don't
    # connect ad accounts — the ad-connection endpoints then return 503 rather
    # than the app failing to start. Generate with: openssl rand -base64 32
    token-encryption-key: ${TOKEN_ENCRYPTION_KEY:}
  adplatform:
    # Public HTTPS origin the platforms redirect back to. In local dev this is a
    # tunnel (ngrok/cloudflared) pointing at :8080 — see AD_PLATFORM_SETUP.md.
    # It must match the redirect URI registered in each platform's app settings
    # exactly, including scheme and absence of a trailing slash.
    redirect-base-url: ${OAUTH_REDIRECT_BASE_URL:}
    # Where the callback sends the browser after storing the grant.
    frontend-base-url: ${FRONTEND_BASE_URL:http://localhost:5173}
    meta:
      app-id: ${META_APP_ID:}
      app-secret: ${META_APP_SECRET:}
    tiktok:
      app-id: ${TIKTOK_APP_ID:}
      app-secret: ${TIKTOK_APP_SECRET:}
```

- [ ] **Step 7: Add test stubs**

Append to `backend/spring-boot/src/test/resources/application.properties`:

```properties
# Ad-platform OAuth — a real (throwaway) key so TokenCipher can be constructed in
# context tests; the app ids stay blank so providers report unconfigured by
# default. Tests that need a configured provider override these per-class.
ceview.security.token-encryption-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
ceview.adplatform.redirect-base-url=https://test.example.com
ceview.adplatform.frontend-base-url=http://localhost:5173
ceview.adplatform.meta.app-id=
ceview.adplatform.meta.app-secret=
ceview.adplatform.tiktok.app-id=
ceview.adplatform.tiktok.app-secret=
```

- [ ] **Step 8: Run the full suite to confirm nothing regressed**

Run: `cd backend/spring-boot && ./mvnw test`
Expected: BUILD SUCCESS, no new failures.

- [ ] **Step 9: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/ \
        backend/spring-boot/src/test/java/com/ceview/module4/adconnections/ \
        backend/spring-boot/src/main/resources/application.yml \
        backend/spring-boot/src/test/resources/application.properties
git commit -m "feat(module4): add AdProvider enum and ad-platform configuration properties"
```

---

### Task 3: Database schema

**Files:**
- Create: `backend/spring-boot/src/main/resources/db/migration/V27__module4_ad_platform_connections.sql`
- Create: `backend/spring-boot/src/main/resources/db/h2/V18__ad_platform_connections.sql`

There is no test for this task — `test/resources/application.properties:19` disables Flyway and builds the schema from entities. Task 4 defines the entities that must match this SQL column-for-column; review them side by side before committing.

- [ ] **Step 1: Write the Postgres migration**

Create `V27__module4_ad_platform_connections.sql`:

```sql
-- ============================================================================
-- V27 — Module 4: ad-platform account connections and cached ad insights
--
-- WHY
--   Module 4's campaign metrics are entirely operator-typed today. The four
--   figures the ad platforms already know — impressions, clicks, spend,
--   conversions — are the tedious ones to look up and the easiest to mistype,
--   and a wrong ad spend silently corrupts the PES score. These tables let an
--   operator connect a Meta or TikTok ad account once and pull those figures.
--
-- WHY A SEPARATE STATE TABLE
--   The OAuth callback arrives as a browser redirect from the platform with no
--   Authorization header, so there is no JWT to resolve the tenant from. The
--   state token minted at authorize time carries the business_profile_id
--   through the redirect, and doubles as the OAuth CSRF defence.
--
-- SCOPE NOTE
--   These are ADS connections. The separate publishing connection specified in
--   docs/module-3/backend/PlatformConnectionController.md is a different grant
--   with different scopes and is not built here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tbl_ad_platform_connection (
    connection_id           UUID        NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id     UUID        NOT NULL,
    provider                TEXT        NOT NULL,

    -- Base64(iv || ciphertext || tag) from common/crypto/TokenCipher.
    -- Never returned by any endpoint.
    access_token_encrypted  TEXT        NOT NULL,
    -- Meta long-lived tokens have no refresh token; TikTok's does.
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,

    -- Null until the operator picks which ad account to report on.
    external_account_id     TEXT,
    external_account_name   TEXT,
    -- The ad account's own currency, as reported by the platform. Stored rather
    -- than converted: a wrong FX rate silently corrupts ROAS.
    currency                CHAR(3),

    scopes                  TEXT,
    status                  TEXT        NOT NULL,

    connected_at            TIMESTAMPTZ,
    last_synced_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ,

    CONSTRAINT pk_ad_platform_connection PRIMARY KEY (connection_id),
    CONSTRAINT fk_ad_conn_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_ad_conn_profile_provider UNIQUE (business_profile_id, provider),
    CONSTRAINT chk_ad_conn_provider CHECK (provider IN ('meta','tiktok')),
    CONSTRAINT chk_ad_conn_status CHECK (
        status IN ('PENDING_ACCOUNT_SELECTION','ACTIVE','REVOKED'))
);

COMMENT ON TABLE  tbl_ad_platform_connection IS
    'Per-operator OAuth grant for a Meta or TikTok ad account. Tokens are AES-GCM encrypted.';
COMMENT ON COLUMN tbl_ad_platform_connection.status IS
    'PENDING_ACCOUNT_SELECTION until the operator chooses an ad account; ACTIVE once chosen.';

CREATE INDEX IF NOT EXISTS idx_ad_conn_profile_status
    ON tbl_ad_platform_connection (business_profile_id, status);

-- OAuth state ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tbl_ad_oauth_state (
    state               UUID        NOT NULL,
    business_profile_id UUID        NOT NULL,
    provider            TEXT        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    consumed_at         TIMESTAMPTZ,

    CONSTRAINT pk_ad_oauth_state PRIMARY KEY (state),
    CONSTRAINT chk_ad_state_provider CHECK (provider IN ('meta','tiktok'))
);

COMMENT ON TABLE tbl_ad_oauth_state IS
    'Single-use, short-TTL token binding an OAuth redirect back to the operator who started it.';

CREATE INDEX IF NOT EXISTS idx_ad_oauth_state_expiry ON tbl_ad_oauth_state (expires_at);

-- Cached insights -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS tbl_ad_insight (
    insight_id          UUID          NOT NULL DEFAULT gen_random_uuid(),
    business_profile_id UUID          NOT NULL,
    provider            TEXT          NOT NULL,
    external_account_id TEXT          NOT NULL,

    period_start        DATE          NOT NULL,
    period_end          DATE          NOT NULL,

    impressions         BIGINT        NOT NULL DEFAULT 0,
    clicks              BIGINT        NOT NULL DEFAULT 0,
    spend               NUMERIC(14,2) NOT NULL DEFAULT 0,
    conversions         BIGINT        NOT NULL DEFAULT 0,
    currency            CHAR(3),

    fetched_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- The raw payload is kept deliberately: field-shape surprises across API
    -- versions are the likeliest failure mode and this is what makes them
    -- diagnosable after the fact.
    raw_response        TEXT,

    CONSTRAINT pk_ad_insight PRIMARY KEY (insight_id),
    CONSTRAINT fk_ad_insight_profile FOREIGN KEY (business_profile_id)
        REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE,
    CONSTRAINT uq_ad_insight_period UNIQUE
        (business_profile_id, provider, period_start, period_end),
    CONSTRAINT chk_ad_insight_provider CHECK (provider IN ('meta','tiktok'))
);

COMMENT ON TABLE tbl_ad_insight IS
    'Last-fetched platform metrics for one reporting period. Re-syncing a period updates the row.';

CREATE INDEX IF NOT EXISTS idx_ad_insight_profile_period
    ON tbl_ad_insight (business_profile_id, period_start DESC);
```

- [ ] **Step 2: Write the H2 mirror**

Create `db/h2/V18__ad_platform_connections.sql`. H2 2.x has no `gen_random_uuid()` and no `COMMENT ON`, so the mirror drops both — the entity's `@PrePersist` supplies the id in every code path anyway.

```sql
-- H2 mirror of db/migration/V27__module4_ad_platform_connections.sql
--
-- NOTE ON THIS MIRROR SET: db/h2 is hand-maintained, is nine migrations behind
-- db/migration, and uses divergent version numbers (this file mirrors V27 but
-- is numbered V18 because the h2 set's highest existing version is V17). It is
-- used ONLY by the `h2` runtime profile — tests build their schema from the JPA
-- entities with Flyway disabled (src/test/resources/application.properties).
--
-- Differences forced by H2: no gen_random_uuid() default (the entity's
-- @PrePersist assigns the id), and no COMMENT ON statements.

CREATE TABLE IF NOT EXISTS tbl_ad_platform_connection (
    connection_id           UUID        NOT NULL,
    business_profile_id     UUID        NOT NULL,
    provider                VARCHAR(20) NOT NULL,
    access_token_encrypted  CLOB        NOT NULL,
    refresh_token_encrypted CLOB,
    token_expires_at        TIMESTAMP WITH TIME ZONE,
    external_account_id     VARCHAR(128),
    external_account_name   VARCHAR(255),
    currency                CHAR(3),
    scopes                  CLOB,
    status                  VARCHAR(30) NOT NULL,
    connected_at            TIMESTAMP WITH TIME ZONE,
    last_synced_at          TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_ad_platform_connection PRIMARY KEY (connection_id),
    CONSTRAINT uq_ad_conn_profile_provider UNIQUE (business_profile_id, provider),
    CONSTRAINT chk_ad_conn_provider CHECK (provider IN ('meta','tiktok')),
    CONSTRAINT chk_ad_conn_status CHECK (status IN ('PENDING_ACCOUNT_SELECTION','ACTIVE','REVOKED'))
);

ALTER TABLE tbl_ad_platform_connection
    ADD CONSTRAINT fk_ad_conn_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ad_conn_profile_status
    ON tbl_ad_platform_connection (business_profile_id, status);

CREATE TABLE IF NOT EXISTS tbl_ad_oauth_state (
    state               UUID        NOT NULL,
    business_profile_id UUID        NOT NULL,
    provider            VARCHAR(20) NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at         TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_ad_oauth_state PRIMARY KEY (state),
    CONSTRAINT chk_ad_state_provider CHECK (provider IN ('meta','tiktok'))
);

CREATE INDEX IF NOT EXISTS idx_ad_oauth_state_expiry ON tbl_ad_oauth_state (expires_at);

CREATE TABLE IF NOT EXISTS tbl_ad_insight (
    insight_id          UUID          NOT NULL,
    business_profile_id UUID          NOT NULL,
    provider            VARCHAR(20)   NOT NULL,
    external_account_id VARCHAR(128)  NOT NULL,
    period_start        DATE          NOT NULL,
    period_end          DATE          NOT NULL,
    impressions         BIGINT        NOT NULL DEFAULT 0,
    clicks              BIGINT        NOT NULL DEFAULT 0,
    spend               NUMERIC(14,2) NOT NULL DEFAULT 0,
    conversions         BIGINT        NOT NULL DEFAULT 0,
    currency            CHAR(3),
    fetched_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_response        CLOB,
    CONSTRAINT pk_ad_insight PRIMARY KEY (insight_id),
    CONSTRAINT uq_ad_insight_period UNIQUE (business_profile_id, provider, period_start, period_end),
    CONSTRAINT chk_ad_insight_provider CHECK (provider IN ('meta','tiktok'))
);

ALTER TABLE tbl_ad_insight
    ADD CONSTRAINT fk_ad_insight_profile FOREIGN KEY (business_profile_id)
    REFERENCES tbl_business_profile (business_profile_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ad_insight_profile_period
    ON tbl_ad_insight (business_profile_id, period_start DESC);
```

- [ ] **Step 3: Verify the migration applies**

With Docker Postgres running (RUNNING.md §3 Path A):

Run: `cd backend/spring-boot && ./mvnw spring-boot:run`
Expected: the startup log shows `Migrating schema "public" to version "27 - module4 ad platform connections"` and the app reaches `Started CeViewApplication`. Stop it with Ctrl+C.

Then confirm the table exists:

```bash
docker exec -it ceview-postgres psql -U ceview -d ceview -c "\d tbl_ad_platform_connection"
```

Expected: the column list above, including constraints `pk_ad_platform_connection` and `uq_ad_conn_profile_provider`.

- [ ] **Step 4: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/resources/db/migration/V27__module4_ad_platform_connections.sql backend/spring-boot/src/main/resources/db/h2/V18__ad_platform_connections.sql
git commit -m "feat(module4): add ad-platform connection, oauth state, and insight tables"
```

---

### Task 4: Entities and repositories

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdPlatformConnection.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdOAuthState.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsight.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdPlatformConnectionRepository.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdOAuthStateRepository.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsightRepository.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionPersistenceTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdConnectionPersistenceTest.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Schema-and-mapping guard. The test schema is generated from these entities
 * (ddl-auto=create-drop), so this asserts the JPA mapping works end to end — it
 * does NOT exercise the Flyway SQL in V27, which no test covers.
 */
@SpringBootTest
class AdConnectionPersistenceTest {

    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private AdOAuthStateRepository stateRepo;
    @Autowired private AdInsightRepository insightRepo;
    @Autowired private BusinessProfileRepository profileRepo;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        insightRepo.deleteAll();
        connectionRepo.deleteAll();
        stateRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void assignsAnIdAndCreatedAtOnPersist() {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("cipher-text");
        conn.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);

        AdPlatformConnection saved = connectionRepo.save(conn);

        assertNotNull(saved.getConnectionId());
        assertNotNull(saved.getCreatedAt());
    }

    @Test
    void findsAConnectionByProfileAndProvider() {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.TIKTOK.key());
        conn.setAccessTokenEncrypted("cipher-text");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        connectionRepo.save(conn);

        assertTrue(connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, AdProvider.TIKTOK.key())
                .isPresent());
        assertTrue(connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, AdProvider.META.key())
                .isEmpty());
    }

    @Test
    void listsOnlyActiveConnections() {
        AdPlatformConnection active = new AdPlatformConnection();
        active.setBusinessProfileId(profileId);
        active.setProvider(AdProvider.META.key());
        active.setAccessTokenEncrypted("c");
        active.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        connectionRepo.save(active);

        AdPlatformConnection pending = new AdPlatformConnection();
        pending.setBusinessProfileId(profileId);
        pending.setProvider(AdProvider.TIKTOK.key());
        pending.setAccessTokenEncrypted("c");
        pending.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        connectionRepo.save(pending);

        assertEquals(1, connectionRepo
                .findByBusinessProfileIdAndStatus(profileId, AdPlatformConnection.STATUS_ACTIVE)
                .size());
    }

    @Test
    void roundTripsAnOAuthStateRow() {
        AdOAuthState state = new AdOAuthState();
        state.setBusinessProfileId(profileId);
        state.setProvider(AdProvider.META.key());
        state.setExpiresAt(OffsetDateTime.now().plusMinutes(10));
        UUID token = stateRepo.save(state).getState();

        Optional<AdOAuthState> found = stateRepo.findById(token);
        assertTrue(found.isPresent());
        assertNull(found.get().getConsumedAt());
    }

    @Test
    void findsAnInsightByItsUniquePeriodKey() {
        AdInsight insight = new AdInsight();
        insight.setBusinessProfileId(profileId);
        insight.setProvider(AdProvider.META.key());
        insight.setExternalAccountId("act_123");
        insight.setPeriodStart(LocalDate.of(2026, 8, 31));
        insight.setPeriodEnd(LocalDate.of(2026, 9, 6));
        insight.setImpressions(1000L);
        insight.setClicks(50L);
        insight.setSpend(new BigDecimal("250.00"));
        insight.setConversions(3L);
        insight.setCurrency("PHP");
        insightRepo.save(insight);

        assertTrue(insightRepo.findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                profileId, AdProvider.META.key(),
                LocalDate.of(2026, 8, 31), LocalDate.of(2026, 9, 6)).isPresent());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionPersistenceTest`
Expected: compilation failure — `cannot find symbol: class AdPlatformConnection`.

- [ ] **Step 3: Write the connection entity**

Create `AdPlatformConnection.java`:

```java
package com.ceview.module4.adconnections;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One operator's OAuth grant for one ad platform (V27 migration).
 *
 * <p>Status lifecycle:
 * <pre>
 *   (callback stores tokens) --> PENDING_ACCOUNT_SELECTION
 *                                      | operator picks an ad account
 *                                      v
 *                                   ACTIVE --> REVOKED  (disconnect)
 * </pre>
 *
 * <p>Only ACTIVE connections are synced — a connection without a chosen ad
 * account has nothing to report on.
 *
 * <p>The two token fields hold ciphertext from
 * {@link com.ceview.common.crypto.TokenCipher} and must never be copied into a
 * DTO or a log line.
 */
@Data
@Entity
@Table(
    name = "tbl_ad_platform_connection",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_ad_conn_profile_provider",
        columnNames = {"business_profile_id", "provider"}
    )
)
public class AdPlatformConnection {

    /** Status constants — match the CHECK constraint in V27. */
    public static final String STATUS_PENDING_ACCOUNT_SELECTION = "PENDING_ACCOUNT_SELECTION";
    public static final String STATUS_ACTIVE                    = "ACTIVE";
    public static final String STATUS_REVOKED                   = "REVOKED";

    @Id
    @Column(name = "connection_id")
    private UUID connectionId;

    @Column(name = "business_profile_id", nullable = false)   private UUID   businessProfileId;
    @Column(name = "provider", nullable = false, length = 20) private String provider;

    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;
    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;
    @Column(name = "token_expires_at") private OffsetDateTime tokenExpiresAt;

    @Column(name = "external_account_id",   length = 128) private String externalAccountId;
    @Column(name = "external_account_name", length = 255) private String externalAccountName;
    @Column(name = "currency", length = 3)                private String currency;

    @Column(name = "scopes", columnDefinition = "TEXT")     private String scopes;
    @Column(name = "status", nullable = false, length = 30) private String status;

    @Column(name = "connected_at")   private OffsetDateTime connectedAt;
    @Column(name = "last_synced_at") private OffsetDateTime lastSyncedAt;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at")     private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (connectionId == null) connectionId = UUID.randomUUID();
        if (createdAt    == null) createdAt    = OffsetDateTime.now();
        if (status       == null) status       = STATUS_PENDING_ACCOUNT_SELECTION;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 4: Write the state entity**

Create `AdOAuthState.java`:

```java
package com.ceview.module4.adconnections;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single-use token binding an in-flight OAuth redirect to the operator who
 * started it (V27 migration).
 *
 * <p>This exists because the callback is a browser redirect from Meta/TikTok
 * carrying no Authorization header — there is no JWT to resolve a tenant from,
 * so the tenant has to travel in the {@code state} parameter and be looked up
 * here. It is also the OAuth CSRF defence: an attacker cannot forge a callback
 * for a state value they never received.
 *
 * <p>Rows are consumed exactly once ({@code consumedAt}) and expire after
 * {@code AdConnectionService.STATE_TTL}.
 */
@Data
@Entity
@Table(name = "tbl_ad_oauth_state")
public class AdOAuthState {

    @Id
    @Column(name = "state")
    private UUID state;

    @Column(name = "business_profile_id", nullable = false)   private UUID   businessProfileId;
    @Column(name = "provider", nullable = false, length = 20) private String provider;

    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "expires_at", nullable = false) private OffsetDateTime expiresAt;
    @Column(name = "consumed_at")                  private OffsetDateTime consumedAt;

    @PrePersist
    void onCreate() {
        if (state     == null) state     = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 5: Write the insight entity**

Create `AdInsight.java`:

```java
package com.ceview.module4.adconnections;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The last-fetched platform metrics for one (profile, provider, period) — the
 * cache behind the Performance screen's "Sync from ad accounts" button.
 *
 * <p>Re-syncing a period updates the existing row rather than inserting a
 * second one; the unique constraint {@code uq_ad_insight_period} enforces that.
 *
 * <p>{@code rawResponse} keeps the untouched payload on purpose: when a
 * platform renames a field between API versions, the parsed columns go quietly
 * wrong and this is the only record of what actually came back.
 */
@Data
@Entity
@Table(
    name = "tbl_ad_insight",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_ad_insight_period",
        columnNames = {"business_profile_id", "provider", "period_start", "period_end"}
    )
)
public class AdInsight {

    @Id
    @Column(name = "insight_id")
    private UUID insightId;

    @Column(name = "business_profile_id", nullable = false)   private UUID   businessProfileId;
    @Column(name = "provider", nullable = false, length = 20) private String provider;
    @Column(name = "external_account_id", nullable = false, length = 128)
    private String externalAccountId;

    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "period_end",   nullable = false) private LocalDate periodEnd;

    @Column(name = "impressions", nullable = false) private long impressions;
    @Column(name = "clicks",      nullable = false) private long clicks;
    @Column(name = "spend", nullable = false, precision = 14, scale = 2)
    private BigDecimal spend = BigDecimal.ZERO;
    @Column(name = "conversions", nullable = false) private long   conversions;
    @Column(name = "currency", length = 3)          private String currency;

    @Column(name = "fetched_at", nullable = false) private OffsetDateTime fetchedAt;
    @Column(name = "raw_response", columnDefinition = "TEXT") private String rawResponse;

    @PrePersist
    void onCreate() {
        if (insightId == null) insightId = UUID.randomUUID();
        if (fetchedAt == null) fetchedAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 6: Write the three repositories**

Create `AdPlatformConnectionRepository.java`:

```java
package com.ceview.module4.adconnections;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Every query here is scoped by {@code businessProfileId} on purpose — there is
 * deliberately no "find by provider" method that crosses tenants.
 */
public interface AdPlatformConnectionRepository extends JpaRepository<AdPlatformConnection, UUID> {

    Optional<AdPlatformConnection> findByBusinessProfileIdAndProvider(UUID businessProfileId,
                                                                     String provider);

    List<AdPlatformConnection> findByBusinessProfileId(UUID businessProfileId);

    List<AdPlatformConnection> findByBusinessProfileIdAndStatus(UUID businessProfileId,
                                                               String status);
}
```

Create `AdOAuthStateRepository.java`:

```java
package com.ceview.module4.adconnections;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface AdOAuthStateRepository extends JpaRepository<AdOAuthState, UUID> {

    /**
     * Housekeeping for rows nobody came back for. Called opportunistically on
     * each authorize request — this table churns slowly enough that it does not
     * warrant a scheduled job.
     */
    @Modifying
    @Query("DELETE FROM AdOAuthState s WHERE s.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") OffsetDateTime cutoff);
}
```

Create `AdInsightRepository.java`:

```java
package com.ceview.module4.adconnections;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface AdInsightRepository extends JpaRepository<AdInsight, UUID> {

    Optional<AdInsight> findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
            UUID businessProfileId, String provider, LocalDate periodStart, LocalDate periodEnd);
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionPersistenceTest`
Expected: `Tests run: 5, Failures: 0, Errors: 0`.

If `BusinessProfile` requires fields the test does not set, add them in `setUp()` — read `module1/businessinput/BusinessProfile.java` for its `nullable = false` columns rather than guessing.

- [ ] **Step 8: Review the entities against V27 by eye**

No test covers the Flyway SQL. Open `V27__module4_ad_platform_connections.sql` and the three entities side by side and confirm every column name, nullability, and length matches. A mismatch surfaces only at runtime under the `postgres` profile, as a Hibernate schema-validation failure at startup.

- [ ] **Step 9: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/ backend/spring-boot/src/test/java/com/ceview/module4/adconnections/
git commit -m "feat(module4): add ad connection, oauth state, and insight entities"
```

---

### Task 5: Open the callback path in both security filters

The callback is a browser redirect from Meta/TikTok with no `Authorization` header. Two filters currently stand in its way: `SecurityConfig`'s `.anyRequest().authenticated()` returns 401, and `ProfileCompletionFilter` returns 403 for any authenticated operator with a blank `contactNumber`. Both need a narrow exemption for this one path.

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/config/SecurityConfig.java:42`
- Modify: `backend/spring-boot/src/main/java/com/ceview/auth/ProfileCompletionFilter.java:75-77`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdCallbackSecurityTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdCallbackSecurityTest.java`:

```java
package com.ceview.module4.adconnections;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The OAuth callback must be reachable without a JWT — it is a redirect from the
 * ad platform, not an XHR from our own frontend. Every OTHER ad-connection route
 * must stay locked down.
 *
 * <p>Guards two separate filters: SecurityConfig's authenticated-by-default rule
 * and ProfileCompletionFilter's 403 for operators without a contact number.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AdCallbackSecurityTest {

    @Autowired private MockMvc mvc;

    @Test
    void callbackIsReachableWithoutAuthentication() throws Exception {
        // Not asserting the body: with no state row this resolves to an error
        // redirect. What matters is that it is NOT 401 — i.e. the filter chain
        // let it through to the controller.
        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("code", "irrelevant")
                        .param("state", "00000000-0000-0000-0000-000000000000"))
           .andExpect(status().is3xxRedirection());
    }

    @Test
    void listingConnectionsStillRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/ad-connections"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void listingAccountsStillRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/accounts"))
           .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdCallbackSecurityTest`
Expected: `callbackIsReachableWithoutAuthentication` fails with `Status expected:<3xx> but was:<401>`. The other two pass already (nothing is mapped yet, but the 401 comes from the filter chain before routing).

- [ ] **Step 3: Open the path in SecurityConfig**

In `SecurityConfig.java`, change line 42 from:

```java
                .requestMatchers("/api/auth/**", "/actuator/**", "/error").permitAll()
```

to:

```java
                // The ad-platform OAuth callback is a browser redirect from
                // Meta/TikTok — it carries no Authorization header, so tenancy
                // travels in a single-use state token instead (see AdOAuthState).
                .requestMatchers("/api/ad-connections/*/callback").permitAll()
                .requestMatchers("/api/auth/**", "/actuator/**", "/error").permitAll()
```

- [ ] **Step 4: Exempt the path in ProfileCompletionFilter**

In `ProfileCompletionFilter.java`, change `isExempt` to:

```java
    private boolean isExempt(String path) {
        return path.startsWith("/api/auth/")
            || path.startsWith("/actuator/")
            || path.equals("/error")
            // OAuth callback: a redirect from the ad platform, not a UI call.
            // Blocking it here would 403 an operator mid-redirect with no way
            // to recover the grant they just approved.
            || isAdConnectionCallback(path);
    }

    /** Matches {@code /api/ad-connections/{provider}/callback} and nothing else. */
    private boolean isAdConnectionCallback(String path) {
        return path.startsWith("/api/ad-connections/") && path.endsWith("/callback");
    }
```

- [ ] **Step 5: Add the minimal controller so the route resolves**

The test asserts a redirect, which needs a mapped handler. Create `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java` with just the callback for now — Task 6 and later tasks add the rest:

```java
package com.ceview.module4.adconnections;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

/**
 * Submodule 4.1 — ad-platform account connections.
 *
 * <p>Every endpoint except the callback is JWT-authenticated and scoped to the
 * caller's own business profile. The callback is deliberately public; see
 * {@link AdOAuthState} for how tenancy survives that.
 */
@RestController
@RequestMapping("/api/ad-connections")
public class AdConnectionController {

    private final AdProviderProperties props;

    public AdConnectionController(AdProviderProperties props) {
        this.props = props;
    }

    /**
     * OAuth redirect target. Always answers with a 302 back to the frontend —
     * never a JSON error — because the caller here is a browser mid-redirect,
     * not our own client code.
     */
    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(@PathVariable String provider,
                                         @RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(name = "error", required = false) String error) {
        // Filled in by Task 12. For now every call is an error redirect.
        return redirectToFrontend(provider, "unhandled");
    }

    private ResponseEntity<Void> redirectToFrontend(String provider, String errorCode) {
        String url = props.getFrontendBaseUrl()
                + "/settings/platforms?adconnect_error=" + errorCode
                + "&provider=" + provider;
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdCallbackSecurityTest`
Expected: `Tests run: 3, Failures: 0, Errors: 0`.

- [ ] **Step 7: Run the security regression suite**

`SecurityLockdownVerificationTest` exists specifically to catch accidental widening of the public surface.

Run: `cd backend/spring-boot && ./mvnw test -Dtest=SecurityLockdownVerificationTest,ProfileCompletionFilterTest`
Expected: BUILD SUCCESS. If `SecurityLockdownVerificationTest` enumerates public paths and now fails, add the callback path to its expected list with a comment explaining why — do not weaken the assertion.

- [ ] **Step 8: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/config/SecurityConfig.java backend/spring-boot/src/main/java/com/ceview/auth/ProfileCompletionFilter.java backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdCallbackSecurityTest.java
git commit -m "feat(module4): permit the ad-platform OAuth callback through both auth filters"
```

---

### Task 6: DTOs and the connection-listing endpoint

Ends Phase 1: the Settings screen can ask what is connected and get a truthful answer, including "this server has no credentials for that provider".

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionDtos.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionListTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdConnectionListTest.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * GET /api/ad-connections always answers for BOTH providers, so the Settings UI
 * can render a row per provider without guessing. Meta is configured here,
 * TikTok is not — the response must distinguish them.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "ceview.adplatform.meta.app-id=test-meta-app",
        "ceview.adplatform.meta.app-secret=test-meta-secret"
})
class AdConnectionListTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AdPlatformConnectionRepository connectionRepo;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        connectionRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorId = UUID.randomUUID();
        token = jwtService.issue(operatorId, "operator@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void reportsBothProvidersWithTheirConfiguredFlag() throws Exception {
        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2))
           .andExpect(jsonPath("$[?(@.provider=='meta')].configured").value(true))
           .andExpect(jsonPath("$[?(@.provider=='tiktok')].configured").value(false))
           .andExpect(jsonPath("$[?(@.provider=='meta')].status").value("DISCONNECTED"));
    }

    @Test
    void reportsAnActiveConnectionWithItsAccountAndCurrency() throws Exception {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("cipher");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        conn.setExternalAccountId("act_123");
        conn.setExternalAccountName("Cebu Dive Ads");
        conn.setCurrency("PHP");
        connectionRepo.save(conn);

        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[?(@.provider=='meta')].status").value("ACTIVE"))
           .andExpect(jsonPath("$[?(@.provider=='meta')].accountName").value("Cebu Dive Ads"))
           .andExpect(jsonPath("$[?(@.provider=='meta')].currency").value("PHP"));
    }

    @Test
    void neverLeaksTokensToTheClient() throws Exception {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("SUPER-SECRET-CIPHERTEXT");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        connectionRepo.save(conn);

        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(content().string(org.hamcrest.Matchers.not(
                   org.hamcrest.Matchers.containsString("SUPER-SECRET-CIPHERTEXT"))))
           .andExpect(content().string(org.hamcrest.Matchers.not(
                   org.hamcrest.Matchers.containsString("accessToken"))));
    }

    @Test
    void doesNotReturnAnotherOperatorsConnection() throws Exception {
        UUID otherOperator = UUID.randomUUID();
        BusinessProfile other = new BusinessProfile();
        other.setUserId(otherOperator);
        other.setBusinessName("Someone Else");
        UUID otherProfileId = profileRepo.save(other).getBusinessProfileId();

        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(otherProfileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("cipher");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        conn.setExternalAccountName("Not Yours");
        connectionRepo.save(conn);

        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[?(@.provider=='meta')].status").value("DISCONNECTED"));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionListTest`
Expected: all four fail with 404 — no `GET /api/ad-connections` handler exists yet.

- [ ] **Step 3: Write the DTOs**

Create `AdConnectionDtos.java`. One file for all records, mirroring how `module4/dto/AnalyticsDtos.java` groups its own:

```java
package com.ceview.module4.adconnections;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Request and response shapes for the ad-connection endpoints.
 *
 * <p>Nothing here carries a token, encrypted or otherwise. That is a deliberate
 * invariant, asserted by {@code AdConnectionListTest.neverLeaksTokensToTheClient}.
 */
public final class AdConnectionDtos {

    private AdConnectionDtos() {}

    /** Status reported to the UI when no row exists for a provider. */
    public static final String STATUS_DISCONNECTED = "DISCONNECTED";

    /**
     * One row of GET /api/ad-connections.
     *
     * @param configured whether THIS SERVER has credentials for the provider —
     *                   distinct from whether this operator has connected it
     * @param status     DISCONNECTED, PENDING_ACCOUNT_SELECTION, ACTIVE, or REVOKED
     */
    public record AdConnectionView(
            String provider,
            boolean configured,
            String status,
            String accountName,
            String currency,
            OffsetDateTime connectedAt,
            OffsetDateTime lastSyncedAt
    ) {}

    /** POST /api/ad-connections/{provider}/authorize response. */
    public record AuthorizeUrlResponse(String authorizeUrl) {}

    /** One selectable ad account, from GET /{provider}/accounts. */
    public record AdAccountOption(String id, String name, String currency) {}

    /** POST /{provider}/account request body. */
    public record SelectAccountRequest(String externalAccountId) {}

    /** What one provider contributed to a sync. */
    public record InsightSource(
            String provider,
            String accountName,
            long impressions,
            long clicks,
            BigDecimal spend,
            long conversions,
            String currency
    ) {}

    /**
     * GET /api/ad-connections/insights response.
     *
     * <p>{@code impressions}/{@code clicks}/{@code spend}/{@code conversions} are
     * the combined figures the ingestion form prefills with. They are only
     * populated when every source shares a currency — otherwise the totals are
     * null, {@code warnings} explains why, and the UI offers per-source prefill
     * instead of a silently wrong sum.
     */
    public record InsightsResponse(
            String periodStart,
            String periodEnd,
            Long impressions,
            Long clicks,
            BigDecimal spend,
            Long conversions,
            String currency,
            List<InsightSource> sources,
            List<String> warnings
    ) {}
}
```

- [ ] **Step 4: Add the listing endpoint**

Replace the body of `AdConnectionController.java` with:

```java
package com.ceview.module4.adconnections;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module4.adconnections.AdConnectionDtos.AdConnectionView;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Submodule 4.1 — ad-platform account connections.
 *
 * <p>Every endpoint except the callback is JWT-authenticated and scoped to the
 * caller's own business profile via {@link CurrentBusinessProfile}. The callback
 * is deliberately public; see {@link AdOAuthState} for how tenancy survives that.
 */
@RestController
@RequestMapping("/api/ad-connections")
public class AdConnectionController {

    private final AdProviderProperties props;
    private final AdPlatformConnectionRepository connectionRepo;
    private final CurrentBusinessProfile currentBusinessProfile;

    public AdConnectionController(AdProviderProperties props,
                                  AdPlatformConnectionRepository connectionRepo,
                                  CurrentBusinessProfile currentBusinessProfile) {
        this.props = props;
        this.connectionRepo = connectionRepo;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    /**
     * One row per provider, always — a provider with no connection row reports
     * DISCONNECTED rather than being omitted, so the UI can render a stable list.
     */
    @GetMapping
    public List<AdConnectionView> list() {
        UUID profileId = currentBusinessProfile.resolveProfileId();

        Map<String, AdPlatformConnection> byProvider =
                connectionRepo.findByBusinessProfileId(profileId).stream()
                        .collect(Collectors.toMap(AdPlatformConnection::getProvider,
                                                  Function.identity()));

        return Arrays.stream(AdProvider.values())
                .map(provider -> toView(provider, byProvider.get(provider.key())))
                .toList();
    }

    private AdConnectionView toView(AdProvider provider, AdPlatformConnection conn) {
        boolean configured = props.isConfigured(provider);
        if (conn == null) {
            return new AdConnectionView(provider.key(), configured,
                    AdConnectionDtos.STATUS_DISCONNECTED, null, null, null, null);
        }
        return new AdConnectionView(
                provider.key(),
                configured,
                conn.getStatus(),
                conn.getExternalAccountName(),
                conn.getCurrency(),
                conn.getConnectedAt(),
                conn.getLastSyncedAt());
    }

    /**
     * OAuth redirect target. Always answers with a 302 back to the frontend —
     * never a JSON error — because the caller is a browser mid-redirect, not our
     * own client code.
     */
    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(@PathVariable String provider,
                                         @RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(name = "error", required = false) String error) {
        // Filled in by Task 12.
        return redirectToFrontend(provider, "unhandled");
    }

    private ResponseEntity<Void> redirectToFrontend(String provider, String errorCode) {
        String url = props.getFrontendBaseUrl()
                + "/settings/platforms?adconnect_error=" + errorCode
                + "&provider=" + provider;
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionListTest`
Expected: `Tests run: 4, Failures: 0, Errors: 0`.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend/spring-boot && ./mvnw test`
Expected: BUILD SUCCESS with no new failures.

- [ ] **Step 7: Verify Phase 1 by hand**

Start the backend with no ad credentials set and confirm it boots normally, then:

```powershell
# Log in as a seeded operator (see SEED_CREDENTIALS.md) and capture the token
$token = (Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"maria@cebudive.ph","password":"Password123!"}').accessToken

Invoke-RestMethod -Uri http://localhost:8080/api/ad-connections `
  -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json
```

Expected: two rows, both `configured: false`, both `status: DISCONNECTED`. Substitute a real seeded email/password from `SEED_CREDENTIALS.md`.

- [ ] **Step 8: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/ backend/spring-boot/src/test/java/com/ceview/module4/adconnections/
git commit -m "feat(module4): add ad-connection DTOs and GET /api/ad-connections"
```

---

## Phase 2 — Meta connect

Ends with: a real OAuth round-trip through the tunnel produces an ACTIVE connection row holding an encrypted token and a chosen ad account.

> **Before starting this phase**, open Meta's current Graph API documentation and confirm the version string, the OAuth dialog URL, the token-exchange parameters, and the `/me/adaccounts` field names. The values below reflect the v21.0 shape but Meta versions quarterly. If anything differs, change the constants and the recorded test JSON together, and record what you used in `AD_PLATFORM_SETUP.md`.

### Task 7: MockWebServer dependency, client interface, and the authorize URL

**Files:**
- Modify: `backend/spring-boot/pom.xml`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/AdPlatformClient.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientAuthorizeUrlTest.java`

- [ ] **Step 1: Add the test dependency**

In `pom.xml`, immediately after the `spring-boot-starter-test` dependency, add:

```xml
        <!-- Fakes the Meta/TikTok HTTP endpoints in client tests. The repo's
             existing convention (@MockBean the client bean) can't cover JSON
             parsing or the outgoing request shape, which is where integration
             bugs against a third-party API actually live. -->
        <dependency>
            <groupId>com.squareup.okhttp3</groupId>
            <artifactId>mockwebserver</artifactId>
            <version>4.12.0</version>
            <scope>test</scope>
        </dependency>
```

Run: `cd backend/spring-boot && ./mvnw -q dependency:resolve`
Expected: completes with no error. If the download fails, check network access before continuing.

- [ ] **Step 2: Write the failing test**

Create `MetaAdsClientAuthorizeUrlTest.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientAuthorizeUrlTest {

    private MetaAdsClient client(String appId) {
        AdProviderProperties props = new AdProviderProperties();
        props.getMeta().setAppId(appId);
        props.getMeta().setAppSecret("secret");
        props.setRedirectBaseUrl("https://tunnel.example.com");
        return new MetaAdsClient(props, "https://graph.facebook.com/v21.0",
                                 "https://www.facebook.com/v21.0/dialog/oauth");
    }

    @Test
    void includesAppIdRedirectStateAndScope() {
        String url = client("APP123").buildAuthorizeUrl("state-token-abc");
        String decoded = URLDecoder.decode(url, StandardCharsets.UTF_8);

        assertTrue(decoded.startsWith("https://www.facebook.com/v21.0/dialog/oauth?"), decoded);
        assertTrue(decoded.contains("client_id=APP123"), decoded);
        assertTrue(decoded.contains("state=state-token-abc"), decoded);
        assertTrue(decoded.contains("scope=ads_read"), decoded);
        assertTrue(decoded.contains(
                "redirect_uri=https://tunnel.example.com/api/ad-connections/meta/callback"), decoded);
    }

    @Test
    void urlEncodesTheRedirectUri() {
        // The raw URL must not contain a bare "://" inside the redirect_uri value,
        // or Meta rejects the request with an unhelpful "URL blocked" error.
        String url = client("APP123").buildAuthorizeUrl("s");
        assertTrue(url.contains("redirect_uri=https%3A%2F%2Ftunnel.example.com"), url);
    }

    @Test
    void reportsItsProvider() {
        assertEquals(AdProvider.META, client("APP123").provider());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientAuthorizeUrlTest`
Expected: compilation failure — `cannot find symbol: class MetaAdsClient`.

- [ ] **Step 4: Write the interface**

Create `client/AdPlatformClient.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;

import java.time.LocalDate;
import java.util.List;

/**
 * Everything CeView needs from one ad platform. Two implementations —
 * {@link MetaAdsClient} and {@code TikTokAdsClient} — and nothing above this
 * interface knows which platform it is talking to.
 *
 * <p>Implementations are synchronous and throw {@link AdPlatformException} on
 * any failure; callers decide whether that is fatal.
 */
public interface AdPlatformClient {

    AdProvider provider();

    /** The consent-screen URL to send the operator's browser to. */
    String buildAuthorizeUrl(String state);

    /** Trades the one-time authorization code for a usable, long-lived token. */
    TokenGrant exchangeCode(String code);

    /** The ad accounts this grant can read. */
    List<AdAccountOption> listAccounts(String accessToken);

    /** Account-level metrics for one closed reporting period, inclusive of both dates. */
    AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                LocalDate periodStart, LocalDate periodEnd);
}
```

Create `client/TokenGrant.java`:

```java
package com.ceview.module4.adconnections.client;

import java.time.OffsetDateTime;

/**
 * A usable token plus what we know about its lifetime.
 *
 * @param refreshToken null where the platform does not issue one (Meta's
 *                     long-lived token has no refresh partner — it is
 *                     re-exchanged before expiry instead)
 * @param expiresAt    null when the platform does not say
 */
public record TokenGrant(String accessToken,
                         String refreshToken,
                         OffsetDateTime expiresAt,
                         String scopes) {}
```

Create `client/AdInsightData.java`:

```java
package com.ceview.module4.adconnections.client;

import java.math.BigDecimal;

/**
 * Parsed account-level metrics for one period, plus the untouched payload they
 * came from (stored on the insight row for later diagnosis).
 */
public record AdInsightData(long impressions,
                            long clicks,
                            BigDecimal spend,
                            long conversions,
                            String currency,
                            String rawResponse) {}
```

Create `client/AdPlatformException.java`:

```java
package com.ceview.module4.adconnections.client;

/**
 * Any failure talking to an ad platform: transport, non-2xx, an in-body error
 * code, or an unparseable payload. The message is surfaced to the operator, so
 * it must never contain a token.
 */
public class AdPlatformException extends RuntimeException {

    public AdPlatformException(String message) {
        super(message);
    }

    public AdPlatformException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 5: Write MetaAdsClient with only the authorize URL**

Create `client/MetaAdsClient.java`. The remaining methods throw for now and are filled in by Tasks 8, 9, and 12:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

/**
 * Meta Graph API client — covers Facebook AND Instagram ad placements, since one
 * Meta ad account runs both.
 *
 * <p>Builds its own {@link WebClient} with an explicit timeout rather than using
 * the shared {@code fastapiClient} bean, following the precedent in
 * {@code module2/submodule21/ExternalMarketDataClient}.
 *
 * <p>The two base URLs are injected so tests can point them at a MockWebServer.
 */
@Component
public class MetaAdsClient implements AdPlatformClient {

    private static final Logger log = LoggerFactory.getLogger(MetaAdsClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    /** Read-only access to ad account performance data. Nothing more is needed. */
    private static final String SCOPE = "ads_read";

    private final AdProviderProperties props;
    private final String graphBaseUrl;
    private final String dialogUrl;
    private final WebClient http;

    public MetaAdsClient(AdProviderProperties props,
                         @Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v21.0}")
                         String graphBaseUrl,
                         @Value("${ceview.adplatform.meta.dialog-url:https://www.facebook.com/v21.0/dialog/oauth}")
                         String dialogUrl) {
        this.props = props;
        this.graphBaseUrl = graphBaseUrl;
        this.dialogUrl = dialogUrl;
        this.http = WebClient.builder().baseUrl(graphBaseUrl).build();
    }

    @Override
    public AdProvider provider() {
        return AdProvider.META;
    }

    @Override
    public String buildAuthorizeUrl(String state) {
        return UriComponentsBuilder.fromUriString(dialogUrl)
                .queryParam("client_id", props.getMeta().getAppId())
                .queryParam("redirect_uri", props.callbackUrl(AdProvider.META))
                .queryParam("state", state)
                .queryParam("scope", SCOPE)
                .queryParam("response_type", "code")
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUriString();
    }

    @Override
    public TokenGrant exchangeCode(String code) {
        throw new UnsupportedOperationException("implemented in Task 8");
    }

    @Override
    public List<AdAccountOption> listAccounts(String accessToken) {
        throw new UnsupportedOperationException("implemented in Task 9");
    }

    @Override
    public AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        throw new UnsupportedOperationException("implemented in Task 12");
    }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientAuthorizeUrlTest`
Expected: `Tests run: 3, Failures: 0, Errors: 0`.

- [ ] **Step 7: Commit** — *user runs this*

```bash
git add backend/spring-boot/pom.xml backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/ backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/
git commit -m "feat(module4): add AdPlatformClient interface and Meta authorize URL"
```

---

### Task 8: Exchange the Meta authorization code for a long-lived token

Meta's code exchange returns a short-lived token (about an hour). A second call trades it for a long-lived one (about 60 days). Both happen inside `exchangeCode` so callers never see the short-lived token.

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-token.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-long-lived-token.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-error.json`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientTokenTest.java`

- [ ] **Step 1: Save the recorded payloads**

Create `src/test/resources/adplatform/meta-token.json`:

```json
{
  "access_token": "EAAshort-lived-token",
  "token_type": "bearer",
  "expires_in": 3600
}
```

Create `src/test/resources/adplatform/meta-long-lived-token.json`:

```json
{
  "access_token": "EAAlong-lived-token",
  "token_type": "bearer",
  "expires_in": 5183944
}
```

Create `src/test/resources/adplatform/meta-error.json`:

```json
{
  "error": {
    "message": "This authorization code has been used.",
    "type": "OAuthException",
    "code": 100,
    "fbtrace_id": "A1bC2dE3f"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `MetaAdsClientTokenTest.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientTokenTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientTokenTest.class
                .getResourceAsStream("/adplatform/" + name)) {
            assertNotNull(in, "missing test fixture: " + name);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private MockResponse json(String body) {
        return new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(body);
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
    void exchangesTheCodeThenUpgradesToALongLivedToken() throws Exception {
        server.enqueue(json(fixture("meta-token.json")));
        server.enqueue(json(fixture("meta-long-lived-token.json")));

        TokenGrant grant = client.exchangeCode("AUTH-CODE-1");

        assertEquals("EAAlong-lived-token", grant.accessToken());
        assertNull(grant.refreshToken(), "Meta issues no refresh token");
        assertNotNull(grant.expiresAt());
        assertTrue(grant.expiresAt().isAfter(OffsetDateTime.now().plusDays(50)),
                   "long-lived token should be ~60 days out");
        assertEquals("ads_read", grant.scopes());
    }

    @Test
    void sendsTheCodeAppCredentialsAndRedirectUri() throws Exception {
        server.enqueue(json(fixture("meta-token.json")));
        server.enqueue(json(fixture("meta-long-lived-token.json")));

        client.exchangeCode("AUTH-CODE-1");

        RecordedRequest first = server.takeRequest();
        String path = first.getPath();
        assertTrue(path.contains("/oauth/access_token"), path);
        assertTrue(path.contains("client_id=APP123"), path);
        assertTrue(path.contains("client_secret=SECRET456"), path);
        assertTrue(path.contains("code=AUTH-CODE-1"), path);
        // The redirect_uri must match the one used at authorize time exactly,
        // or Meta rejects the exchange.
        assertTrue(path.contains("redirect_uri="), path);
    }

    @Test
    void requestsTheLongLivedTokenWithTheFbExchangeGrant() throws Exception {
        server.enqueue(json(fixture("meta-token.json")));
        server.enqueue(json(fixture("meta-long-lived-token.json")));

        client.exchangeCode("AUTH-CODE-1");
        server.takeRequest();
        RecordedRequest second = server.takeRequest();

        String path = second.getPath();
        assertTrue(path.contains("grant_type=fb_exchange_token"), path);
        assertTrue(path.contains("fb_exchange_token=EAAshort-lived-token"), path);
    }

    @Test
    void throwsWithMetasMessageOnAnOauthError() throws Exception {
        server.enqueue(new MockResponse()
                .setResponseCode(400)
                .setHeader("Content-Type", "application/json")
                .setBody(fixture("meta-error.json")));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.exchangeCode("REUSED-CODE"));
        assertTrue(e.getMessage().contains("authorization code has been used"), e.getMessage());
    }

    @Test
    void neverPutsTheAppSecretInTheExceptionMessage() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("boom"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.exchangeCode("CODE"));
        assertFalse(e.getMessage().contains("SECRET456"), e.getMessage());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientTokenTest`
Expected: 5 failures, all `UnsupportedOperationException: implemented in Task 8`.

- [ ] **Step 4: Implement the exchange**

In `MetaAdsClient.java`, add these imports:

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import java.time.OffsetDateTime;
```

Add a field and initialise it in the constructor:

```java
    private final ObjectMapper mapper = new ObjectMapper();
```

Replace the `exchangeCode` stub with:

```java
    /**
     * Two calls, deliberately hidden behind one method: Meta's code exchange
     * yields a ~1-hour token, which is useless for a nightly sync, so it is
     * immediately traded for the ~60-day long-lived token. Callers only ever
     * see the long-lived one.
     */
    @Override
    public TokenGrant exchangeCode(String code) {
        JsonNode shortLived = getJson("/oauth/access_token", uri -> uri
                .queryParam("client_id",     props.getMeta().getAppId())
                .queryParam("client_secret", props.getMeta().getAppSecret())
                .queryParam("redirect_uri",  props.callbackUrl(AdProvider.META))
                .queryParam("code",          code));

        String shortToken = text(shortLived, "access_token");
        if (shortToken == null) {
            throw new AdPlatformException("Meta returned no access_token for the authorization code");
        }

        JsonNode longLived = getJson("/oauth/access_token", uri -> uri
                .queryParam("grant_type",        "fb_exchange_token")
                .queryParam("client_id",         props.getMeta().getAppId())
                .queryParam("client_secret",     props.getMeta().getAppSecret())
                .queryParam("fb_exchange_token", shortToken));

        String longToken = text(longLived, "access_token");
        if (longToken == null) {
            throw new AdPlatformException("Meta returned no long-lived access_token");
        }

        OffsetDateTime expiresAt = null;
        JsonNode expiresIn = longLived.get("expires_in");
        if (expiresIn != null && expiresIn.isNumber()) {
            expiresAt = OffsetDateTime.now().plusSeconds(expiresIn.asLong());
        }

        log.info("[Module4] Meta token exchanged, expires_at={}", expiresAt);
        return new TokenGrant(longToken, null, expiresAt, SCOPE);
    }
```

Add these helpers at the bottom of the class:

```java
    /** A GET returning parsed JSON, with Meta's error envelope turned into an exception. */
    private JsonNode getJson(String path,
                             java.util.function.UnaryOperator<UriComponentsBuilder> query) {
        String body;
        try {
            body = http.get()
                    .uri(uriBuilder -> query.apply(
                            UriComponentsBuilder.fromPath(path)).build(true).toUri())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("Meta API " + e.getStatusCode() + ": "
                    + extractErrorMessage(e.getResponseBodyAsString()), e);
        } catch (Exception e) {
            // Deliberately does not interpolate the request URI — it carries the
            // app secret as a query parameter.
            throw new AdPlatformException("Meta API call failed: " + e.getClass().getSimpleName(), e);
        }
        return parse(body);
    }

    private JsonNode parse(String body) {
        try {
            return mapper.readTree(body == null ? "{}" : body);
        } catch (Exception e) {
            throw new AdPlatformException("Meta returned a non-JSON response", e);
        }
    }

    /** Pulls {@code error.message} out of Meta's error envelope, falling back to the raw body. */
    private String extractErrorMessage(String body) {
        try {
            JsonNode error = mapper.readTree(body).get("error");
            if (error != null && error.get("message") != null) {
                return error.get("message").asText();
            }
        } catch (Exception ignored) {
            // fall through
        }
        return body == null || body.isBlank() ? "(empty body)" : body;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }
```

Note the `uri` lambda uses `UriComponentsBuilder.fromPath(path)` and `build(true)` so the already-encoded query values are not double-encoded. If `WebClient` complains about a relative URI, prepend `graphBaseUrl` inside the lambda instead.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientTokenTest`
Expected: `Tests run: 5, Failures: 0, Errors: 0`.

- [ ] **Step 6: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientTokenTest.java backend/spring-boot/src/test/resources/adplatform/
git commit -m "feat(module4): exchange Meta authorization code for a long-lived token"
```

---

### Task 9: List the Meta ad accounts a grant can read

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-adaccounts.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-adaccounts-page2.json`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientAccountsTest.java`

- [ ] **Step 1: Save the recorded payloads**

Create `meta-adaccounts.json` — note the `paging.next` cursor, which is why paging must be handled:

```json
{
  "data": [
    { "id": "act_111111111", "name": "Cebu Dive Co. Ads", "currency": "PHP", "account_status": 1 },
    { "id": "act_222222222", "name": "Personal Test Account", "currency": "USD", "account_status": 1 }
  ],
  "paging": {
    "cursors": { "before": "MAZDZD", "after": "MjQZD" },
    "next": "PAGE_2_URL"
  }
}
```

Create `meta-adaccounts-page2.json`:

```json
{
  "data": [
    { "id": "act_333333333", "name": "Second Page Account", "currency": "PHP", "account_status": 2 }
  ],
  "paging": {
    "cursors": { "before": "NjQZD", "after": "NzQZD" }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `MetaAdsClientAccountsTest.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
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

class MetaAdsClientAccountsTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientAccountsTest.class
                .getResourceAsStream("/adplatform/" + name)) {
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
    void parsesIdNameAndCurrency() throws Exception {
        server.enqueue(json(fixture("meta-adaccounts.json").replace("PAGE_2_URL", "")));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(2, accounts.size());
        assertEquals("act_111111111", accounts.get(0).id());
        assertEquals("Cebu Dive Co. Ads", accounts.get(0).name());
        assertEquals("PHP", accounts.get(0).currency());
        assertEquals("USD", accounts.get(1).currency());
    }

    @Test
    void requestsTheFieldsItParsesAndSendsTheToken() throws Exception {
        server.enqueue(json(fixture("meta-adaccounts.json").replace("PAGE_2_URL", "")));

        client.listAccounts("TOKEN");

        RecordedRequest request = server.takeRequest();
        String path = request.getPath();
        assertTrue(path.contains("/me/adaccounts"), path);
        assertTrue(path.contains("fields=id%2Cname%2Ccurrency")
                || path.contains("fields=id,name,currency"), path);
        assertTrue(path.contains("access_token=TOKEN"), path);
    }

    @Test
    void followsThePagingCursor() throws Exception {
        String page2Url = server.url("/v21.0/me/adaccounts?after=MjQZD").toString();
        server.enqueue(json(fixture("meta-adaccounts.json").replace("PAGE_2_URL", page2Url)));
        server.enqueue(json(fixture("meta-adaccounts-page2.json")));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(3, accounts.size(), "should include the second page");
        assertEquals("act_333333333", accounts.get(2).id());
    }

    @Test
    void returnsAnEmptyListWhenTheGrantSeesNoAdAccounts() throws Exception {
        // Common for a brand-new Meta developer account with no Business
        // Portfolio — the UI must show "no ad accounts found", not an error.
        server.enqueue(json("{\"data\":[]}"));

        assertTrue(client.listAccounts("TOKEN").isEmpty());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientAccountsTest`
Expected: 4 failures, all `UnsupportedOperationException: implemented in Task 9`.

- [ ] **Step 4: Implement listAccounts**

In `MetaAdsClient.java`, add imports:

```java
import java.util.ArrayList;
```

Replace the `listAccounts` stub with:

```java
    /**
     * Every ad account this grant can read, following Meta's cursor paging.
     *
     * <p>An operator with an agency or several businesses genuinely has more
     * than one, and the ordering is not documented as stable — which is why the
     * operator picks rather than the code assuming the first is right.
     */
    @Override
    public List<AdAccountOption> listAccounts(String accessToken) {
        List<AdAccountOption> accounts = new ArrayList<>();

        JsonNode page = getJson("/me/adaccounts", uri -> uri
                .queryParam("fields", "id,name,currency")
                .queryParam("limit", 100)
                .queryParam("access_token", accessToken));

        while (page != null) {
            JsonNode data = page.get("data");
            if (data != null && data.isArray()) {
                for (JsonNode account : data) {
                    accounts.add(new AdAccountOption(
                            text(account, "id"),
                            text(account, "name"),
                            text(account, "currency")));
                }
            }

            String next = page.path("paging").path("next").asText(null);
            if (next == null || next.isBlank()) break;
            if (accounts.size() > 500) {
                log.warn("[Module4] Meta ad-account paging exceeded 500 rows; stopping");
                break;
            }
            page = getAbsoluteJson(next);
        }

        return accounts;
    }

    /** Follows a fully-qualified paging URL that Meta hands back verbatim. */
    private JsonNode getAbsoluteJson(String absoluteUrl) {
        try {
            String body = WebClient.create().get()
                    .uri(absoluteUrl)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            return parse(body);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("Meta paging request " + e.getStatusCode() + ": "
                    + extractErrorMessage(e.getResponseBodyAsString()), e);
        } catch (Exception e) {
            throw new AdPlatformException("Meta paging request failed: "
                    + e.getClass().getSimpleName(), e);
        }
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientAccountsTest`
Expected: `Tests run: 4, Failures: 0, Errors: 0`.

- [ ] **Step 6: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientAccountsTest.java backend/spring-boot/src/test/resources/adplatform/
git commit -m "feat(module4): list Meta ad accounts with cursor paging"
```

---

### Task 10: AdConnectionService — state lifecycle and grant storage

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionService.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionsConfig.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionServiceTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdConnectionServiceTest.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The state token is the only thing tying an un-authenticated callback back to
 * an operator, so its rules — single use, short TTL, provider-bound — are
 * security properties, not conveniences. Each has its own test.
 */
@SpringBootTest
class AdConnectionServiceTest {

    @Autowired private AdConnectionService service;
    @Autowired private AdOAuthStateRepository stateRepo;
    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private TokenCipher tokenCipher;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        connectionRepo.deleteAll();
        stateRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void mintsAStateBoundToTheProfileAndProvider() {
        UUID state = service.mintState(profileId, AdProvider.META);

        AdOAuthState saved = stateRepo.findById(state).orElseThrow();
        assertEquals(profileId, saved.getBusinessProfileId());
        assertEquals("meta", saved.getProvider());
        assertNull(saved.getConsumedAt());
        assertTrue(saved.getExpiresAt().isAfter(OffsetDateTime.now()));
    }

    @Test
    void consumesAValidStateExactlyOnce() {
        UUID state = service.mintState(profileId, AdProvider.META);

        assertEquals(profileId, service.consumeState(state, AdProvider.META));
        // A replayed callback must not resolve to a tenant a second time.
        assertThrows(IllegalStateException.class,
                () -> service.consumeState(state, AdProvider.META));
    }

    @Test
    void rejectsAStateMintedForAnotherProvider() {
        UUID state = service.mintState(profileId, AdProvider.META);
        assertThrows(IllegalStateException.class,
                () -> service.consumeState(state, AdProvider.TIKTOK));
    }

    @Test
    void rejectsAnExpiredState() {
        AdOAuthState expired = new AdOAuthState();
        expired.setBusinessProfileId(profileId);
        expired.setProvider(AdProvider.META.key());
        expired.setExpiresAt(OffsetDateTime.now().minusMinutes(1));
        UUID state = stateRepo.save(expired).getState();

        assertThrows(IllegalStateException.class,
                () -> service.consumeState(state, AdProvider.META));
    }

    @Test
    void rejectsAnUnknownState() {
        assertThrows(IllegalStateException.class,
                () -> service.consumeState(UUID.randomUUID(), AdProvider.META));
    }

    @Test
    void storesTheGrantEncryptedAndPendingAccountSelection() {
        TokenGrant grant = new TokenGrant("PLAINTEXT-TOKEN", null,
                OffsetDateTime.now().plusDays(60), "ads_read");

        service.storeGrant(profileId, AdProvider.META, grant);

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION, saved.getStatus());
        assertNotEquals("PLAINTEXT-TOKEN", saved.getAccessTokenEncrypted(),
                        "the token must not be stored in the clear");
        assertEquals("PLAINTEXT-TOKEN", tokenCipher.decrypt(saved.getAccessTokenEncrypted()));
        assertNotNull(saved.getConnectedAt());
    }

    @Test
    void reconnectingReplacesTheExistingGrantRatherThanDuplicatingIt() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("FIRST", null, null, "ads_read"));
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("SECOND", null, null, "ads_read"));

        assertEquals(1, connectionRepo.findByBusinessProfileId(profileId).size());
        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals("SECOND", tokenCipher.decrypt(saved.getAccessTokenEncrypted()));
    }

    @Test
    void selectingAnAccountActivatesTheConnection() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));

        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_999", "Dive Ads", "PHP"));

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals(AdPlatformConnection.STATUS_ACTIVE, saved.getStatus());
        assertEquals("act_999", saved.getExternalAccountId());
        assertEquals("Dive Ads", saved.getExternalAccountName());
        assertEquals("PHP", saved.getCurrency());
    }

    @Test
    void disconnectingDiscardsTheTokens() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", "REFRESH", null, "ads_read"));

        service.disconnect(profileId, AdProvider.META);

        Optional<AdPlatformConnection> saved =
                connectionRepo.findByBusinessProfileIdAndProvider(profileId, "meta");
        assertTrue(saved.isPresent(), "the row is kept as an audit trail");
        assertEquals(AdPlatformConnection.STATUS_REVOKED, saved.get().getStatus());
        assertEquals("", saved.get().getAccessTokenEncrypted());
        assertNull(saved.get().getRefreshTokenEncrypted());
    }

    @Test
    void decryptsAnActiveConnectionsAccessToken() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("USABLE-TOKEN", null, null, "ads_read"));
        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();

        assertEquals("USABLE-TOKEN", service.accessTokenOf(conn));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionServiceTest`
Expected: compilation failure — `cannot find symbol: class AdConnectionService`.

- [ ] **Step 3: Write the cipher bean configuration**

`TokenCipher` throws when the key is missing, so it must not be a blanket `@Component`. Create `AdConnectionsConfig.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module4.adconnections.client.AdPlatformClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Wiring for the ad-connection feature.
 *
 * <p>The {@link TokenCipher} bean is always registered, but a blank key produces
 * a cipher that throws on first use rather than at startup — the same
 * degrade-gracefully posture as {@code FirebaseConfig}: an environment with no
 * ad credentials must still boot, and the endpoints report 503 instead.
 */
@Configuration
public class AdConnectionsConfig {

    @Bean
    public TokenCipher tokenCipher(
            @Value("${ceview.security.token-encryption-key:}") String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            return new UnconfiguredTokenCipher();
        }
        return new TokenCipher(base64Key);
    }

    /** Lookup from provider key to its client, so the controller stays provider-agnostic. */
    @Bean
    public Map<AdProvider, AdPlatformClient> adPlatformClients(List<AdPlatformClient> clients) {
        return clients.stream().collect(
                Collectors.toMap(AdPlatformClient::provider, Function.identity()));
    }

    /**
     * Stands in when no encryption key is configured. Every operation fails
     * loudly; nothing silently stores a token in the clear.
     */
    static class UnconfiguredTokenCipher extends TokenCipher {
        // A syntactically valid throwaway key so the super constructor succeeds.
        private static final String PLACEHOLDER =
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

        UnconfiguredTokenCipher() {
            super(PLACEHOLDER);
        }

        @Override
        public String encrypt(String plaintext) {
            throw new IllegalStateException(
                    "TOKEN_ENCRYPTION_KEY is not configured; refusing to store an ad-platform token");
        }

        @Override
        public String decrypt(String encrypted) {
            throw new IllegalStateException(
                    "TOKEN_ENCRYPTION_KEY is not configured; cannot read a stored ad-platform token");
        }
    }
}
```

`TokenCipher`'s methods must be non-final for this subclass to work — they already are. Its class declaration must also not be `final`; confirm Task 1's version is `public class TokenCipher`.

- [ ] **Step 4: Write the service**

Create `AdConnectionService.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Owns the connection lifecycle: minting and consuming OAuth state, storing an
 * encrypted grant, recording the operator's account choice, and disconnecting.
 *
 * <p>It does not talk to the platforms — that is {@code AdPlatformClient}'s job.
 */
@Service
public class AdConnectionService {

    private static final Logger log = LoggerFactory.getLogger(AdConnectionService.class);

    /**
     * How long an operator has to complete the consent screen. Ten minutes is
     * generous for a redirect flow and short enough that a leaked state value
     * is not useful for long.
     */
    static final Duration STATE_TTL = Duration.ofMinutes(10);

    private final AdOAuthStateRepository stateRepo;
    private final AdPlatformConnectionRepository connectionRepo;
    private final TokenCipher tokenCipher;

    public AdConnectionService(AdOAuthStateRepository stateRepo,
                               AdPlatformConnectionRepository connectionRepo,
                               TokenCipher tokenCipher) {
        this.stateRepo = stateRepo;
        this.connectionRepo = connectionRepo;
        this.tokenCipher = tokenCipher;
    }

    /**
     * Creates the single-use token that carries this operator's identity through
     * the un-authenticated callback.
     */
    @Transactional
    public UUID mintState(UUID businessProfileId, AdProvider provider) {
        // Opportunistic housekeeping — rows nobody came back for.
        stateRepo.deleteExpiredBefore(OffsetDateTime.now().minusDays(1));

        AdOAuthState state = new AdOAuthState();
        state.setBusinessProfileId(businessProfileId);
        state.setProvider(provider.key());
        state.setExpiresAt(OffsetDateTime.now().plus(STATE_TTL));
        return stateRepo.save(state).getState();
    }

    /**
     * Validates and burns a state token.
     *
     * @return the business profile that started this flow
     * @throws IllegalStateException if the token is unknown, expired, already
     *         used, or was minted for a different provider — the caller turns
     *         this into an error redirect, never a stack trace in the browser
     */
    @Transactional
    public UUID consumeState(UUID state, AdProvider provider) {
        AdOAuthState row = stateRepo.findById(state)
                .orElseThrow(() -> new IllegalStateException("unknown oauth state"));

        if (row.getConsumedAt() != null) {
            throw new IllegalStateException("oauth state already used");
        }
        if (row.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new IllegalStateException("oauth state expired");
        }
        if (!row.getProvider().equals(provider.key())) {
            throw new IllegalStateException("oauth state was minted for a different provider");
        }

        row.setConsumedAt(OffsetDateTime.now());
        stateRepo.save(row);
        return row.getBusinessProfileId();
    }

    /**
     * Persists a fresh grant, replacing any existing one for this provider so a
     * reconnect does not violate {@code uq_ad_conn_profile_provider}.
     *
     * <p>The connection lands in PENDING_ACCOUNT_SELECTION: a grant without a
     * chosen ad account cannot be synced.
     */
    @Transactional
    public void storeGrant(UUID businessProfileId, AdProvider provider, TokenGrant grant) {
        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(businessProfileId, provider.key())
                .orElseGet(AdPlatformConnection::new);

        conn.setBusinessProfileId(businessProfileId);
        conn.setProvider(provider.key());
        conn.setAccessTokenEncrypted(tokenCipher.encrypt(grant.accessToken()));
        conn.setRefreshTokenEncrypted(grant.refreshToken() == null
                ? null : tokenCipher.encrypt(grant.refreshToken()));
        conn.setTokenExpiresAt(grant.expiresAt());
        conn.setScopes(grant.scopes());
        conn.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        conn.setConnectedAt(OffsetDateTime.now());
        // A reconnect may be to a different account entirely — clear the old choice.
        conn.setExternalAccountId(null);
        conn.setExternalAccountName(null);
        conn.setCurrency(null);

        connectionRepo.save(conn);
        log.info("[Module4] stored {} grant for profile={}", provider.key(), businessProfileId);
    }

    /** Records which ad account to report on, and activates the connection. */
    @Transactional
    public AdPlatformConnection selectAccount(UUID businessProfileId, AdProvider provider,
                                              AdAccountOption account) {
        AdPlatformConnection conn = requireConnection(businessProfileId, provider);

        conn.setExternalAccountId(account.id());
        conn.setExternalAccountName(account.name());
        conn.setCurrency(account.currency());
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);

        log.info("[Module4] {} connection activated for profile={} account={}",
                 provider.key(), businessProfileId, account.id());
        return connectionRepo.save(conn);
    }

    /**
     * Discards the tokens and marks the connection revoked. The row itself is
     * kept: "this operator once connected Meta and disconnected" is worth
     * knowing, and historical insight rows still reference the provider.
     */
    @Transactional
    public void disconnect(UUID businessProfileId, AdProvider provider) {
        connectionRepo.findByBusinessProfileIdAndProvider(businessProfileId, provider.key())
                .ifPresent(conn -> {
                    conn.setAccessTokenEncrypted("");
                    conn.setRefreshTokenEncrypted(null);
                    conn.setTokenExpiresAt(null);
                    conn.setStatus(AdPlatformConnection.STATUS_REVOKED);
                    connectionRepo.save(conn);
                    log.info("[Module4] {} connection revoked for profile={}",
                             provider.key(), businessProfileId);
                });
    }

    /** The usable, decrypted access token for a stored connection. */
    public String accessTokenOf(AdPlatformConnection conn) {
        return tokenCipher.decrypt(conn.getAccessTokenEncrypted());
    }

    public AdPlatformConnection requireConnection(UUID businessProfileId, AdProvider provider) {
        return connectionRepo
                .findByBusinessProfileIdAndProvider(businessProfileId, provider.key())
                .filter(c -> !AdPlatformConnection.STATUS_REVOKED.equals(c.getStatus()))
                .orElseThrow(() -> new IllegalStateException(
                        "no active " + provider.key() + " connection for this operator"));
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionServiceTest`
Expected: `Tests run: 10, Failures: 0, Errors: 0`.

- [ ] **Step 6: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionService.java backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionsConfig.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionServiceTest.java
git commit -m "feat(module4): add AdConnectionService state lifecycle and grant storage"
```

---

### Task 11: Wire the connect endpoints

Completes Phase 2: authorize, callback, accounts, account selection, and disconnect.

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionFlowTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdConnectionFlowTest.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.client.AdPlatformClient;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end through the controller with the HTTP client mocked — the client's
 * own request/response handling is covered by the MockWebServer tests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "ceview.adplatform.meta.app-id=test-meta-app",
        "ceview.adplatform.meta.app-secret=test-meta-secret",
        "ceview.adplatform.redirect-base-url=https://tunnel.example.com",
        "ceview.adplatform.frontend-base-url=http://localhost:5173"
})
class AdConnectionFlowTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private AdOAuthStateRepository stateRepo;
    @Autowired private AdConnectionService service;

    /** Replaces the real Meta client so no network call happens. */
    @MockBean private com.ceview.module4.adconnections.client.MetaAdsClient metaClient;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        connectionRepo.deleteAll();
        stateRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorId = UUID.randomUUID();
        token = jwtService.issue(operatorId, "operator@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();

        when(metaClient.provider()).thenReturn(AdProvider.META);
        when(metaClient.buildAuthorizeUrl(anyString()))
                .thenAnswer(inv -> "https://facebook.test/dialog?state=" + inv.getArgument(0));
    }

    @Test
    void authorizeReturnsAUrlAndPersistsAState() throws Exception {
        mvc.perform(post("/api/ad-connections/meta/authorize")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.authorizeUrl").exists());

        org.junit.jupiter.api.Assertions.assertEquals(1, stateRepo.count());
    }

    @Test
    void authorizeReturns503WhenTheProviderIsNotConfigured() throws Exception {
        // TikTok has no app id in this test's properties.
        mvc.perform(post("/api/ad-connections/tiktok/authorize")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isServiceUnavailable())
           .andExpect(jsonPath("$.code").value("AD_PROVIDER_NOT_CONFIGURED"));
    }

    @Test
    void callbackStoresTheGrantAndRedirectsToTheFrontend() throws Exception {
        when(metaClient.exchangeCode("CODE-1"))
                .thenReturn(new TokenGrant("TOKEN", null, null, "ads_read"));
        UUID state = service.mintState(profileId, AdProvider.META);

        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("code", "CODE-1")
                        .param("state", state.toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   "http://localhost:5173/settings/platforms?adconnect=meta"));

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(
                AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION, saved.getStatus());
    }

    @Test
    void callbackRedirectsWithAnErrorWhenTheOperatorDeclinesConsent() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("error", "access_denied")
                        .param("state", UUID.randomUUID().toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   org.hamcrest.Matchers.containsString("adconnect_error=access_denied")));
    }

    @Test
    void callbackRedirectsWithAnErrorForAnInvalidState() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("code", "CODE-1")
                        .param("state", UUID.randomUUID().toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   org.hamcrest.Matchers.containsString("adconnect_error=invalid_state")));
    }

    @Test
    void accountsListsWhatTheGrantCanSee() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption("act_1", "Dive Ads", "PHP"),
                new AdAccountOption("act_2", "Test", "USD")));

        mvc.perform(get("/api/ad-connections/meta/accounts")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2))
           .andExpect(jsonPath("$[0].id").value("act_1"))
           .andExpect(jsonPath("$[0].currency").value("PHP"));
    }

    @Test
    void selectingAnAccountActivatesTheConnection() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption("act_1", "Dive Ads", "PHP")));

        mvc.perform(post("/api/ad-connections/meta/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalAccountId\":\"act_1\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("ACTIVE"))
           .andExpect(jsonPath("$.accountName").value("Dive Ads"))
           .andExpect(jsonPath("$.currency").value("PHP"));
    }

    @Test
    void selectingAnAccountTheGrantCannotSeeIsRejected() throws Exception {
        // Guards against a client posting an arbitrary ad account id.
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption("act_1", "Dive Ads", "PHP")));

        mvc.perform(post("/api/ad-connections/meta/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalAccountId\":\"act_SOMEONE_ELSE\"}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void disconnectRevokesTheConnection() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));

        mvc.perform(delete("/api/ad-connections/meta")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(
                AdPlatformConnection.STATUS_REVOKED, saved.getStatus());
    }

    @Test
    void anUnknownProviderIsA400NotA500() throws Exception {
        mvc.perform(post("/api/ad-connections/naver/authorize")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionFlowTest`
Expected: failures — the authorize, accounts, account, and delete routes return 404 or 405.

- [ ] **Step 3: Implement the endpoints**

Replace `AdConnectionController.java` with:

```java
package com.ceview.module4.adconnections;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module4.adconnections.AdConnectionDtos.*;
import com.ceview.module4.adconnections.client.AdPlatformClient;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Submodule 4.1 — ad-platform account connections.
 *
 * <p>Every endpoint except {@link #callback} is JWT-authenticated and scoped to
 * the caller's own business profile via {@link CurrentBusinessProfile}. The
 * callback is public because it is a browser redirect from the platform; see
 * {@link AdOAuthState} for how tenancy survives that.
 *
 * <p>A provider with no credentials on this server answers 503
 * {@code AD_PROVIDER_NOT_CONFIGURED} rather than failing at startup — the same
 * posture {@code AuthController} takes when Firebase is absent.
 */
@RestController
@RequestMapping("/api/ad-connections")
public class AdConnectionController {

    private static final Logger log = LoggerFactory.getLogger(AdConnectionController.class);

    private final AdProviderProperties props;
    private final AdPlatformConnectionRepository connectionRepo;
    private final AdConnectionService service;
    private final CurrentBusinessProfile currentBusinessProfile;
    private final Map<AdProvider, AdPlatformClient> clients;

    public AdConnectionController(AdProviderProperties props,
                                  AdPlatformConnectionRepository connectionRepo,
                                  AdConnectionService service,
                                  CurrentBusinessProfile currentBusinessProfile,
                                  Map<AdProvider, AdPlatformClient> clients) {
        this.props = props;
        this.connectionRepo = connectionRepo;
        this.service = service;
        this.currentBusinessProfile = currentBusinessProfile;
        this.clients = clients;
    }

    // ── Listing ──────────────────────────────────────────────────────────────

    /**
     * One row per provider, always — a provider with no connection reports
     * DISCONNECTED rather than being omitted, so the UI renders a stable list.
     */
    @GetMapping
    public List<AdConnectionView> list() {
        UUID profileId = currentBusinessProfile.resolveProfileId();

        Map<String, AdPlatformConnection> byProvider =
                connectionRepo.findByBusinessProfileId(profileId).stream()
                        .collect(Collectors.toMap(AdPlatformConnection::getProvider,
                                                  Function.identity()));

        return Arrays.stream(AdProvider.values())
                .map(provider -> toView(provider, byProvider.get(provider.key())))
                .toList();
    }

    // ── Connect ──────────────────────────────────────────────────────────────

    @PostMapping("/{provider}/authorize")
    public AuthorizeUrlResponse authorize(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);

        UUID profileId = currentBusinessProfile.resolveProfileId();
        UUID state = service.mintState(profileId, p);
        return new AuthorizeUrlResponse(clientFor(p).buildAuthorizeUrl(state.toString()));
    }

    /**
     * OAuth redirect target. Always answers 302 back to the frontend — never a
     * JSON error — because the caller is a browser mid-redirect, not our own
     * client code. Failures are conveyed as an {@code adconnect_error} param.
     */
    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(@PathVariable String provider,
                                         @RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(name = "error", required = false) String error) {
        AdProvider p;
        try {
            p = AdProvider.fromKey(provider);
        } catch (IllegalArgumentException e) {
            return errorRedirect(provider, "unknown_provider");
        }

        // The operator declined on the consent screen, or the platform refused.
        if (error != null && !error.isBlank()) {
            log.info("[Module4] {} consent not granted: {}", provider, error);
            return errorRedirect(provider, error);
        }
        if (code == null || code.isBlank() || state == null || state.isBlank()) {
            return errorRedirect(provider, "missing_code_or_state");
        }

        UUID profileId;
        try {
            profileId = service.consumeState(UUID.fromString(state), p);
        } catch (IllegalArgumentException | IllegalStateException e) {
            log.warn("[Module4] {} callback rejected: {}", provider, e.getMessage());
            return errorRedirect(provider, "invalid_state");
        }

        try {
            TokenGrant grant = clientFor(p).exchangeCode(code);
            service.storeGrant(profileId, p, grant);
        } catch (AdPlatformException | IllegalStateException e) {
            log.error("[Module4] {} token exchange failed: {}", provider, e.getMessage());
            return errorRedirect(provider, "token_exchange_failed");
        }

        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(props.getFrontendBaseUrl()
                        + "/settings/platforms?adconnect=" + p.key()))
                .build();
    }

    // ── Account selection ────────────────────────────────────────────────────

    @GetMapping("/{provider}/accounts")
    public List<AdAccountOption> accounts(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        return listAccountsFor(p, currentBusinessProfile.resolveProfileId());
    }

    @PostMapping("/{provider}/account")
    public AdConnectionView selectAccount(@PathVariable String provider,
                                          @RequestBody SelectAccountRequest body) {
        AdProvider p = parseProvider(provider);
        requireConfigured(p);
        UUID profileId = currentBusinessProfile.resolveProfileId();

        if (body == null || body.externalAccountId() == null || body.externalAccountId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "externalAccountId is required");
        }

        // Re-fetch rather than trusting the posted id: this is the only thing
        // stopping a client from binding the connection to an arbitrary account.
        AdAccountOption chosen = listAccountsFor(p, profileId).stream()
                .filter(a -> body.externalAccountId().equals(a.id()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "that ad account is not available to this connection"));

        return toView(p, service.selectAccount(profileId, p, chosen));
    }

    @DeleteMapping("/{provider}")
    public ResponseEntity<Void> disconnect(@PathVariable String provider) {
        AdProvider p = parseProvider(provider);
        service.disconnect(currentBusinessProfile.resolveProfileId(), p);
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private List<AdAccountOption> listAccountsFor(AdProvider p, UUID profileId) {
        AdPlatformConnection conn;
        try {
            conn = service.requireConnection(profileId, p);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        try {
            return clientFor(p).listAccounts(service.accessTokenOf(conn));
        } catch (AdPlatformException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private AdConnectionView toView(AdProvider provider, AdPlatformConnection conn) {
        boolean configured = props.isConfigured(provider);
        if (conn == null) {
            return new AdConnectionView(provider.key(), configured,
                    AdConnectionDtos.STATUS_DISCONNECTED, null, null, null, null);
        }
        return new AdConnectionView(provider.key(), configured, conn.getStatus(),
                conn.getExternalAccountName(), conn.getCurrency(),
                conn.getConnectedAt(), conn.getLastSyncedAt());
    }

    private AdProvider parseProvider(String key) {
        try {
            return AdProvider.fromKey(key);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown ad provider: " + key);
        }
    }

    private void requireConfigured(AdProvider provider) {
        if (!props.isConfigured(provider)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AD_PROVIDER_NOT_CONFIGURED");
        }
    }

    private AdPlatformClient clientFor(AdProvider provider) {
        AdPlatformClient client = clients.get(provider);
        if (client == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AD_PROVIDER_NOT_CONFIGURED");
        }
        return client;
    }

    private ResponseEntity<Void> errorRedirect(String provider, String errorCode) {
        String url = props.getFrontendBaseUrl()
                + "/settings/platforms?adconnect_error=" + errorCode
                + "&provider=" + provider;
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }
}
```

- [ ] **Step 4: Check the 503 body shape**

The test asserts `$.code == "AD_PROVIDER_NOT_CONFIGURED"`. Read `common/ApiExceptionHandler.java` and confirm how it renders a `ResponseStatusException` — if it emits `{"error": ...}` rather than `{"code": ...}`, either add a handler branch that maps this reason to a `code` field, or change the test to assert the shape the handler actually produces. Do not leave the two disagreeing.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdConnectionFlowTest`
Expected: `Tests run: 10, Failures: 0, Errors: 0`.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend/spring-boot && ./mvnw test`
Expected: BUILD SUCCESS.

- [ ] **Step 7: Verify Phase 2 against the real Meta API**

This is the first point where the tunnel is needed. Follow `AD_PLATFORM_SETUP.md` §4–§6 (written in Task 24 — if you are executing in order, write the env-var section of that guide now, or set the variables by hand). Then:

1. Start the tunnel and the backend with `META_APP_ID`, `META_APP_SECRET`, `OAUTH_REDIRECT_BASE_URL`, and `TOKEN_ENCRYPTION_KEY` set.
2. `POST /api/ad-connections/meta/authorize` with a valid JWT, and open the returned `authorizeUrl` in a browser.
3. Complete the consent screen.

Expected: the browser lands on `http://localhost:5173/settings/platforms?adconnect=meta`, and:

```bash
docker exec -it ceview-postgres psql -U ceview -d ceview \
  -c "SELECT provider, status, left(access_token_encrypted, 24) FROM tbl_ad_platform_connection;"
```

shows one `meta` row with status `PENDING_ACCOUNT_SELECTION` and a token column that is unreadable Base64 — not a string starting `EAA`.

- [ ] **Step 8: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdConnectionFlowTest.java
git commit -m "feat(module4): wire ad-platform authorize, callback, accounts, and disconnect"
```

---

## Phase 3 — Meta insights

Ends with: a `curl` against the running backend returns the real ad account's numbers and writes a `tbl_ad_insight` row.

### Task 12: Fetch Meta account-level insights

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-insights.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/meta-insights-empty.json`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientInsightsTest.java`

**A note on conversions.** Meta does not return a single "conversions" number. It returns an `actions` array whose entries are typed — page engagement, link clicks, pixel leads, purchases. Summing all of them would double-count wildly (a click is also an action). This implementation sums only `offsite_conversion.*` and `lead`/`purchase` action types, which is the closest honest analogue of the "Conversions (leads)" field the ingestion form asks for. Record this choice in `AD_PLATFORM_SETUP.md` so nobody later assumes the number means something else.

- [ ] **Step 1: Save the recorded payloads**

Create `meta-insights.json`. Note every numeric value arrives as a **string** — this is Meta's actual behaviour and the parser must handle it:

```json
{
  "data": [
    {
      "impressions": "48210",
      "clicks": "1327",
      "spend": "4820.55",
      "actions": [
        { "action_type": "post_engagement", "value": "2210" },
        { "action_type": "link_click", "value": "1327" },
        { "action_type": "offsite_conversion.fb_pixel_lead", "value": "34" },
        { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "11" }
      ],
      "date_start": "2026-08-31",
      "date_stop": "2026-09-06"
    }
  ],
  "paging": { "cursors": { "before": "MAZDZD", "after": "MAZDZD" } }
}
```

Create `meta-insights-empty.json` — what a real but unspent ad account returns:

```json
{
  "data": [],
  "paging": { "cursors": { "before": "MAZDZD", "after": "MAZDZD" } }
}
```

- [ ] **Step 2: Write the failing test**

Create `MetaAdsClientInsightsTest.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientInsightsTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static final LocalDate START = LocalDate.of(2026, 8, 31);
    private static final LocalDate END   = LocalDate.of(2026, 9, 6);

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientInsightsTest.class
                .getResourceAsStream("/adplatform/" + name)) {
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
    void parsesStringEncodedNumbers() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertEquals(48210L, data.impressions());
        assertEquals(1327L, data.clicks());
        assertEquals(0, new BigDecimal("4820.55").compareTo(data.spend()));
    }

    @Test
    void countsOnlyConversionActionTypes() throws Exception {
        // 34 pixel leads + 11 pixel purchases = 45. post_engagement (2210) and
        // link_click (1327) are NOT conversions — counting them would inflate
        // the figure by two orders of magnitude.
        server.enqueue(json(fixture("meta-insights.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertEquals(45L, data.conversions());
    }

    @Test
    void keepsTheRawPayloadForDiagnosis() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertNotNull(data.rawResponse());
        assertTrue(data.rawResponse().contains("offsite_conversion"), data.rawResponse());
    }

    @Test
    void requestsAccountLevelDataForTheExactDateRange() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        client.fetchInsights("TOKEN", "act_111", START, END);

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/act_111/insights"), path);
        assertTrue(path.contains("level=account"), path);
        assertTrue(path.contains("\"since\":\"2026-08-31\""), path);
        assertTrue(path.contains("\"until\":\"2026-09-06\""), path);
        assertTrue(path.contains("access_token=TOKEN"), path);
    }

    @Test
    void returnsZeroesForAnAccountWithNoSpendInThePeriod() throws Exception {
        // A brand-new ad account behaves exactly like this. It is not an error,
        // and the UI must be able to say "connected, no data for this period".
        server.enqueue(json(fixture("meta-insights-empty.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertEquals(0L, data.impressions());
        assertEquals(0L, data.clicks());
        assertEquals(0, BigDecimal.ZERO.compareTo(data.spend()));
        assertEquals(0L, data.conversions());
    }

    @Test
    void surfacesAnExpiredTokenAsAPlatformException() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"error\":{\"message\":\"Session has expired\",\"code\":190}}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.fetchInsights("STALE", "act_111", START, END));
        assertTrue(e.getMessage().contains("Session has expired"), e.getMessage());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientInsightsTest`
Expected: 6 failures, all `UnsupportedOperationException: implemented in Task 12`.

- [ ] **Step 4: Implement fetchInsights**

In `MetaAdsClient.java`, add imports:

```java
import java.math.BigDecimal;
import java.util.Set;
```

Add these constants next to `SCOPE`:

```java
    /**
     * Which of Meta's {@code actions} entries count as a conversion.
     *
     * <p>Meta returns every action type in one array — page engagement, link
     * clicks, pixel events. Summing them all would count a single click several
     * times over. These are the types that correspond to what the ingestion form
     * calls "Conversions (leads)".
     */
    private static final Set<String> CONVERSION_ACTION_PREFIXES =
            Set.of("offsite_conversion.", "onsite_conversion.");
    private static final Set<String> CONVERSION_ACTION_TYPES =
            Set.of("lead", "purchase", "complete_registration");
```

Replace the `fetchInsights` stub with:

```java
    /**
     * Account-level totals for one closed reporting period.
     *
     * <p>{@code level=account} collapses every campaign, ad set, and ad into a
     * single row, which is what Module 4's weekly campaign record needs. Meta
     * returns all numbers as strings; {@link #asLong} and {@link #asDecimal}
     * handle that.
     */
    @Override
    public AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        String timeRange = "{\"since\":\"" + periodStart + "\",\"until\":\"" + periodEnd + "\"}";

        JsonNode response = getJson("/" + externalAccountId + "/insights", uri -> uri
                .queryParam("level", "account")
                .queryParam("fields", "impressions,clicks,spend,actions")
                .queryParam("time_range", timeRange)
                .queryParam("access_token", accessToken));

        JsonNode data = response.get("data");
        if (data == null || !data.isArray() || data.isEmpty()) {
            // No spend in the window. Correct and common for a new account.
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
                null,                       // currency comes from the connection row
                response.toString());
    }

    /** Sums only the action types that genuinely represent a conversion. */
    private long countConversions(JsonNode actions) {
        if (actions == null || !actions.isArray()) return 0L;

        long total = 0L;
        for (JsonNode action : actions) {
            String type = text(action, "action_type");
            if (type == null) continue;

            boolean isConversion = CONVERSION_ACTION_TYPES.contains(type)
                    || CONVERSION_ACTION_PREFIXES.stream().anyMatch(type::startsWith);
            if (isConversion) {
                total += parseLong(text(action, "value"));
            }
        }
        return total;
    }

    private long asLong(JsonNode node, String field) {
        return parseLong(text(node, field));
    }

    private BigDecimal asDecimal(JsonNode node, String field) {
        String raw = text(node, field);
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            log.warn("[Module4] Meta returned an unparseable {}: {}", field, raw);
            return BigDecimal.ZERO;
        }
    }

    private static long parseLong(String raw) {
        if (raw == null || raw.isBlank()) return 0L;
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=MetaAdsClientInsightsTest`
Expected: `Tests run: 6, Failures: 0, Errors: 0`.

- [ ] **Step 6: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/MetaAdsClient.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/MetaAdsClientInsightsTest.java backend/spring-boot/src/test/resources/adplatform/
git commit -m "feat(module4): fetch Meta account-level insights for a reporting period"
```

---

### Task 13: AdInsightSyncService

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsightSyncService.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightSyncServiceTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdInsightSyncServiceTest.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import com.ceview.module4.adconnections.client.AdInsightData;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.MetaAdsClient;
import com.ceview.module4.adconnections.client.TikTokAdsClient;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
class AdInsightSyncServiceTest {

    private static final LocalDate START = LocalDate.of(2026, 8, 31);
    private static final LocalDate END   = LocalDate.of(2026, 9, 6);

    @Autowired private AdInsightSyncService syncService;
    @Autowired private AdConnectionService connectionService;
    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private AdInsightRepository insightRepo;
    @Autowired private BusinessProfileRepository profileRepo;

    @MockBean private MetaAdsClient metaClient;
    @MockBean private TikTokAdsClient tiktokClient;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        insightRepo.deleteAll();
        connectionRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();

        when(metaClient.provider()).thenReturn(AdProvider.META);
        when(tiktokClient.provider()).thenReturn(AdProvider.TIKTOK);
    }

    /** Connects a provider and puts it in ACTIVE with the given account/currency. */
    private void activate(AdProvider provider, String accountId, String currency) {
        connectionService.storeGrant(profileId, provider,
                new TokenGrant("TOKEN-" + provider.key(), null, null, "scope"));
        connectionService.selectAccount(profileId, provider,
                new AdConnectionDtos.AdAccountOption(accountId, provider.key() + " Ads", currency));
    }

    @Test
    void returnsEmptyTotalsWhenNothingIsConnected() {
        InsightsResponse response = syncService.sync(profileId, START, END);

        assertTrue(response.sources().isEmpty());
        assertNull(response.impressions());
        assertTrue(response.warnings().stream()
                .anyMatch(w -> w.toLowerCase().contains("no connected")));
    }

    @Test
    void sumsASingleProvidersMetricsIntoTheTotals() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(48210, 1327,
                        new BigDecimal("4820.55"), 45, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(1, response.sources().size());
        assertEquals(48210L, response.impressions());
        assertEquals(1327L, response.clicks());
        assertEquals(0, new BigDecimal("4820.55").compareTo(response.spend()));
        assertEquals(45L, response.conversions());
        assertEquals("PHP", response.currency());
        assertTrue(response.warnings().isEmpty());
    }

    @Test
    void combinesTwoProvidersThatShareACurrency() {
        activate(AdProvider.META, "act_1", "PHP");
        activate(AdProvider.TIKTOK, "adv_2", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("500.00"), 5, null, "{}"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("250.50"), 3, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(2, response.sources().size());
        assertEquals(3000L, response.impressions());
        assertEquals(120L, response.clicks());
        assertEquals(0, new BigDecimal("750.50").compareTo(response.spend()));
        assertEquals(8L, response.conversions());
        assertEquals("PHP", response.currency());
    }

    @Test
    void refusesToSumAcrossDifferentCurrencies() {
        // Summing USD and PHP would produce a number that means nothing, and
        // would flow straight into ROAS. Report both sources and say why.
        activate(AdProvider.META, "act_1", "USD");
        activate(AdProvider.TIKTOK, "adv_2", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("100.00"), 5, null, "{}"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("5000.00"), 3, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(2, response.sources().size());
        assertNull(response.spend(), "totals must be withheld on a currency mismatch");
        assertNull(response.impressions());
        assertNull(response.currency());
        assertTrue(response.warnings().stream()
                .anyMatch(w -> w.toLowerCase().contains("currency")), response.warnings().toString());
    }

    @Test
    void persistsOneInsightRowPerProviderAndPeriod() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("500.00"), 5, null, "{\"a\":1}"));

        syncService.sync(profileId, START, END);

        AdInsight saved = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                        profileId, "meta", START, END).orElseThrow();
        assertEquals(1000L, saved.getImpressions());
        assertEquals("PHP", saved.getCurrency());
        assertEquals("{\"a\":1}", saved.getRawResponse());
    }

    @Test
    void resyncingThePeriodUpdatesTheRowRatherThanDuplicatingIt() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("500.00"), 5, null, "{}"));
        syncService.sync(profileId, START, END);

        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(1800, 90, new BigDecimal("900.00"), 9, null, "{}"));
        syncService.sync(profileId, START, END);

        assertEquals(1, insightRepo.count());
        assertEquals(1800L, insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                        profileId, "meta", START, END).orElseThrow().getImpressions());
    }

    @Test
    void stampsLastSyncedAtOnTheConnection() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(1, 1, BigDecimal.ONE, 1, null, "{}"));

        syncService.sync(profileId, START, END);

        assertNotNull(connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow()
                .getLastSyncedAt());
    }

    @Test
    void oneProviderFailingDoesNotLoseTheOther() {
        activate(AdProvider.META, "act_1", "PHP");
        activate(AdProvider.TIKTOK, "adv_2", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any()))
                .thenThrow(new AdPlatformException("Session has expired"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("250.50"), 3, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(1, response.sources().size());
        assertEquals("tiktok", response.sources().get(0).provider());
        assertTrue(response.warnings().stream()
                .anyMatch(w -> w.contains("meta")), response.warnings().toString());
    }

    @Test
    void skipsAConnectionThatHasNoChosenAccount() {
        connectionService.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "scope"));   // still PENDING

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertTrue(response.sources().isEmpty());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdInsightSyncServiceTest`
Expected: compilation failure — `cannot find symbol: class AdInsightSyncService` (and `TikTokAdsClient`, which Task 15 creates; add a minimal stub class now if you are executing strictly in order, or run this test after Task 15).

- [ ] **Step 3: Write the service**

Create `AdInsightSyncService.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.module4.adconnections.AdConnectionDtos.InsightSource;
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import com.ceview.module4.adconnections.client.AdInsightData;
import com.ceview.module4.adconnections.client.AdPlatformClient;
import com.ceview.module4.adconnections.client.AdPlatformException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Pulls one reporting period's metrics from every ACTIVE connection, caches
 * them, and reduces them to the shape the ingestion form prefills with.
 *
 * <p>Two rules make this more than a sum:
 * <ul>
 *   <li><b>One provider failing must not lose the others.</b> Each fetch is
 *       isolated; a failure becomes a warning, not an exception.</li>
 *   <li><b>Mixed currencies are never summed.</b> Adding USD spend to PHP spend
 *       produces a number that means nothing and flows straight into ROAS, so
 *       the totals are withheld and the caller is told why.</li>
 * </ul>
 */
@Service
public class AdInsightSyncService {

    private static final Logger log = LoggerFactory.getLogger(AdInsightSyncService.class);

    private final AdPlatformConnectionRepository connectionRepo;
    private final AdInsightRepository insightRepo;
    private final AdConnectionService connectionService;
    private final Map<AdProvider, AdPlatformClient> clients;

    public AdInsightSyncService(AdPlatformConnectionRepository connectionRepo,
                                AdInsightRepository insightRepo,
                                AdConnectionService connectionService,
                                Map<AdProvider, AdPlatformClient> clients) {
        this.connectionRepo = connectionRepo;
        this.insightRepo = insightRepo;
        this.connectionService = connectionService;
        this.clients = clients;
    }

    @Transactional
    public InsightsResponse sync(UUID businessProfileId, LocalDate periodStart, LocalDate periodEnd) {
        List<AdPlatformConnection> active = connectionRepo.findByBusinessProfileIdAndStatus(
                businessProfileId, AdPlatformConnection.STATUS_ACTIVE);

        List<InsightSource> sources = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (active.isEmpty()) {
            warnings.add("No connected ad accounts. Connect one in Settings -> Platforms.");
            return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                    null, null, null, null, null, sources, warnings);
        }

        for (AdPlatformConnection conn : active) {
            if (conn.getExternalAccountId() == null) {
                // Defensive: an ACTIVE row should always have one.
                continue;
            }
            AdProvider provider = AdProvider.fromKey(conn.getProvider());
            AdPlatformClient client = clients.get(provider);
            if (client == null) {
                warnings.add(provider.key() + " is not configured on this server.");
                continue;
            }

            try {
                AdInsightData data = client.fetchInsights(
                        connectionService.accessTokenOf(conn),
                        conn.getExternalAccountId(), periodStart, periodEnd);

                upsertInsight(businessProfileId, conn, data, periodStart, periodEnd);

                conn.setLastSyncedAt(OffsetDateTime.now());
                connectionRepo.save(conn);

                sources.add(new InsightSource(provider.key(), conn.getExternalAccountName(),
                        data.impressions(), data.clicks(), data.spend(), data.conversions(),
                        conn.getCurrency()));

            } catch (AdPlatformException | IllegalStateException e) {
                log.warn("[Module4] {} sync failed for profile={}: {}",
                         provider.key(), businessProfileId, e.getMessage());
                warnings.add(provider.key() + " could not be synced: " + e.getMessage());
            }
        }

        return reduce(periodStart, periodEnd, sources, warnings);
    }

    /** Writes or updates the cached row for this (profile, provider, period). */
    private void upsertInsight(UUID businessProfileId, AdPlatformConnection conn,
                               AdInsightData data, LocalDate periodStart, LocalDate periodEnd) {
        AdInsight insight = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                        businessProfileId, conn.getProvider(), periodStart, periodEnd)
                .orElseGet(AdInsight::new);

        insight.setBusinessProfileId(businessProfileId);
        insight.setProvider(conn.getProvider());
        insight.setExternalAccountId(conn.getExternalAccountId());
        insight.setPeriodStart(periodStart);
        insight.setPeriodEnd(periodEnd);
        insight.setImpressions(data.impressions());
        insight.setClicks(data.clicks());
        insight.setSpend(data.spend() == null ? BigDecimal.ZERO : data.spend());
        insight.setConversions(data.conversions());
        // The platform's insights payload carries no currency; the ad account's
        // own currency, captured at account-selection time, is authoritative.
        insight.setCurrency(conn.getCurrency());
        insight.setFetchedAt(OffsetDateTime.now());
        insight.setRawResponse(data.rawResponse());

        insightRepo.save(insight);
    }

    /** Combines the per-source figures, or withholds the totals if it cannot. */
    private InsightsResponse reduce(LocalDate periodStart, LocalDate periodEnd,
                                    List<InsightSource> sources, List<String> warnings) {
        if (sources.isEmpty()) {
            return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                    null, null, null, null, null, sources, warnings);
        }

        Set<String> currencies = sources.stream()
                .map(InsightSource::currency)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        if (currencies.size() > 1) {
            warnings.add("Connected ad accounts report in different currencies ("
                    + String.join(", ", currencies)
                    + "), so their figures cannot be combined. Use one source at a time.");
            return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                    null, null, null, null, null, sources, warnings);
        }

        long impressions = sources.stream().mapToLong(InsightSource::impressions).sum();
        long clicks      = sources.stream().mapToLong(InsightSource::clicks).sum();
        long conversions = sources.stream().mapToLong(InsightSource::conversions).sum();
        BigDecimal spend = sources.stream()
                .map(s -> s.spend() == null ? BigDecimal.ZERO : s.spend())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        String currency = currencies.isEmpty() ? null : currencies.iterator().next();

        return new InsightsResponse(periodStart.toString(), periodEnd.toString(),
                impressions, clicks, spend, conversions, currency, sources, warnings);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdInsightSyncServiceTest`
Expected: `Tests run: 9, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdInsightSyncService.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightSyncServiceTest.java
git commit -m "feat(module4): add AdInsightSyncService with currency-mismatch handling"
```

---

### Task 14: The insights endpoint

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightsEndpointTest.java`

- [ ] **Step 1: Write the failing test**

Create `AdInsightsEndpointTest.java`:

```java
package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AdInsightsEndpointTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;

    @MockBean private AdInsightSyncService syncService;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        UUID operatorId = UUID.randomUUID();
        token = jwtService.issue(operatorId, "operator@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void returnsTheSyncResultForTheRequestedPeriod() throws Exception {
        when(syncService.sync(eq(profileId),
                eq(LocalDate.of(2026, 8, 31)), eq(LocalDate.of(2026, 9, 6))))
            .thenReturn(new InsightsResponse("2026-08-31", "2026-09-06",
                    48210L, 1327L, new BigDecimal("4820.55"), 45L, "PHP",
                    List.of(), List.of()));

        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.impressions").value(48210))
           .andExpect(jsonPath("$.clicks").value(1327))
           .andExpect(jsonPath("$.currency").value("PHP"));
    }

    @Test
    void scopesTheSyncToTheAuthenticatedOperator() throws Exception {
        when(syncService.sync(eq(profileId), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()))
            .thenReturn(new InsightsResponse("2026-08-31", "2026-09-06",
                    null, null, null, null, null, List.of(), List.of()));

        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk());

        verify(syncService).sync(eq(profileId),
                eq(LocalDate.of(2026, 8, 31)), eq(LocalDate.of(2026, 9, 6)));
    }

    @Test
    void rejectsAnInvertedDateRange() throws Exception {
        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-09-06")
                        .param("periodEnd", "2026-08-31")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isBadRequest());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/ad-connections/insights")
                        .param("periodStart", "2026-08-31")
                        .param("periodEnd", "2026-09-06"))
           .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdInsightsEndpointTest`
Expected: 404 on the three authenticated cases.

- [ ] **Step 3: Add the endpoint**

In `AdConnectionController.java`, add imports:

```java
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
```

Add the `AdInsightSyncService` to the constructor and field list, then add this method after `list()`:

```java
    /**
     * Pulls the given period's metrics from every connected ad account.
     *
     * <p>Synchronous on purpose: the operator pressed a button and is waiting.
     * A scheduled variant can reuse {@link AdInsightSyncService} unchanged.
     *
     * <p>This route is deliberately NOT under {@code /{provider}} — it spans
     * every connected provider in one call.
     */
    @GetMapping("/insights")
    public InsightsResponse insights(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd) {

        if (periodEnd.isBefore(periodStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "periodEnd must not be before periodStart");
        }
        return syncService.sync(currentBusinessProfile.resolveProfileId(), periodStart, periodEnd);
    }
```

**Watch the route ordering.** `/{provider}/callback` and `/insights` both live under `/api/ad-connections`. Spring matches the more specific literal path first, so `/insights` is safe — but if you ever add a bare `/{provider}` GET, it would shadow this. Keep `/insights` declared above the `@PathVariable` routes as a reminder.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=AdInsightsEndpointTest`
Expected: `Tests run: 4, Failures: 0, Errors: 0`.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend/spring-boot && ./mvnw test`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Verify Phase 3 against the real Meta API**

With the tunnel running, the backend configured, and a Meta connection ACTIVE (Phase 2 §7 plus an account selected via `POST /api/ad-connections/meta/account`):

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/ad-connections/insights?periodStart=2026-08-31&periodEnd=2026-09-06" `
  -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5
```

Expected: a JSON body with a `sources` array containing one `meta` entry. **Zeros are a valid result** — a new ad account with no spend in that window reports nothing. Confirm the row landed:

```bash
docker exec -it ceview-postgres psql -U ceview -d ceview \
  -c "SELECT provider, period_start, period_end, impressions, clicks, spend, currency FROM tbl_ad_insight;"
```

- [ ] **Step 7: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/AdInsightsEndpointTest.java
git commit -m "feat(module4): add GET /api/ad-connections/insights"
```

---

## Phase 4 — TikTok parity

Ends with: both providers connectable at once, including the currency-mismatch path.

> **Before starting this phase**, confirm against TikTok's current Business API documentation: the portal auth URL, whether the callback parameter is `auth_code` or `code`, the `oauth2/access_token/` request body, and the `report/integrated/get/` metric names. TikTok has renamed report endpoints before. Record what you actually used in `AD_PLATFORM_SETUP.md`.

**Three ways TikTok differs from Meta, all of which the code must handle:**

1. **Errors arrive as HTTP 200.** Every response carries a `code` field; `0` means success and anything else is an error with a `message`. Checking the HTTP status alone silently accepts failures.
2. **The callback parameter is `auth_code`, not `code`.** The controller must accept both.
3. **Currency needs a second call.** `oauth2/advertiser/get/` returns ids and names only; `advertiser/info/` returns the currency.

### Task 15: TikTokAdsClient — OAuth and account listing

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java`
- Create: `backend/spring-boot/src/test/resources/adplatform/tiktok-token.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/tiktok-error.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/tiktok-advertisers.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/tiktok-advertiser-info.json`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/AdConnectionController.java` (accept `auth_code`)
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/TikTokAdsClientTest.java`

- [ ] **Step 1: Save the recorded payloads**

`tiktok-token.json`:

```json
{
  "code": 0,
  "message": "OK",
  "request_id": "20260906120000ABCDEF",
  "data": {
    "access_token": "tiktok-access-token-value",
    "refresh_token": "tiktok-refresh-token-value",
    "scope": [4, 5],
    "advertiser_ids": ["7000000000000000001"],
    "expires_in": 86400,
    "refresh_token_expires_in": 31536000
  }
}
```

`tiktok-error.json` — note the HTTP status will be **200**:

```json
{
  "code": 40001,
  "message": "The auth_code is invalid or has expired.",
  "request_id": "20260906120001ABCDEF",
  "data": {}
}
```

`tiktok-advertisers.json`:

```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "list": [
      { "advertiser_id": "7000000000000000001", "advertiser_name": "Cebu Dive Co." },
      { "advertiser_id": "7000000000000000002", "advertiser_name": "Test Advertiser" }
    ]
  }
}
```

`tiktok-advertiser-info.json`:

```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "list": [
      { "advertiser_id": "7000000000000000001", "name": "Cebu Dive Co.", "currency": "PHP" },
      { "advertiser_id": "7000000000000000002", "name": "Test Advertiser", "currency": "USD" }
    ]
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `TikTokAdsClientTest.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TikTokAdsClientTest {

    private MockWebServer server;
    private TikTokAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = TikTokAdsClientTest.class.getResourceAsStream("/adplatform/" + name)) {
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
        props.getTiktok().setAppId("TTAPP");
        props.getTiktok().setAppSecret("TTSECRET");
        props.setRedirectBaseUrl("https://tunnel.example.com");

        String base = server.url("/open_api/v1.3").toString();
        client = new TikTokAdsClient(props, base, server.url("/portal/auth").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void reportsItsProvider() {
        assertEquals(AdProvider.TIKTOK, client.provider());
    }

    @Test
    void buildsAnAuthorizeUrlWithAppIdStateAndRedirect() {
        String url = URLDecoder.decode(client.buildAuthorizeUrl("state-abc"), StandardCharsets.UTF_8);

        assertTrue(url.contains("app_id=TTAPP"), url);
        assertTrue(url.contains("state=state-abc"), url);
        assertTrue(url.contains(
                "redirect_uri=https://tunnel.example.com/api/ad-connections/tiktok/callback"), url);
    }

    @Test
    void exchangesTheAuthCodeForAnAccessAndRefreshToken() throws Exception {
        server.enqueue(json(fixture("tiktok-token.json")));

        TokenGrant grant = client.exchangeCode("AUTH-CODE");

        assertEquals("tiktok-access-token-value", grant.accessToken());
        assertEquals("tiktok-refresh-token-value", grant.refreshToken());
        assertNotNull(grant.expiresAt());
    }

    @Test
    void postsTheAppCredentialsAndAuthCodeAsJson() throws Exception {
        server.enqueue(json(fixture("tiktok-token.json")));

        client.exchangeCode("AUTH-CODE");

        RecordedRequest request = server.takeRequest();
        assertEquals("POST", request.getMethod());
        assertTrue(request.getPath().contains("/oauth2/access_token/"), request.getPath());

        String body = request.getBody().readUtf8();
        assertTrue(body.contains("\"app_id\":\"TTAPP\""), body);
        assertTrue(body.contains("\"secret\":\"TTSECRET\""), body);
        assertTrue(body.contains("\"auth_code\":\"AUTH-CODE\""), body);
        assertTrue(body.contains("\"grant_type\":\"auth_code\""), body);
    }

    @Test
    void treatsANonZeroCodeAsAnErrorEvenOnHttp200() throws Exception {
        // This is the trap: TikTok answers 200 with an error envelope. Checking
        // only the HTTP status would accept a failure as success.
        server.enqueue(json(fixture("tiktok-error.json")));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.exchangeCode("STALE-CODE"));
        assertTrue(e.getMessage().contains("auth_code is invalid"), e.getMessage());
        assertTrue(e.getMessage().contains("40001"), e.getMessage());
    }

    @Test
    void listsAdvertisersWithTheirCurrency() throws Exception {
        server.enqueue(json(fixture("tiktok-advertisers.json")));
        server.enqueue(json(fixture("tiktok-advertiser-info.json")));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(2, accounts.size());
        assertEquals("7000000000000000001", accounts.get(0).id());
        assertEquals("Cebu Dive Co.", accounts.get(0).name());
        assertEquals("PHP", accounts.get(0).currency());
        assertEquals("USD", accounts.get(1).currency());
    }

    @Test
    void sendsTheTokenInTheAccessTokenHeaderNotAsABearer() throws Exception {
        server.enqueue(json(fixture("tiktok-advertisers.json")));
        server.enqueue(json(fixture("tiktok-advertiser-info.json")));

        client.listAccounts("TOKEN");

        RecordedRequest request = server.takeRequest();
        assertEquals("TOKEN", request.getHeader("Access-Token"));
        assertNull(request.getHeader("Authorization"));
    }

    @Test
    void stillListsAdvertisersWhenTheCurrencyLookupFails() throws Exception {
        // Losing the currency is a degraded result, not a reason to block the
        // operator from choosing an account.
        server.enqueue(json(fixture("tiktok-advertisers.json")));
        server.enqueue(json("{\"code\":40100,\"message\":\"No permission\",\"data\":{}}"));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(2, accounts.size());
        assertNull(accounts.get(0).currency());
    }

    @Test
    void returnsAnEmptyListWhenTheGrantHasNoAdvertisers() throws Exception {
        server.enqueue(json("{\"code\":0,\"message\":\"OK\",\"data\":{\"list\":[]}}"));

        assertTrue(client.listAccounts("TOKEN").isEmpty());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=TikTokAdsClientTest`
Expected: compilation failure — `cannot find symbol: class TikTokAdsClient`.

- [ ] **Step 4: Write the client**

Create `client/TikTokAdsClient.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * TikTok Business API client.
 *
 * <p>Three behaviours differ sharply from Meta and are handled explicitly:
 * <ul>
 *   <li>Errors arrive as <b>HTTP 200</b> with a non-zero {@code code} field, so
 *       {@link #unwrap} checks the body rather than the status.</li>
 *   <li>The access token travels in an {@code Access-Token} header, not as a
 *       bearer token or query parameter.</li>
 *   <li>Advertiser currency needs a second call to {@code /advertiser/info/}.</li>
 * </ul>
 */
@Component
public class TikTokAdsClient implements AdPlatformClient {

    private static final Logger log = LoggerFactory.getLogger(TikTokAdsClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    private final AdProviderProperties props;
    private final String apiBaseUrl;
    private final String portalAuthUrl;
    private final WebClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public TikTokAdsClient(AdProviderProperties props,
                           @Value("${ceview.adplatform.tiktok.api-base-url:https://business-api.tiktok.com/open_api/v1.3}")
                           String apiBaseUrl,
                           @Value("${ceview.adplatform.tiktok.portal-auth-url:https://business-api.tiktok.com/portal/auth}")
                           String portalAuthUrl) {
        this.props = props;
        this.apiBaseUrl = apiBaseUrl;
        this.portalAuthUrl = portalAuthUrl;
        this.http = WebClient.builder().baseUrl(apiBaseUrl).build();
    }

    @Override
    public AdProvider provider() {
        return AdProvider.TIKTOK;
    }

    @Override
    public String buildAuthorizeUrl(String state) {
        return UriComponentsBuilder.fromUriString(portalAuthUrl)
                .queryParam("app_id", props.getTiktok().getAppId())
                .queryParam("state", state)
                .queryParam("redirect_uri", props.callbackUrl(AdProvider.TIKTOK))
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUriString();
    }

    @Override
    public TokenGrant exchangeCode(String authCode) {
        Map<String, String> body = new HashMap<>();
        body.put("app_id", props.getTiktok().getAppId());
        body.put("secret", props.getTiktok().getAppSecret());
        body.put("auth_code", authCode);
        body.put("grant_type", "auth_code");

        JsonNode data = unwrap(post("/oauth2/access_token/", body));

        String accessToken = text(data, "access_token");
        if (accessToken == null) {
            throw new AdPlatformException("TikTok returned no access_token");
        }

        OffsetDateTime expiresAt = null;
        JsonNode expiresIn = data.get("expires_in");
        if (expiresIn != null && expiresIn.isNumber()) {
            expiresAt = OffsetDateTime.now().plusSeconds(expiresIn.asLong());
        }

        log.info("[Module4] TikTok token exchanged, expires_at={}", expiresAt);
        return new TokenGrant(accessToken, text(data, "refresh_token"), expiresAt,
                              String.valueOf(data.get("scope")));
    }

    @Override
    public List<AdAccountOption> listAccounts(String accessToken) {
        JsonNode data = unwrap(get("/oauth2/advertiser/get/", accessToken, uri -> uri
                .queryParam("app_id", props.getTiktok().getAppId())
                .queryParam("secret", props.getTiktok().getAppSecret())));

        List<String> ids = new ArrayList<>();
        Map<String, String> names = new HashMap<>();
        JsonNode list = data.get("list");
        if (list != null && list.isArray()) {
            for (JsonNode advertiser : list) {
                String id = text(advertiser, "advertiser_id");
                if (id == null) continue;
                ids.add(id);
                names.put(id, text(advertiser, "advertiser_name"));
            }
        }
        if (ids.isEmpty()) return List.of();

        Map<String, String> currencies = fetchCurrencies(accessToken, ids);

        List<AdAccountOption> accounts = new ArrayList<>();
        for (String id : ids) {
            accounts.add(new AdAccountOption(id, names.get(id), currencies.get(id)));
        }
        return accounts;
    }

    /**
     * Currency per advertiser. A failure here is logged and swallowed — the
     * operator can still choose an account, they just see no currency until the
     * first sync fills it in.
     */
    private Map<String, String> fetchCurrencies(String accessToken, List<String> ids) {
        Map<String, String> currencies = new HashMap<>();
        try {
            JsonNode data = unwrap(get("/advertiser/info/", accessToken, uri -> uri
                    .queryParam("advertiser_ids", jsonArray(ids))
                    .queryParam("fields", "[\"advertiser_id\",\"name\",\"currency\"]")));

            JsonNode list = data.get("list");
            if (list != null && list.isArray()) {
                for (JsonNode advertiser : list) {
                    currencies.put(text(advertiser, "advertiser_id"),
                                   text(advertiser, "currency"));
                }
            }
        } catch (AdPlatformException e) {
            log.warn("[Module4] TikTok advertiser currency lookup failed: {}", e.getMessage());
        }
        return currencies;
    }

    @Override
    public AdInsightData fetchInsights(String accessToken, String advertiserId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        throw new UnsupportedOperationException("implemented in Task 16");
    }

    // ── HTTP plumbing ────────────────────────────────────────────────────────

    private JsonNode post(String path, Map<String, String> body) {
        try {
            String raw = http.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(mapper.writeValueAsString(body))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            return parse(raw);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("TikTok API " + e.getStatusCode(), e);
        } catch (AdPlatformException e) {
            throw e;
        } catch (Exception e) {
            throw new AdPlatformException("TikTok API call failed: "
                    + e.getClass().getSimpleName(), e);
        }
    }

    private JsonNode get(String path, String accessToken,
                         java.util.function.UnaryOperator<UriComponentsBuilder> query) {
        try {
            String raw = http.get()
                    .uri(uriBuilder -> query.apply(UriComponentsBuilder.fromPath(path))
                            .build(true).toUri())
                    .header("Access-Token", accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            return parse(raw);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("TikTok API " + e.getStatusCode(), e);
        } catch (AdPlatformException e) {
            throw e;
        } catch (Exception e) {
            throw new AdPlatformException("TikTok API call failed: "
                    + e.getClass().getSimpleName(), e);
        }
    }

    /**
     * Returns {@code data}, or throws if the envelope's {@code code} is non-zero.
     *
     * <p>This is the single most important method in this class: without it,
     * every error is silently treated as an empty success.
     */
    private JsonNode unwrap(JsonNode envelope) {
        int code = envelope.path("code").asInt(-1);
        if (code != 0) {
            String message = envelope.path("message").asText("(no message)");
            throw new AdPlatformException("TikTok API error " + code + ": " + message);
        }
        JsonNode data = envelope.get("data");
        return data == null ? mapper.createObjectNode() : data;
    }

    private JsonNode parse(String raw) {
        try {
            return mapper.readTree(raw == null ? "{}" : raw);
        } catch (Exception e) {
            throw new AdPlatformException("TikTok returned a non-JSON response", e);
        }
    }

    /** TikTok expects list parameters as a JSON array literal in the query string. */
    private static String jsonArray(List<String> values) {
        return "[" + values.stream().map(v -> "\"" + v + "\"")
                .reduce((a, b) -> a + "," + b).orElse("") + "]";
    }

    static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    static long parseLong(String raw) {
        if (raw == null || raw.isBlank()) return 0L;
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    static BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
}
```

- [ ] **Step 5: Accept TikTok's `auth_code` parameter in the callback**

TikTok returns `auth_code`, not `code`. In `AdConnectionController.callback`, add the parameter and prefer whichever is present:

```java
    @GetMapping("/{provider}/callback")
    public ResponseEntity<Void> callback(@PathVariable String provider,
                                         @RequestParam(required = false) String code,
                                         // TikTok's Business API names it auth_code, not code.
                                         @RequestParam(name = "auth_code", required = false) String authCode,
                                         @RequestParam(required = false) String state,
                                         @RequestParam(name = "error", required = false) String error) {
        String grantCode = (code != null && !code.isBlank()) ? code : authCode;
        // ... then use grantCode everywhere the method previously used code
```

Update the null check to test `grantCode`, and pass `grantCode` to `exchangeCode`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=TikTokAdsClientTest,AdConnectionFlowTest`
Expected: `TikTokAdsClientTest` 9 passing, `AdConnectionFlowTest` still 10 passing.

- [ ] **Step 7: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/ backend/spring-boot/src/test/java/com/ceview/module4/adconnections/ backend/spring-boot/src/test/resources/adplatform/
git commit -m "feat(module4): add TikTok OAuth client and accept its auth_code callback param"
```

---

### Task 16: TikTok insights

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java`
- Create: `backend/spring-boot/src/test/resources/adplatform/tiktok-report.json`
- Create: `backend/spring-boot/src/test/resources/adplatform/tiktok-report-empty.json`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/TikTokAdsClientInsightsTest.java`

- [ ] **Step 1: Save the recorded payloads**

`tiktok-report.json`:

```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "list": [
      {
        "dimensions": { "advertiser_id": "7000000000000000001" },
        "metrics": {
          "impressions": "31204",
          "clicks": "894",
          "spend": "1250.75",
          "conversion": "22"
        }
      }
    ],
    "page_info": { "total_number": 1, "page": 1, "page_size": 100, "total_page": 1 }
  }
}
```

`tiktok-report-empty.json`:

```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "list": [],
    "page_info": { "total_number": 0, "page": 1, "page_size": 100, "total_page": 0 }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `TikTokAdsClientInsightsTest.java`:

```java
package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class TikTokAdsClientInsightsTest {

    private MockWebServer server;
    private TikTokAdsClient client;

    private static final LocalDate START = LocalDate.of(2026, 8, 31);
    private static final LocalDate END   = LocalDate.of(2026, 9, 6);

    private static String fixture(String name) throws Exception {
        try (var in = TikTokAdsClientInsightsTest.class
                .getResourceAsStream("/adplatform/" + name)) {
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
        props.getTiktok().setAppId("TTAPP");
        props.getTiktok().setAppSecret("TTSECRET");
        props.setRedirectBaseUrl("https://tunnel.example.com");

        String base = server.url("/open_api/v1.3").toString();
        client = new TikTokAdsClient(props, base, server.url("/portal/auth").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void parsesTheMetricsBlock() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "7000000000000000001", START, END);

        assertEquals(31204L, data.impressions());
        assertEquals(894L, data.clicks());
        assertEquals(0, new BigDecimal("1250.75").compareTo(data.spend()));
        assertEquals(22L, data.conversions());
    }

    @Test
    void requestsAdvertiserLevelBasicReportForTheDateRange() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        client.fetchInsights("TOKEN", "7000000000000000001", START, END);

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/report/integrated/get/"), path);
        assertTrue(path.contains("report_type=BASIC"), path);
        assertTrue(path.contains("data_level=AUCTION_ADVERTISER"), path);
        assertTrue(path.contains("advertiser_id=7000000000000000001"), path);
        assertTrue(path.contains("start_date=2026-08-31"), path);
        assertTrue(path.contains("end_date=2026-09-06"), path);
        assertEquals("TOKEN", request.getHeader("Access-Token"));
    }

    @Test
    void returnsZeroesForAPeriodWithNoSpend() throws Exception {
        server.enqueue(json(fixture("tiktok-report-empty.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "700", START, END);

        assertEquals(0L, data.impressions());
        assertEquals(0, BigDecimal.ZERO.compareTo(data.spend()));
    }

    @Test
    void treatsANonZeroCodeAsAnError() throws Exception {
        server.enqueue(json("{\"code\":40002,\"message\":\"Advertiser not authorized\",\"data\":{}}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.fetchInsights("TOKEN", "700", START, END));
        assertTrue(e.getMessage().contains("Advertiser not authorized"), e.getMessage());
    }

    @Test
    void keepsTheRawPayload() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "700", START, END);

        assertTrue(data.rawResponse().contains("impressions"), data.rawResponse());
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=TikTokAdsClientInsightsTest`
Expected: 5 failures, all `UnsupportedOperationException: implemented in Task 16`.

- [ ] **Step 4: Implement fetchInsights**

Replace the stub in `TikTokAdsClient.java` with:

```java
    /**
     * Advertiser-level totals for one reporting period.
     *
     * <p>{@code data_level=AUCTION_ADVERTISER} with the {@code advertiser_id}
     * dimension collapses every campaign into a single row — the analogue of
     * Meta's {@code level=account}.
     *
     * <p>Unlike Meta, TikTok returns a single {@code conversion} metric, so no
     * action-type filtering is needed. Note the metric name is singular.
     */
    @Override
    public AdInsightData fetchInsights(String accessToken, String advertiserId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        JsonNode envelope = get("/report/integrated/get/", accessToken, uri -> uri
                .queryParam("advertiser_id", advertiserId)
                .queryParam("report_type", "BASIC")
                .queryParam("data_level", "AUCTION_ADVERTISER")
                .queryParam("dimensions", "[\"advertiser_id\"]")
                .queryParam("metrics", "[\"impressions\",\"clicks\",\"spend\",\"conversion\"]")
                .queryParam("start_date", periodStart.toString())
                .queryParam("end_date", periodEnd.toString())
                .queryParam("page_size", 100));

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
                null,                        // currency comes from the connection row
                raw);
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend/spring-boot && ./mvnw test -Dtest=TikTokAdsClientInsightsTest`
Expected: `Tests run: 5, Failures: 0, Errors: 0`.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend/spring-boot && ./mvnw test`
Expected: BUILD SUCCESS. This is the last backend task — every backend test in the plan should now be green.

- [ ] **Step 7: Verify Phase 4 against the real TikTok API**

With `TIKTOK_APP_ID` and `TIKTOK_APP_SECRET` set and the tunnel running, repeat the Phase 2 §7 and Phase 3 §6 walkthrough for `tiktok`. Then connect **both** providers and confirm:

```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/ad-connections/insights?periodStart=2026-08-31&periodEnd=2026-09-06" `
  -Headers @{ Authorization = "Bearer $token" } | ConvertTo-Json -Depth 5
```

Expected: `sources` has two entries. If your Meta account is USD and your TikTok account is PHP, the top-level totals are `null` and `warnings` explains the currency mismatch — that is the designed behaviour, not a bug.

- [ ] **Step 8: Commit** — *user runs this*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/adconnections/client/TikTokAdsClient.java backend/spring-boot/src/test/java/com/ceview/module4/adconnections/client/TikTokAdsClientInsightsTest.java backend/spring-boot/src/test/resources/adplatform/
git commit -m "feat(module4): fetch TikTok advertiser-level insights"
```

---

## Phase 5 — Frontend

Ends with: a full click-through from Settings → Platforms to a prefilled Performance ingestion form.

Frontend conventions to match: Vitest + `@testing-library/react`, components wrapped in `ToastProvider` and `OverlayStackProvider` when rendered in tests, and stores replaced with `vi.mock`. Copy the setup at the top of `components/settings/PlatformsSettings.test.tsx:8-40`.

### Task 17: Types, fixtures, and the apiClient group

**Files:**
- Modify: `frontend/types.ts`
- Create: `frontend/services/fixtures/adConnections.ts`
- Modify: `frontend/services/apiClient.ts`
- Test: `frontend/services/apiClient.adConnections.test.ts`

- [ ] **Step 1: Add the types**

Append to `frontend/types.ts`, after the existing `PlatformConnection` block:

```ts
/**
 * Ad platforms CeView can pull campaign metrics from.
 *
 * Deliberately separate from `PlatformId`. A Meta ad account covers Facebook
 * AND Instagram placements in one grant, and an ads grant is a different
 * authorisation from a publishing grant — collapsing the two would make a
 * connected ad account look like permission to publish, which it is not.
 */
export type AdProvider = 'meta' | 'tiktok';

export type AdConnectionStatus =
  | 'DISCONNECTED'
  | 'PENDING_ACCOUNT_SELECTION'
  | 'ACTIVE'
  | 'REVOKED';

export interface AdConnection {
  provider: AdProvider;
  /** Whether THIS SERVER has credentials for the provider — not whether the operator connected it. */
  configured: boolean;
  status: AdConnectionStatus;
  accountName: string | null;
  currency: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
}

export interface AdAccountOption {
  id: string;
  name: string | null;
  currency: string | null;
}

export interface AdInsightSource {
  provider: AdProvider;
  accountName: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  currency: string | null;
}

/**
 * Totals are null when the connected accounts report in different currencies —
 * the backend refuses to sum them. `warnings` says why, and the UI falls back
 * to per-source prefill.
 */
export interface AdInsightSummary {
  periodStart: string;
  periodEnd: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  conversions: number | null;
  currency: string | null;
  sources: AdInsightSource[];
  warnings: string[];
}
```

- [ ] **Step 2: Write the fixtures**

Create `frontend/services/fixtures/adConnections.ts`:

```ts
/**
 * Fixture data for the ad-connection endpoints, used when VITE_USE_FIXTURES=true.
 *
 * Meta is connected and active; TikTok is configured on the server but not yet
 * connected by this operator — the two states the Settings UI most needs to
 * render side by side.
 */
import type { AdAccountOption, AdConnection, AdInsightSummary } from '../../types';

export const MOCK_AD_CONNECTIONS: AdConnection[] = [
  {
    provider: 'meta',
    configured: true,
    status: 'ACTIVE',
    accountName: 'Cebu Dive Co. Ads',
    currency: 'PHP',
    connectedAt: '2026-08-20T02:14:00Z',
    lastSyncedAt: '2026-09-06T01:00:00Z',
  },
  {
    provider: 'tiktok',
    configured: true,
    status: 'DISCONNECTED',
    accountName: null,
    currency: null,
    connectedAt: null,
    lastSyncedAt: null,
  },
];

export const MOCK_AD_ACCOUNTS: AdAccountOption[] = [
  { id: 'act_111111111', name: 'Cebu Dive Co. Ads', currency: 'PHP' },
  { id: 'act_222222222', name: 'Personal Test Account', currency: 'PHP' },
];

export const MOCK_AD_INSIGHTS: AdInsightSummary = {
  periodStart: '2026-08-31',
  periodEnd: '2026-09-06',
  impressions: 48210,
  clicks: 1327,
  spend: 4820.55,
  conversions: 45,
  currency: 'PHP',
  sources: [
    {
      provider: 'meta',
      accountName: 'Cebu Dive Co. Ads',
      impressions: 48210,
      clicks: 1327,
      spend: 4820.55,
      conversions: 45,
      currency: 'PHP',
    },
  ],
  warnings: [],
};
```

- [ ] **Step 3: Write the failing test**

Create `frontend/services/apiClient.adConnections.test.ts`:

```ts
/**
 * Covers the adConnections endpoint group: paths, methods, and the fixture
 * branch. The fetch layer itself (auth header, error mapping) is already
 * covered by apiClient.auth.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calledPath(): string {
  return String(fetchMock.mock.calls[0][0]);
}

function calledInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

describe('apiClient.adConnections', () => {
  it('lists connections', async () => {
    await apiClient.adConnections.list();
    expect(calledPath()).toContain('/api/ad-connections');
  });

  it('posts to authorize for a provider', async () => {
    await apiClient.adConnections.authorize('meta');
    expect(calledPath()).toContain('/api/ad-connections/meta/authorize');
    expect(calledInit().method).toBe('POST');
  });

  it('lists the ad accounts a grant can see', async () => {
    await apiClient.adConnections.accounts('tiktok');
    expect(calledPath()).toContain('/api/ad-connections/tiktok/accounts');
  });

  it('posts the chosen account id', async () => {
    await apiClient.adConnections.selectAccount('meta', 'act_111111111');
    expect(calledPath()).toContain('/api/ad-connections/meta/account');
    expect(calledInit().method).toBe('POST');
    expect(String(calledInit().body)).toContain('act_111111111');
  });

  it('deletes a connection to disconnect it', async () => {
    await apiClient.adConnections.disconnect('meta');
    expect(calledPath()).toContain('/api/ad-connections/meta');
    expect(calledInit().method).toBe('DELETE');
  });

  it('requests insights for an explicit period', async () => {
    await apiClient.adConnections.insights('2026-08-31', '2026-09-06');
    expect(calledPath()).toContain('/api/ad-connections/insights');
    expect(calledPath()).toContain('periodStart=2026-08-31');
    expect(calledPath()).toContain('periodEnd=2026-09-06');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run services/apiClient.adConnections.test.ts`
Expected: type error / runtime failure — `apiClient.adConnections` is undefined.

- [ ] **Step 5: Add the apiClient group**

In `frontend/services/apiClient.ts`, add the fixture import near the others (around line 19):

```ts
import { MOCK_AD_ACCOUNTS, MOCK_AD_CONNECTIONS, MOCK_AD_INSIGHTS } from './fixtures/adConnections';
```

Add these to the type import block:

```ts
  AdAccountOption,
  AdConnection,
  AdInsightSummary,
  AdProvider,
```

Then add this group immediately after the existing `connections` group (around line 326):

```ts
  /**
   * Ad-platform (Meta / TikTok) account connections and metric sync.
   *
   * Distinct from `connections` above, which is the publishing-platform
   * scaffolding. An ads grant is a different authorisation — see types.ts's
   * AdProvider doc comment.
   */
  adConnections: {
    list: () =>
      USE_FIXTURES
        ? delay<AdConnection[]>(MOCK_AD_CONNECTIONS)
        : request<AdConnection[]>('/api/ad-connections'),

    /** Returns the consent-screen URL the browser should navigate to. */
    authorize: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay<{ authorizeUrl: string }>({ authorizeUrl: '#fixture-no-oauth' })
        : request<{ authorizeUrl: string }>(`/api/ad-connections/${provider}/authorize`, {
            method: 'POST',
          }),

    accounts: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay<AdAccountOption[]>(MOCK_AD_ACCOUNTS)
        : request<AdAccountOption[]>(`/api/ad-connections/${provider}/accounts`),

    selectAccount: (provider: AdProvider, externalAccountId: string) =>
      USE_FIXTURES
        ? delay<AdConnection>(MOCK_AD_CONNECTIONS[0])
        : request<AdConnection>(`/api/ad-connections/${provider}/account`, {
            method: 'POST',
            body: JSON.stringify({ externalAccountId }),
          }),

    disconnect: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request(`/api/ad-connections/${provider}`, { method: 'DELETE' }),

    /**
     * Pulls the period's metrics from every connected ad account. Synchronous
     * on the backend — this call can take several seconds.
     */
    insights: (periodStart: string, periodEnd: string) =>
      USE_FIXTURES
        ? delay<AdInsightSummary>(MOCK_AD_INSIGHTS)
        : request<AdInsightSummary>(
            `/api/ad-connections/insights?periodStart=${periodStart}&periodEnd=${periodEnd}`,
          ),
  },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run services/apiClient.adConnections.test.ts`
Expected: `6 passed`.

- [ ] **Step 7: Commit** — *user runs this*

```bash
git add frontend/types.ts frontend/services/fixtures/adConnections.ts frontend/services/apiClient.ts frontend/services/apiClient.adConnections.test.ts
git commit -m "feat(module4): add ad-connection types, fixtures, and apiClient group"
```

---

### Task 18: The useAdConnections hook

**Files:**
- Create: `frontend/services/useAdConnections.ts`
- Test: `frontend/services/useAdConnections.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/services/useAdConnections.test.tsx`:

```tsx
/**
 * The hook is deliberately not a context provider: only two components need
 * this data and neither shares state with the other, so each fetches its own.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdConnections } from './useAdConnections';
import type { AdConnection } from '../types';

const listMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('./apiClient', () => ({
  apiClient: {
    adConnections: {
      list: () => listMock(),
      disconnect: (...args: unknown[]) => disconnectMock(...args),
    },
  },
}));

const META_ACTIVE: AdConnection = {
  provider: 'meta',
  configured: true,
  status: 'ACTIVE',
  accountName: 'Cebu Dive Co. Ads',
  currency: 'PHP',
  connectedAt: '2026-08-20T02:14:00Z',
  lastSyncedAt: null,
};

const TIKTOK_OFF: AdConnection = {
  provider: 'tiktok',
  configured: false,
  status: 'DISCONNECTED',
  accountName: null,
  currency: null,
  connectedAt: null,
  lastSyncedAt: null,
};

beforeEach(() => {
  listMock.mockReset();
  disconnectMock.mockReset();
  listMock.mockResolvedValue([META_ACTIVE, TIKTOK_OFF]);
  disconnectMock.mockResolvedValue({ ok: true });
});

describe('useAdConnections', () => {
  it('starts null then loads the connections', async () => {
    const { result } = renderHook(() => useAdConnections());
    expect(result.current.connections).toBeNull();
    await waitFor(() => expect(result.current.connections).toHaveLength(2));
  });

  it('reports whether any provider is active', async () => {
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.hasActive).toBe(true));
  });

  it('reports no active provider when none is connected', async () => {
    listMock.mockResolvedValue([TIKTOK_OFF]);
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.connections).toHaveLength(1));
    expect(result.current.hasActive).toBe(false);
  });

  it('finds one provider by key', async () => {
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.connections).toHaveLength(2));
    expect(result.current.forProvider('meta')?.accountName).toBe('Cebu Dive Co. Ads');
  });

  it('disconnecting refetches the list', async () => {
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.connections).toHaveLength(2));

    await act(async () => {
      await result.current.disconnect('meta');
    });

    expect(disconnectMock).toHaveBeenCalledWith('meta');
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a load failure instead of hanging on null', async () => {
    listMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAdConnections());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.connections).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run services/useAdConnections.test.tsx`
Expected: cannot resolve `./useAdConnections`.

- [ ] **Step 3: Write the hook**

Create `frontend/services/useAdConnections.ts`:

```ts
/**
 * Ad-platform connection state for one component.
 *
 * Deliberately a plain hook rather than a context provider like
 * connectionsStore.tsx: only Settings and the Performance ingestion form need
 * this, they never render together, and neither mutates state the other reads.
 * A provider would add a mount point in App.tsx for no benefit.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AdConnection, AdProvider } from '../types';
import { apiClient } from './apiClient';

export interface AdConnectionsState {
  /** null while loading; [] once loaded (or failed). */
  connections: AdConnection[] | null;
  error: unknown | null;
  hasActive: boolean;
  forProvider(provider: AdProvider): AdConnection | null;
  refresh(): Promise<void>;
  disconnect(provider: AdProvider): Promise<void>;
}

export function useAdConnections(): AdConnectionsState {
  const [connections, setConnections] = useState<AdConnection[] | null>(null);
  const [error, setError] = useState<unknown | null>(null);

  const refresh = useCallback(async () => {
    try {
      setConnections(await apiClient.adConnections.list());
      setError(null);
    } catch (err) {
      // An empty array rather than null: the UI renders "nothing connected"
      // plus the error, instead of a skeleton that never resolves.
      setConnections([]);
      setError(err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const disconnect = useCallback(
    async (provider: AdProvider) => {
      await apiClient.adConnections.disconnect(provider);
      await refresh();
    },
    [refresh],
  );

  const forProvider = useCallback(
    (provider: AdProvider) => connections?.find((c) => c.provider === provider) ?? null,
    [connections],
  );

  return {
    connections,
    error,
    hasActive: (connections ?? []).some((c) => c.status === 'ACTIVE'),
    forProvider,
    refresh,
    disconnect,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run services/useAdConnections.test.tsx`
Expected: `6 passed`.

- [ ] **Step 5: Commit** — *user runs this*

```bash
git add frontend/services/useAdConnections.ts frontend/services/useAdConnections.test.tsx
git commit -m "feat(module4): add useAdConnections hook"
```

---

### Task 19: The Ad Accounts settings section

**Files:**
- Create: `frontend/components/settings/AdAccountsSection.tsx`
- Test: `frontend/components/settings/AdAccountsSection.test.tsx`

Styling: reuse the exact row markup already in `PlatformsSettings.tsx:104-142` — `card p-6`, the bordered flex row, `badge badge--teal`, `btn-outline--sm`, `btn-primary`. Consult the `tourism-app-branding` skill before inventing any new class.

- [ ] **Step 1: Write the failing test**

Create `frontend/components/settings/AdAccountsSection.test.tsx`:

```tsx
/**
 * Four states matter here and each is a different message to the operator:
 * server has no credentials, operator hasn't connected, operator connected but
 * hasn't picked an account, and fully active.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdAccountsSection from './AdAccountsSection';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';
import type { AdConnection } from '../../types';

const listMock = vi.fn();
const authorizeMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      list: () => listMock(),
      authorize: (...args: unknown[]) => authorizeMock(...args),
      disconnect: (...args: unknown[]) => disconnectMock(...args),
    },
  },
}));

function connection(over: Partial<AdConnection>): AdConnection {
  return {
    provider: 'meta',
    configured: true,
    status: 'DISCONNECTED',
    accountName: null,
    currency: null,
    connectedAt: null,
    lastSyncedAt: null,
    ...over,
  };
}

function renderSection() {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <AdAccountsSection onConnected={() => {}} />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  listMock.mockReset();
  authorizeMock.mockReset();
  disconnectMock.mockReset();
  authorizeMock.mockResolvedValue({ authorizeUrl: 'https://facebook.test/dialog' });
  disconnectMock.mockResolvedValue({ ok: true });
});

describe('AdAccountsSection', () => {
  it('renders a row per provider', async () => {
    listMock.mockResolvedValue([
      connection({ provider: 'meta' }),
      connection({ provider: 'tiktok' }),
    ]);
    renderSection();
    expect(await screen.findByText('Meta Ads')).toBeInTheDocument();
    expect(screen.getByText('TikTok Ads')).toBeInTheDocument();
  });

  it('says so when the server has no credentials for a provider', async () => {
    listMock.mockResolvedValue([connection({ provider: 'meta', configured: false })]);
    renderSection();
    expect(await screen.findByText(/not configured on this server/i)).toBeInTheDocument();
  });

  it('disables Connect when the provider is unconfigured', async () => {
    listMock.mockResolvedValue([connection({ provider: 'meta', configured: false })]);
    renderSection();
    await screen.findByText('Meta Ads');
    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  it('shows the account name and currency when active', async () => {
    listMock.mockResolvedValue([
      connection({ status: 'ACTIVE', accountName: 'Cebu Dive Co. Ads', currency: 'PHP' }),
    ]);
    renderSection();
    expect(await screen.findByText(/Cebu Dive Co. Ads/)).toBeInTheDocument();
    expect(screen.getByText(/PHP/)).toBeInTheDocument();
  });

  it('prompts to finish setup when connected but no account is chosen', async () => {
    listMock.mockResolvedValue([connection({ status: 'PENDING_ACCOUNT_SELECTION' })]);
    renderSection();
    expect(await screen.findByRole('button', { name: /choose ad account/i })).toBeInTheDocument();
  });

  it('navigates to the consent screen on Connect', async () => {
    listMock.mockResolvedValue([connection({ provider: 'meta' })]);
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign, href: '' },
      writable: true,
    });

    renderSection();
    await screen.findByText('Meta Ads');
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => expect(authorizeMock).toHaveBeenCalledWith('meta'));
  });

  it('disconnects and refetches', async () => {
    listMock.mockResolvedValue([connection({ status: 'ACTIVE', accountName: 'Ads' })]);
    renderSection();
    await screen.findByText(/Ads/);

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    await waitFor(() => expect(disconnectMock).toHaveBeenCalledWith('meta'));
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run components/settings/AdAccountsSection.test.tsx`
Expected: cannot resolve `./AdAccountsSection`.

- [ ] **Step 3: Write the component**

Create `frontend/components/settings/AdAccountsSection.tsx`:

```tsx
/**
 * Settings -> Platforms: ad-account connections.
 *
 * Sits BELOW the existing publishing-platform rows and is deliberately separate
 * from them. Connecting a Meta ad account grants read access to ad metrics; it
 * is not permission to publish, and one Meta grant covers both Facebook and
 * Instagram placements. Merging the two lists would misrepresent both.
 *
 * Spec: docs/superpowers/specs/2026-09-06-ad-platform-connections-design.md
 */
import { useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAdConnections } from '../../services/useAdConnections';
import { apiClient } from '../../services/apiClient';
import type { AdConnection, AdProvider } from '../../types';

const PROVIDER_LABELS: Record<AdProvider, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
};

const PROVIDER_HINTS: Record<AdProvider, string> = {
  meta: 'Covers Facebook and Instagram ad placements',
  tiktok: 'TikTok Ads Manager',
};

export default function AdAccountsSection({
  onConnected,
}: {
  /** Called when a provider needs its ad account chosen — opens the picker. */
  onConnected: (provider: AdProvider) => void;
}) {
  const { connections, error, disconnect } = useAdConnections();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<AdProvider | null>(null);

  async function startConnect(provider: AdProvider) {
    setBusy(provider);
    try {
      const { authorizeUrl } = await apiClient.adConnections.authorize(provider);
      // A full navigation, not a popup: the consent screen is a first-party
      // page on the platform's domain and returns via our own callback.
      window.location.href = authorizeUrl;
    } catch {
      showToast(`Could not start the ${PROVIDER_LABELS[provider]} connection`);
      setBusy(null);
    }
  }

  async function handleDisconnect(provider: AdProvider) {
    setBusy(provider);
    try {
      await disconnect(provider);
      showToast(`Disconnected from ${PROVIDER_LABELS[provider]}`);
    } finally {
      setBusy(null);
    }
  }

  if (connections === null) {
    return (
      <div className="card p-6">
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skel" style={{ height: 64 }} />
          <div className="skel" style={{ height: 64 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="heading-lg mb-1">Ad accounts</h2>
      <p className="body-sm mb-5">
        Connect an ad account to pull impressions, clicks, and spend into Performance
        automatically. Revenue and bookings stay yours to enter.
      </p>

      {error != null && (
        <p className="body-sm mb-4 text-[var(--color-danger)]">
          Could not load ad connections. Check that the backend is running.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {connections.map((connection) => (
          <AdConnectionRow
            key={connection.provider}
            connection={connection}
            busy={busy === connection.provider}
            onConnect={() => startConnect(connection.provider)}
            onChooseAccount={() => onConnected(connection.provider)}
            onDisconnect={() => handleDisconnect(connection.provider)}
          />
        ))}
      </div>
    </div>
  );
}

function AdConnectionRow({
  connection,
  busy,
  onConnect,
  onChooseAccount,
  onDisconnect,
}: {
  connection: AdConnection;
  busy: boolean;
  onConnect: () => void;
  onChooseAccount: () => void;
  onDisconnect: () => void;
}) {
  const { provider, configured, status, accountName, currency } = connection;
  const isActive = status === 'ACTIVE';
  const isPending = status === 'PENDING_ACCOUNT_SELECTION';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-gray-light)] p-4">
      <div className="flex items-center gap-3">
        {isActive ? (
          <CheckCircle2 className="text-[var(--color-mint-primary)]" aria-hidden="true" />
        ) : (
          <Circle className="text-[var(--color-text-muted)]" aria-hidden="true" />
        )}
        <div>
          <p className="font-semibold text-navy-dark">{PROVIDER_LABELS[provider]}</p>
          <p className="body-xs text-[var(--color-text-muted)]">{statusLine(connection)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isActive && <span className="badge badge--teal">Connected</span>}
        {busy && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}

        {isPending && (
          <button type="button" className="btn-primary" onClick={onChooseAccount}>
            Choose ad account
          </button>
        )}

        {isActive || isPending ? (
          <button type="button" className="btn-outline--sm" onClick={onDisconnect} disabled={busy}>
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={onConnect}
            disabled={!configured || busy}
            title={configured ? undefined : 'This server has no credentials for this provider'}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );

  function statusLine(c: AdConnection): string {
    if (!c.configured) return 'Not configured on this server';
    if (isActive) {
      return currency ? `${accountName ?? 'Connected'} · ${currency}` : (accountName ?? 'Connected');
    }
    if (isPending) return 'Connected — choose which ad account to report on';
    return PROVIDER_HINTS[provider];
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run components/settings/AdAccountsSection.test.tsx`
Expected: `7 passed`. If a class name like `text-[var(--color-danger)]` does not exist, check the token list in the `tourism-app-branding` skill and substitute the real one — do not invent a token.

- [ ] **Step 5: Commit** — *user runs this*

```bash
git add frontend/components/settings/AdAccountsSection.tsx frontend/components/settings/AdAccountsSection.test.tsx
git commit -m "feat(module4): add the Ad Accounts settings section"
```

---

### Task 20: Account picker and post-redirect handling

**Files:**
- Create: `frontend/components/settings/AdAccountPickerModal.tsx`
- Modify: `frontend/components/settings/PlatformsSettings.tsx`
- Test: `frontend/components/settings/AdAccountPickerModal.test.tsx`
- Test: modify `frontend/components/settings/PlatformsSettings.test.tsx`

- [ ] **Step 1: Write the failing picker test**

Create `frontend/components/settings/AdAccountPickerModal.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdAccountPickerModal from './AdAccountPickerModal';
import { ToastProvider } from '../shared/Toast';
import { OverlayStackProvider } from '../shared/useOverlayStack';

const accountsMock = vi.fn();
const selectAccountMock = vi.fn();

vi.mock('../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      accounts: (...args: unknown[]) => accountsMock(...args),
      selectAccount: (...args: unknown[]) => selectAccountMock(...args),
    },
  },
}));

function renderPicker(onDone = vi.fn()) {
  return render(
    <ToastProvider>
      <OverlayStackProvider>
        <AdAccountPickerModal provider="meta" onClose={vi.fn()} onSelected={onDone} />
      </OverlayStackProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  accountsMock.mockReset();
  selectAccountMock.mockReset();
  selectAccountMock.mockResolvedValue({});
  accountsMock.mockResolvedValue([
    { id: 'act_1', name: 'Cebu Dive Co. Ads', currency: 'PHP' },
    { id: 'act_2', name: 'Personal Test', currency: 'USD' },
  ]);
});

describe('AdAccountPickerModal', () => {
  it('lists the accounts the grant can see, with currency', async () => {
    renderPicker();
    expect(await screen.findByText('Cebu Dive Co. Ads')).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
  });

  it('submits the chosen account', async () => {
    const onSelected = vi.fn();
    renderPicker(onSelected);
    fireEvent.click(await screen.findByText('Cebu Dive Co. Ads'));
    fireEvent.click(screen.getByRole('button', { name: /use this account/i }));

    await waitFor(() => expect(selectAccountMock).toHaveBeenCalledWith('meta', 'act_1'));
    await waitFor(() => expect(onSelected).toHaveBeenCalled());
  });

  it('keeps the confirm button disabled until something is picked', async () => {
    renderPicker();
    await screen.findByText('Cebu Dive Co. Ads');
    expect(screen.getByRole('button', { name: /use this account/i })).toBeDisabled();
  });

  it('explains an empty list rather than showing a blank modal', async () => {
    // Real and common: a brand-new Meta developer account with no Business
    // Portfolio has no ad accounts at all.
    accountsMock.mockResolvedValue([]);
    renderPicker();
    expect(await screen.findByText(/no ad accounts/i)).toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    accountsMock.mockRejectedValue(new Error('502'));
    renderPicker();
    expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run components/settings/AdAccountPickerModal.test.tsx`
Expected: cannot resolve `./AdAccountPickerModal`.

- [ ] **Step 3: Write the picker**

Create `frontend/components/settings/AdAccountPickerModal.tsx`:

```tsx
/**
 * Which ad account should CeView report on?
 *
 * A Meta login commonly exposes several ad accounts — personal, agency, a test
 * account — and TikTok exposes every advertiser the grant covers. Auto-picking
 * the first is silently wrong for anyone with more than one, and the platforms
 * do not document their ordering as stable, so the operator chooses.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import type { AdAccountOption, AdProvider } from '../../types';

const PROVIDER_LABELS: Record<AdProvider, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
};

export default function AdAccountPickerModal({
  provider,
  onClose,
  onSelected,
}: {
  provider: AdProvider;
  onClose: () => void;
  onSelected: () => void;
}) {
  const [accounts, setAccounts] = useState<AdAccountOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    apiClient.adConnections
      .accounts(provider)
      .then((list) => {
        if (!cancelled) setAccounts(list);
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.adConnections.selectAccount(provider, selected);
      showToast(`${PROVIDER_LABELS[provider]} connected`);
      onSelected();
    } catch {
      showToast('Could not save that ad account. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Choose a ${PROVIDER_LABELS[provider]} account`}>
      {accounts === null && (
        <div className="flex items-center gap-2 py-6">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" />
          <span className="body-sm">Loading your ad accounts…</span>
        </div>
      )}

      {loadFailed && (
        <p className="body-sm py-4">
          Could not load your ad accounts. The connection may have expired — disconnect and
          connect again.
        </p>
      )}

      {accounts !== null && !loadFailed && accounts.length === 0 && (
        <p className="body-sm py-4">
          No ad accounts are available on this connection. Create one in the platform’s Ads
          Manager first, then reconnect.
        </p>
      )}

      {accounts !== null && accounts.length > 0 && (
        <div className="flex flex-col gap-2 py-2" role="radiogroup" aria-label="Ad accounts">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              role="radio"
              aria-checked={selected === account.id}
              onClick={() => setSelected(account.id)}
              className={`flex items-center justify-between rounded-lg border p-3 text-left ${
                selected === account.id
                  ? 'border-[var(--color-mint-primary)]'
                  : 'border-[var(--color-gray-light)]'
              }`}
            >
              <span className="font-semibold text-navy-dark">{account.name ?? account.id}</span>
              <span className="body-xs text-[var(--color-text-muted)]">
                {account.currency ?? '—'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" className="btn-outline--sm" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={confirm}
          disabled={!selected || saving}
        >
          Use this account
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Run the picker test**

Run: `cd frontend && npm test -- --run components/settings/AdAccountPickerModal.test.tsx`
Expected: `5 passed`. If `Modal`'s props differ from `open`/`onClose`/`title`, read `components/shared/Modal.tsx` and match its actual signature.

- [ ] **Step 5: Wire both into PlatformsSettings**

In `PlatformsSettings.tsx`, add imports:

```tsx
import AdAccountsSection from './AdAccountsSection';
import AdAccountPickerModal from './AdAccountPickerModal';
import type { AdProvider } from '../../types';
```

Add state and a post-redirect effect inside the component, after the existing `useState` declarations:

```tsx
  /**
   * The provider whose account picker is open. Set either by returning from the
   * OAuth redirect (?adconnect=meta) or by the row's "Choose ad account" button.
   */
  const [pickerProvider, setPickerProvider] = useState<AdProvider | null>(null);
  const [adRefreshKey, setAdRefreshKey] = useState(0);

  // The backend's callback redirects here with ?adconnect=<provider> on success
  // or ?adconnect_error=<code> on failure. Read them once, then strip them so a
  // refresh doesn't reopen the picker.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('adconnect');
    const failed = params.get('adconnect_error');

    if (connected === 'meta' || connected === 'tiktok') {
      setPickerProvider(connected);
    } else if (failed) {
      showToast(
        failed === 'access_denied'
          ? 'Connection cancelled.'
          : `Could not complete the connection (${failed}).`,
      );
    }

    if (connected || failed) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showToast]);
```

Then render the section and modal after the existing connected-platforms card, inside the same wrapper:

```tsx
      <div className="mt-6">
        <AdAccountsSection key={adRefreshKey} onConnected={setPickerProvider} />
      </div>

      {pickerProvider && (
        <AdAccountPickerModal
          provider={pickerProvider}
          onClose={() => setPickerProvider(null)}
          onSelected={() => {
            setPickerProvider(null);
            // Force AdAccountsSection to remount and refetch so the row flips
            // to ACTIVE without a page reload.
            setAdRefreshKey((k) => k + 1);
          }}
        />
      )}
```

If the component's top-level element is a single `div.card`, wrap the existing card and the new section in a fragment rather than nesting cards.

- [ ] **Step 6: Add a regression test to PlatformsSettings.test.tsx**

The existing file mocks `connectionsStore`. Add a mock for the ad apiClient at the top:

```tsx
vi.mock('../../services/apiClient', () => ({
  apiClient: {
    adConnections: {
      list: () => Promise.resolve([]),
      authorize: () => Promise.resolve({ authorizeUrl: '#' }),
      disconnect: () => Promise.resolve({ ok: true }),
      accounts: () => Promise.resolve([]),
      selectAccount: () => Promise.resolve({}),
    },
  },
}));
```

and add this test:

```tsx
  it('still renders the publishing platforms alongside the ad accounts section', async () => {
    renderSettings();
    expect(await screen.findByText('Instagram')).toBeInTheDocument();
    expect(await screen.findByText('Ad accounts')).toBeInTheDocument();
  });
```

- [ ] **Step 7: Run the settings tests**

Run: `cd frontend && npm test -- --run components/settings/`
Expected: every file in the directory passes, including the pre-existing `PlatformsSettings` tests.

- [ ] **Step 8: Commit** — *user runs this*

```bash
git add frontend/components/settings/
git commit -m "feat(module4): add the ad account picker and post-redirect handling"
```

---

### Task 21: Sync into the Performance ingestion form

The payoff task. Four of the seven fields fill themselves; the other three stay the operator's.

**Files:**
- Modify: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx`
- Test: `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `IngestionForm.adSync.test.tsx`:

```tsx
/**
 * Ad-sync behaviour of the ingestion form. The form's own validation and
 * submit path are covered by its existing tests; this file only covers what
 * connecting an ad account changes.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IngestionForm from './IngestionForm';
import type { AdConnection, AdInsightSummary } from '../../../types';

const insightsMock = vi.fn();
const ingestMock = vi.fn();
let connections: AdConnection[] = [];

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    adConnections: { insights: (...a: unknown[]) => insightsMock(...a) },
    campaign: { ingest: (...a: unknown[]) => ingestMock(...a) },
  },
}));

vi.mock('../../../services/useAdConnections', () => ({
  useAdConnections: () => ({
    connections,
    error: null,
    hasActive: connections.some((c) => c.status === 'ACTIVE'),
    forProvider: (p: string) => connections.find((c) => c.provider === p) ?? null,
    refresh: async () => {},
    disconnect: async () => {},
  }),
}));

const ACTIVE_META: AdConnection = {
  provider: 'meta',
  configured: true,
  status: 'ACTIVE',
  accountName: 'Cebu Dive Co. Ads',
  currency: 'PHP',
  connectedAt: '2026-08-20T00:00:00Z',
  lastSyncedAt: null,
};

const SUMMARY: AdInsightSummary = {
  periodStart: '2026-08-31',
  periodEnd: '2026-09-06',
  impressions: 48210,
  clicks: 1327,
  spend: 4820.55,
  conversions: 45,
  currency: 'PHP',
  sources: [
    {
      provider: 'meta',
      accountName: 'Cebu Dive Co. Ads',
      impressions: 48210,
      clicks: 1327,
      spend: 4820.55,
      conversions: 45,
      currency: 'PHP',
    },
  ],
  warnings: [],
};

beforeEach(() => {
  insightsMock.mockReset();
  ingestMock.mockReset();
  ingestMock.mockResolvedValue({});
  insightsMock.mockResolvedValue(SUMMARY);
  connections = [];
});

describe('IngestionForm ad sync', () => {
  it('hides the sync button when no ad account is connected', () => {
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sync from ad accounts/i })).toBeNull();
  });

  it('shows the sync button when a connection is active', () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sync from ad accounts/i })).toBeInTheDocument();
  });

  it('fills the four platform-known fields', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    await waitFor(() =>
      expect((screen.getByLabelText(/impressions/i) as HTMLInputElement).value).toBe('48210'),
    );
    expect((screen.getByLabelText(/^clicks/i) as HTMLInputElement).value).toBe('1327');
    expect((screen.getByLabelText(/ad spend/i) as HTMLInputElement).value).toBe('4820.55');
    expect((screen.getByLabelText(/conversions/i) as HTMLInputElement).value).toBe('45');
  });

  it('leaves the business-side fields untouched', async () => {
    // The ad platforms do not know revenue, bookings, or new customers.
    // Filling them with anything — including zero — would corrupt ROAS and CAC.
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    const revenueBefore = (screen.getByLabelText(/revenue/i) as HTMLInputElement).value;

    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));
    await waitFor(() => expect(insightsMock).toHaveBeenCalled());

    expect((screen.getByLabelText(/revenue/i) as HTMLInputElement).value).toBe(revenueBefore);
  });

  it('labels the money fields with the account currency', async () => {
    connections = [{ ...ACTIVE_META, currency: 'USD' }];
    insightsMock.mockResolvedValue({ ...SUMMARY, currency: 'USD' });
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    await waitFor(() => expect(screen.getByLabelText(/ad spend \(USD\)/i)).toBeInTheDocument());
  });

  it('syncs the same period the form submits', async () => {
    connections = [ACTIVE_META];
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    await waitFor(() => expect(insightsMock).toHaveBeenCalled());
    const [start, end] = insightsMock.mock.calls[0];
    expect(String(start)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(end)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(start) < String(end)).toBe(true);
  });

  it('shows the warning and does not prefill when currencies differ', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockResolvedValue({
      ...SUMMARY,
      impressions: null,
      clicks: null,
      spend: null,
      conversions: null,
      currency: null,
      warnings: ['Connected ad accounts report in different currencies (PHP, USD).'],
    });

    render(<IngestionForm onSubmit={vi.fn()} />);
    const before = (screen.getByLabelText(/impressions/i) as HTMLInputElement).value;
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    expect(await screen.findByText(/different currencies/i)).toBeInTheDocument();
    expect((screen.getByLabelText(/impressions/i) as HTMLInputElement).value).toBe(before);
  });

  it('reports a sync failure without wiping what is typed', async () => {
    connections = [ACTIVE_META];
    insightsMock.mockRejectedValue(new Error('502'));
    render(<IngestionForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync from ad accounts/i }));

    expect(await screen.findByText(/could not sync/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- --run components/module-4/4.1-campaign-analytics/IngestionForm.adSync.test.tsx`
Expected: the first test passes trivially; the rest fail because no sync button exists.

**If the fields have no accessible label**, `getByLabelText` will fail on every test. Read `IngestionForm.tsx`'s current input markup first — if the label is not associated via `htmlFor`/`id`, fix that association as part of this task. It is a genuine accessibility gap, not test scaffolding.

- [ ] **Step 3: Make the field labels currency-aware**

In `IngestionForm.tsx`, replace the static `FIELDS` constant with a function:

```tsx
/**
 * Which of the seven fields the ad platforms can actually fill.
 *
 * Revenue, bookings, and new customers are business facts no ad API knows —
 * they stay the operator's to enter. Prefilling them with zero would make ROAS
 * and CAC meaningless while looking authoritative.
 */
const SYNCABLE_FIELDS = ['impressions', 'clicks', 'adSpend', 'conversions'] as const;

function fieldsFor(currency: string): { key: keyof CampaignInput; label: string; hint: string }[] {
  return [
    { key: 'impressions', label: 'Impressions', hint: 'Total ad impressions served' },
    { key: 'clicks', label: 'Clicks', hint: 'Total clicks on ads' },
    { key: 'adSpend', label: `Ad spend (${currency})`, hint: `Total spend in ${currency}` },
    { key: 'revenue', label: `Revenue (${currency})`, hint: 'Revenue attributed to the campaign' },
    { key: 'conversions', label: 'Conversions (leads)', hint: 'Enquiry form submissions' },
    { key: 'bookings', label: 'Bookings (sales)', hint: 'Confirmed bookings closed' },
    { key: 'newCustomers', label: 'New customers', hint: 'Net-new customers acquired' },
  ];
}

/** Peso unless a connected ad account reports in something else. */
const DEFAULT_CURRENCY = '₱';
```

Replace every use of `FIELDS` in the component body with a memoised `fields`:

```tsx
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const fields = useMemo(() => fieldsFor(currency), [currency]);
```

`initialValues()` also iterates `FIELDS`; change it to iterate `fieldsFor(DEFAULT_CURRENCY)` — it only reads `key`, so the label does not matter there.

- [ ] **Step 4: Add the sync control**

Add imports:

```tsx
import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdConnections } from '../../../services/useAdConnections';
```

Add state and the handler inside the component:

```tsx
  const { hasActive } = useAdConnections();
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [syncedKeys, setSyncedKeys] = useState<string[]>([]);

  /**
   * Pulls the same period the form submits, so the synced figures and the
   * persisted campaign record describe the same week.
   */
  async function syncFromAdAccounts() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const { periodStart, periodEnd } = lastCompleteWeek();
      const summary = await apiClient.adConnections.insights(periodStart, periodEnd);

      if (summary.warnings.length > 0) {
        setSyncNote(summary.warnings.join(' '));
      }

      // Totals are withheld on a currency mismatch — prefilling from a partial
      // response would be worse than not prefilling at all.
      if (summary.impressions == null) {
        return;
      }

      setValues((current) => ({
        ...current,
        impressions: String(summary.impressions ?? current.impressions),
        clicks: String(summary.clicks ?? current.clicks),
        adSpend: String(summary.spend ?? current.adSpend),
        conversions: String(summary.conversions ?? current.conversions),
      }));
      setSyncedKeys([...SYNCABLE_FIELDS]);
      if (summary.currency) setCurrency(summary.currency);
      if (summary.warnings.length === 0) {
        setSyncNote(`Filled from ${summary.sources.map((s) => s.provider).join(' and ')}.`);
      }
    } catch {
      setSyncNote('Could not sync from your ad accounts. Enter the figures manually.');
    } finally {
      setSyncing(false);
    }
  }
```

An operator editing a synced field should lose its provenance tag. In the existing input `onChange`, add:

```tsx
                setSyncedKeys((keys) => keys.filter((k) => k !== key));
```

Render the button above the field grid, and the note below it:

```tsx
      {hasActive && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-outline--sm"
            onClick={syncFromAdAccounts}
            disabled={syncing}
          >
            <RefreshCw className={syncing ? 'animate-spin' : ''} size={14} aria-hidden="true" />
            {syncing ? 'Syncing…' : 'Sync from ad accounts'}
          </button>
          <span className="body-xs text-[var(--color-text-muted)]">
            Fills impressions, clicks, spend, and conversions. Revenue and bookings stay yours.
          </span>
        </div>
      )}

      {syncNote && <p className="body-sm mb-4">{syncNote}</p>}
```

And mark each synced field, next to its label:

```tsx
              {syncedKeys.includes(key) && (
                <span className="badge badge--teal">synced</span>
              )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- --run components/module-4/4.1-campaign-analytics/`
Expected: the new file's 9 tests pass and the pre-existing `IngestionForm` tests still pass.

- [ ] **Step 6: Run the whole frontend suite and a build**

Run: `cd frontend && npm test -- --run && npm run build`
Expected: all tests pass; the build completes with no TypeScript errors.

- [ ] **Step 7: Verify Phase 5 in the browser**

With the backend running, the tunnel up, and `VITE_USE_FIXTURES=false`:

1. `npm run dev`, log in, go to **Settings → Platforms**.
2. Confirm the three publishing rows are unchanged and an **Ad accounts** section appears below them.
3. Click **Connect** on Meta Ads, complete consent, and confirm you return to the same page with the account picker open.
4. Pick an account; the row flips to Connected with the account name and currency.
5. Go to **Performance**. With no campaign data, the ingestion form appears with a **Sync from ad accounts** button.
6. Click it; impressions, clicks, ad spend, and conversions fill in and are tagged `synced`. Revenue, bookings, and new customers stay as they were.

- [ ] **Step 8: Commit** — *user runs this*

```bash
git add frontend/components/module-4/4.1-campaign-analytics/
git commit -m "feat(module4): sync ad-account metrics into the campaign ingestion form"
```

---


### Task 22: Playwright coverage for the settings UI states

Playwright cannot drive a real OAuth consent screen — it lives on Meta's domain behind a login this test has no credentials for. So this covers the states CeView itself renders, with `/api/ad-connections` stubbed, and says so plainly in the file header rather than implying the flow is tested.

**Files:**
- Modify: `e2e/tests/settings-platforms.spec.ts`

- [ ] **Step 1: Write the failing spec**

Append to `e2e/tests/settings-platforms.spec.ts`, inside the file but after the existing `test.describe('Platforms', ...)` block. It follows the same conventions as the existing block: `requireBackend()` in `beforeEach`, `SEED_OPERATOR` for login, and `page.route` to stand in for endpoints whose real behaviour needs external credentials.

```ts
// ── Ad accounts ─────────────────────────────────────────────────────────────
//
// Screen: /settings/platforms — the "Ad accounts" section
// Spec: docs/superpowers/specs/2026-09-06-ad-platform-connections-design.md
//
// SCOPE, STATED HONESTLY: this does NOT test the OAuth round-trip. The consent
// screen is a page on Meta's/TikTok's own domain behind a login these tests have
// no credentials for, so /api/ad-connections is stubbed and only the states
// CeView renders are asserted. The real flow is verified by hand — see
// AD_PLATFORM_SETUP.md §8.

test.describe('Platforms — ad accounts', () => {
  test.beforeEach(async () => {
    await requireBackend();
  });

  type AdConnection = {
    provider: 'meta' | 'tiktok';
    configured: boolean;
    status: 'DISCONNECTED' | 'PENDING_ACCOUNT_SELECTION' | 'ACTIVE' | 'REVOKED';
    accountName: string | null;
    currency: string | null;
    connectedAt: string | null;
    lastSyncedAt: string | null;
  };

  function connection(over: Partial<AdConnection> = {}): AdConnection {
    return {
      provider: 'meta',
      configured: true,
      status: 'DISCONNECTED',
      accountName: null,
      currency: null,
      connectedAt: null,
      lastSyncedAt: null,
      ...over,
    };
  }

  async function mockAdConnections(
    page: import('@playwright/test').Page,
    rows: AdConnection[],
  ) {
    await page.route('**/api/ad-connections', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
    });
  }

  async function loginAndOpenPlatforms(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(SEED_OPERATOR.email);
    await page.getByLabel(/password/i).fill(SEED_OPERATOR.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.goto('/settings/platforms');
  }

  test('renders a row for each ad provider below the publishing platforms', async ({ page }) => {
    await mockAdConnections(page, [
      connection({ provider: 'meta' }),
      connection({ provider: 'tiktok' }),
    ]);
    await loginAndOpenPlatforms(page);

    await expect(page.getByText('Ad accounts')).toBeVisible();
    await expect(page.getByText('Meta Ads')).toBeVisible();
    await expect(page.getByText('TikTok Ads')).toBeVisible();
    // The publishing rows must still be there — this section is additive.
    await expect(page.getByText('Instagram')).toBeVisible();
  });

  test('an unconfigured provider says so and cannot be connected', async ({ page }) => {
    await mockAdConnections(page, [connection({ provider: 'meta', configured: false })]);
    await loginAndOpenPlatforms(page);

    await expect(page.getByText(/not configured on this server/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^connect$/i })).toBeDisabled();
  });

  test('an active connection shows its account name and currency', async ({ page }) => {
    await mockAdConnections(page, [
      connection({ status: 'ACTIVE', accountName: 'Cebu Dive Co. Ads', currency: 'PHP' }),
    ]);
    await loginAndOpenPlatforms(page);

    await expect(page.getByText('Cebu Dive Co. Ads')).toBeVisible();
    await expect(page.getByText(/PHP/)).toBeVisible();
    await expect(page.getByRole('button', { name: /disconnect/i })).toBeVisible();
  });

  test('a pending connection prompts the operator to choose an account', async ({ page }) => {
    await mockAdConnections(page, [connection({ status: 'PENDING_ACCOUNT_SELECTION' })]);
    await loginAndOpenPlatforms(page);

    await expect(page.getByRole('button', { name: /choose ad account/i })).toBeVisible();
  });

  test('returning from the redirect with an error surfaces it and clears the query', async ({ page }) => {
    await mockAdConnections(page, [connection()]);
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(SEED_OPERATOR.email);
    await page.getByLabel(/password/i).fill(SEED_OPERATOR.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await page.goto('/settings/platforms?adconnect_error=access_denied');

    await expect(page.getByText(/connection cancelled/i)).toBeVisible();
    // The param is stripped so a refresh doesn't re-toast.
    await expect(page).toHaveURL(/\/settings\/platforms$/);
  });

  test('returning from a successful redirect opens the account picker', async ({ page }) => {
    await mockAdConnections(page, [connection({ status: 'PENDING_ACCOUNT_SELECTION' })]);
    await page.route('**/api/ad-connections/meta/accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'act_111111111', name: 'Cebu Dive Co. Ads', currency: 'PHP' },
        ]),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(SEED_OPERATOR.email);
    await page.getByLabel(/password/i).fill(SEED_OPERATOR.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await page.goto('/settings/platforms?adconnect=meta');

    await expect(page.getByText(/choose a meta ads account/i)).toBeVisible();
    await expect(page.getByText('Cebu Dive Co. Ads')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd e2e && npx playwright test settings-platforms.spec.ts`
Expected: the six new tests fail on the missing "Ad accounts" heading (or skip entirely if the backend is not running — start it first, per RUNNING.md §3).

If they skip, that is `requireBackend()` doing its job; start the stack and re-run before treating the task as done.

- [ ] **Step 3: Make them pass**

If Tasks 19 and 20 are complete, these should pass as written. Where they do not, the mismatch is almost always one of:

- **Login selectors.** Read `e2e/tests/login.spec.ts` for the actual field labels and button name, and copy them rather than guessing.
- **Toast text.** The error test asserts "Connection cancelled" — match whatever string Task 20's effect actually shows.
- **Modal title.** The picker test asserts "Choose a Meta Ads account" — match Task 20's `Modal` title exactly.

Fix the spec to match the implementation where the implementation is right; fix the implementation where the spec describes the better behaviour.

- [ ] **Step 4: Run the full e2e suite**

Run: `cd e2e && npx playwright test`
Expected: no new failures. Most other specs are `describe.skip` scaffolding and will report as skipped — that is the existing state of this suite, not something this task changes.

- [ ] **Step 5: Commit** — *user runs this*

```bash
git add e2e/tests/settings-platforms.spec.ts
git commit -m "test(e2e): cover the ad-accounts settings states in fixture mode"
```

---
## Phase 6 — Documentation

### Task 23: AD_PLATFORM_SETUP.md

**Files:**
- Create: `AD_PLATFORM_SETUP.md` (repo root)

There is no automated test for a document. The acceptance criterion is that a developer who has never seen this feature can follow it start to finish and reach a synced figure.

- [ ] **Step 1: Read the house style first**

Read `RUNNING.md` — specifically its section numbering with `---` rules (`:18`, `:55`, `:220`), its env-var table format (`:226-235`, columns `Variable | Required? | Used by | Notes`, where Notes is a full sentence describing the failure mode when unset), and its `Symptom | Fix` troubleshooting table (`:458-477`). Match all three.

- [ ] **Step 2: Write the guide**

Create `AD_PLATFORM_SETUP.md` with these sections. Every command must be copy-pasteable PowerShell, as in RUNNING.md.

1. **Title and purpose.** What this enables (pull impressions/clicks/spend/conversions into Performance), and an explicit statement of what it does **not** do: it does not publish posts, and it does not fetch organic post engagement.
2. **What you need before starting.** Two subsections. *Meta:* a developer account, a Business Portfolio, and an ad account; note that Business Verification and App Review are required before anyone but your own test users can connect, and that both run in calendar weeks. *TikTok:* a TikTok for Business account, a developer app, and an advertiser account. State plainly that API access itself is free — the cost is verification time and ad spend.
3. **Creating the Meta app.** Where to create it, which product to add, requesting `ads_read`, and where App ID and App Secret appear. Record the Graph API version this integration was built against, and note that `ceview.adplatform.meta.graph-base-url` overrides it without a code change.
4. **Creating the TikTok app.** Sandbox versus production, and how an advertiser account authorises the app. Note that the callback parameter is `auth_code`, not `code` — this surprises people reading Meta's docs first.
5. **Running the tunnel.** Install and start `ngrok http 8080` (or `cloudflared`), and copy the HTTPS URL. Flag prominently that a free-tier URL changes on restart and must be re-registered in §6 each session.
6. **Registering the redirect URI.** The exact values: `https://<tunnel>/api/ad-connections/meta/callback` and `.../tiktok/callback`. Warn that a trailing slash or an `http://` scheme produces a "URL blocked" error that names no cause.
7. **Environment variables.** A table in RUNNING.md's format covering `META_APP_ID`, `META_APP_SECRET`, `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`, `OAUTH_REDIRECT_BASE_URL`, `FRONTEND_BASE_URL`, and `TOKEN_ENCRYPTION_KEY`. For the last one, give the generator:

   ```powershell
   # 256-bit key, Base64 — required before any ad token can be stored
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

   State the failure mode for each: an unset app id makes that provider's endpoints return 503 `AD_PROVIDER_NOT_CONFIGURED` while the rest of the app runs normally; an unset `TOKEN_ENCRYPTION_KEY` lets the app start but refuses to store a token.
8. **Manual test walkthrough.** The six browser steps from Task 21 §7, each with the database state to expect:
   - after the callback: one `tbl_ad_platform_connection` row, status `PENDING_ACCOUNT_SELECTION`, `access_token_encrypted` unreadable
   - after choosing an account: status `ACTIVE` with `external_account_id` and `currency` set
   - after a sync: one `tbl_ad_insight` row and `last_synced_at` stamped

   Include the `psql` commands from Tasks 3, 11, and 14.
9. **Getting non-zero data.** State plainly that a new ad account returns zeros and that this is correct, not a bug. Two options: run a small real campaign (a few hundred pesos is enough to generate non-zero impressions and clicks), or use the platform sandbox — noting sandbox figures are synthetic and must never be presented as real results.
10. **What the numbers mean.** Two things a reader will otherwise get wrong: Meta returns an `actions` array from which only `offsite_conversion.*`, `onsite_conversion.*`, `lead`, `purchase`, and `complete_registration` are counted as conversions (Task 12); and figures are never converted between currencies, so mixed-currency accounts report separately with a warning.
11. **Direct API testing with curl.** Follow RUNNING.md §7's existing "Direct API testing without the frontend" pattern: obtain a JWT, then call `/api/ad-connections`, `/authorize`, `/accounts`, `/account`, and `/insights` in order.
12. **Troubleshooting.** A `Symptom | Fix` table covering at minimum: *URL blocked / redirect URI mismatch* (the tunnel URL changed, re-register it); *invalid_state on return* (the ten-minute TTL expired, or the link was opened twice — start again from Settings); *503 AD_PROVIDER_NOT_CONFIGURED* (app id or secret unset in the backend's environment); *the account picker is empty* (the grant sees no ad accounts — create one in Ads Manager); *"different currencies" warning* (expected, use one source at a time); *401 from Meta on sync* (the long-lived token expired after ~60 days — disconnect and reconnect); *TikTok returns HTTP 200 but nothing syncs* (check the `code` field in the response body, not the status).

- [ ] **Step 3: Walk the guide yourself, from a clean shell**

Open a new terminal with none of the ad variables set and follow the guide top to bottom. Anything you had to know but the guide did not say is a defect in the guide — fix it now, while you still remember what was missing.

- [ ] **Step 4: Commit** — *user runs this*

```bash
git add AD_PLATFORM_SETUP.md
git commit -m "docs: add the ad-platform connection setup and testing guide"
```

---

### Task 24: Cross-links and scope notes

Leaves the docs consistent so the next reader does not re-litigate what was built.

**Files:**
- Modify: `RUNNING.md`
- Modify: `README.md`
- Modify: `docs/module-3/backend/PlatformConnectionController.md`
- Modify: `docs/module-4/backend/post-metrics.md`
- Modify: `docs/module-4/README.md`

- [ ] **Step 1: Link the guide from RUNNING.md**

In §5 Environment variables, after the existing table, add:

```markdown
> **Connecting Meta or TikTok ad accounts?** Those variables (`META_APP_ID`,
> `TIKTOK_APP_ID`, `TOKEN_ENCRYPTION_KEY`, and the tunnel URL) are documented
> separately in [`AD_PLATFORM_SETUP.md`](AD_PLATFORM_SETUP.md), along with how to
> register the OAuth redirect URI and test the connection end to end. None of
> them are required for normal local development — the backend starts without
> them and the ad-connection endpoints report 503.
```

- [ ] **Step 2: Add it to README.md's documentation map**

Add a row to the Doc | Path | Covers table:

```markdown
| Ad platform setup | [`AD_PLATFORM_SETUP.md`](AD_PLATFORM_SETUP.md) | Connecting Meta and TikTok ad accounts; OAuth setup, env vars, manual testing |
```

- [ ] **Step 3: Note the scope split on the Module 3 spec**

At the top of `docs/module-3/backend/PlatformConnectionController.md`, under the existing "specified, not yet implemented" heading, add:

```markdown
> **Not the same thing as an ad-account connection.** This document specifies a
> *publishing* grant (post on the operator's behalf, read post insights) and
> remains unimplemented. A separate *ads* connection — Meta Ads and TikTok Ads,
> read-only campaign metrics — was built in September 2026 under
> `com.ceview.module4.adconnections`; see
> [`docs/superpowers/specs/2026-09-06-ad-platform-connections-design.md`](../../superpowers/specs/2026-09-06-ad-platform-connections-design.md).
> The two are different OAuth scopes and different tables. Connecting an ad
> account does not grant permission to publish.
```

- [ ] **Step 4: Note what post-metrics still needs**

At the top of `docs/module-4/backend/post-metrics.md`, add:

```markdown
> **Still unimplemented.** The ad-connection work of September 2026 delivered
> account-level *ad* metrics (`tbl_ad_insight`), not per-post organic insights.
> Per-post metrics need a publishing connection with `pages_read_engagement` /
> `instagram_manage_insights` — a different grant from the `ads_read` scope that
> feature uses.
```

- [ ] **Step 5: Mention the feature in the Module 4 README**

Add a short paragraph to `docs/module-4/README.md` describing the ad-connection flow and linking the spec and `AD_PLATFORM_SETUP.md`, matching that file's existing prose style.

- [ ] **Step 6: Final full verification**

```powershell
cd backend/spring-boot; ./mvnw test
cd ../../frontend; npm test -- --run; npm run build
```

Expected: BUILD SUCCESS and all frontend tests passing. Then re-run the browser walkthrough in Task 21 §7 once more, end to end, on a fresh backend start.

- [ ] **Step 7: Commit** — *user runs this*

```bash
git add RUNNING.md README.md docs/module-3/backend/PlatformConnectionController.md docs/module-4/backend/post-metrics.md docs/module-4/README.md
git commit -m "docs: cross-link the ad-platform guide and clarify the publishing/ads scope split"
```

---

## Final verification

Run everything before calling this done:

- `cd backend/spring-boot && ./mvnw test` — all green, including the MockWebServer suites.
- `cd frontend && npm test -- --run && npm run build` — all green, no TypeScript errors.
- `cd e2e && npx playwright test` — no new failures (most existing specs are `describe.skip` scaffolding and report as skipped).
- The full browser walkthrough (Task 21 §7) against real Meta and TikTok test accounts through a live tunnel.
- `SELECT access_token_encrypted FROM tbl_ad_platform_connection;` in `psql` returns unreadable Base64, not a token.
- `GET /api/ad-connections` with a second operator's JWT returns only that operator's connections.
- The backend boots with no ad credentials configured, and nothing else regresses.

## Out of scope — do not build these here

Organic publishing to Facebook, Instagram, or TikTok. Scheduled metric polling. The Module 3 `PlatformConnectionController` and `PublishingController` specs. Per-post organic insights. FX conversion. Meta App Review submission — required before anyone but the developer's own test users can connect, and worth starting in parallel with Phase 1 rather than after.
