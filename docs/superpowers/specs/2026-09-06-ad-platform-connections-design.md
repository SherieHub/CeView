# Ad Platform Connections — Meta Ads & TikTok Ads

**Date:** 2026-09-06
**Status:** Approved design, ready for implementation planning
**Module:** 4 (Campaign Analytics & Reporting), with narrow touches to shared auth plumbing

---

## Problem

Module 4's Performance screen is the only place CeView reports campaign outcomes, and every
number in it is typed in by hand. `IngestionForm.tsx` collects seven counters — impressions,
clicks, adSpend, revenue, conversions, bookings, newCustomers — and `POST /api/analytics/manual`
derives CTR, CPC, ROAS, CAC and the PES score from them.

This is friction at the wrong moment. The four figures the ad platforms already know
(impressions, clicks, spend, conversions) are the tedious ones for an operator to look up, and a
mistyped ad spend silently corrupts the PES score the entire module is built around.

Separately, `PlatformsSettings.tsx` presents three platform rows whose "Connect" button is a
1.3-second `setTimeout` — deliberate scaffolding, documented as such in its own header comment,
with no backend behind it.

## Goal

An MSME operator OAuth-connects their Meta Ads and/or TikTok Ads account, chooses which ad
account to report on, and pulls that period's platform-side metrics into the ingestion form.
Revenue, bookings, and new customers remain operator-entered.

## Non-goals

Organic publishing of media and captions to Facebook, Instagram, or TikTok. Scheduled metric
polling. The Module 3 `PlatformConnectionController`, `PublishingController`, and `post-metrics`
specs. Per-post organic insights. Currency conversion. Meta App Review submission.

Publishing was considered and explicitly deferred: it requires media hosting (Instagram's
Content Publishing API needs a publicly reachable image URL, not the base64 data URL the Content
Studio holds today), a two-step container-then-publish flow, and `instagram_content_publish` app
review. Folding it in would roughly double the surface area before any part of the feature became
verifiable end to end.

---

## Design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Ads metrics only | Smallest independently testable slice; publishing follows as its own spec |
| Data merge | Fetched values prefill; operator completes | Ad platforms don't know revenue/bookings/customers; zeroing them would make ROAS and CAC meaningless |
| Callback host | HTTPS tunnel to `localhost:8080` | Both platforms require an HTTPS redirect URI |
| Token storage | AES-GCM, key from env var | No encryption utility exists in the repo today; these are 60-to-365-day-lived secrets |
| UI placement | New "Ad Accounts" section | Ads and publishing are separate grants; keeps the existing publish gating untouched |
| Sync trigger | On-demand button | Manually testable now; a scheduled poll can follow once the fetch is proven |
| Ad account | Operator picks | A Meta login typically exposes several accounts; auto-picking the first is silently wrong |
| Currency | Store and display the account's own | No FX error introduced; historical rates would be needed for past periods |
| Missing credentials | Degrade gracefully, 503 | Mirrors `FirebaseConfig`; keeps CI and teammates unblocked |
| Client tests | Add `okhttp3 mockwebserver` | JSON parsing against real payloads is where integration bugs actually live |

---

## Architecture

### Why the OAuth callback cannot be JWT-authenticated

The callback arrives as a **browser redirect from Meta or TikTok**. It carries no `Authorization`
header, so `SecurityConfig`'s `.anyRequest().authenticated()` rule has no way to determine which
operator the grant belongs to.

Tenancy therefore rides on a single-use `state` token, minted at authorize time and persisted
server-side with the business profile id bound to it. This is also the CSRF defence the OAuth
spec expects.

Two narrow changes to existing shared plumbing follow from this:

- `SecurityConfig` adds `/api/ad-connections/*/callback` to its `permitAll` matcher list.
- `ProfileCompletionFilter.isExempt` adds the same path. Without it, an operator whose
  `contactNumber` is blank receives a 403 mid-redirect with no path to recover.

Every other endpoint remains authenticated and tenant-scoped through
`currentBusinessProfile.resolveProfileId()`, matching how `EngagementMetricsController` already
scopes its queries.

### Flow

