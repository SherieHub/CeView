# CeView

CeView is a tourism-demand intelligence and AI-assisted marketing platform for Cebu-based MSMEs (dive shops, cafés, tour operators, and similar small tourism-adjacent businesses). It forecasts inbound-traveler demand surges from specific international markets, alerts business owners when a surge is coming, and helps them draft, review, and publish market-localized social content around it — then reports back on how that content performed.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind
- **Orchestration API:** Spring Boot 3.3 (Java 21), JWT auth
- **AI microservices:** FastAPI (Python 3.12) × 2 — `fastapi-sbert` (SBERT business classification, LangGraph content generation, Groq) and `fastapi-transformer` (XGBoost + Groq/Gemini demand forecasting)
- **Data:** PostgreSQL 16 + pgvector, Flyway migrations
- **Testing:** Vitest (frontend), JUnit (Spring Boot), pytest (FastAPI services), Playwright (end-to-end)

## Architecture at a Glance

The product is organized into four modules:

- **[Module 1 — Business Classification & Uniqueness Scoring](docs/module-1/README.md)** — classifies a business into tourism categories and scores how differentiated it is against the local cohort.
- **[Module 2 — Market Radar & Notifications](docs/module-2/README.md)** — ingests and forecasts market demand, surfacing surge alerts per target market.
- **[Module 3 — Content Studio](docs/module-3/README.md)** — generates market-localized captions and creative direction, gated by a compliance/approval flow.
- **[Module 4 — Campaign Analytics & Reporting](docs/module-4/README.md)** — computes campaign KPIs and an AI-generated prescriptive performance report.

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for full end-to-end sequence diagrams across every integration path.

## Current State

The app is fully authenticated and multi-tenant: every API route is JWT-gated and data is isolated per business operator. Local development ships with **9 seeded demo MSME operator profiles** with realistic, isolated data across all four modules — see [`SEED_CREDENTIALS.md`](backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md) for login credentials once your local stack is running.

## Quick Start

Backend (Docker, requires Docker Desktop and a [GROQ API key](https://console.groq.com/keys)):

```bash
cd backend
copy .env.example .env   # then fill in GROQ_API_KEY (required)
docker-compose up --build
```

Frontend:

```bash
cd ceview
npm install
npm run dev   # http://localhost:3000
```

For the native/H2 path (no Docker), the full environment variable reference, seeded demo accounts, troubleshooting, and end-to-end tests, see **[RUNNING.md](RUNNING.md)** — the complete setup guide.

## Documentation Map

| Doc | Path | Covers |
|---|---|---|
| Setup & Running | [`RUNNING.md`](RUNNING.md) | Full local setup (Docker and native/H2 paths), environment variables, demo accounts, troubleshooting, e2e tests |
| System Architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) | End-to-end sequence/flow diagrams across all integration paths |
| Architecture Spec | [`ARCHITECTURE_SPEC.md`](ARCHITECTURE_SPEC.md) | Scoring algorithms/formulas behind each module |
| API Contract | [`backend/CONTRACT.md`](backend/CONTRACT.md) | Full REST endpoint contract between frontend and backend |
| Module 1–4 docs | [`docs/module-1/`](docs/module-1/README.md) … [`docs/module-4/`](docs/module-4/README.md) | Per-module deep dives: components, DB schema, sequence diagrams |
| Deployment | [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md) | Deploying the full stack to Render |

## Testing & CI

| Workflow | Runs |
|---|---|
| [`ci-frontend.yml`](.github/workflows/ci-frontend.yml) | Vitest unit + integration tests, production build |
| [`ci-spring-boot.yml`](.github/workflows/ci-spring-boot.yml) | JUnit tests against H2, package |
| [`ci-fastapi-sbert.yml`](.github/workflows/ci-fastapi-sbert.yml) | pytest for the classification/content service |
| [`ci-fastapi-transformer.yml`](.github/workflows/ci-fastapi-transformer.yml) | pytest for the forecasting service |
| [`e2e.yml`](.github/workflows/e2e.yml) | Full-stack Playwright run against a Dockerized backend and built frontend |
