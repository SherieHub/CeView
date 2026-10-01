# Remove Synthetic Fallbacks — Implementation Plan (Index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every value in the CeView UI comes from PostgreSQL, a documented formula over PostgreSQL rows, or an implemented AI model — and where a dependency is unavailable the UI says so and why, instead of substituting canned data.

**Architecture:** One structured unavailability contract (`503` + `{code, message, dependency, cause, stage}`) is introduced first and spoken by all three services. Then each tier of synthetic data is deleted behind it: persisted provenance plus last-known-good reads for external data, hard failures for AI generation, and outright deletion of the frontend fixture layer. `Literal` response types make a fallback unrepresentable rather than merely forbidden.

**Tech Stack:** React 19 + TypeScript + Vite + Vitest (frontend), Spring Boot 3.3 / Java 21 (orchestration API), FastAPI + Python 3.12 + pytest (AI services), PostgreSQL 16 + Flyway, Playwright (e2e).

**Spec:** [`docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md`](../../specs/2026-08-30-remove-synthetic-fallbacks-design.md)

---

## ⚠️ Commits are the operator's to run

`.claude/CLAUDE.md` forbids Claude from running `git commit` or `git push` in this
repository under any circumstances. Each task ends with a **Commit** step showing the
exact command, but **a human runs it**. An agent executing this plan stops at each
commit step, reports the task ready to commit, and hands the command back.

## ⚠️ These tasks need a running backend

Verification for Phases 1–5 assumes the Docker stack is up:

```bash
cd backend && docker compose up -d
```

PostgreSQL is the only supported database. `application-h2.yml` and
`src/main/resources/db/h2/` are out of scope and known to have drifted.

Wait for `fastapi-sbert` to report healthy before running Phase 2 or 3 verification —
its lifespan hook downloads a ~1.1GB E5 encoder on first start (`start_period: 600s`).

## Execution order

```
01-contract.md      Tasks 1–7    ← must complete first; everything depends on it
        │
        ├── 02-provenance.md   Tasks 8–16   ← Tier C; must precede Tier A
        │        │
        │        └── 03-tier-a.md   Tasks 17–25
        │                 │
        │                 └── 04-naver.md   Tasks 26–29
        │                          │
        │                          └── 05-fixtures.md   Tasks 30–35
        │                                   │
        │                                   └── 06-guards.md   Tasks 36–40
```

This chain is deliberately serial, unlike the predecessor plan's parallel slices.
Tier A before Tier C's provenance work would blank Module 2 with no staleness story
to soften it (spec §Sequencing). Naver removal after Tier A means `content.py` is
edited once, not twice. The fixture deletion last means every screen already has a
real data path or an explicit panel to fall back to.

## Task inventory