```
1. Operator clicks "Connect Meta Ads"
   POST /api/ad-connections/meta/authorize             (JWT)
   → mint state row (businessProfileId, provider, 10-min TTL)
   → return { authorizeUrl }
   → frontend navigates to it

2. Consent screen → platform redirects to the tunnel URL
   GET /api/ad-connections/meta/callback?code&state    (permitAll)
   → validate state: exists, unconsumed, unexpired, provider matches → consume
   → exchange code for token (Meta: exchange again for a long-lived token)
   → encrypt, upsert connection with status = PENDING_ACCOUNT_SELECTION
   → 302 to {FRONTEND_BASE_URL}/settings/platforms?adconnect=meta

3. Frontend sees ?adconnect=meta, opens the account picker
   GET  /api/ad-connections/meta/accounts              (JWT)
   POST /api/ad-connections/meta/account               (JWT)
   → persist account id, name, currency; status = ACTIVE

4. Performance → "Sync from ad accounts"
   GET /api/ad-connections/insights?periodStart&periodEnd   (JWT)
   → fan out to each ACTIVE connection, upsert tbl_ad_insight
   → return aggregate + per-source breakdown + warnings
   → IngestionForm prefills four of its seven fields
```

### Package placement

New package `com.ceview.module4.adconnections`. These connections exist to feed Module 4's
analytics and the sync endpoint's only consumer is the Performance screen.

The pre-existing `docs/module-3/backend/PlatformConnectionController.md` spec describes a
*publishing* connection under Module 3. It stays where it is and remains unbuilt. Both specs
gain a cross-reference so the distinction survives future readers.

---

## Data model

One Flyway migration, `V27__module4_ad_platform_connections.sql`, following the conventions
established in `V26__module1_reference_corpus.sql`: `tbl_` prefix, `UUID … DEFAULT
gen_random_uuid()`, named `pk_`/`uq_`/`chk_` constraints, `TIMESTAMPTZ`, `IF NOT EXISTS`,
`COMMENT ON`, and a header block explaining the rationale.

### `tbl_ad_platform_connection`

One row per (business profile, provider).

| Column | Notes |
|---|---|
| `connection_id` | UUID PK |
| `business_profile_id` | FK → `tbl_business_profile` |
| `provider` | `CHECK IN ('meta','tiktok')` |
| `access_token_encrypted` | never returned to the client |
| `refresh_token_encrypted` | nullable — Meta long-lived tokens have none |
| `token_expires_at` | nullable |
| `external_account_id`, `external_account_name`, `currency CHAR(3)` | null until the operator selects an account |
| `scopes` | granted scope string as returned |
| `status` | `CHECK IN ('PENDING_ACCOUNT_SELECTION','ACTIVE','REVOKED')` |
| `connected_at`, `last_synced_at`, `created_at`, `updated_at` | |

`uq_ad_conn_profile_provider UNIQUE (business_profile_id, provider)`.

### `tbl_ad_oauth_state`

Short-lived CSRF and tenancy carrier: `state` (UUID PK), `business_profile_id`, `provider`,
`created_at`, `expires_at`, `consumed_at`. Rows older than a day are deleted opportunistically on
each authorize call — this does not warrant a scheduler.

### `tbl_ad_insight`

| Column | Notes |
|---|---|
| `insight_id` | UUID PK |
| `business_profile_id`, `provider`, `external_account_id` | |
| `period_start DATE`, `period_end DATE` | |
| `impressions BIGINT`, `clicks BIGINT`, `spend NUMERIC(14,2)`, `conversions BIGINT` | |
| `currency CHAR(3)` | as reported by the platform |
| `fetched_at` | |
| `raw_response TEXT` | kept deliberately — field-shape surprises are the likeliest failure mode, and this is what makes them debuggable |

`uq_ad_insight_period UNIQUE (business_profile_id, provider, period_start, period_end)` so a
re-sync updates rather than duplicates.

### H2 mirror

Add `db/h2/V18__ad_platform_connections.sql`. Tests do not need it — `src/test/resources/
application.properties` uses `ddl-auto=create-drop` with Flyway disabled — but the `h2` *runtime*
profile still points at `classpath:db/h2` and would fail schema validation without it. The file
header should record honestly that this mirror set is already nine migrations behind the Postgres
set and diverges in numbering.

---

## Components

| Component | Responsibility |
|---|---|
| `common/crypto/TokenCipher` | AES/GCM/NoPadding, random 12-byte IV prepended to ciphertext, Base64 out. Key from `ceview.security.token-encryption-key`. No new dependency. |
| `AdProviderProperties` | `@ConfigurationProperties` holding app id, secret, and redirect base per provider, plus `isConfigured(provider)`. |
| `AdPlatformClient` (interface) | `buildAuthorizeUrl`, `exchangeCode`, `listAccounts`, `fetchInsights`. |
| `MetaAdsClient` | Graph API. Own `WebClient` with explicit timeouts, following the `ExternalMarketDataClient` precedent rather than the shared `fastapiClient` bean. |
| `TikTokAdsClient` | Business API. Returns HTTP 200 with a non-zero `code` field on error — must be checked explicitly rather than relying on status. |
| `AdConnectionService` | State lifecycle, token exchange and encryption, account selection, disconnect. |
| `AdInsightSyncService` | Fan-out, upsert, aggregation, currency reconciliation. |
| `AdConnectionController` | The seven endpoints below. |

