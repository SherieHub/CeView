# Running CeView Locally

Complete developer setup guide — how to bring up the full stack (Postgres +
Spring Boot + FastAPI ×2 + React frontend) and verify every piece actually
works, including the login/auth flow and seeded demo data.

There are two supported paths to run the backend:

- **Path A: Docker** — closest to production (Postgres + pgvector). Requires
  Docker Desktop with CPU virtualization enabled. **Recommended.**
- **Path B: Native (H2)** — runs without Docker, using an embedded H2 database
  instead of Postgres. Use this if Docker won't start on your machine.

The frontend and e2e test suite are identical in both paths.

---

## 1. Prerequisites

| Tool | Path A (Docker) | Path B (native) | Install |
|---|---|---|---|
| Docker Desktop ≥ 4.30 | ✅ required | — | `winget install Docker.DockerDesktop` |
| JDK 21 (Temurin) | — | ✅ required | `winget install EclipseAdoptium.Temurin.21.JDK` |
| Python 3.12 | — | ✅ required | `winget install Python.Python.3.12` |
| Node.js ≥ 20 | ✅ required | ✅ required | already installed if `node --version` works |
| A GROQ API key | ✅ required to run `fastapi-transformer` | ✅ required to run `fastapi-transformer` | https://console.groq.com/keys |
| A HuggingFace token (read-only) | optional | optional | https://huggingface.co/settings/tokens |

The Spring Boot Maven Wrapper (`mvnw`/`mvnw.cmd`) is included — you do **not**
need to install Maven.

**Disk/network note:** on first run, `fastapi-sbert` downloads the ~1.1GB
SBERT/E5 encoder from HuggingFace. This can take several minutes on a cold
start; Docker caches it afterward in a named volume so it only happens once.

---

## 2. First-time setup checklist

Run through this once per machine (or once per fresh clone):

1. Install the prerequisites above for whichever path you're using.
2. Get a **GROQ API key** (required — `fastapi-transformer` will not start
   without one) and, optionally, a **read-only HuggingFace token**.
3. Copy `backend/.env.example` → `backend/.env` and fill in the two keys
   above (see [§5 Environment variables](#5-environment-variables) for the
   full list). **`backend/.env` is gitignored — never commit it.**
4. Pick Path A or Path B below and bring the backend up.
5. Install and run the frontend (§4).
6. Log in with a seeded demo account (§6) and confirm data loads.
7. Optionally run the automated Playwright e2e suite (§7).

---

## 3. Backend

### Path A: Docker (recommended)

One command brings up Postgres + Spring Boot + both FastAPI services
together.

```powershell
cd backend
copy .env.example .env       # first time only — then fill in GROQ_API_KEY (required)
docker-compose up --build
```

Spring Boot's `Dockerfile` builds the jar itself in a Maven stage (multi-stage
build) — no separate `mvnw package` step needed before `docker-compose up`.
The first build is slower since it compiles inside Docker and downloads the
SBERT encoder; later builds reuse Docker's layer cache unless `pom.xml` or
`src/` changed.

When you see `Started CeViewApplication` and the FastAPI worker lines, the
backend is ready.

#### Resetting a stale Postgres volume

This project's Flyway migrations are sometimes **edited in place** (seed data
lives in versioned migrations rather than a separate reset script), and
`docker-compose.yml` sets `SPRING_FLYWAY_VALIDATE_ON_MIGRATE: "false"`, so a
changed migration slips through silently against a database that already
applied the old version. Any time you pull or switch branches and
`backend/spring-boot/src/main/resources/db/migration/` changed, reset rather
than debugging the resulting errors.

**Symptoms that mean "stale volume", not a code bug:**
- `ceview-spring exited with code 1` right after a Postgres
  `insert or update ... violates foreign key constraint`.
- `column "..." does not exist` during a migration.
- `password authentication failed for user "ceview"` from `ceview-postgres`
  (usually downstream of the crash loop above).

```powershell
cd backend
docker-compose down -v       # full reset: wipes ceview-pgdata AND ceview-hf-cache
docker-compose up --build
```

