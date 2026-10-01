# Frontend ↔ Backend Connection — Implementation Plan (Index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every CeView frontend surface that has a backend endpoint fetch real data by default, so developers can manually debug against a live stack.

**Architecture:** A shared foundation phase (domain types extracted out of fixtures, a structured `ApiError`, one reusable error panel, a live contract-test harness, backend config-error codes, and JWT-derived endpoint variants), followed by four vertical slices — one per module — each ending with a passing contract test and a screen rendering real seeded data.

**Tech Stack:** React 19 + TypeScript + Vite + Vitest (frontend), Spring Boot 3.3 / Java 21 (orchestration API), FastAPI + Python 3.12 (AI services), PostgreSQL 16 + pgvector + Flyway, Playwright (e2e).

**Spec:** [`docs/superpowers/specs/2026-08-29-frontend-backend-connection-design.md`](../../specs/2026-08-29-frontend-backend-connection-design.md)

---

## ⚠️ Commits are the operator's to run

`.claude/CLAUDE.md` forbids Claude from running `git commit` or `git push` in this
repository under any circumstances. The `Commit` step at the end of each task shows the
exact command, but **a human runs it**. An agent executing this plan should stop at each
commit step, report that the task is ready to commit, and hand the command back.

## ⚠️ These tasks need a running backend

Every slice's verification step assumes the Docker stack is up:

```bash
cd backend && docker compose up -d
```

Postgres is the only supported database (spec §Environment). `application-h2.yml` and
`src/main/resources/db/h2/` are out of scope and known to have drifted — do not use them
to verify anything in this plan.

Wait for `fastapi-sbert` to become healthy before running module-1 or module-3 tasks; its
lifespan hook downloads a ~1.1GB E5 encoder on first start (`start_period: 600s`).

## File structure

### Created

| File | Responsibility |
|---|---|
| `frontend/services/apiError.ts` | `ApiError` class — status, path, method, backend code, parsed body |
| `frontend/components/shared/ApiErrorPanel.tsx` | The one error surface every wired screen renders |
| `frontend/tests/contract/backendProbe.ts` | Health probe + seeded-operator login helper; drives auto-skip |
| `frontend/tests/contract/module2.contract.test.ts` | Live contract test, module 2 endpoints |
| `frontend/tests/contract/module4.contract.test.ts` | Live contract test, module 4 endpoints |
| `frontend/tests/contract/module1.contract.test.ts` | Live contract test, module 1 endpoints |
| `frontend/tests/contract/module3.contract.test.ts` | Live contract test, module 3 endpoints |
| `backend/spring-boot/src/main/java/com/ceview/ai/AiDependencyException.java` | Distinguishes "dependency not configured" from "dependency failed" |
| `backend/spring-boot/src/main/java/com/ceview/module2/ForecastStatusController.java` | `GET /api/v1/forecasting/status` |

### Modified

| File | Change |
|---|---|
| `frontend/types.ts` | Gains the 10 domain types extracted from fixtures |
| `frontend/services/apiClient.ts` | Correct paths, envelope unwrapping, `ApiError`, new methods |
| `frontend/services/fixtures/*.ts` | Import types from `types.ts` instead of declaring them |
| `frontend/components/module-2/2.1-dashboard/useDashboardState.ts` | Stops importing fixtures; renders error panel |
| `frontend/components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` | Stops importing `MOCK_MARKETS` |
| `frontend/components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` | Real history/report calls + error panel |
| `frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx` | Submits to `/analytics/manual` |
| `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx` | Real classification + uniqueness calls |
| `frontend/components/module-1/onboarding/OnboardingWizard.tsx` | Saves profile via `PUT /business-profile` |
| `frontend/components/module-1/onboarding/steps/BasicInfoStep.tsx` | Stops importing `DEMO_BUSINESS` |
| `frontend/components/settings/BusinessProfileSettings.tsx` | Uses a real `save()`; cast removed |
| `frontend/components/module-3/3.1-content-studio/*.tsx` | Real content/compliance/creative calls |
| `backend/.../module2/dto/MarketDtos.java` | `MarketDto` gains 7 mapped fields |
| `backend/.../module2/ForecastingController.java` | Pathless `analyze` / `ensure` variants |
| `backend/.../module3/CreativeDirectionController.java` | Pathless `generate` variant |
| `backend/.../module3/ContentController.java` | `approve` without required `profileId` |
| `backend/.../module4/engagement/EngagementMetricsController.java` | Tenant-scope `GET /metrics` |

## Execution order

