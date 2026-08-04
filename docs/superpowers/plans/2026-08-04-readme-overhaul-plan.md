# README & Developer Docs Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the accidentally-overwritten root `README.md` with an accurate technical dev-README, retire the stale `DOCKER.md`, and fix two unrelated repo-hygiene issues (`.vscode/settings.json`, `.gitignore`).

**Architecture:** This is a documentation/config change with no application code involved — no test suite applies. Each task instead has explicit "verify" steps (file existence, valid JSON, working relative links) in place of automated tests, and every step shows the exact file content to write.

**Tech Stack:** Markdown, JSON (`.vscode/settings.json`), plain-text (`.gitignore`). No build step.

**Spec:** `docs/superpowers/specs/2026-08-04-readme-overhaul-design.md`

---

### Task 1: Delete stale `DOCKER.md`

**Files:**
- Delete: `DOCKER.md`

- [ ] **Step 1: Confirm nothing else references it**

Run: `grep -rn "DOCKER.md" --include="*.md" --include="*.yml" --include="*.json" .`
Expected: no output (or only the design spec/plan docs mentioning it by name — those are fine to leave, they're historical).

- [ ] **Step 2: Delete the file**

```bash
git rm DOCKER.md
```

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: remove stale DOCKER.md, superseded by RUNNING.md"
```

---

### Task 2: Fix `.vscode/settings.json` merge conflict

**Files:**
- Modify: `.vscode/settings.json`

Current content (invalid JSON — unresolved merge conflict):
```json
{
  "js/ts.tsdk.path": "node_modules\\typescript\\lib",
  "java.compile.nullAnalysis.mode": "automatic",
<<<<<<< HEAD
  "python-envs.defaultEnvManager": "ms-python.python:system"
=======
  "python-envs.defaultEnvManager": "ms-python.python:system",
  "cSpell.words": [
    "genai"
  ]
>>>>>>> paldo
}
```

- [ ] **Step 1: Replace with the resolved union of both branches**

Write `.vscode/settings.json`:
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

- [ ] **Step 2: Verify it's valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.vscode/settings.json', 'utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add .vscode/settings.json
git commit -m "chore: resolve merge-conflict markers in .vscode/settings.json"
```

---

### Task 3: Fix `.gitignore`

**Files:**
- Modify: `.gitignore`

Current content (lists the committed template twice instead of the real secrets file):
```
backend/.env.example
backend/.env.example
```

- [ ] **Step 1: Replace with the correct entry**

Write `.gitignore`:
```
backend/.env
```

- [ ] **Step 2: Verify the real secrets file is now ignored and the template is not**

Run: `git check-ignore -v backend/.env backend/.env.example`
Expected: first line shows `.gitignore:1:backend/.env	backend/.env` (ignored); second line: no match for `backend/.env.example` (command exits nonzero for that path alone, or shows no rule) — confirming the template stays trackable.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "fix: gitignore the real backend/.env secrets file, not the committed template"
```

---

### Task 4: Write the new root `README.md`

**Files:**
- Modify: `README.md` (full replacement)

- [ ] **Step 1: Write the new README content**

Write `README.md`:
```markdown
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
```

- [ ] **Step 2: Verify every relative link in the new README resolves to a real file**

Run:
```bash
for f in RUNNING.md ARCHITECTURE.md ARCHITECTURE_SPEC.md backend/CONTRACT.md docs/module-1/README.md docs/module-2/README.md docs/module-3/README.md docs/module-4/README.md docs/DEPLOY_RENDER.md backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md .github/workflows/ci-frontend.yml .github/workflows/ci-spring-boot.yml .github/workflows/ci-fastapi-sbert.yml .github/workflows/ci-fastapi-transformer.yml .github/workflows/e2e.yml; do test -f "$f" && echo "OK  $f" || echo "MISSING $f"; done
```
Expected: every line printed as `OK  <path>`, no `MISSING` lines.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: replace accidentally-overwritten README with an accurate project overview"
```

---

### Task 5: Confirm `RUNNING.md` doesn't duplicate the new README

**Files:**
- Read-only check: `RUNNING.md`

The spec calls for trimming `RUNNING.md` only if its opening now duplicates the new README's Quick Start. `RUNNING.md` opens with its own title ("Running CeView Locally"), a description of the two setup paths, and a prerequisites table — distinct from the README's product overview and happy-path Quick Start. No overlapping content was found, so this task is a verification-only step, not an edit.

- [ ] **Step 1: Re-read the first 20 lines and confirm no duplication**

Run: `git diff --stat` (after Task 4's commit) to confirm `RUNNING.md` is not modified, and manually re-read `RUNNING.md` lines 1–20 to confirm they still read distinctly from the new `README.md` Quick Start section.
Expected: `RUNNING.md` untouched; no redundant restatement of the Quick Start commands beyond what's needed for its own prerequisites framing.

- [ ] **Step 2: No commit needed** (no file changes in this task)

---

### Task 6: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Confirm the full task set is committed**

Run: `git status`
Expected: clean working tree (all of Tasks 1–4's changes committed; Task 5 made no changes).

- [ ] **Step 2: Confirm DOCKER.md is gone and README.md is the new content**

Run: `test -f DOCKER.md && echo "STILL EXISTS" || echo "deleted"` and `head -5 README.md`
Expected: `deleted`; `head -5 README.md` shows the new `# CeView` title and product description, not the Module 1.2 content.

- [ ] **Step 3: Confirm JSON and gitignore fixes are in place**

Run: `node -e "JSON.parse(require('fs').readFileSync('.vscode/settings.json','utf8')); console.log('json ok')"` and `git check-ignore backend/.env`
Expected: `json ok`; `git check-ignore backend/.env` prints `backend/.env` (confirming it's ignored).

---

## Self-Review Notes

- **Spec coverage:** README rewrite (Task 4), RUNNING.md check (Task 5), DOCKER.md deletion (Task 1), `.vscode/settings.json` fix (Task 2), `.gitignore` fix (Task 3) — all five spec items covered. Documentation Map and Testing & CI tables from the spec are both included verbatim in Task 4's README content.
- **Placeholder scan:** no TBD/TODO markers; every step shows full literal file content or an exact runnable command with expected output.
- **Consistency:** paths referenced in Task 4's README (RUNNING.md, ARCHITECTURE.md, ARCHITECTURE_SPEC.md, backend/CONTRACT.md, docs/module-N/README.md, docs/DEPLOY_RENDER.md, SEED_CREDENTIALS.md, workflow files) were all confirmed to exist via Glob/Read during design research; Task 4 Step 2 re-verifies this mechanically before commit.
