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

**⚠️ If you have an existing Postgres volume from before a schema/seed-data
change** (e.g. pulling a branch that edits already-applied Flyway migrations,
or any time `docker-compose.yml`'s `SPRING_FLYWAY_VALIDATE_ON_MIGRATE: "false"`
setting lets a modified migration slip through silently): wipe it and start
fresh rather than debugging stale-schema errors.

**How to tell you need this** — any of these symptoms mean your database was
initialized by an *older* version of the migrations and needs a full reset,
not a code fix:
- `ceview-spring exited with code 1` right after a Postgres log line like
  `insert or update ... violates foreign key constraint` (a migration that
  changed — e.g. seed data — is inserting rows that reference something an
  *older, already-applied* version of an earlier migration never created,
  because Flyway skipped re-running it).
- `column "..." does not exist` during a migration.
- `password authentication failed for user "ceview"` from `ceview-postgres`
  (a corrupted/inconsistent state, usually downstream of the same stale-volume
  crash loop above — a fresh volume clears it too).
- You just pulled a branch/commit that you know edited a migration file
  that was already applied to your local database (check `git log` on
  `backend/spring-boot/src/main/resources/db/migration/` if unsure).

**Option 1 — full reset (safe default, always works):**
```powershell
cd backend
docker-compose down -v       # removes ALL named volumes: ceview-pgdata AND ceview-hf-cache
docker-compose up --build
```
This also wipes the cached SBERT/E5 model, so `fastapi-sbert` will re-download
it (~1.1GB, several minutes) on next start — expected, one-time cost.

**Option 2 — targeted reset (faster, keeps the HF model cache):**
```powershell
cd backend
docker-compose down
docker volume rm backend_ceview-pgdata
docker-compose up --build
```
Use this when you specifically need a clean database but don't want to
re-download the SBERT model every time. (Volume name is prefixed with the
Compose project name — `backend_` here, since the compose file lives in
`backend/`; run `docker volume ls` if you're unsure of the exact name on your
machine.)

