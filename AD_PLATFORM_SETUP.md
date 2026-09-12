# Ad Platform Connections — Setup & Testing Guide

This guide walks through connecting a Meta (Facebook/Instagram) or TikTok ad
account to CeView and pulling real performance figures into Module 4
(Campaign Analytics & Reporting).

**What this enables:** once connected, CeView can pull **impressions,
clicks, spend, and conversions** for a chosen ad account and prefill those
four fields on the Performance screen's ingestion form.

**What this does NOT do:**
- It does **not** publish posts to Facebook, Instagram, or TikTok. That is a
  separate, unbuilt integration (see `docs/module-3/backend/PlatformConnectionController.md`)
  with different scopes.
- It does **not** fetch organic post engagement (likes, comments, shares,
  reach on unpaid posts). It only reads **paid ad account** metrics.

If you've never set up an OAuth app with Meta or TikTok before, budget more
calendar time than you'd expect — see §2.

---

## 1. What you need before starting

### Meta

- A [Meta for Developers](https://developers.facebook.com/) account.
- A **Business Portfolio** (Meta Business Suite / Business Manager) — an app
  created without one can't request `ads_read` in a way that reaches real ad
  accounts.
- At least one **ad account** under that Business Portfolio (can be empty —
  see §9 for what an empty account returns).

Two things gate who can connect:

- **Business Verification** — Meta reviewing your Business Portfolio's
  identity. Required before the app can be used by anyone other than
  Business Portfolio admins/testers.
- **App Review** — Meta reviewing the specific permission (`ads_read`)
  your app requests. Required before anyone outside your own added test
  users can connect.

Both run in **calendar weeks**, not minutes — plan the first end-to-end
connection days ahead of when you need it working for someone other than
yourself. Until both clear, you (and any Meta users you explicitly add as
testers/admins on the app) can still connect and test everything in this
guide.

### TikTok

- A [TikTok for Business](https://ads.tiktok.com/) account.
- A [TikTok for Business developer app](https://business-api.tiktok.com/portal/docs)
  ("Developer Portal" app).
- At least one **advertiser account** to authorize the app against.

**The API access itself is free** for both platforms. The real cost of this
integration is **your time** (verification review cycles, waiting on app
approval) and, if you want non-zero numbers to test with (§9), a small
amount of **real ad spend**.

---

## 2. Creating the Meta app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps/) →
   **Create App** → choose the **Business** app type → attach it to your
   Business Portfolio.
2. In the app dashboard, **Add Product** → find **Marketing API** → add it.
   This is the product that exposes ad account read access.
3. Under App Review → Permissions and Features, request **`ads_read`**.
   Until App Review approves it, only Business Portfolio
   admins/testers/developers can grant this scope when connecting.
4. **App ID** and **App Secret** are shown on the app dashboard's
   **Settings → Basic** page. You'll put both into the backend's environment
   in §7.

This integration was built and tested against **Graph API v21.0**
(`https://graph.facebook.com/v21.0`). Meta versions its Graph API roughly
quarterly and eventually retires old versions — if you're reading this
months after it was written, check the [Meta API versioning
changelog](https://developers.facebook.com/docs/graph-api/changelog) for
whether v21.0 is still current. You do not need to touch code to move to a
newer version: override the Spring property
`ceview.adplatform.meta.graph-base-url` (e.g. via
`--ceview.adplatform.meta.graph-base-url=https://graph.facebook.com/v22.0`
as a command-line arg, or the equivalent relaxed-binding environment
variable `CEVIEW_ADPLATFORM_META_GRAPHBASEURL`) to point at the new
version's base URL.

---

## 3. Creating the TikTok app

1. Go to [TikTok for Business Developer Portal](https://business-api.tiktok.com/portal/docs) →
   create a new app.
2. Apps start in **Sandbox** mode, which only works against sandbox
   advertiser accounts and synthetic data (see §9). Moving to **Production**
   requires submitting the app for review with the scopes it uses; do this
   once you're ready to connect a real advertiser account.
3. **App ID** and **App Secret** (called "Secret" in TikTok's UI) are on the
   app's Basic Information page.
4. An advertiser authorizes your app from **TikTok Ads Manager** — the
   advertiser account owner clicks through the same OAuth consent screen
   this guide's walkthrough uses (§8), not a separate developer-portal
   action.

**Watch for this:** TikTok's OAuth callback sends the authorization code
back as a query parameter named **`auth_code`**, not `code`. If you've read
Meta's OAuth docs (or anyone else's) first, `code` is what you'll expect —
TikTok is the outlier. CeView's callback endpoint already handles both names
(it prefers `code` if present, falls back to `auth_code` otherwise), so
nothing to configure here — this is just so the parameter name doesn't
throw you off when reading TikTok's own docs or inspecting the redirect URL.

---

## 4. Running the tunnel

Both platforms redirect the browser back to a **public HTTPS URL** after
consent — `localhost:8080` is not reachable from Meta's or TikTok's servers,
so local development needs a tunnel in front of the backend.

**This project uses a native, quick/ephemeral tunnel — run in its own
terminal, not Docker.** cloudflared's *named*-tunnel mode (a stable hostname
that survives restarts) needs a domain registered in a Cloudflare account,
which costs money and isn't worth it for local dev; the quick-tunnel mode
below is entirely free and needs nothing beyond the `cloudflared` CLI (or
ngrok, if you prefer it) already being installed.

```powershell
cloudflared tunnel --url http://localhost:8080
# or, equivalently:
ngrok http 8080
```

Leave this running in its own terminal window for the duration of your
session. It prints an HTTPS forwarding URL, e.g.
`https://a1b2-c3d4.trycloudflare.com`. Copy it — you need it in §5 and §6.

**⚠️ This URL is random and changes every time you restart the tunnel.** New
day, laptop slept, terminal closed, tunnel dropped — any of those gives you a
**new** URL, and you must:

1. Re-register it as the redirect URI with Meta/TikTok (§5)
2. Update `OAUTH_REDIRECT_BASE_URL` in `backend/.env` (§6)
3. `docker compose up -d spring-boot` so the backend picks up the new value
   (env vars are only read at container start, not live)

This is the single most common reason the walkthrough in §7 breaks between
sessions — if OAuth suddenly stops working after previously working, this
mismatch is the first thing to check: confirm what URL the tunnel is
*currently* printing matches both what's registered with the platform and
what `docker exec ceview-spring env | grep OAUTH_REDIRECT_BASE_URL` shows.

---

## 5. Registering the redirect URI

In each platform's app settings, register the **exact** callback URLs,
substituting your tunnel URL from §4 for `<tunnel>`:

```text
https://<tunnel>/api/ad-connections/meta/callback
https://<tunnel>/api/ad-connections/tiktok/callback
```

- Meta: App Dashboard → your app → **Facebook Login for Business** or
  **Marketing API** settings → **Valid OAuth Redirect URIs**.
- TikTok: Developer Portal → your app → **Basic Information** →
  **Redirect URI** (sometimes called Callback URL).

**⚠️ A trailing slash or an `http://` scheme breaks this silently.** Both
platforms compare the redirect URI **byte-for-byte** against what's
registered. `https://a1b2.ngrok-free.app/api/ad-connections/meta/callback/`
(trailing slash) or `http://...` (wrong scheme) will not match
`https://a1b2.ngrok-free.app/api/ad-connections/meta/callback`, and the
error the platform shows — something like **"URL blocked" / "Can't Load
URL"** on Meta, a generic invalid-redirect error on TikTok — names neither
the mismatch nor which of scheme/host/path/trailing-slash is wrong. If you
hit that error, re-copy both URLs and diff them character by character
before looking anywhere else.

---

## 6. Environment variables

Set these the same way you set the rest of the backend's config — in
`backend/.env` (Path A / Docker Compose) or as shell env vars (Path B /
native). See `RUNNING.md` §5 for how those two paths differ.

| Variable | Required? | Used by | Notes |
|---|---|---|---|
| `META_APP_ID` | Required to use Meta | `spring-boot` | Bound to `ceview.adplatform.meta.app-id`. Unset (or blank), Meta's `/api/ad-connections/meta/*` endpoints return `503 AD_PROVIDER_NOT_CONFIGURED` — the rest of the app, including TikTok's endpoints, keeps working normally. |
| `META_APP_SECRET` | Required to use Meta | `spring-boot` | Bound to `ceview.adplatform.meta.app-secret`. Same failure mode as `META_APP_ID` — both must be set together; Meta is considered "configured" only when neither is blank. |
| `TIKTOK_APP_ID` | Required to use TikTok | `spring-boot` | Bound to `ceview.adplatform.tiktok.app-id`. Unset, TikTok's `/api/ad-connections/tiktok/*` endpoints return `503 AD_PROVIDER_NOT_CONFIGURED`, independently of Meta's configuration. |
| `TIKTOK_APP_SECRET` | Required to use TikTok | `spring-boot` | Bound to `ceview.adplatform.tiktok.app-secret`. Same failure mode as `TIKTOK_APP_ID`. |
| `OAUTH_REDIRECT_BASE_URL` | Required to use either provider | `spring-boot` | Bound to `ceview.adplatform.redirect-base-url`. This is your tunnel URL from §4 (no trailing slash) — it's prepended to `/api/ad-connections/{provider}/callback` to build the exact redirect URI both the authorize call and each platform's registered URI must match. Unset, the built redirect URI is malformed and the platform rejects the authorize request. |
| `FRONTEND_BASE_URL` | Has a default | `spring-boot` | Bound to `ceview.adplatform.frontend-base-url`; Spring's own internal default is `http://localhost:5173`, but this repo's `docker-compose.yml` overrides that to `http://localhost:3001` — the port `RUNNING.md` §4 actually runs the frontend on. Where the callback 302-redirects the browser back to (`/settings/platforms`) after storing or failing to store the grant. If you run the frontend on a different port, override this to match or the browser lands on a dead port after connecting. |
| `TOKEN_ENCRYPTION_KEY` | Required before any token can be stored | `spring-boot` | Bound to `ceview.security.token-encryption-key`. Unset, the app **starts fine** and the OAuth authorize/consent screen still works, but the token-exchange step in the callback throws and the connection ends in a `token_exchange_failed` redirect — nothing is ever stored unencrypted. Generate a value with the command below. |

**⚠️ These must reach the container, not just exist in `backend/.env`.** Under
Docker Compose (Path A), `backend/docker-compose.yml`'s `spring-boot` service
has to explicitly list each one as `SOME_VAR: ${SOME_VAR:-}` for Compose to
forward it — `backend/.env` alone only populates `${...}` substitutions
Compose is told to look for, it does not blanket-inject every variable in
the file into every container. All six ad-platform variables above are
already wired through in this repo's `docker-compose.yml`; if you add a new
one later, wire it the same way or it will silently never reach the app.

**⚠️ Spring Boot only reads env vars at container start, not live.** After
changing `OAUTH_REDIRECT_BASE_URL` (or any of these) in `backend/.env`, run
`docker compose up -d spring-boot` — editing the file alone changes nothing
until the container restarts and picks the new value up.

Generate `TOKEN_ENCRYPTION_KEY` — a 256-bit AES-GCM key, Base64-encoded:

```powershell
# 256-bit key, Base64 — required before any ad token can be stored
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Copy the output into `TOKEN_ENCRYPTION_KEY`. It must decode to exactly 32
bytes — the command above always produces that; don't hand-edit the output.

---

## 7. Manual test walkthrough

With the tunnel (§4), redirect URIs (§5), and env vars (§6) all in place,
and the backend + frontend running (`RUNNING.md` §3–§4):

1. **Open Settings → Platforms** in the frontend and click **Connect** next
   to Meta or TikTok. You're sent to the platform's OAuth consent screen.
2. **Approve the consent screen.** The platform redirects your browser back
   through the tunnel to the backend's callback, which stores the grant and
   redirects you again to `/settings/platforms` with an account picker open.

   Check the database:
   ```powershell
   docker exec ceview-postgres psql -U ceview -d ceview -c "SELECT connection_id, provider, status, external_account_id, currency FROM tbl_ad_platform_connection;"
   ```
   Expect **one row**: `status = 'PENDING_ACCOUNT_SELECTION'`,
   `external_account_id` and `currency` both `NULL`. Confirm the token is
   unreadable, not merely hidden:
   ```powershell
   docker exec ceview-postgres psql -U ceview -d ceview -c "SELECT access_token_encrypted FROM tbl_ad_platform_connection;"
   ```
   That value is Base64 ciphertext (`base64(iv || ciphertext || tag)`) —
   not a recognizable OAuth token.

3. **Choose an account** from the picker. This calls
   `POST /api/ad-connections/{provider}/account`.

   ```powershell
   docker exec ceview-postgres psql -U ceview -d ceview -c "SELECT provider, status, external_account_id, currency FROM tbl_ad_platform_connection;"
   ```
   Expect `status = 'ACTIVE'` now, with `external_account_id` and
   `currency` both populated.

4. **The connections row in Settings → Platforms shows ACTIVE**, with the
   chosen account's name.

5. **Go to Performance** and open the ingestion form for a campaign period.

6. **Click "Sync from ad accounts."** This calls
   `GET /api/ad-connections/insights?periodStart=...&periodEnd=...`. The
   **Impressions, Clicks, Spend, Conversions** fields fill in and are
   visually tagged as synced (vs. hand-typed).

   ```powershell
   docker exec ceview-postgres psql -U ceview -d ceview -c "SELECT provider, period_start, period_end, impressions, clicks, spend, conversions FROM tbl_ad_insight;"
   ```
   Expect **one row** per connected provider for that period. Also confirm
   the connection's sync timestamp advanced:
   ```powershell
   docker exec ceview-postgres psql -U ceview -d ceview -c "SELECT provider, last_synced_at FROM tbl_ad_platform_connection;"
   ```
   `last_synced_at` should be a few seconds old, not `NULL`.

(Native/H2 Path B: swap the `docker exec ceview-postgres psql -U ceview -d
ceview` prefix for the H2 console at http://localhost:8080/h2, JDBC URL
`jdbc:h2:mem:ceview`, and run the same `SELECT`s there — see `RUNNING.md`
§3.)

---

## 8. Getting non-zero data

**A brand-new ad account with no campaigns returns all zeros.** This is
correct, not a bug — there's nothing for the platform to report yet. Don't
spend time debugging a "sync succeeded but everything is 0" result before
checking whether the ad account has actually spent anything.

Two ways to get non-zero numbers to test against:

1. **Run a small real campaign.** A few hundred pesos of real spend on
   either platform is enough to generate non-zero impressions and clicks
   within a day, and usually at least one conversion if the campaign has a
   conversion objective configured.
2. **Use the platform's sandbox.** Meta and TikTok both offer sandbox/test
   ad accounts that return synthetic (fabricated) traffic without spending
   real money. This is faster and free, but the numbers are **not real** —
   never present sandbox figures to a business owner as if they reflect
   actual ad performance. Use sandbox only to verify the sync mechanism
   works, then switch to a real account before trusting any number you see.

---

## 9. What the numbers mean

Three behaviors are easy to get wrong if you haven't read the client code:

1. **Meta's conversions are filtered, not summed wholesale.** Meta returns
   one `actions` array covering every action type — page engagement, link
   clicks, pixel events, purchases, all mixed together. Summing all of them
   would massively overcount "conversions." Only entries whose
   `action_type` starts with `offsite_conversion.` or `onsite_conversion.`,
   or is exactly `lead`, `purchase`, or `complete_registration`, are counted.
   Everything else in that array is ignored for this figure.

2. **Figures are never converted between currencies.** Each ad account's
   `spend` is stored in whatever currency the platform reports for that
   account — CeView does not fetch or apply an exchange rate. If you connect
   a PHP-denominated Meta account and a USD-denominated TikTok account, the
   sync endpoint deliberately withholds the combined total (impressions,
   clicks, spend, conversions all come back `null`) and returns a warning
   instead — each source's figures are still reported individually. Never
   read a missing total as "sync failed"; check the `warnings` array.

3. **A garbage `spend` value is an error, not a zero.** If either platform
   returns a `spend` field that's present but not parseable as a number,
   CeView throws rather than silently recording `0`. This is deliberate:
   spend drives ROAS, and a parsed `0` is indistinguishable from "genuinely
   no spend" once it's in the database — so if you see a sync failure whose
   message mentions an unparseable spend value, that means the platform
   sent something unexpected in that field, not that spend was actually
   zero. An **absent or blank** `spend` field is still treated as a
   legitimate `0` — only a present-but-malformed value throws.

---

## 10. Direct API testing with curl

Following `RUNNING.md`'s "Direct API testing without the frontend" pattern —
get a JWT first, then exercise the ad-connections endpoints in order.

```powershell
# Login to get a token
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login -ContentType 'application/json' -Body '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}'
$token = $login.token

# 1. List every provider's connection state (one row per provider, always)
Invoke-RestMethod -Uri http://localhost:8080/api/ad-connections -Headers @{ Authorization = "Bearer $token" }

# 2. Start the OAuth flow for Meta (or "tiktok") — returns a URL to open in a browser
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/ad-connections/meta/authorize -Headers @{ Authorization = "Bearer $token" }

# --- open the returned authorizeUrl in a browser and complete consent (§7) ---
# The callback itself (GET /{provider}/callback) is browser-only — it's a 302
# redirect target for the platform, not something to curl directly.

# 3. List ad accounts the stored grant can see
Invoke-RestMethod -Uri http://localhost:8080/api/ad-connections/meta/accounts -Headers @{ Authorization = "Bearer $token" }

# 4. Choose one (id from step 3's response)
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/ad-connections/meta/account -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -Body '{"externalAccountId":"act_1234567890"}'

# 5. Pull insights for a period across every ACTIVE connection (max 366-day range)
Invoke-RestMethod -Uri "http://localhost:8080/api/ad-connections/insights?periodStart=2026-08-01&periodEnd=2026-08-31" -Headers @{ Authorization = "Bearer $token" }
```

`GET /api/ad-connections/insights` rejects any request where
`periodEnd - periodStart` exceeds 366 days with `400 Bad Request` — request
it a year or less at a time.

To disconnect and start over: `DELETE /api/ad-connections/{provider}`.

The seven endpoints walked through above (§7 for the manual flow, this section
for `curl`/PowerShell) are the full ad-connection API surface — there is no
separate reference document for them. `backend/CONTRACT.md` does not yet cover
this feature; if it's updated later to include the rest of the API, add
ad-connections to it too.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Meta shows "URL blocked" / TikTok rejects the redirect with a generic invalid-redirect error | The registered redirect URI doesn't byte-for-byte match what the backend sent — almost always because the tunnel URL changed since you last registered it (§4). Copy the tunnel's current URL and re-register both callback URLs in §5. |
| `invalid_state` in the `adconnect_error` query param on return | Either the 10-minute state TTL expired before you finished the consent screen, or the authorize link was opened twice (state tokens are single-use). Go back to Settings → Platforms and click Connect again from scratch. |
| `503 AD_PROVIDER_NOT_CONFIGURED` from any `/api/ad-connections/{provider}/*` route | That provider's app id or secret is unset (or blank) in the backend's environment — see §6. Check with `echo $env:META_APP_ID` (or `TIKTOK_APP_ID`) in the same shell the backend was started from. |
| The account picker (step 3 in §7) comes back empty | The OAuth grant succeeded but the connected user/business has no ad accounts visible to it. Create one in Meta Ads Manager or TikTok Ads Manager, then retry `GET /{provider}/accounts` (no need to redo the OAuth consent). |
| "Connected ad accounts report in different currency codes" warning, no combined total | Expected behavior, not a bug — see §9 point 2. Use each source's individual figures (in the `sources` array) instead of the withheld combined total, or disconnect one provider so only one currency is in play. |
| `401` from Meta partway through a sync that used to work | Meta's long-lived token expires after roughly 60 days. Disconnect (`DELETE /api/ad-connections/meta`) and reconnect through §7 to mint a fresh one. |
| TikTok's sync call returns HTTP 200 but nothing gets synced / a warning appears anyway | TikTok reports API errors **inside a 200 response body**, not via HTTP status — check the response's `code` field (non-zero means an error, with `message` explaining it), not the HTTP status code, when debugging a TikTok call that "succeeded" but produced nothing. |

---

## 12. Live-walkthrough note

This guide was written and desk-checked against the actual source
(`AdConnectionController.java`, `MetaAdsClient.java`, `TikTokAdsClient.java`,
`AdProviderProperties.java`, `AdConnectionsConfig.java`,
`AdInsightSyncService.java`, `V27__module4_ad_platform_connections.sql`,
`application.yml`) but **has not been run end-to-end** against real Meta and
TikTok developer accounts — doing so requires accounts, app review timelines,
and a live tunnel this environment doesn't have. **Before trusting this
guide completely, a developer with real Meta and TikTok developer accounts
should run through §2–§10 once** and correct anything that doesn't match
what they actually see.
