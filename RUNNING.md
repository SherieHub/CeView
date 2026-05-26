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
copy .env.example .env       # optional — only needed if you want live Gemini calls
docker-compose up --build
```

When you see `Started CeViewApplication` and the FastAPI worker line, the backend is ready.

**Health checks:**
```powershell
curl http://localhost:8080/actuator/health    # {"status":"UP"}
curl http://localhost:8000/healthz            # {"status":"ok"}
```

Stop with `Ctrl+C` then `docker-compose down`.

> If Docker Desktop shows **"Virtualization support not detected"**: reboot into BIOS/UEFI, enable Intel VT-x / AMD-V, and turn on Windows features *Hyper-V* and *Virtual Machine Platform*. If you can't, use Path B instead.

---

## Path B: Native (no Docker)

Three terminals. Keep all three open while testing.

### 1. FastAPI — terminal 1

```powershell
cd backend\fastapi
# First time only — install Python deps
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m pip install -r requirements.txt
# Run
C:\Users\austi\AppData\Local\Programs\Python\Python312\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`. Swagger docs at http://localhost:8000/docs.

### 2. Spring Boot — terminal 2

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd backend\spring-boot
# First time only — build the fat jar
.\mvnw.cmd -B package -DskipTests
# Run with the H2 profile (no DB required)
& "$env:JAVA_HOME\bin\java.exe" -jar target\ceview-backend-0.1.0.jar `
    --spring.profiles.active=h2 `
    --ceview.fastapi.base-url=http://127.0.0.1:8000 `
    --ceview.cors.allowed-origins=http://localhost:3000
```

Wait for `Started CeViewApplication in N seconds`. Health at http://localhost:8080/actuator/health.

H2 console: http://localhost:8080/h2 — JDBC URL `jdbc:h2:mem:ceview`, user `sa`, no password.

### 3. Frontend — terminal 3

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

## Optional: enable live Gemini calls

The backend defaults to **mocked** AI responses so it runs offline. To use the real Gemini API:

1. Get a key from https://aistudio.google.com/app/apikey
2. Set environment variables before launching FastAPI (or in `backend/.env` for Path A):

   ```powershell
   $env:GEMINI_API_KEY = "your-key-here"
   $env:ENABLE_GEMINI = "true"
   ```

3. Restart FastAPI. Caption generation and prescriptive report endpoints will now call Gemini; everything else stays on stubs.

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
│   ├── spring-boot/              # orchestrator on :8080
│   │   ├── mvnw, mvnw.cmd
│   │   ├── pom.xml
│   │   └── src/main/...
│   └── fastapi/                  # AI microservice on :8000
│       ├── requirements.txt
│       └── app/
└── RUNNING.md                    # this file
```
