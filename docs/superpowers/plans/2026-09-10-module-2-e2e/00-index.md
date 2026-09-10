# Module 2 E2E Completion — Implementation Plan (Index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Module 2 (Market Radar & Notifications) genuinely end to end — every value on the Dashboard and Market Radar drawer comes from a real, correct, tested source — so the **only** remaining work is supplying the trained BiLSTM + Transformer artifact to a prepared engine seam.

**Architecture:** Keep the existing Frontend → Spring Boot → Postgres → fastapi-transformer architecture. Fix the signal layer first (one canonical forex unit, one row per ISO week), then build the fixed 12×6 feature matrix and a pluggable forecast engine (`FORECAST_ENGINE=stub|groq|bilstm`, default `stub`) behind the existing `POST /internal/forecasting/inference-batch` contract, then make Spring, the alerts, the surge vocabulary and the UI consume it truthfully, and prove it with Playwright.

**Tech Stack:** React 19 + Vite + Vitest, Spring Boot 3.3 (Java 21, JUnit 5, Mockito, H2 for tests), FastAPI (Python 3.12, pytest, pandas), PostgreSQL 16 + Flyway, Playwright.

---

## Governing documents (precedence, highest first)

1. [`docs/module-2/MODULE_2_E2E_CONTRACT.md`](../../../module-2/MODULE_2_E2E_CONTRACT.md) — **frozen**. Every task implements a contract section (cited as "contract §N"). If a task and the contract disagree, the contract wins and the task is a bug.
2. [`docs/module-2/MODULE_2_E2E_STATUS_AND_DATA_MAPPING.md`](../../../module-2/MODULE_2_E2E_STATUS_AND_DATA_MAPPING.md) — the audit (IDs `C-`, `H-`, `T-`, `M2-UI-`).
3. This plan.

## Repository rules that override the generic skill template

- **Never run `git commit` or `git push`** (`AGENTS.md`, `.claude/CLAUDE.md`). Every task ends with a **Checkpoint**: stop, summarise the diff, and hand back to the user with a suggested Conventional Commit message. The user commits.
- No destructive git commands.
- Stay inside Module 2 boundaries; shared or Module 3 files touched are listed explicitly per task.
- Every data path stays tenant-scoped to the JWT-resolved business profile.

## Standard commands

| Suite | Command | Working dir |
|---|---|---|
| FastAPI all | `pytest tests/ -v` | `backend/fastapi-transformer` |
| One FastAPI test | `pytest tests/unit/test_x.py::test_name -v` | `backend/fastapi-transformer` |
| Spring all | `./mvnw -B test` (PowerShell: `.\mvnw.cmd -B test`) | `backend/spring-boot` |
| Spring subset | `./mvnw -B test -Dtest=ClassA+ClassB` | `backend/spring-boot` |
| Frontend unit | `npm run test:unit` | `frontend` |
| One frontend file | `npx vitest run path/to/file.test.tsx` | `frontend` |
| Frontend build / typecheck | `npm run build` | `frontend` |
| Live contract (needs stack) | `npm run test:contract` | `frontend` |
| Full stack | `docker compose up -d --build` | `backend` |
| Playwright one spec | `npx playwright test tests/dashboard.spec.ts` | `e2e` |

Spring tests run on H2 with `ddl-auto=create-drop` and **Flyway disabled** (`src/test/resources/application.properties`): new entity fields appear in tests automatically, but every Postgres migration is hand-written and verified against the Docker stack.

## Plan-level decisions (subordinate to the contract; cover audit items the contract does not)