### Endpoints

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/api/ad-connections` | JWT | Per provider: `configured`, `status`, `accountName`, `currency`, `lastSyncedAt`. Never tokens. |
| `POST` | `/api/ad-connections/{provider}/authorize` | JWT | `{ authorizeUrl }` |
| `GET` | `/api/ad-connections/{provider}/callback` | permitAll | 302 to the frontend |
| `GET` | `/api/ad-connections/{provider}/accounts` | JWT | `[{ id, name, currency }]` |
| `POST` | `/api/ad-connections/{provider}/account` | JWT | Persists selection |
| `DELETE` | `/api/ad-connections/{provider}` | JWT | Discards tokens, status → REVOKED |
| `GET` | `/api/ad-connections/insights` | JWT | Aggregate, per-source breakdown, warnings |

### Unconfigured providers

`GET /api/ad-connections` always succeeds and reports `configured: false`. Every other endpoint
for an unconfigured provider returns **503** with `{"code":"AD_PROVIDER_NOT_CONFIGURED"}`.

This mirrors how `AuthController` handles an absent Firebase configuration, keeps CI and
teammates unblocked, and lets the Settings UI render a truthful "not configured on this server"
state rather than a generic error.

### Currency mismatch

If Meta reports USD and TikTok reports PHP, the two figures cannot be summed. The insights
response returns each source separately alongside a `warnings` array, and the frontend offers
per-source prefill instead of a combined total. Producing a silently wrong sum would be worse
than asking the operator to choose.

### API specifics to verify at implementation time

These endpoint shapes are **not asserted as current**. Meta versions its Graph API quarterly and
TikTok has renamed report endpoints before. The implementer confirms each against live
documentation first, and `AD_PLATFORM_SETUP.md` records whatever is actually used.

- **Meta:** `dialog/oauth` (scope `ads_read`) → `oauth/access_token` → `fb_exchange_token` for a
  long-lived token → `/me/adaccounts?fields=id,name,currency` → `/{act_id}/insights` with
  `level=account` and a `time_range` JSON parameter.
- **TikTok:** `/portal/auth` → `/oauth2/access_token/` → `/oauth2/advertiser/get/` →
  `/report/integrated/get/` with `data_level=AUCTION_ADVERTISER`. Authentication travels in an
  `Access-Token` header, not a bearer token.

---

## Frontend

- **`types.ts`** — add `AdProvider = 'meta' | 'tiktok'`, `AdConnection`, `AdAccountOption`,
  `AdInsightSummary`. `PlatformId` and `PlatformConnection` are left alone; they belong to the
  publishing flow.
- **`apiClient.ts`** — an `adConnections` group following the existing
  `USE_FIXTURES ? delay(MOCK) : request(path)` ternary shape, plus `fixtures/adConnections.ts`.
- **`components/settings/AdAccountsSection.tsx`** — rendered inside `PlatformsSettings` beneath
  the existing rows, under its own heading. Two rows with real connect/disconnect, a
  "not configured on this server" state, and the connected account name and currency.
- **`components/settings/AdAccountPickerModal.tsx`** — opened on return from the redirect.
- **`PlatformsSettings.tsx`** — reads `?adconnect=` / `?adconnect_error=` from the URL, shows a
  toast, opens the picker, then clears the params. Its three-row publishing scaffolding is not
  touched; its header comment gains a line distinguishing publishing connections from ad
  connections.
- **`IngestionForm.tsx`** — a "Sync from ad accounts" button, shown only when at least one
  connection is ACTIVE. On success it fills impressions, clicks, adSpend, and conversions, tagging
  each with its source, and leaves revenue, bookings, and newCustomers to the operator. The
  hardcoded `₱` in the `FIELDS` labels becomes currency-driven. Synced values stay editable —
  overriding one drops its source tag.

No new context provider. Two components need this data and each fetches it; a `useAdConnections()`
hook suffices.

---

## Testing

**Backend**

- `TokenCipherTest` — round-trip; distinct ciphertexts for identical plaintext (random IV); a
  tampered ciphertext throwing rather than returning garbage.
- `MetaAdsClientTest` / `TikTokAdsClientTest` — MockWebServer against recorded JSON in
  `src/test/resources/adplatform/`. Assert both the parse and the outgoing request: path, query
  parameters, auth header. Cover TikTok's 200-with-error-code case and a paged account list.
- `AdConnectionControllerTest` — MockMvc with a real minted JWT, per the convention in
  `MetricsTenantScopingTest`. Tenant scoping; 503 when unconfigured; state tokens rejected when
  expired, already consumed, unknown, or bound to a different provider.
- `AdInsightSyncServiceTest` — upsert idempotency and the currency-mismatch warning.

**Frontend** — Vitest for the apiClient group, `AdAccountsSection`'s four states (unconfigured,
disconnected, pending, active), and `IngestionForm` prefill and override behaviour.

**e2e** — Playwright cannot drive a real OAuth consent screen. A fixture-mode spec covers the
settings UI states only; the spec file should say so plainly rather than imply the flow is
covered.

---

## Developer setup guide

New root file `AD_PLATFORM_SETUP.md`, matching RUNNING.md's house style: numbered `##` sections
separated by horizontal rules, PowerShell code blocks, a `Variable | Required? | Used by | Notes`
environment table, and a `Symptom | Fix` troubleshooting table.