```
01-foundation.md   Tasks 1–6   ← must complete first; everything depends on it
        │
        ├── 02a-module-2-category-dimension.md   Tasks 1a.1–1a.4
        │        └── 02-module-2.md   Tasks 7–12   ← 7, 11, 12 depend on 1a
        ├── 03-module-4.md   Tasks 13–17
        ├── 04-module-1.md   Tasks 18–21
        └── 05-module-3.md   Tasks 22–25
                  │
                  └── 06-e2e.md   Tasks 26–28   ← needs all four slices merged
```

Foundation is a hard prerequisite. The four slices are independent of each other and may
be worked in parallel by different people once foundation merges. The recommended serial
order is 2 → 4 → 1 → 3: modules 2 and 4 have seed data and no AI dependency, module 1
needs `fastapi-sbert`, module 3 needs both `fastapi-sbert` and a `GROQ_API_KEY`.

## Task inventory

| # | Task | File |
|---|---|---|
| 1 | Extract domain types into `types.ts` | 01-foundation.md |
| 2 | `ApiError` with backend code passthrough | 01-foundation.md |
| 3 | `<ApiErrorPanel>` | 01-foundation.md |
| 4 | Contract-test harness with auto-skip | 01-foundation.md |
| 5 | Backend config-error codes | 01-foundation.md |
| 6 | JWT-derived endpoint variants | 01-foundation.md |
| 1a.1 | Carry category into `tbl_market_signal_record` | 02a-module-2-category-dimension.md |
| 1a.2 | Forecast per (category, market); persist `yoyRatio` | 02a-module-2-category-dimension.md |
| 1a.3 | Expose `category`/`alertLevel`/`alertMessage` on notifications | 02a-module-2-category-dimension.md |
| 1a.4 | Backfill category onto seeded rows | 02a-module-2-category-dimension.md |
| 7 | `notifications.list` → real endpoint | 02-module-2.md |
| 8 | Resolve `notifications.markRead` | 02-module-2.md |
| 9 | `GET /forecasting/status` | 02-module-2.md |
| 10 | Extend `MarketDto` with 7 mapped fields | 02-module-2.md |
| 11 | `markets.list` + `forecast.analyze` → real | 02-module-2.md |
| 12 | Drop fixture imports from module-2 components | 02-module-2.md |
| 13 | Tenant-scope `GET /analytics/metrics` | 03-module-4.md |
| 14 | `campaign.history` → real endpoint | 03-module-4.md |
| 15 | `campaign.report` → real endpoint | 03-module-4.md |
| 16 | `IngestionForm` → `POST /analytics/manual` | 03-module-4.md |
| 17 | `PesGauge` → `GET /analytics/pes/{id}` | 03-module-4.md |
| 18 | `classification.analyze` client method | 04-module-1.md |
| 19 | `classification.uniqueness` client method | 04-module-1.md |
| 20 | `businessProfile.save()` + remove the cast | 04-module-1.md |
| 21 | Wire `AnalysisStep` + wizard completion | 04-module-1.md |
| 22 | `content.generate` with a real request body | 05-module-3.md |
| 23 | `compliance.omcsAnalyze` with real caption/image | 05-module-3.md |
| 24 | `creativeDirection.generate` | 05-module-3.md |
| 25 | Drop fixture imports from module-3 components | 05-module-3.md |
| 26 | Fix e2e base URL + backend-aware skip | 06-e2e.md |
| 27 | Full-journey Playwright spec | 06-e2e.md |
| 28 | Run the journey in CI against a real backend | 06-e2e.md |

## Out of scope

Deferred to spec C — do not implement here, and do not remove the fixtures backing them:

- `POST /api/v1/posts/publish`, `GET /api/v1/posts` — `postStore`, `ContentBoard`, `CalendarView`
- `GET/POST/DELETE /api/v1/platform-connections/*` — `connectionsStore`, Settings → Platforms
- `GET/POST /api/v1/workspace/*` — Settings → Workspace
- Reconciling `WorkspaceMember` (types.ts) with `WorkspaceMemberFixture`

## Open decisions resolved in this plan

The spec left three open. This plan settles them:

1. **`notifications.markRead`** — Task 8 adds `PATCH /api/v1/notifications/{id}/read`
   backed by the existing `is_read` column, rather than deleting the call. The dashboard
   already tracks read state optimistically; persisting it is a few lines and stops read
   state resetting on every reload.