| # | Task | File |
|---|---|---|
| 1 | `DependencyUnavailable` + handler in `fastapi-sbert` | 01-contract.md |
| 2 | `DependencyUnavailable` + handler in `fastapi-transformer` | 01-contract.md |
| 3 | `AgentLLMModel` records why initialisation failed | 01-contract.md |
| 4 | Spring gateway passes the 503 body through verbatim | 01-contract.md |
| 5 | `ApiError` carries `dependency` / `cause` / `stage` | 01-contract.md |
| 6 | `ApiErrorPanel` renders them | 01-contract.md |
| 7 | Fix `GROQ_MODEL` and `OMCS_VISION_MODEL` defaults | 01-contract.md |
| 8 | `V22` — signal-record provenance columns | 02-provenance.md |
| 9 | `V23` — purge synthetic signal records | 02-provenance.md |
| 10 | Scheduler persists `source`, writes nothing on failure | 02-provenance.md |
| 11 | `trend_service` raises instead of returning stubs | 02-provenance.md |
| 12 | `EnrichedSequenceBuilder` filters to real rows, reports staleness | 02-provenance.md |
| 13 | `MOD22_NO_MARKET_DATA` when no real rows exist | 02-provenance.md |
| 14 | `ExternalMarketDataClient` last-known-good GDP/forex | 02-provenance.md |
| 15 | Remove the inline 2-sigma seasonality fallback | 02-provenance.md |
| 16 | `dataAsOf` / `dataStale` on `MarketDto` + `<StaleDataBanner>` | 02-provenance.md |
| 17 | Split `_mock_captions` into a prompt-only schema example | 03-tier-a.md |
| 18 | Delete `_fallback_captions` from the caption agent | 03-tier-a.md |
| 19 | Delete `_FALLBACK_SERVICES`; empty services is a 424 | 03-tier-a.md |
| 20 | Delete `_creative_fallback` | 03-tier-a.md |
| 21 | Delete `_FALLBACK_PAYLOAD` from `pes_analysis` | 03-tier-a.md |
| 22 | Delete `_FALLBACK_REPORT` / `_FALLBACK_EVALUATION` | 03-tier-a.md |
| 23 | Delete `_fallback_report` from `report.py` | 03-tier-a.md |
| 24 | Delete Spring's rule-based report fallbacks | 03-tier-a.md |
| 25 | `Literal` source types + Spring `ContentSource` enum | 03-tier-a.md |
| 26 | Remove Naver from the AI services | 04-naver.md |
| 27 | Remove Naver from Spring | 04-naver.md |
| 28 | Remove Naver from the frontend (`PlatformId` narrowing) | 04-naver.md |
| 29 | `V24` — drop Naver content rows | 04-naver.md |
| 30 | `<NotImplementedPanel>` | 05-fixtures.md |
| 31 | Rehome `OMCS_RUBRIC_LABELS` and the dev seeds | 05-fixtures.md |
| 32 | Zero `DEFAULT_CAMPAIGN_INPUT`; require the fields | 05-fixtures.md |
| 33 | Point the three no-backend screens at `NotImplementedPanel` | 05-fixtures.md |
| 34 | Strip `USE_FIXTURES` from `apiClient` | 05-fixtures.md |
| 35 | Delete `services/fixtures/` and the flag | 05-fixtures.md |
| 36 | `scripts/no-synthetic-data.mjs` guard | 06-guards.md |
| 37 | Wire the guard into all six CI workflows | 06-guards.md |
| 38 | Negative-path contract tests | 06-guards.md |
| 39 | Provenance e2e spec | 06-guards.md |
| 40 | Docs: `RUNNING.md` + `CLAUDE.md` | 06-guards.md |

## File structure

### Created

| File | Responsibility |
|---|---|
| `backend/fastapi-sbert/app/unavailable.py` | `DependencyUnavailable` + its FastAPI handler |
| `backend/fastapi-transformer/app/unavailable.py` | Same, for the transformer service |
| `backend/spring-boot/src/main/resources/db/migration/V22__module2_signal_provenance.sql` | `source` / `source_fetched_at` on signal records |
| `backend/spring-boot/src/main/resources/db/migration/V23__module2_purge_synthetic_signals.sql` | Delete stub-derived rows |
| `backend/spring-boot/src/main/resources/db/migration/V24__module3_drop_naver_content.sql` | Delete Naver content rows |
| `frontend/components/shared/NotImplementedPanel.tsx` | The "no backend route exists" surface |
| `frontend/components/shared/StaleDataBanner.tsx` | The "real but old" surface |
| `frontend/components/module-3/3.1-content-studio/omcsRubric.ts` | OMCS rubric display labels |
| `frontend/components/module-1/onboarding/devSeed.ts` | `DEV_SEED_DRAFT`, DEV-only |
| `frontend/tests/contract/unavailable.contract.test.ts` | Asserts 503-with-cause, never 200 |
| `scripts/no-synthetic-data.mjs` | Banned-identifier guard |
| `scripts/synthetic-data-allowlist.json` | Guard exceptions, reason required |
| `e2e/tests/provenance.spec.ts` | No canned string reaches the DOM |

### Deleted

| File | Why |
|---|---|
| `backend/fastapi-transformer/app/services/ml_stubs.py` | Zero importers; most misleading artifact in the tree |
| `frontend/services/fixtures/` (11 modules + README) | The fixture layer itself |
| `frontend/services/apiClient.fixtures.test.ts` | Tests a branch that no longer exists |

## Out of scope

- `/api/posts`, `/api/platform-connections`, `/api/workspace/*` — Task 30/33 declare
  these unbuilt rather than implementing them.
- Module 1's `AnalysisStep` — still the blocked Task 21 of the predecessor plan.
- The `MOD31_CAPTION_AGENT_FAILED` "missing platform 'tiktok'" bug. This plan makes it
  unmaskable; fixing the caption agent's prompt is separate work. **Expect Content
  Studio to show a red error panel after Phase 2 until that is fixed** — that is the
  plan working as designed, not a regression.
