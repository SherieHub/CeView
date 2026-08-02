# Running CeView Locally

How to bring up the full stack — Spring Boot + FastAPI + React — for end-to-end testing.

There are two supported paths:

- **Path A: Docker** — closest to the SDD (Postgres + pgvector). Requires Docker Desktop with CPU virtualization enabled.
- **Path B: Native (H2)** — runs without Docker. Same behavior, embedded H2 database instead of Postgres. Use this if Docker won't start.

The frontend is identical in both paths.

---

## Prerequisites

| Tool | Path A (Docker) | Path B (native) | Install |
|---|---|---|---|
| Docker Desktop ≥ 4.30 | ✅ required | — | `winget install Docker.DockerDesktop` |
| JDK 21 (Temurin) | — | ✅ required | `winget install EclipseAdoptium.Temurin.21.JDK` |
| Python 3.12 | — | ✅ required | `winget install Python.Python.3.12` |
| Node.js ≥ 20 | ✅ required | ✅ required | already installed if `node --version` works |

The Spring Boot Maven Wrapper (`mvnw`) is included — you do **not** need to install Maven.

---

## Path A: Docker (preferred)

One command brings up Postgres + Spring Boot + FastAPI together.

```powershell
cd backend
copy .env.example .env       # optional — only needed if you want live Groq/HF calls

docker-compose up --build
```

Spring Boot's `Dockerfile` builds the jar itself in a Maven stage (multi-stage
build) — no separate `mvnw package` step needed before `docker-compose up`
anymore. The first build will be slower since it compiles inside Docker; later
builds reuse Docker's layer cache unless `pom.xml` or `src/` changed.

When you see `Started CeViewApplication` and the FastAPI worker lines, the backend is ready.

**Health checks:**
```powershell
curl http://localhost:8080/actuator/health    # spring-boot        {"status":"UP"}
curl http://localhost:8000/healthz            # fastapi-sbert      {"status":"ok"}
curl http://localhost:8001/healthz            # fastapi-transformer {"status":"ok"}
```

Stop with `Ctrl+C` then `docker-compose down`.

> If Docker Desktop shows **"Virtualization support not detected"**: reboot into BIOS/UEFI, enable Intel VT-x / AMD-V, and turn on Windows features *Hyper-V* and *Virtual Machine Platform*. If you can't, use Path B instead.

---

## Path B: Native (no Docker)

Four terminals. Keep all four open while testing.

### 1. FastAPI (sbert) — terminal 1

```powershell
cd backend\fastapi-sbert
# First time only — install Python deps
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m pip install -r requirements.txt
# Run
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`. Swagger docs at http://localhost:8000/docs.

### 2. FastAPI (transformer) — terminal 2

```powershell
cd backend\fastapi-transformer
# First time only — install Python deps
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m pip install -r requirements.txt
# Run
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

You should see `Uvicorn running on http://127.0.0.1:8001`. Swagger docs at http://localhost:8001/docs.

### 3. Spring Boot — terminal 3

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
    --ceview.cors.allowed-origins=http://localhost:3000
```

Wait for `Started CeViewApplication in N seconds`. Health at http://localhost:8080/actuator/health.

H2 console: http://localhost:8080/h2 — JDBC URL `jdbc:h2:mem:ceview`, user `sa`, no password.

### 4. Frontend — terminal 4

```powershell
cd ceview
# First time only
npm install
npm run dev
```

Vite reports `http://localhost:3000/`. Open that in your browser.

---

## End-to-end smoke test

With all three (or just Docker) running:

1. Open **http://localhost:3000**
2. Open DevTools (F12) → **Network** tab, filter by `localhost:8080`
3. Click through the sidebar and watch requests fire:

| Tab | What you click | Backend call |
|---|---|---|
| **Home** | (auto on load) | `GET /api/v1/notifications` |
| **Market Radar** | (auto on load) | `GET /api/v1/forecasting/markets` |
| **Uniqueness Score** | Fill all fields → *Analyze Business Profile* | `POST /api/v1/classification/analyze` |
| **Uniqueness Score** | *Compute Uniqueness* | `POST /api/v1/classification/uniqueness` |
| **Business Profile** | *Recalibrate* (keywords) | `POST /api/v1/business-profile/keywords` |
| **Campaign Analytics** | *Generate AI Report* | `POST /api/v1/analytics/report` |

Every request should return **200 OK** with JSON. If the backend is down, the views fall back to local mock data and log a warning to the console — refreshing once the backend is up restores live data.

### Direct API testing without the frontend

