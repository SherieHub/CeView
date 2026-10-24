# Ad Platform Connections — Setup & Testing Guide

This guide walks through connecting a Meta (Facebook/Instagram) or TikTok ad
account to CeView and pulling real performance figures into Module 4
(Campaign Analytics & Reporting).

**What this enables:** once connected, CeView can pull **impressions,
clicks, spend, and conversions** for a chosen ad account and prefill those
four fields on the Performance screen's ingestion form. The sync can
optionally be **scoped to a single campaign** rather than the whole account
(§7 step 5) — worth doing if the operator runs several unrelated campaigns on
one account, since the account total otherwise blends them into one PES score.

**What this does NOT do:**
- It does **not** publish posts to Facebook, Instagram, or TikTok. That is a
  separate publishing feature (see `docs/SOCIAL_PUBLISHING_SETUP.md`). Meta now shares one upgraded login across publishing and ads; TikTok creator and ads apps remain separate.
- It does **not** fetch organic post engagement (likes, comments, shares,
  reach on unpaid posts). It only reads **paid ad account** metrics.

> Publishing and PAUSED ad creation setup: see `docs/SOCIAL_PUBLISHING_SETUP.md`.

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
  see §8 for what an empty account returns).

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
2. In the app dashboard, open **Use cases** → **Add use cases**. Meta apps
   created since about 2024 no longer use "Add Product"; a permission is only
   valid for login once a use case that includes it has been added. Add all
   three of these (the app needs them together because CeView uses **one Meta
   login for both ads reporting and publishing**):
   - **Create & manage ads with Marketing API** — `ads_read`, `ads_management`,
     `business_management`.
   - **Manage everything on your Page** — `pages_show_list`,
     `pages_read_engagement`, `pages_manage_posts`, `read_insights`.
   - **Manage messaging & content on Instagram** (the **Facebook Login**
     variant, not "Instagram Login") — `instagram_basic`,
     `instagram_content_publish`, `instagram_manage_insights`.

   For each use case, click **Customize** and confirm every permission above
   is added under **Permissions and features**; adding the use case alone may
   not enable each scope. Console labels change — follow the intent if a name
   differs. The Threads and WhatsApp use cases are not needed.
3. **Invalid Scopes error?** If the Meta consent screen says
   `Invalid Scopes: pages_manage_posts, read_insights, instagram_basic, …`,
   the scope names in `MetaAdsClient.java` are fine — the use cases in step 2
   are missing from the app. See §11.
4. **Use Development mode while testing.** Under **Publish** in the sidebar,
   keep the app unpublished. Then **App roles → Roles**: add every account that
   will connect as a **Tester** or **Developer**, and have each one accept the
   invite (developers.facebook.com/requests). In Development mode, role-holders
   can grant these permissions without App Review. A **Published** (Live) app
   needs Advanced Access via App Review for the permissions above, and people
   without a role cannot grant them.
5. **App ID** and **App Secret** are shown on the app dashboard's
   **Settings → Basic** page. You'll put both into the backend's environment
   in §6.