1. Prerequisites — Meta developer account, Business Portfolio, ad account; TikTok for Business
   and developer app. Which steps need business verification and which do not.
2. Creating the Meta app — which product to add, the `ads_read` scope, where App ID and Secret live.
3. Creating the TikTok app — sandbox versus production, advertiser authorisation.
4. Running the tunnel against port 8080 and copying the HTTPS URL.
5. Registering the redirect URI on both platforms, including the re-registration step required
   each time a free-tier tunnel URL changes.
6. Environment variables: `META_APP_ID`, `META_APP_SECRET`, `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`,
   `OAUTH_REDIRECT_BASE_URL`, `FRONTEND_BASE_URL`, `TOKEN_ENCRYPTION_KEY` — with the one-liner
   that generates a valid 256-bit key.
7. Manual test walkthrough: connect → pick account → sync → confirm the prefill, listing the
   expected database rows at each step.
8. Getting non-zero data. A brand-new ad account reports zeros — the connection will appear to
   work perfectly and return nothing. Either run a small real campaign or use the platform
   sandbox; both documented, with the caveat that sandbox data is synthetic.
9. Direct API testing with `curl`, following RUNNING.md §7's existing pattern.
10. Troubleshooting: redirect URI mismatch, expired state, 503 unconfigured, empty account list,
    currency mismatch warning, token expiry.

Cross-linked from RUNNING.md §5 and README.md's documentation map.

---

## Build order

Each phase ends somewhere independently verifiable.

1. **Foundation** — `TokenCipher` and tests, migration (both sets), entities, repositories,
   `AdProviderProperties`, security and filter path exemptions.
   *Verify: app boots with and without credentials; `GET /api/ad-connections` reports
   `configured: false` for both providers.*
2. **Meta connect** — authorize, callback, accounts, account selection; `MetaAdsClient` OAuth half.
   *Verify: real OAuth round-trip through the tunnel; an ACTIVE row holding an encrypted token.*
3. **Meta insights** — `fetchInsights`, `AdInsightSyncService`, the insights endpoint.
   *Verify: `curl` returns the real ad account's numbers; a `tbl_ad_insight` row is written.*
4. **TikTok parity** — the same two phases against `TikTokAdsClient`.
   *Verify: both providers connected simultaneously, including the currency-mismatch path.*
5. **Frontend** — types, apiClient, `AdAccountsSection`, picker modal, IngestionForm sync.
   *Verify: full click-through from Settings to a prefilled Performance form.*
6. **Documentation** — `AD_PLATFORM_SETUP.md`, cross-links, and notes on the two Module 3 specs
   recording what this work did and did not build.

## Acceptance

- `./mvnw test` and `npm test` green; `npm run build` clean.
- Manual end-to-end per `AD_PLATFORM_SETUP.md` §7 against real Meta and TikTok test accounts
  through a live tunnel.
- `access_token_encrypted` is unreadable ciphertext when inspected in `psql`.
- A second operator's JWT returns only that operator's connections.
- The backend boots with no ad credentials configured and nothing else regresses.

## Known external constraints

These are timeline risks outside the codebase, recorded so they are not rediscovered later.

- Meta App Review and Business Verification are required before anyone other than the developer's
  own test users can connect. Both run in calendar weeks.
- Instagram organic insights (not in this scope, but relevant to the follow-on publishing spec)
  require a Professional account linked to a Facebook Page.
- Free-tier tunnel URLs change on restart, requiring redirect URI re-registration each session.
- A new ad account with no spend returns zeroed metrics; this is correct behaviour, not a defect.
