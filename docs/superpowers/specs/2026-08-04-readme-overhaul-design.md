# CeView — README & Developer Setup Documentation Overhaul

## Context

The repo root `README.md` currently contains the wrong content: it's a verbatim copy of `docs/module-1/1.2-uniqueness-scoring/README.md` (a single sub-feature doc), the result of an accidental "Add files via upload" commit (`36aeb446`/`7c1fdfc6`) that overwrote the real project README. Git history (`git log --follow -p -- README.md`) shows the original README was a project-overview page (tagline, features, mission) that has since gone stale anyway — it predates the app's current stack, the full authentication rollout, the 9 seeded demo operators, and the CI/e2e infrastructure that now exist.

Meanwhile `RUNNING.md` (417 lines) is already a comprehensive, recently-polished (`05eb8b21`) setup and troubleshooting guide, and the repo has accumulated several other docs (`ARCHITECTURE.md`, `ARCHITECTURE_SPEC.md`, `backend/CONTRACT.md`, `docs/module-1..4/`, `docs/DEPLOY_RENDER.md`) with no central index pointing a new developer to the right one. There's also a stale, narrower `DOCKER.md` that predates the 4th backend service and duplicates/contradicts RUNNING.md's Docker instructions.

This work replaces the root README with an accurate technical developer-README, indexes the existing docs so developers know where to go for deeper detail, retires the stale `DOCKER.md`, and fixes two small unrelated repo-hygiene issues discovered during research (a broken `.vscode/settings.json` and a `.gitignore` mistake) while in the area.

## Scope

**In scope:**
- Rewrite `README.md`.
- Light-touch pass on `RUNNING.md` to remove any duplication with the new README's Quick Start (no structural rewrite — it's already accurate).
- Delete `DOCKER.md`.
- Fix `.vscode/settings.json` (unresolved merge-conflict markers, currently invalid JSON).
- Fix `.gitignore` (lists `backend/.env.example` twice; should ignore `backend/.env` instead).

**Out of scope:**
- `backend/CONTRACT.md`'s stale "Auth is open in scaffolding" note — flagged for the user, not fixed here.
- Any change to the actual application code, CI workflows, or other docs under `docs/`.
- Adding a live-demo URL (none currently confirmed) or CI status badges (not requested).

## README.md — Target Structure

Technical dev-README tone throughout: no emoji-pitch language, no "Mission"/"Disclaimer" sections (both obsolete — the IP-withholding disclaimer is false now that the backend is fully in-repo).

1. **Title + description** — `# CeView`, one paragraph: what the product does (predicts inbound-tourism demand surges for specific markets and helps Cebu MSMEs plan and publish AI-assisted, market-localized social content around them) and who it's for.

2. **Tech Stack** — one line per layer:
   - Frontend: React 19 + TypeScript + Vite, Tailwind
   - Orchestration API: Spring Boot 3.3 (Java 21), JWT auth
   - AI microservices: FastAPI (Python 3.12) × 2 — `fastapi-sbert` (SBERT classification, LangGraph content generation, Groq) and `fastapi-transformer` (XGBoost + Groq/Gemini demand forecasting)
   - Data: PostgreSQL 16 + pgvector, Flyway migrations
   - Testing: Vitest (frontend), JUnit (Spring Boot), pytest (FastAPI services), Playwright (e2e)

3. **Architecture at a Glance** — the 4-module breakdown, one line each, each linking to its `docs/module-N/README.md`:
   - Module 1 — Business Classification & Uniqueness Scoring
   - Module 2 — Market Radar & Notifications
   - Module 3 — Content Studio (caption generation, creative direction, compliance)
   - Module 4 — Campaign Analytics & Reporting
   Also link `ARCHITECTURE.md` for the full system diagram.