2. **`Market.yoyRatio`** — ~~no producer exists~~ **superseded during execution.**
   Validating the live schema showed `yoy_ratio` is computed at ingestion
   (`tbl_trend_fetch_job.yoy_ratio`, `tbl_market_signal_record.yoy_ratio`) and passed into
   `GeminiForecastRequest` as an input — it was simply never persisted downstream. Task
   1a.1 adds the column and Task 1a.2 persists it, so Task 10 surfaces a real value. The
   frontend type stays `number | null` because pre-V20 rows remain null.
3. **Category-scoped ranking** — Task 11 reuses `GET /api/v1/forecasting/markets` with an
   optional `?category=` filter rather than adding a new endpoint, since the ranking is
   already computed per profile and only needs filtering.

---

## Execution outcome

**30 of 32 tasks complete.** Two are blocked on unbuilt features, not on wiring.

| Slice | Status |
|---|---|
| Phase 0 — Foundation (1–6) | ✅ complete |
| 1a — category dimension (1a.1–1a.4) | ✅ complete |
| 1 — Module 2 (7–12) + 7a | ✅ complete |
| 2 — Module 4 (13–17) | ✅ complete |
| 3 — Module 1 (18–20) | ✅ complete |
| 3 — Module 1 (21) | ⛔ **blocked** — see below |
| 4 — Module 3 (22–25) | ✅ complete |
| 5 — e2e (26–28) | ✅ complete |

Final: frontend **46 files / 330 tests**, contract **13 tests**, e2e journey **4/4**, backend **88+ tests**, schema **v21**.

### ⛔ Task 21 is blocked: `AnalysisStep` is an unbuilt stub

The plan assumed onboarding's analysis step existed and needed its calls wired. It does not:

```tsx
export default function AnalysisStep() {
  return <div>Not implemented yet — see CARD — Onboarding: Step 5 Analysis…</div>;
}
```

`OnboardingWizard` renders every step with no props, no `onComplete` exists, the Finish button is
permanently `disabled` (`stepValid` case 4 hard-codes `false`), and `ObDraft` has no `categories`
or `uniquenessScore` fields. The original UI plan calls for porting five components out of the
frozen `ceview/` build.

That is a feature build requiring product-design decisions, not a connection task. The client
methods it needs (`classification.analyze`, `classification.uniqueness`, `businessProfile.save`)
are done and verified in Tasks 18–20 — so the wiring is ready the moment the screen exists.

Other stubs found, all already out of scope: `CalendarView`, `PlatformsSettings`,
`WorkspaceSettings` (the latter two are spec-C deferrals).

### Uniqueness scale — decided and implemented

Three conventions collided: DB **0–1** (all 9 seeded profiles, 0.61–0.77), the classification API
**0–100** (`overallScore`), and frontend fixtures/display **0–100**.

**Decision:** the database stays canonical at 0–1 (no migration needed). Display formats ×100 at
the edge — fixed in `DashboardView.tsx` and `BusinessProfileSettings.tsx`, and `DEMO_PROFILE`'s
fixture moved from `82` to `0.82`. Onboarding must divide `overallScore` by 100 on save when
Task 21 lands.

### Root cause behind two "unexplained" failures

`POST /api/analytics/report` returning an empty `{}`, and `POST /api/content/generate` returning
500, were **the same underlying issue**: the configured Groq model `llama-3.3-70b-versatile` was
decommissioned. Groq answers 404 `model_not_found` while the API key still authenticates, so it
presented as a generic failure rather than a config problem.

Fixed: `GROQ_MODEL` is now read by `AgentLLMModel.py` (it was hardcoded) as well as
`gemini_client.py`, and is passed through `docker-compose.yml` to both AI services. Setting it to
`openai/gpt-oss-120b` **repaired the prescriptive report**, which now returns real content.

**Still open, out of scope:** caption generation fails with `MOD31_CAPTION_AGENT_FAILED` —
`"missing platform 'tiktok'"`. Reproduced across two different models, so it is prompt strictness
inside `fastapi-sbert`'s caption agent, not configuration. Content Studio surfaces this as a
specific error panel rather than a blank screen.

### Known-open items recorded elsewhere

- `login.spec.ts` fails 4/5 — it asserts `.topbar-title b`, but `Topbar.tsx` no longer renders a
  route title (moved to each screen's `PageHead`). A pre-existing regression, unrelated to this plan.
- `rank-markets` should read the already-populated `tbl_trend_fetch_job` instead of calling
  PyTrends live — see [`02-module-2.md`](02-module-2.md) §Task 7a follow-up.
- `OMCS_VISION_MODEL` defaults to a model this Groq key cannot access.