That also wipes the cached SBERT/E5 model, costing a ~1.1GB re-download. To
keep the model cache, drop only the database volume instead:

```powershell
docker-compose down
docker volume rm backend_ceview-pgdata
docker-compose up --build
```

(The volume name is prefixed with the Compose project name — `backend_` here,
since the compose file lives in `backend/`. Run `docker volume ls` if unsure.)

**Health checks:**
```powershell
curl http://localhost:8080/actuator/health    # spring-boot         {"status":"UP"}
curl http://localhost:8000/healthz            # fastapi-sbert       {"status":"ok"}
curl http://localhost:8001/healthz            # fastapi-transformer {"status":"ok"}
```

Stop with `Ctrl+C` then `docker-compose down` (add `-v` to also wipe the
database).

> If Docker Desktop shows **"Virtualization support not detected"**: reboot
> into BIOS/UEFI, enable Intel VT-x / AMD-V, and turn on Windows features
> *Hyper-V* and *Virtual Machine Platform*. If you can't, use Path B instead.

### Path B: Native (no Docker)

Three terminals. Keep all three open while testing.

#### 1. FastAPI (sbert) — terminal 1

```powershell
cd backend\fastapi-sbert
# First time only — install Python deps
py -3.12 -m pip install -r requirements.txt
# Run
py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

(`py -3.12` is the Windows Python launcher. If you don't have it, substitute
the full path to your 3.12 interpreter.)

You should see `Uvicorn running on http://127.0.0.1:8000`. Swagger docs at
http://localhost:8000/docs.

#### 2. FastAPI (transformer) — terminal 2

Requires `GROQ_API_KEY` to be set (see §5) — this service raises and exits
immediately at startup without it.

```powershell
cd backend\fastapi-transformer
$env:GROQ_API_KEY = "your-groq-key-here"
# First time only — install Python deps
py -3.12 -m pip install -r requirements.txt
# Run
py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

You should see `Uvicorn running on http://127.0.0.1:8001`. Swagger docs at
http://localhost:8001/docs.

#### 3. Spring Boot — terminal 3

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd backend\spring-boot
# First time only — build the fat jar
.\mvnw.cmd -B package -DskipTests
# Run with the H2 profile (no DB required)
& "$env:JAVA_HOME\bin\java.exe" -jar target\ceview-backend-0.1.0.jar `
    --spring.profiles.active=h2 `
    --ceview.fastapi.sbert.base-url=http://127.0.0.1:8000 `
    --ceview.fastapi.transformer.base-url=http://127.0.0.1:8001 `
    --ceview.cors.allowed-origins=http://localhost:3001
```

Wait for `Started CeViewApplication in N seconds`. Health at
http://localhost:8080/actuator/health.

H2 seeds the same 9 demo operators as Postgres (see §6) fresh on every
restart — H2 is in-memory, so there's nothing to "wipe" between runs; a
restart is always a clean slate.

H2 console: http://localhost:8080/h2 — JDBC URL `jdbc:h2:mem:ceview`, user
`sa`, no password.

---

## 4. Frontend

```powershell
cd frontend
npm install       # first time only
npm run dev
```

Vite reports `http://localhost:3001/`. Open that in your browser.

By default it talks to the backend at `http://localhost:8080`
(`VITE_API_BASE_URL` env var overrides this if you need to point it
elsewhere).

---

## 5. Environment variables

All backend secrets/config live in `backend/.env` (Path A / Docker Compose)
or as shell env vars (Path B / native). **`backend/.env` is gitignored —
never commit real keys.** Start from `backend/.env.example`.