```powershell
# Markets
curl http://localhost:8080/api/v1/forecasting/markets

# Classification analyze
$body = '{"businessName":"Sunset Cove","description":"Beachfront eco-resort","coreServices":["villas"],"uvp":"Marine biologist guide"}'
Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/v1/classification/analyze -ContentType 'application/json' -Body $body

# Analytics metrics
curl "http://localhost:8080/api/v1/analytics/metrics?start=2026-05-01&end=2026-05-14"
```

See `backend/CONTRACT.md` for the full endpoint table.

---

## AI keys: one required, one optional

- **`GROQ_API_KEY` is REQUIRED for `fastapi-transformer`.** Unlike `fastapi-sbert`, it does not degrade gracefully — the process raises `RuntimeError` and exits immediately at startup if this is unset (`app/services/gemini_forecaster.py`). The service will not come up at all without a valid key. Get one from https://console.groq.com/keys.
- **`GROQ_API_KEY` is optional for `fastapi-sbert`.** Without it, `app/services/gemini_client.py` logs a warning and every AI call (captions, prescriptive reports) returns a deterministic fallback tagged `"source": "fallback"` instead of `"source": "groq"`.
- **`HF_TOKEN`** — optional, used by `fastapi-sbert` for downloading the SBERT/E5 encoder from HuggingFace. Get a token from https://huggingface.co/settings/tokens.

Set before launching FastAPI (or in `backend/.env` for Path A — `docker-compose.yml` already reads `GROQ_API_KEY`/`HF_TOKEN` from it):

```powershell
$env:GROQ_API_KEY = "your-groq-key-here"   # required to run fastapi-transformer at all
$env:HF_TOKEN = "your-hf-token-here"       # optional
```

Without `GROQ_API_KEY` you can still run `spring-boot` + `fastapi-sbert` + the frontend, but any view that hits `fastapi-transformer` (Market Radar forecasting) will fail — that container won't start.

---

## Stopping everything

**Path A (Docker):**
```powershell
cd backend
docker-compose down
```

**Path B (native):** close each terminal, or:
```powershell
Get-Process java   | Stop-Process -Force
Get-Process python | Stop-Process -Force
Get-Process node   | Stop-Process -Force
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker-compose` says *Virtualization support not detected* | Enable Intel VT-x / AMD-V in BIOS, or use Path B. |
| `mvnw.cmd` fails with *"The system cannot find the file ...maven-wrapper.properties"* (Path B only — Path A builds inside Docker and doesn't need `mvnw.cmd`) | The `.mvn/wrapper/` folder is missing from the checkout. Regenerate it with an installed Maven (`mvn -N wrapper:wrapper -Dmaven=3.9.9`), or install Maven directly (`winget install Apache.Maven`) and run `mvn -B package -DskipTests` instead of `mvnw.cmd`. |
| `ceview-fastapi-transformer` container exits immediately / `docker-compose ps` doesn't list it | It crashes on startup with `RuntimeError: GROQ_API_KEY environment variable is not set` — this service has no stub mode. Set `GROQ_API_KEY` in `backend/.env` (Path A) or as an env var before launching it (Path B), then restart just that service: `docker-compose up -d --build fastapi-transformer`. |
| Browser shows `Failed to fetch` on `localhost:8080` | Spring Boot isn't running, or CORS isn't allowing your Vite port. Restart Spring with `--ceview.cors.allowed-origins=http://localhost:3000`. |
| Spring Boot fails with `Schema-validation` errors | You started with the Postgres profile but pointed at a fresh H2. Use `--spring.profiles.active=h2`. |
| `mvnw.cmd is not recognized` | Run with the absolute path: `& "C:\Users\austi\CeView\backend\spring-boot\mvnw.cmd" package -DskipTests`. |
| Frontend keeps showing mock data even when backend is up | Open DevTools → Network. If `/api/v1/...` calls return 4xx/5xx, the fallback kicks in. Check the response body for the error. |
| Port 8080/8000/3000 already in use | `Get-NetTCPConnection -LocalPort 8080` to find the PID, then `Stop-Process -Id <pid> -Force`. |

---

## Project layout reference

```
CeView/
├── ceview/                       # React 19 + Vite frontend
│   └── services/
│       ├── apiClient.ts          # all backend calls live here
│       └── geminiService.ts      # legacy direct-to-Gemini (kept for unwired flows)
├── backend/
│   ├── docker-compose.yml        # Path A
│   ├── .env.example
│   ├── spring-boot/               # orchestrator on :8080
│   │   ├── mvnw, mvnw.cmd
│   │   ├── pom.xml
│   │   └── src/main/...
│   ├── fastapi-sbert/             # SBERT/Gemini NLP microservice on :8000
│   │   ├── requirements.txt
│   │   └── app/
│   └── fastapi-transformer/       # forecasting microservice on :8001
│       ├── requirements.txt
│       └── app/
└── RUNNING.md                    # this file
```