4. **Current State** — a short callout: the app is fully authenticated and multi-tenant (JWT-gated, per-operator data isolation across all 4 modules), seeded with 9 realistic demo MSME operator profiles for local testing — this is the single most load-bearing fact for someone about to run the app locally (they need to log in, and there's demo data to explore). Link to `backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md` for actual credentials.

5. **Quick Start** — happy-path only, Docker-first:
   ```
   cd backend
   copy .env.example .env   # fill in GROQ_API_KEY (required)
   docker-compose up --build
   ```
   ```
   cd ceview
   npm install
   npm run dev   # http://localhost:3000
   ```
   Immediately followed by: "For the native/H2 path (no Docker), environment variable reference, troubleshooting, seeded demo accounts, and end-to-end tests, see **[RUNNING.md](RUNNING.md)**." No further setup detail duplicated in the README itself.

6. **Documentation Map** — table:

   | Doc | Path | Covers |
   |---|---|---|
   | Setup & Running | `RUNNING.md` | Full local setup (Docker and native/H2 paths), environment variables, demo accounts, troubleshooting, e2e tests |
   | System Architecture | `ARCHITECTURE.md` | End-to-end sequence/flow diagrams across all integration paths |
   | Architecture Spec | `ARCHITECTURE_SPEC.md` | Scoring algorithms/formulas behind each module |
   | API Contract | `backend/CONTRACT.md` | Full REST endpoint contract between frontend and backend |
   | Module 1–4 docs | `docs/module-1/` … `docs/module-4/` | Per-module deep dives: components, DB schema, sequence diagrams |
   | Deployment | `docs/DEPLOY_RENDER.md` | Deploying the full stack to Render |

7. **Testing & CI** — one line per workflow with a link into `.github/workflows/`:
   - `ci-frontend.yml` — Vitest unit + integration tests, build
   - `ci-spring-boot.yml` — JUnit tests (H2), package
   - `ci-fastapi-sbert.yml` / `ci-fastapi-transformer.yml` — pytest per service
   - `e2e.yml` — full-stack Playwright run against Dockerized backend + built frontend

## RUNNING.md — Adjustment

No structural changes. Only check the top of the file for any content that now literally duplicates the new README Quick Start (e.g. a redundant top-level intro paragraph) and trim if so, so the two files don't drift. RUNNING.md remains the canonical detailed setup/troubleshooting reference.

## DOCKER.md — Deletion

Delete `DOCKER.md` outright. It documents only 3 containers (Postgres, FastAPI, Spring Boot), predating `fastapi-transformer`, and RUNNING.md §"Backend — Path A (Docker)" is the accurate, current replacement. No content needs to be merged forward — confirmed nothing in DOCKER.md isn't already covered by RUNNING.md's Docker section.

## Hygiene Fixes

**`.vscode/settings.json`** — currently invalid JSON due to an unresolved merge conflict:
```json
<<<<<<< HEAD
  "python-envs.defaultEnvManager": "ms-python.python:system"
=======
  "python-envs.defaultEnvManager": "ms-python.python:system",
  "cSpell.words": [
    "genai"
  ]
>>>>>>> paldo
```
Resolve by taking the union (both branches set the same `defaultEnvManager` value; only the `paldo` branch adds `cSpell.words`):
```json
{
  "js/ts.tsdk.path": "node_modules\\typescript\\lib",
  "java.compile.nullAnalysis.mode": "automatic",
  "python-envs.defaultEnvManager": "ms-python.python:system",
  "cSpell.words": [
    "genai"
  ]
}
```

**`.gitignore`** — currently:
```
backend/.env.example
backend/.env.example
```
`backend/.env.example` is a committed template and should NOT be gitignored (RUNNING.md tells developers to `copy` it). The real secrets file is `backend/.env`, which isn't currently listed at all (it happens not to be tracked today, but only by luck). Fix to:
```
backend/.env
```

## Verification

- `README.md` renders correctly on GitHub (valid Markdown, working relative links to `RUNNING.md`, `ARCHITECTURE.md`, `ARCHITECTURE_SPEC.md`, `backend/CONTRACT.md`, each `docs/module-N/README.md`, `docs/DEPLOY_RENDER.md`, and `backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md`).
- `DOCKER.md` no longer exists and nothing else in the repo links to it (`grep -r "DOCKER.md"`).
- `.vscode/settings.json` parses as valid JSON.
- `.gitignore` contains `backend/.env` and no longer double-lists `backend/.env.example`.
- A developer following only the new README's Quick Start + a RUNNING.md skim can get the full stack running locally and log in with a seeded demo account.