**When you need this**: any time you pull changes to this project that touch
`backend/spring-boot/src/main/resources/db/migration/`, and you already have
a running/previously-run Postgres container from before that pull. This is
especially likely right after checking out a new branch or rebasing, since
this project's Flyway migrations are sometimes edited in place (seed data
lives in versioned migrations rather than a separate reset script) rather
than always appended as new files.

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
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m pip install -r requirements.txt
# Run
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`. Swagger docs at
http://localhost:8000/docs.

#### 2. FastAPI (transformer) — terminal 2

Requires `GROQ_API_KEY` to be set (see §5) — this service raises and exits
immediately at startup without it.

```powershell
cd backend\fastapi-transformer
$env:GROQ_API_KEY = "your-groq-key-here"
# First time only — install Python deps
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m pip install -r requirements.txt
# Run
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
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
| `GROQ_API_KEY` | **Required** for `fastapi-transformer` | `fastapi-transformer`, `fastapi-sbert` | `fastapi-transformer` raises `RuntimeError` and refuses to start without it — no stub mode. `fastapi-sbert` degrades gracefully instead: without it, AI calls (captions, prescriptive reports) return a deterministic fallback tagged `"source": "fallback"`. Get one at https://console.groq.com/keys. |
| `HF_TOKEN` | Optional | `fastapi-sbert` | Used to download the SBERT/E5 encoder from HuggingFace. **Use a read-only token** — nothing in this codebase writes to HuggingFace. Get one at https://huggingface.co/settings/tokens. |
| `JWT_SECRET` | Recommended (has a dev default) | `spring-boot` | Signs/verifies login JWTs. Defaults to `dev-secret-change-me-please-32chars-min` if unset — fine for local dev, must be a real 32+ char secret in any shared/deployed environment. |
| `CORS_ALLOWED_ORIGINS` | Has a default | `spring-boot` | Comma-separated list of origins allowed to call the API. Default covers `localhost:3001`/`5173`. Add your frontend's actual origin if it differs. |
| `FIREBASE_CREDENTIALS_JSON` | Optional | `spring-boot` | Full Firebase service-account JSON (as a single-line string), used to verify Google Sign-In ID tokens. Unset by default — `POST /api/auth/google` returns 503 until it's set. See §6 below for how to obtain it. |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | Path A only, has defaults | `spring-boot` | Already wired in `docker-compose.yml` to the `postgres` service (`ceview`/`ceview`/`ceview`). Only needed manually for Path B + real Postgres (uncommon — Path B normally uses H2). |
| `VITE_API_BASE_URL` | Optional | frontend | Overrides the default `http://localhost:8080` backend URL. |
| `VITE_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Optional | frontend | Firebase web app config, used by the "Continue with Google" button. Without these, the button still renders but the Firebase popup will fail. See §6 below. |

---

## 6. Authentication & seeded demo accounts

The app requires login — every screen is gated behind a Sign In page, and
every `/api/**` backend route requires a valid JWT.

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

You can also register a brand-new account via the Register link on the login
page (`POST /api/auth/register`) — it starts with an empty business
profile instead of pre-seeded data.

**What to verify once logged in:**
- The business profile / home / campaign analytics screens show *that
  operator's own* seeded data.
- Logging out and back in as a *different* seeded operator shows *different*
  data — no cross-operator leakage.
- `curl http://localhost:8080/api/business-profile` **without** an
  `Authorization` header returns `401` — the API is genuinely locked down,
  not just the frontend UI.

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

---

## 7. End-to-end smoke test (manual)

With the backend (Path A or B) and frontend both running:

1. Open **http://localhost:3001** — you should land on the **Sign In** page,
   not the app.
2. Log in with a seeded account from §6.
3. Open DevTools (F12) → **Network** tab, filter by `localhost:8080`.
4. Click through the sidebar and watch requests fire — every request should
   now carry an `Authorization: Bearer <token>` header and return **200 OK**:

| Tab | What you click | Backend call |
|---|---|---|
| **Home** | (auto on load) | `GET /api/notifications` |
| **Market Radar** | (auto on load) | `GET /api/forecasting/markets` |
| **Uniqueness Score** | Fill all fields → *Analyze Business Profile* | `POST /api/classification/analyze` |
| **Uniqueness Score** | *Compute Uniqueness* | `POST /api/classification/uniqueness` |
| **Business Profile** | *Save* | `PUT /api/business-profile` |
| **Campaign Analytics** | *Generate AI Report* | `POST /api/analytics/report` |

5. Click **Sign Out** in the sidebar — you should be returned to the Sign In
   page, and further API calls should stop (or 401 if attempted directly).

If the backend is down or a call 401s unexpectedly, some views fall back to
local mock data and log a warning to the console — check the Network tab
response body for the actual error before assuming it's a frontend bug.

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
| `mvnw.cmd is not recognized` | Run with the absolute path: `& "C:\Users\austi\CeView\backend\spring-boot\mvnw.cmd" package -DskipTests`. |
| Frontend keeps showing mock data even when backend is up | Open DevTools → Network. If `/api/...` calls return 4xx/5xx, the fallback kicks in. Check the response body for the error. |
| Port 8080/8000/8001/3000 already in use | `Get-NetTCPConnection -LocalPort 8080` to find the PID, then `Stop-Process -Id <pid> -Force`. |
| `fastapi-sbert` takes forever to become healthy on first run | Expected — it's downloading the ~1.1GB SBERT/E5 encoder from HuggingFace (`start_period: 600s` in the healthcheck accounts for this). Subsequent runs reuse the cached model via the `ceview-hf-cache` Docker volume. |
| Playwright e2e tests fail with connection errors | The stack isn't running yet — Playwright doesn't start it for you. Bring up backend + frontend first (§3, §4), then run `npx playwright test`. |

---

## 11. Project layout reference

```
CeView/
├── frontend/                       # React 19 + Vite frontend
│   ├── components/auth/          # LoginPage, RegisterPage, AuthGate
│   └── services/
│       ├── apiClient.ts          # all backend calls live here, attaches JWT
│       ├── auth.tsx              # AuthProvider / useAuth() — session state
│       └── geminiService.ts      # legacy direct-to-Gemini (kept for unwired flows)
├── e2e/                          # Playwright end-to-end tests
│   └── tests/smoke.spec.ts       # login flow + core navigation smoke test
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
│   │       └── h2/               # H2 mirror migrations (for tests / native Path B)
│   ├── fastapi-sbert/            # SBERT/Gemini NLP microservice on :8000
│   │   ├── requirements.txt
│   │   └── app/
│   └── fastapi-transformer/      # forecasting microservice on :8001
│       ├── requirements.txt
│       └── app/
└── RUNNING.md                    # this file
```