The original integration used v21.0; social publishing now defaults to **Graph API v25.0**
(`https://graph.facebook.com/v25.0`). Meta versions its Graph API roughly
quarterly and eventually retires old versions — if you're reading this
months after it was written, check the [Meta API versioning
changelog](https://developers.facebook.com/docs/graph-api/changelog) for
which version is current. You do not need to touch code to move to a
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
   advertiser accounts and synthetic data (see §8). Moving to **Production**
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

**Recommended: an ngrok static domain.** It is free, permanent, and means you
register the redirect URIs and set `OAUTH_REDIRECT_BASE_URL` **once**, instead
of after every restart. (A cloudflared *named* tunnel also gives a stable
hostname, but it needs a domain whose DNS is on Cloudflare — the tunnel itself
is free, the domain is the cost. `ceview.online`'s DNS is on Route 53, so don't
move it just for local dev.)

One-time setup:

1. Create an account at ngrok.com (free plan).
2. Install and update the agent: `winget install ngrok.ngrok`, then
   `ngrok update`. **Free accounts require agent 3.20.0 or newer** — an older
   agent fails with `ERR_NGROK_121` ("agent version … is too old"). Check with
   `ngrok version`.
3. Add your authtoken (dashboard → Getting Started → Your Authtoken):
   `ngrok config add-authtoken <token>`
4. In the dashboard, go to **Domains** and create your free static domain. Copy
   it exactly as shown — it looks like `<name>.ngrok-free.dev` (some accounts
   get `.ngrok-free.app`). Don't append a second suffix.

Each session, in its own terminal (not Docker):

```powershell
ngrok http --url=https://<your-domain>.ngrok-free.dev 8080
```

On agents older than 3.20 the flag is `--domain=<your-domain>.ngrok-free.dev`
(hostname only, no `https://`); on current agents both `--url` and `--domain`
work. Leave it running for the
session. Your redirect base is then `https://<your-domain>.ngrok-free.dev`
permanently — register it in §5 and set it in §6 once.

**Alternative: a quick cloudflared tunnel** (free, no account, but the URL is
random):

```powershell
cloudflared tunnel --url http://localhost:8080
```

It prints an HTTPS URL such as `https://a1b2-c3d4.trycloudflare.com`.

**⚠️ A quick tunnel's URL changes every time you restart it.** New day, laptop
slept, terminal closed, tunnel dropped — any of those gives you a **new** URL,
and you must:

1. Re-register it as the redirect URI with Meta/TikTok (§5)
2. Update `OAUTH_REDIRECT_BASE_URL` in `backend/.env` (§6)
3. `docker compose up -d spring-boot` so the backend picks up the new value
   (env vars are only read at container start, not live)

If OAuth suddenly stops working after previously working on a quick tunnel,
this mismatch is the first thing to check: confirm what URL the tunnel is
*currently* printing matches both what's registered with the platform and
what `docker exec ceview-spring env | grep OAUTH_REDIRECT_BASE_URL` shows. A
static ngrok domain avoids the whole problem.

**Meta only — `localhost` without any tunnel (unverified).** The OAuth
redirect is performed by your browser, not by Meta's servers, and Meta has
allowed `http://localhost` redirect URIs for apps in Development mode. If the
dashboard accepts `http://localhost:8080/api/ad-connections/meta/callback`,
you can set `OAUTH_REDIRECT_BASE_URL=http://localhost:8080` and skip the tunnel
for connecting a Meta account. This has not been confirmed against this app and
stops working once the app is Live. It does **not** cover TikTok, which
requires HTTPS redirect URIs, and it does not make uploaded media reachable by
Meta/Instagram/TikTok for publishing (see `MEDIA_PUBLIC_BASE_URL` in §6).

---

## 5. Registering the redirect URI

In each platform's app settings, register the **exact** callback URLs,
substituting your tunnel URL from §4 for `<tunnel>`:

```text
https://<tunnel>/api/ad-connections/meta/callback
https://<tunnel>/api/ad-connections/tiktok/callback
https://<tunnel>/api/social-connections/tiktok/callback
```

- Meta: App Dashboard → your app → **Facebook Login for Business** or
  **Marketing API** settings → **Valid OAuth Redirect URIs**. One Meta URI
  serves both ads and publishing.
- TikTok ads app: Developer Portal → your app → **Basic Information** →
  **Redirect URI** (sometimes called Callback URL) → the `ad-connections`
  URI.
- TikTok publishing app (TikTok for Developers, separate from the ads app —
  see `docs/SOCIAL_PUBLISHING_SETUP.md` §C): the `social-connections` URI.

Both platforms accept several redirect URIs, so keep the production
`https://api.ceview.online/...` entries alongside the tunnel ones — they don't
conflict.

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
| `OAUTH_REDIRECT_BASE_URL` | Required to use either provider | `spring-boot` | Bound to `ceview.adplatform.redirect-base-url`. This is your tunnel URL from §4 (no trailing slash, **and no trailing space** — a trailing slash is stripped, but trailing whitespace is not, and Meta compares the URI byte-for-byte) — it's prepended to `/api/ad-connections/{provider}/callback` to build the exact redirect URI both the authorize call and each platform's registered URI must match. Unset, the built redirect URI is malformed and the platform rejects the authorize request. |
| `MEDIA_PUBLIC_BASE_URL` | Needed for publishing | `spring-boot` | Origin used to build the public URL of every uploaded image/video. Meta ad delivery downloads ad images from it, and Instagram/TikTok fetch media from it. With `MEDIA_STORAGE=local` the files live on your machine, so this **must be your tunnel URL** (e.g. `https://<your-domain>.ngrok-free.dev`, no trailing slash) — leaving it on `https://ceview.online/` makes every upload point at a production URL where the file doesn't exist (broken image previews, failed delivery). Re-upload after changing it; existing uploads keep the URL stored at upload time. |
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
and the backend + frontend running (`RUNNING.md` §3–§4). Social connections
(Facebook Page / Instagram) need the Postgres path (Path A); the native H2
path doesn't create their tables:

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

5. **Optionally pin the sync to one campaign.** By default the sync reports the
   **whole ad account**. If the operator runs several unrelated campaigns on one
   account, that total mixes them into a single PES score. Choosing a campaign
   (`GET /{provider}/campaigns`, then `POST /{provider}/campaign`) scopes every
   later sync to it; posting a null or blank `externalCampaignId` clears the
   pin and returns to whole-account reporting.

   ```powershell
   docker exec ceview-postgres psql -U ceview -d ceview -c "SELECT provider, external_campaign_id, external_campaign_name FROM tbl_ad_platform_connection;"
   ```
   `NULL` in both columns is the unchanged default, not a failure.

6. **Go to Performance** and open the ingestion form for a campaign period.

7. **Click "Sync from ad accounts."** This calls
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

# 5. (optional) List campaigns on the selected ad account
Invoke-RestMethod -Uri http://localhost:8080/api/ad-connections/meta/campaigns -Headers @{ Authorization = "Bearer $token" }

# 6. (optional) Pin the sync to one campaign — or clear it with a null id
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/ad-connections/meta/campaign -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -Body '{"externalCampaignId":"120210"}'

# 7. Pull insights for a period across every ACTIVE connection (max 366-day range)
Invoke-RestMethod -Uri "http://localhost:8080/api/ad-connections/insights?periodStart=2026-08-01&periodEnd=2026-08-31" -Headers @{ Authorization = "Bearer $token" }
```

Both campaign calls re-fetch and match the id server-side, so an arbitrary
posted `externalCampaignId` is rejected with `400` rather than stored.

`GET /api/ad-connections/insights` rejects any request where
`periodEnd - periodStart` exceeds 366 days with `400 Bad Request` — request
it a year or less at a time.

To disconnect and start over: `DELETE /api/ad-connections/{provider}`.

The nine endpoints walked through above (§7 for the manual flow, this section
for `curl`/PowerShell) are the full ad-connection API surface: `GET /`,
`POST /{provider}/authorize`, `GET /{provider}/callback`,
`GET /{provider}/accounts`, `POST /{provider}/account`,
`GET /{provider}/campaigns`, `POST /{provider}/campaign`, `GET /insights`,
`DELETE /{provider}`. There is no separate reference document for them.
`backend/CONTRACT.md` does not yet cover this feature; if it's updated later to
include the rest of the API, add ad-connections to it too.

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Meta shows "URL blocked" / TikTok rejects the redirect with a generic invalid-redirect error | The registered redirect URI doesn't byte-for-byte match what the backend sent — almost always because the tunnel URL changed since you last registered it (§4), or `OAUTH_REDIRECT_BASE_URL` has a trailing space or slash. Copy the tunnel's current URL, fix `.env`, and re-register the callback URLs in §5. |
| Meta consent screen: `Invalid Scopes: pages_manage_posts, read_insights, instagram_basic, instagram_content_publish, instagram_manage_insights` | The Meta app is missing the Page and Instagram use cases (or their permissions aren't added under **Customize**). Add them per §2 step 2, and use Development mode with your account as a Tester (§2 step 4). The scope names in code are correct. |
| `ngrok` fails with `unknown flag: --url`, or `ERR_NGROK_121` / "agent version is too old" | The installed agent is older than 3.20.0. Run `ngrok update` (or `winget upgrade ngrok.ngrok`, or reinstall from ngrok.com/download). Until then use `--domain=` instead of `--url=`. Also check the domain isn't doubled (`….ngrok-free.dev.ngrok-free.app`). |
| A published post shows **Failed** with "The platform rejected delivery. Check the media and account permissions." | That text is generic: `DeliveryHttp.java` maps every Meta error that isn't an auth error (`190`, `102`) or rate limit (`4`, `17`, `32`) to it, and the real Meta error is not logged. First rule out the media URL — a broken image preview in the post detail means `MEDIA_PUBLIC_BASE_URL` is wrong (§6). Then retry with a **new** post after reconnecting Meta with the full permission set; a Failed post is not retried. Check that the chosen ad account is one the connected user administers and is in good standing. |
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
`AdInsightSyncService.java`, `V41__module4_ad_platform_connections.sql`,
`V42__module4_ad_campaign_selection.sql`, `application.yml`) but **has not been
run end-to-end** against real Meta and
TikTok developer accounts — doing so requires accounts, app review timelines,
and a live tunnel this environment doesn't have. **Before trusting this
guide completely, a developer with real Meta and TikTok developer accounts
should run through §2–§10 once** and correct anything that doesn't match
what they actually see.
