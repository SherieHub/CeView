# Docker Setup Guide

This guide covers building and running the CeView backend stack in Docker Desktop. The stack is three containers: **PostgreSQL** (with pgvector), **FastAPI** (AI microservice), and **Spring Boot** (main API).

The frontend (Vite/React) runs on your local machine and talks to Spring Boot on `localhost:8080`.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git repository cloned locally

---

## 1. Create the environment file

All three containers are configured through a single `.env` file in the `backend/` directory. A template is provided.

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in the values:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
ENABLE_GEMINI=true
JWT_SECRET=replace-with-at-least-32-chars-of-random-secret
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key. Get one at [aistudio.google.com](https://aistudio.google.com). |
| `ENABLE_GEMINI` | Set to `true` to use the live AI model. `false` returns mock responses. |
| `JWT_SECRET` | Secret used to sign auth tokens. Must be at least 32 characters. |
| `CORS_ALLOWED_ORIGINS` | Origin(s) the frontend runs on. Default is `http://localhost:5173` (Vite dev server). |

---

## 2. Build and start the containers

From the repo root:

```bash
cd backend
docker compose up --build
```

The `--build` flag rebuilds the Spring Boot and FastAPI images from their Dockerfiles. Omit it on subsequent starts when no code has changed.

Docker Compose starts the services in dependency order:
1. **postgres** starts first and waits until healthy
2. **fastapi** starts next
3. **spring-boot** starts after both postgres and fastapi are ready

Expected output when all three are running:

```
ceview-postgres  | database system is ready to accept connections
ceview-fastapi   | INFO:     Uvicorn running on http://0.0.0.0:8000
ceview-spring    | Started CeViewApplication in X.XXX seconds
```

---

## 3. Verify the services

| Service | URL | Expected response |
|---|---|---|
| Spring Boot health | `http://localhost:8080/actuator/health` | `{"status":"UP"}` |
| FastAPI docs | `http://localhost:8000/docs` | Swagger UI page |
| PostgreSQL | `localhost:5432` | Accessible via any Postgres client (DB: `ceview`, user: `ceview`, password: `ceview`) |

---

## 4. Run the frontend

In a separate terminal, from the repo root:

```bash
cd ceview
npm install
npm run dev
```

The dev server starts on `http://localhost:5173` (or `http://localhost:3000` — check terminal output). The frontend proxies API calls to Spring Boot at `http://localhost:8080`.

---

## 5. Common commands

**Start containers (no rebuild):**
```bash
cd backend
docker compose up
```

**Stop containers:**
```bash
docker compose down
```

**Stop containers and delete the database volume** (resets all data):
```bash
docker compose down -v
```

**Rebuild a single service** (e.g., after changing FastAPI code):
```bash
docker compose up --build fastapi
```

**View live logs for a specific container:**
```bash
docker compose logs -f spring-boot
docker compose logs -f fastapi
docker compose logs -f postgres
```

**Open a shell in a running container:**
```bash
docker exec -it ceview-spring bash
docker exec -it ceview-fastapi bash
```

**Connect to the database directly:**
```bash
docker exec -it ceview-postgres psql -U ceview -d ceview
```

---

## 6. Container reference

| Container | Image | Port | Purpose |
|---|---|---|---|
| `ceview-postgres` | `pgvector/pgvector:pg16` | `5432` | Primary database with vector extension |
| `ceview-fastapi` | Built from `backend/fastapi/Dockerfile` | `8000` | AI inference (Gemini, classification) |
| `ceview-spring` | Built from `backend/spring-boot/Dockerfile` | `8080` | Main REST API, business logic, JPA |

Spring Boot connects to FastAPI internally via `http://fastapi:8000` (Docker's internal network). From your machine you reach FastAPI at `http://localhost:8000`.

---

## 7. Troubleshooting

**Spring Boot exits immediately on first run**

The Spring Boot build compiles the JAR inside Docker using Maven. This takes 2–4 minutes the first time while dependencies are downloaded. Subsequent builds are faster because Maven layers are cached.

**`spring-boot` container fails with "Connection refused" to postgres**

The `depends_on: condition: service_healthy` setting should prevent this, but if it happens run:
```bash
docker compose restart spring-boot
```

**Port already in use**

Another process is using `5432`, `8000`, or `8080`. Either stop the conflicting process or change the left-hand port mapping in `docker-compose.yml` (e.g., `"5433:5432"`).

**`GEMINI_API_KEY` not picked up**

Ensure the `.env` file is in the `backend/` directory (same folder as `docker-compose.yml`), not the repo root. Docker Compose loads `.env` from the directory where the command is run.

**Changes to source code not reflected**

Run `docker compose up --build` to rebuild the affected image. Containers do not hot-reload source changes.
