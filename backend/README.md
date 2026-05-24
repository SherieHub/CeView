# CeView Backend

Two-process backend matching the SDD:

- **Spring Boot** (`spring-boot/`) — orchestrator, auth, persistence, REST API on `:8080`
- **FastAPI** (`fastapi/`) — AI microservice (Gemini, SBERT stub, forecast stub) on `:8000`
- **PostgreSQL + pgvector** — single instance

## Run

```bash
cd backend
docker-compose up --build
```

Then point the React frontend (Vite at `:5173`) at `http://localhost:8080`.

## Env

Optional `.env` next to `docker-compose.yml`:

```
GEMINI_API_KEY=...
ENABLE_GEMINI=true
JWT_SECRET=at-least-32-chars-please-change-me
```

If `ENABLE_GEMINI=false` (default), FastAPI returns deterministic mocks matching the frontend's existing data shapes — useful for offline dev.

## Health

- `GET http://localhost:8080/actuator/health`
- `GET http://localhost:8000/healthz`

See `../README.md` (root) and the plan file for the full endpoint contract.
