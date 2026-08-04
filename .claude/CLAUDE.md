# CeView — Project Context for Claude

CeView is a tourism-demand intelligence and AI-assisted marketing platform for Cebu-based MSMEs
(dive shops, cafés, tour operators, and similar small tourism-adjacent businesses). It forecasts
inbound-traveler demand surges from specific international markets, alerts business owners when a
surge is coming, and helps them draft, review, and publish market-localized social content around
it — then reports back on how that content performed.

This file exists so a fresh session doesn't need to re-read the whole repo for orientation. Read
the linked docs when you need depth on a specific area; treat this file as the map, not the
territory.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind — lives in `ceview/`
- **Orchestration API:** Spring Boot 3.3 (Java 21), JWT auth — `backend/spring-boot/`
- **AI microservices (Python 3.12, FastAPI):**
  - `backend/fastapi-sbert/` — SBERT business classification, LangGraph content generation, Groq
  - `backend/fastapi-transformer/` — XGBoost + Groq/Gemini demand forecasting
- **Data:** PostgreSQL 16 + pgvector, Flyway migrations
- **Testing:** Vitest (frontend), JUnit (Spring Boot), pytest (both FastAPI services), Playwright (e2e, `e2e/`)
- **Deploy:** Render (`render.yaml`, `docs/DEPLOY_RENDER.md`)

## Architecture at a Glance

Four modules, each spanning frontend + backend + one or both AI services:

| Module | Purpose | Docs |
|---|---|---|
| 1 — Business Classification & Uniqueness Scoring | Classifies a business into tourism categories, scores differentiation vs. local cohort | [`docs/module-1/README.md`](../docs/module-1/README.md) |
| 2 — Market Radar & Notifications | Ingests/forecasts market demand, surfaces surge alerts per target market | [`docs/module-2/README.md`](../docs/module-2/README.md) |
| 3 — Content Studio | Generates market-localized captions/creative direction, gated by compliance/approval flow | [`docs/module-3/README.md`](../docs/module-3/README.md) |
| 4 — Campaign Analytics & Reporting | Computes campaign KPIs + AI-generated prescriptive performance report | [`docs/module-4/README.md`](../docs/module-4/README.md) |

Full end-to-end sequence diagrams: [`ARCHITECTURE.md`](../ARCHITECTURE.md).
Scoring algorithms/formulas behind each module: [`ARCHITECTURE_SPEC.md`](../ARCHITECTURE_SPEC.md).
Frontend↔backend REST contract: [`backend/CONTRACT.md`](../backend/CONTRACT.md).

The app is fully authenticated and multi-tenant — every API route is JWT-gated, data is isolated
per business operator. Local dev ships with 9 seeded demo MSME operator profiles (see
[`backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md`](../backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md)).

## Repo Layout

- `ceview/` — React frontend (components organized by module: `components/module-1` … `module-4`, plus `auth/`, `shared/`; `services/` for API clients; `old-components/` is legacy/unused)
- `backend/spring-boot/` — Java orchestration API
- `backend/fastapi-sbert/`, `backend/fastapi-transformer/` — Python AI microservices
- `docs/` — per-module deep dives, deployment guide, and `docs/superpowers/` (specs/plans from the brainstorming→writing-plans workflow)
- `e2e/` — Playwright end-to-end tests
- `.github/workflows/` — CI: `ci-frontend.yml`, `ci-spring-boot.yml`, `ci-fastapi-sbert.yml`, `ci-fastapi-transformer.yml`, `e2e.yml`

## Running Locally

Quick start is in the root [`README.md`](../README.md). Full setup (Docker and native/H2 paths,
env vars, demo accounts, troubleshooting, e2e) is in [`RUNNING.md`](../RUNNING.md) — read that
before debugging local environment issues rather than guessing.

## Dos and Don'ts for Claude in This Repo

**Don't:**
- **Never run `git commit` or `git push` in this repository, under any circumstances, even if explicitly asked mid-task.** Reading history is fine (`git log`, `git show`, `git diff`, `git blame`) — writing to history is not. If a task seems to require a commit, stop and hand it back to the user to run themselves.
- Don't run destructive git operations (`reset --hard`, `checkout --`, `clean -f`, force-push) — not your call to make in this repo.
- Don't add abstractions, refactors, or "while I'm here" cleanup beyond what the task asked for.
- Don't touch `ceview/old-components/` unless a task specifically calls for it — it's legacy.

**Do:**
- Follow the module boundaries above when placing new code — a Module 3 change belongs in `components/module-3`, `docs/module-3`, etc., not scattered.
- Check `docs/module-N/README.md` and the relevant `*_SYSTEM_DOCUMENTATION.md` before modifying a module's logic — the scoring/forecasting formulas are specified in `ARCHITECTURE_SPEC.md` and shouldn't be reverse-engineered from code alone.
- Keep multi-tenant isolation in mind for any backend change touching data access — every query path is expected to be scoped to the authenticated business operator.
- Use the skills in `.claude/skills/` and commands in `.claude/commands/` (see below) — they encode the team's working process.

## Skills, Commands, and Agents in This Repo

`.claude/skills/`, `.claude/commands/`, and `.claude/agents/` are checked into the repo so every
collaborator gets the same Claude Code workflow without needing to install marketplace plugins
individually:

- **`skills/`** — process skills from the `superpowers` plugin (brainstorming → writing-plans →
  execution, TDD, systematic debugging, code review flow, git worktrees, etc.), plus
  `frontend-design` (polished UI work) and `obsidian-note-generator` (structured notes from source
  material).
- **`commands/`** — `code-review.md` (`/code-review`), for reviewing a PR or the working diff.
- **`agents/`** — `code-simplifier.md`, for simplifying/refining recently-changed code without
  changing behavior.

Not included here because they aren't plain markdown skill/command files: the `playwright` plugin
(browser automation via MCP server) — install it yourself via `/plugin` if you need it.

These are point-in-time copies. If the upstream plugins update, re-sync manually rather than
assuming they'll drift automatically.