| # | Decision | Audit |
|---|---|---|
| P-1 | The profile-agnostic weekly 21-job trend grid is gated off by default (`ceview.trend-fetch.enabled=false`); it feeds nothing the UI reads and competes for the PyTrends rate limit. | C-07 |
| P-2 | After the daily ingestion job ingests a profile it runs that profile's forecast; the dashboard also calls `POST /api/forecasting/ensure` in the background on mount. | C-08, C-09 |
| P-3 | Keyword-trend alerts are persisted once per (profile, category, ISO week) with stable ids and a message. | C-17, C-18 |
| P-4 | No new AI agent. Narrative text stays template-based but is made truthful and data-driven. | C-15 |
| P-5 | Flight, price and peak-month data stay static reference data, centralised in one class and labelled as reference data in the UI. | C-16 |

## Flyway migrations (`backend/spring-boot/src/main/resources/db/migration/`)

| Version | File | Phase | Contract |
|---|---|---|---|
| V27 | `V27__module2_signal_week_key_and_forex_unit.sql` | 1 | §1.4, §2.1 |
| V28 | `V28__module2_forecast_source.sql` | 3 | §4.3 |
| V29 | `V29__module2_demand_alert_uplift.sql` | 4 | §6 |
| V30 | `V30__module2_keyword_trend_alert.sql` | 7 | P-3 |
| V31 | `V31__module2_e2e_seed_refresh.sql` | 9 | — |

## Phases

| Phase | File | Implements | Status of this file |
|---|---|---|---|
| 0 | [`01-phase-0-baseline.md`](01-phase-0-baseline.md) | — | written |
| 1 | [`02-phase-1-signal-data.md`](02-phase-1-signal-data.md) | contract §1, §2; C-03, C-04, C-05, C-06 | written |
| 2 | [`03-phase-2-features-and-engines.md`](03-phase-2-features-and-engines.md) | contract §3, §4.1–4.2, §5; C-01 (seam), C-02, C-24 | written |
| 3 | `04-phase-3-spring-forecast-consumption.md` | contract §4.3 (no defaults, `forecast_source`, `forecastSource`/`lowConfidence`, chart caveat) | to be written |
| 4 | `05-phase-4-alert-rules.md` | contract §6; C-10, C-11, C-13; `journey.spec.ts` title strings | to be written |
| 5 | `06-phase-5-surge-vocabulary.md` | contract §7; C-12 | to be written |
| 6 | `07-phase-6-truthful-presentation.md` | P-4, P-5; C-15, C-16 | to be written |
| 7 | `08-phase-7-auto-forecast-and-keyword-alerts.md` | P-1, P-2, P-3; C-07, C-08, C-09, C-17, C-18 | to be written |
| 8 | `09-phase-8-frontend-robustness.md` | C-19 … C-23, T-01 … T-08 | to be written |
| 9 | `10-phase-9-seed-and-docs.md` | C-25, C-27, C-28 | to be written |
| 10 | `11-phase-10-e2e-tests.md` | C-26 | to be written |
| 11 | `12-phase-11-bilstm-handoff.md` | contract §5.2 handoff gate | to be written |

Phases are sequential: each starts only when the previous phase's exit gate passes. Within a phase every task is TDD (failing test → run → implement → run → checkpoint).

## Definition of done (whole plan)

1. Every suite in the command table passes; `npm run build` passes.
2. With the default `FORECAST_ENGINE=stub`, `docker compose up` serves a working dashboard whose forecasts are deterministic and visibly caveated as stub output (contract §4.3, §5.1); `dashboard.spec.ts`, `market-radar-drawer.spec.ts` and the updated `journey.spec.ts` pass.
3. With `FORECAST_ENGINE=bilstm` and no artifact: `GET /api/forecasting/status` returns `available:false`, the dashboard shows the AI-unavailable banner, and Refresh surfaces `MOD22_FORECAST_MODEL_NOT_READY` in the error panel — no fabricated numbers anywhere.
4. With `FORECAST_ENGINE=groq` and a key: the same specs pass with Groq forecasts.
5. Every `M2-UI-*` row of the audit registry is ✅, ⚠️-accepted static reference data (P-5), or 🔵 served by the engine seam; the audit document is updated (Phase 9).