| Variable | Required? | Used by | Notes |
|---|---|---|---|
| `GROQ_API_KEY` | **Required** for `fastapi-transformer` | `fastapi-transformer`, `fastapi-sbert` | `fastapi-transformer` raises `RuntimeError` and refuses to start without it — no stub mode. `fastapi-sbert` starts without it, but every AI call (captions, caption translation, prescriptive reports) then answers 503 naming the missing key — there is no canned fallback. Get one at https://console.groq.com/keys. |
| `GROQ_MODEL` | Optional | `fastapi-sbert` | Groq text model for caption generation. Default `openai/gpt-oss-120b`. Groq retires models periodically — set this to one your key can access if generation starts returning `model_not_found`. |
| `GROQ_TRANSLATION_MODEL` | Optional | `fastapi-sbert` | Model for the Content Studio **Show English** translation and the *Apply to Korean/Japanese* rewrite. Defaults to `GROQ_MODEL`. Needs **no extra key** — it uses `GROQ_API_KEY`. Set it only to run translation on a different (e.g. cheaper or stronger) Groq model. |
| `HF_TOKEN` | Optional | `fastapi-sbert` | Used to download the SBERT/E5 encoder from HuggingFace. **Use a read-only token** — nothing in this codebase writes to HuggingFace. Get one at https://huggingface.co/settings/tokens. |
| `JWT_SECRET` | **Required** except Path B (H2) | `spring-boot` | Signs/verifies login JWTs; a random 32+ char string (e.g. `openssl rand -hex 32`). Only the `h2` profile has a built-in dev value. Everywhere else — including Path A (Docker Compose) — Spring Boot refuses to start if it is unset, blank, or that dev value. |
| `CEVIEW_ATTRIBUTION_IP_HASH_SALT` | **Required** except Path B (H2) | `spring-boot` | Salt for hashing traveller IPs from tracked links; any random string (e.g. `openssl rand -hex 16`). Same rule as `JWT_SECRET`: only the `h2` profile has a dev value. |
| `CORS_ALLOWED_ORIGINS` | Has a default | `spring-boot` | Comma-separated list of origins allowed to call the API. Default covers `localhost:3001`/`5173`. Add your frontend's actual origin if it differs. |
| `CEVIEW_ATTRIBUTION_BASE_URL` | Has a default | `spring-boot` | Public origin the `/r/{slug}` redirect is served from; bound to `ceview.attribution.base-url`, defaults to `http://localhost:8080`. This string ends up inside live paid ads, so changing it after ads are running breaks every link already in market. |
| `CEVIEW_ATTRIBUTION_IP_HASH_SALT` | Has a dev default | `spring-boot` | Salt for hashing traveller IPs before they are stored for click debounce. Rotating it resets the debounce because existing `ip_hash` values stop matching new ones. |
| `FIREBASE_CREDENTIALS_JSON` | Optional | `spring-boot` | Full Firebase service-account JSON (as a single-line string), used to verify Google Sign-In ID tokens. Unset by default — `POST /api/auth/google` returns 503 until it's set. See §6 below for how to obtain it. |
| `EMAIL_PROVIDER` | Has a default (`log`) | `spring-boot` | How verification and password-reset codes are delivered. `log` prints the code to the spring-boot log and sends nothing (see §5b); `resend` sends through Resend's API and needs the next two variables. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Only with `EMAIL_PROVIDER=resend` | `spring-boot` | Resend API key, and the sender, e.g. `CeView <no-reply@yourdomain.com>`, on a domain verified in Resend. The backend refuses to start with `resend` and either missing. Setup: [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md#email-resend). |
| `CEVIEW_TEST_SUPPORT_ENABLED` | Optional (e2e only) | `spring-boot` | Default `false`. `true` exposes `/api/test-support/email-codes/latest` so Playwright can read emailed codes. The backend refuses to start with this and `EMAIL_PROVIDER=resend`. Leave it off outside e2e. |
| `CEVIEW_AUTH_RATE_LIMIT_MAX_REQUESTS` | Has a default (`10`) | `spring-boot` | Per-IP cap, per 15 minutes, on the auth endpoints that send email. Also overrides the separate phone-verification cap on register / complete-profile (default `20`, see §6). Raise it for e2e runs, which register many accounts from one address. |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | Path A only, has defaults | `spring-boot` | Already wired in `docker-compose.yml` to the `postgres` service (`ceview`/`ceview`/`ceview`). Only needed manually for Path B + real Postgres (uncommon — Path B normally uses H2). |
| `VITE_API_BASE_URL` | Optional | frontend | Overrides the default `http://localhost:8080` backend URL. |
| `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Optional | frontend | Firebase web app config, used by the "Continue with Google" button. Without these, the button still renders but the Firebase popup will fail. See §6 below. |

> **Connecting Meta or TikTok ad accounts?** Those variables (`META_APP_ID`,
> `TIKTOK_APP_ID`, `TOKEN_ENCRYPTION_KEY`, and the tunnel URL) are documented
> separately in [`AD_PLATFORM_SETUP.md`](AD_PLATFORM_SETUP.md), along with how to
> register the OAuth redirect URI and test the connection end to end. None of
> them are required for normal local development — the backend starts without
> them and the ad-connection endpoints report 503.

---

## 5b. Email verification codes in local development

Every new account (and, once, every existing one — the seeded demo operators included) must enter a
6-digit code emailed to it before it can use the app. With the default `EMAIL_PROVIDER=log` nothing is
sent: the code is printed in the backend log.

```bash
# Path A (Docker Compose)
cd backend && docker compose logs --tail 20 spring-boot | grep -A10 "email:log"
# Path B (native): it is in the terminal running `mvnw spring-boot:run`
```

The line looks like `[email:log] to=ramon.delacruz@ceview.local subject="Your CeView verification code"`
followed by `Your code: 123456`. Sign in as a seeded operator, and the app lands on **Verify your email**;
enter that code once. Codes last 10 minutes; "Resend code" waits 60 seconds.

To receive real emails locally instead, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM`
(see [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md#email-resend)). Resend's free tier allows 100 emails a
day. Forgot-password uses the same codes: **Forgot password?** on the sign-in tab.

**Playwright e2e** needs to read those codes without a mailbox: set `CEVIEW_TEST_SUPPORT_ENABLED=true`
(and, to avoid the per-IP cap, `CEVIEW_AUTH_RATE_LIMIT_MAX_REQUESTS=1000`) in `backend/.env` before
`docker compose up`. `e2e/global-setup.ts` then verifies the seeded operator through the API. CI sets both
(`.github/workflows/e2e.yml`).

---

## 5a. Importing the uniqueness reference corpus

Module 1's uniqueness score ranks a business against a **cohort** of other
businesses. That cohort lives in `tbl_business_embedding`, and until it is
populated the score is meaningless — below three rows the scorer has nothing
to rank against, and on a machine with a handful of ad-hoc saved profiles the
score is whatever that machine happens to contain. Two developers would see
different numbers for the same business.

The corpus therefore ships in two halves:

| Half | Where | Applied by |
|---|---|---|
| Profile **text** (64 reference businesses across all 7 categories) | `V26__module1_reference_corpus.sql` | Flyway, automatically |
| The **vectors** for that text | `backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql` | you, once |

```bash
# 1. Flyway seeds the text (runs automatically when spring-boot starts)
docker compose up -d spring-boot

# 2. Import the vectors
docker exec -i ceview-postgres psql -U ceview -d ceview \
  < backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql
```

Verify:

```bash
docker exec ceview-postgres psql -U ceview -d ceview \
  -c "SELECT embedding_model_version, COUNT(*) FROM tbl_business_embedding GROUP BY 1;"
```

You want **one** row back. More than one means a mixed-scheme corpus, which is
the one failure mode worth understanding: vectors built under different schemes
are not comparable, and mixing them does not raise an error — it silently
produces distances driven by the scheme difference rather than by the
businesses, so the scores look fine and are wrong. Fix it by re-embedding
everything from the text already in the database:

```bash
docker exec -i ceview-fastapi python - --all < scripts/generate-reference-corpus.py
```

Re-run that (without `--all`, then regenerate the dump) after **any** change to
`ml_classifier._build_text`, the encoder, or `V26` — otherwise the committed
dump and the code drift apart silently.

> The reference rows are marked `is_reference = TRUE` and have no operator.
> They are corpus material, not tenants, and must never appear in an
> operator-scoped query. Only the uniqueness cohort reads them.

## 6. Authentication & seeded demo accounts

Every operator-facing screen requires Sign In. The traveller enquiry page,
`/enquiry?cv=<clickId>`, is public and has no login prompt.

Backend `/api/**` routes require a valid JWT except these deliberate public paths:

- `/api/auth/**` establishes identity through credentials or verified Google tokens.
- `/api/ad-connections/*/callback` resolves the operator from a validated OAuth
  state token; the provider's browser redirect does not carry a JWT header.
- `/api/public/attribution/**` resolves the business from a valid, unused click id
  whose link is still inside its attribution window. The context read returns only
  the business name; submission returns only a receipt acknowledgement.

`/r/**` sits outside `/api` and is public by design. Track 2 resolves the business
through a random link slug and captures the click. Operator enquiry reads at
`GET /api/attribution/enquiries` remain JWT-protected and tenant-scoped.

**9 realistic demo MSME operator accounts** are seeded automatically by
Flyway (`V2__module1_profile_multi_category.sql`) on both Postgres and H2,
each with a full data set across all 4 modules (business profile, market
forecasts, generated content, and campaign history with a deliberate mix of
improving/flat/declining performance trends).

**Full credential list:**
`backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md`

Quick reference — any of these logs in:

| Email | Password | Business |
|---|---|---|
| `ramon.delacruz@ceview.local` | `MoalboalDive2024!` | Moalboal FreeDive Cebu |
| `ferdie.bacus@ceview.local` | `OslobWhaleTour88!` | Oslob Whale Shark Adventures |
| `marites.abellana@ceview.local` | `KawasanTrek2024!` | Bantayan Blue Waters Island Hopping |

*(see `SEED_CREDENTIALS.md` for all 9 — these are demo/seed credentials only,
never reuse them anywhere real)*

You can also register a brand-new account via the "Create account" tab on the
login page (`POST /api/auth/register`) — it starts with an empty business
profile instead of pre-seeded data.

**What to verify once logged in:**
- The dashboard and performance screens show *that operator's own* seeded
  data.
- Logging out and back in as a *different* seeded operator shows *different*
  data — no cross-operator leakage.
- `curl http://localhost:8080/api/business-profile` **without** an
  `Authorization` header returns `401`. The operator enquiry list must also return
  `401` without a token; the public enquiry endpoints must not.

### Google Sign-In setup (optional)

The "Continue with Google" button on the login page works without any setup
— it's just disabled-looking until configured, and `POST /api/auth/google`
returns `503` if hit without a Firebase credential. To turn it on:

1. In the [Firebase Console](https://console.firebase.google.com/), create
   (or reuse) a project, add a **Web App**, and enable the **Google**
   provider under Authentication → Sign-in method.
2. Copy the web app config (`apiKey`, `authDomain`, `projectId`, `appId`)
   into the frontend's env as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (see `frontend/.env.example`).
3. Project Settings → Service Accounts → **Generate new private key** — this
   downloads a JSON file. Put its full contents (minified to one line) into
   `backend/.env` as `FIREBASE_CREDENTIALS_JSON`. **Never commit this file or
   its contents.**
4. Add `localhost` (both frontend dev ports) and your deployed domain as
   authorized origins in the Firebase Auth settings / Google Cloud OAuth
   consent screen.

A brand-new Google sign-in provisions an operator with no contact number yet
— they're routed to a one-time "complete your profile" screen
(`/complete-profile`) before reaching the rest of the app; a Google sign-in
whose verified email matches an existing password account links to that
account instead of creating a duplicate.

### Phone (SMS OTP) verification setup (optional)

Signup and `/complete-profile` verify the contact number with Firebase Phone
Auth, reusing the same Firebase project and env vars as Google Sign-In. With
Firebase configured, the backend only accepts a number that comes from a
verified Firebase ID token (`phoneIdToken`) and stamps `phone_verified_at`.
Without Firebase env vars, the form falls back to a plain unverified number
input, so local dev, CI and e2e keep working.

1. Firebase Console → Authentication → Sign-in method → enable **Phone**.
2. Phone Auth needs the **Blaze** plan (billing account). The first 10 real
   SMS per day are free; test numbers are unlimited and free. **Set a budget
   alert.**
3. Authentication → Settings → **SMS region policy**: allow only the
   Philippines (`+63`) to prevent SMS-pumping fraud.
4. Confirm `localhost` and your deployed frontend domain are in Authorized
   domains.
5. Authentication → Sign-in method → Phone → **Phone numbers for testing**:
   add a fictional number (e.g. `+63 917 555 0100` → code `123456`) for
   dev, demos and e2e. These never send a real SMS.

**Rate limits.** The browser allows 3 code sends per hour (plus a 30 s resend
cooldown); Firebase enforces its own quotas on top. The backend limits
`POST /api/auth/register` and `PATCH /api/auth/profile` per client IP (429 +
`Retry-After`), default 20 requests per 900 s, tunable with
`ceview.auth.rate-limit.max-requests` / `ceview.auth.rate-limit.window-seconds`
(`CEVIEW_AUTH_RATE_LIMIT_MAX_REQUESTS` overrides the count, same as for the email cap).
Register also counts against the email cap, so both limits apply to it.

**Verify later.** If SMS can't be sent (cap reached, quota, region or outage
errors), the form offers "Verify later". The number is saved with
`phone_verified_at = NULL`; the backend accepts this only when the client sends
`verifyLater: true` with a plausible number. The number can be verified later
under **Settings → Business profile → Contact number** ("Verify number"), which
runs the same OTP flow and saves via `PATCH /api/auth/profile`; the section
reads its status from `GET /api/auth/profile`.

---

## 7. End-to-end smoke test (manual)

With the backend (Path A or B) and frontend both running:

1. Open **http://localhost:3001** — you should land on the **Sign In** page,
   not the app.
2. Log in with a seeded account from §6.
3. Open DevTools (F12) → **Network** tab, filter by `localhost:8080`.
4. Click through the sidebar (`layout/nav.ts`: **Dashboard, Content Studio,
   Calendar, Performance**, and **Business Profile / Platforms / Workspace**
   under Settings) and watch requests fire — every request should now carry
   an `Authorization: Bearer <token>` header and return **200 OK**:

| Sidebar item | What you click | Backend call |
|---|---|---|
| **Dashboard** | (auto on load) | `GET /api/notifications` |
| **Dashboard** | click a demand alert to open its market ranking, then a ranked market to open the Market Radar drawer | `GET /api/forecasting/markets` |
| **Performance** | *Generate AI Report* | `POST /api/analytics/report` |
| **Settings → Business Profile** | *Save* | `PUT /api/business-profile` |
| **Settings → Platforms** | (auto on load) | `GET /api/ad-connections` |
| **Settings → Workspace** | (auto on load) | `GET /api/workspace/members` |

5. Click **Sign Out** in the sidebar — you should be returned to the Sign In
   page, and further API calls should stop (or 401 if attempted directly).
6. In a private browser window, open
   `http://localhost:3001/enquiry?cv=<valid-click-id>`. Use a click captured by
   Track 2, or seed a click for an active link in the local database while Track 2
   is unavailable. Confirm the business name and enquiry form appear without
   signing in. Submit a name and contact, then check the confirmation. Opening
   `/enquiry` without `cv` must show a plain expired-link message.
7. Sign in as the receiving operator and open **Dashboard > Traveller enquiries**.
   Check the compact cards, search by name or contact, and use Next after six
   enquiries to view the remaining records. A second operator must not see
   it. Submit the same click again and verify only one enquiry and one `LINK`
   redemption exist, with `bookings = 1` and `revenue = 0`.
8. Verify both security boundaries without an `Authorization` header:
   `GET /api/business-profile` and `GET /api/attribution/enquiries` return `401`;
   `POST /api/public/attribution/enquiries` with `{}` returns `400`, not `401`.
   Once Track 2 is available, `GET /r/<known-slug>` returns `302`, not `401`.
   Check the public page at 360px width and on a phone's in-app browser.

Enquiries refresh every minute while the dashboard is open, and delivery is
in-app only. Measure how long an operator takes to notice a new enquiry during
manual testing; email delivery remains outside this ticket.

One backend-wired flow isn't clickable from the table above:

- `POST /api/classification/analyze` and `POST /api/classification/uniqueness`
  aren't reachable from a signed-in seeded account — they only fire from the
  **onboarding wizard** (`components/module-1/onboarding/`), which a seeded
  demo operator can't reach: their profile already has a `uniquenessScore`, so
  the profile-completeness guard redirects a direct `/onboarding` visit
  straight back to `/dashboard`. To exercise them manually, **register a
  brand-new account** instead (§6) — analysis fires automatically on the
  wizard's Analysis step, and its *Compute uniqueness score* button fires the
  second call.

If the backend is down or a call fails, the screen says so — `apiClient`'s
`request()` throws an `ApiError` and nothing substitutes fabricated data for a
failed call (see
[`docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md`](docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md)).
Check the Network tab's response body for the real status and Spring's
`{ code, message }` before assuming it's a frontend bug.

The one place mock data appears is `VITE_USE_FIXTURES=true`, which is an
explicit opt-in for UI work without a backend, and which a production build
refuses to compile with.

### Direct API testing without the frontend

```powershell
# Login to get a token
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
    -ContentType 'application/json' `
    -Body '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}'
$token = $login.token

# Use it on a protected route
Invoke-RestMethod -Uri http://localhost:8080/api/business-profile `
    -Headers @{ Authorization = "Bearer $token" }

# Markets (also requires auth now)
Invoke-RestMethod -Uri http://localhost:8080/api/forecasting/markets `
    -Headers @{ Authorization = "Bearer $token" }
```

See `backend/CONTRACT.md` for the full endpoint table.

---

## 8. Automated e2e tests (Playwright)

The `e2e/` package runs the real login → dashboard flow against a live
frontend + backend.

```powershell
cd e2e
npm install          # first time only
npx playwright install   # first time only — downloads browser binaries
npx playwright test      # runs against http://localhost:3001 by default
```

Set `E2E_BASE_URL` to point at a different frontend URL if needed (see
`e2e/playwright.config.ts`).

This requires the full stack (Postgres/H2 + Spring Boot + both FastAPI
services + frontend) to already be running — it does not start anything
itself.

---

## 9. Stopping everything

**Path A (Docker):**
```powershell
cd backend
docker-compose down          # add -v to also wipe the Postgres volume
```

**Path B (native):** close each terminal, or:
```powershell
Get-Process java   | Stop-Process -Force
Get-Process python | Stop-Process -Force
Get-Process node   | Stop-Process -Force
```

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `docker-compose` says *Virtualization support not detected* | Enable Intel VT-x / AMD-V in BIOS, or use Path B instead. |
| `mvnw.cmd` fails with *"The system cannot find the file ...maven-wrapper.properties"* (Path B only) | The `.mvn/wrapper/` folder is missing from the checkout. Regenerate it with an installed Maven (`mvn -N wrapper:wrapper -Dmaven=3.9.9`), or install Maven directly (`winget install Apache.Maven`) and run `mvn -B package -DskipTests` instead of `mvnw.cmd`. |
| `ceview-fastapi-transformer` container exits immediately / `docker-compose ps` doesn't list it | It crashes on startup with `RuntimeError: GROQ_API_KEY environment variable is not set` — no stub mode. Set `GROQ_API_KEY` in `backend/.env` (see §5), then restart just that service: `docker-compose up -d --build fastapi-transformer`. |
| Spring Boot fails with a Flyway checksum/validation error, `column "..." does not exist` mid-migration, an FK-constraint violation while seeding, or Postgres reports `password authentication failed for user "ceview"` right after a migration crash | Stale Postgres volume from before a migration file was edited — see the full "How to tell you need this" callout and reset options in §3 (Path A). Short version: `docker-compose down -v && docker-compose up --build` (Path A), or just restart (Path B/H2 is always fresh, nothing to wipe). |
| Every screen shows blank/login-prompts you never expected | You're not logged in, or your token expired — the app auto-logs-out on any `401` from the backend. Log back in with a seeded account (§6). |
| `curl`/API calls return `401 {"error":"unauthorized",...}` | Expected if you didn't send `Authorization: Bearer <token>` — see §7's "Direct API testing" for how to get one. |
| `curl`/API calls return `403 {"error":"forbidden",...}` | You're authenticated but requested a resource (business profile / campaign / market data) that belongs to a **different** operator than the one in your token — this is the per-operator isolation working as intended, not a bug. |
| Browser shows `Failed to fetch` on `localhost:8080` | Spring Boot isn't running, or CORS isn't allowing your Vite port. Restart Spring with `--ceview.cors.allowed-origins=http://localhost:3001`, or check `CORS_ALLOWED_ORIGINS` in `backend/.env`. |
| Spring Boot fails with `Schema-validation` errors | You started with the Postgres profile but pointed at a fresh H2, or vice versa. Use `--spring.profiles.active=h2` for Path B. |
| `mvnw.cmd is not recognized` | You're not in `backend\spring-boot` — `cd` there first, or invoke it explicitly: `& .\mvnw.cmd package -DskipTests`. PowerShell doesn't resolve commands from the current directory without the `.\` prefix. |
| Frontend shows mock data even when the backend is up | You're running with `VITE_USE_FIXTURES=true`. Nothing else serves mock data — a failed call surfaces an error, it does not silently fall back. Unset the variable and restart Vite. |
| `/r/{slug}` returns 404 for a slug you can see in the database | The slug is case-sensitive and the alphabet excludes `0/O/1/I/l`; a hand-typed slug is the usual cause. Copy the stored `slug` exactly. |
| The redirect takes 30+ seconds on first hit | Expected on a spun-down instance. `render.yaml` runs the Spring service on `plan: free`, and this is blocking for real-world use, not a local-only annoyance: it will be cold exactly when a surge ad first runs. |
| Port 8080/8000/8001/3001 already in use | `Get-NetTCPConnection -LocalPort 8080` to find the PID, then `Stop-Process -Id <pid> -Force`. |
| `fastapi-sbert` takes forever to become healthy on first run | Expected — it's downloading the ~1.1GB SBERT/E5 encoder from HuggingFace (`start_period: 600s` in the healthcheck accounts for this). Subsequent runs reuse the cached model via the `ceview-hf-cache` Docker volume. |
| Playwright e2e tests fail with connection errors | The stack isn't running yet — Playwright doesn't start it for you. Bring up backend + frontend first (§3, §4), then run `npx playwright test`. |

---

## 11. Project layout reference

```
CeView/
├── frontend/                       # React 19 + Vite frontend
│   ├── components/auth/          # LoginPage (sign-in + create-account tabs), AuthGate
│   └── services/
│       ├── apiClient.ts          # all backend calls live here, attaches JWT
│       └── auth.tsx              # AuthProvider / useAuth() — session state
├── e2e/                          # Playwright end-to-end tests
│   └── tests/
│       ├── login.spec.ts         # login flow + shell/routing/overlay coverage
│       ├── journey.spec.ts       # full authenticated journey against the real stack
│       └── *.spec.ts             # one per screen (dashboard, calendar, content-studio, …)
├── backend/
│   ├── docker-compose.yml        # Path A
│   ├── .env.example
│   ├── .env                      # (gitignored) your real secrets — copy from .env.example
│   ├── CONTRACT.md               # full API endpoint reference
│   ├── spring-boot/              # orchestrator on :8080
│   │   ├── mvnw, mvnw.cmd
│   │   ├── pom.xml
│   │   └── src/main/resources/db/
│   │       ├── migration/        # Postgres Flyway migrations (incl. seed data)
│   │       │   └── SEED_CREDENTIALS.md   # demo operator login credentials
│   │       └── h2/               # H2 mirror migrations — the `h2` runtime profile
│                             #   (Path B) ONLY. Tests build their schema from
│                             #   the JPA entities; spring.flyway.enabled=false.
│   ├── fastapi-sbert/            # SBERT/Gemini NLP microservice on :8000
│   │   ├── requirements.txt
│   │   └── app/
│   └── fastapi-transformer/      # forecasting microservice on :8001
│       ├── requirements.txt
│       └── app/
└── RUNNING.md                    # this file
```
