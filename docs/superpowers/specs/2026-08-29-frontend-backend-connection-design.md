# Frontend ↔ Backend Connection — Design

**Date:** 2026-08-29
**Status:** Approved, ready for planning
**Scope:** Sub-projects A + B of the "full connection" effort (see [Decomposition](#decomposition))

## Problem

The frontend is approximately 10% connected to the backend. Only two calls work:
`auth.login/register/google/completeProfile` → `/api/v1/auth/*`, and
`businessProfile.load()` → `GET /api/v1/business-profile`.

Everything else in [`frontend/services/apiClient.ts`](../../../frontend/services/apiClient.ts)
targets a path Spring Boot does not serve. `frontend/.env` currently sets
`VITE_USE_FIXTURES=false`, so those calls fire live and 404 today. Three of the four
modules additionally import `MOCK_*` fixtures directly in component code, bypassing
`apiClient` entirely — no environment flag can switch them.

Developers therefore cannot manually debug against real data.

### Current path mismatches

| `apiClient` calls | Spring Boot actually serves |
|---|---|
| `/api/markets`, `/api/markets/{id}/chart`, `/api/markets/category-scores` | `GET /api/v1/forecasting/markets`, envelope `{markets:[…]}`. No chart or category-scores route exists. |
| `/api/notifications`, `/api/notifications/{id}/read` | `GET /api/v1/notifications`, envelope `{notifications:[…]}`. No mark-read route. |
| `/api/v1/forecasting/analyze`, `/api/v1/forecasting/status` | `POST /api/v1/forecasting/analyze/{profileId}`. No `/status`. |
| `/api/content` | `POST /api/v1/content/generate` (requires a request body) |
| `/api/omcs/rubric`, `/api/omcs/evaluate` | `POST /api/v1/compliance/omcs-analyze` (requires `{caption, imageUrl}`) |
| `/api/campaigns/default-input`, `/history`, `/report` | `GET /api/v1/analytics/metrics`, `GET /api/v1/analytics/history`, `POST /api/v1/analytics/report` |
| `/api/posts`, `/api/connections`, `/api/workspace/*` | Nothing — unimplemented, listed in [`backend/CONTRACT.md`](../../../backend/CONTRACT.md) |

### Components bypassing `apiClient` entirely

- **Module 1 onboarding** — zero network calls anywhere in `components/module-1/`.
  No classification, no uniqueness scoring, no profile save.
- **Module 3 Content Studio** — `MOCK_CONTENT`, `MOCK_OMCS`, `MOCK_POSTS` imported directly.
- **Module 2 Market Radar drawer** — `MOCK_MARKETS` imported directly; dashboard
  category scores read `CATEGORY_MARKET_SCORES` from fixtures.
- **`App.tsx`** — seeds `DEMO_PROFILE`.

### Root cause

`services/fixtures/` does three jobs at once: runtime mock data, the `VITE_USE_FIXTURES`
branch inside every `apiClient` method, and **the source of truth for domain types**
(`import type { Market } from '../fixtures/markets'` appears in 15+ components).
That third job is why the wiring is tangled — a fixture cannot be removed without
breaking type imports across three modules.

Nothing in the repo verifies that a frontend call matches a real backend route.
`frontend/tests/integration/` contains CSS and brand-token contract tests, not backend
integration tests. This is how `/api/markets` drifted from `/api/v1/forecasting/markets`
without anything failing.

## Decomposition

The full goal splits into three sub-projects:

- **A — Contract alignment.** Fix wrong paths, envelopes, and missing arguments so
  modules 2 and 4 hit real endpoints.
- **B — Wire the unwired.** Route module 1 onboarding and module 3 Studio through
  `apiClient` against endpoints that already exist.
- **C — Build missing backend.** Posts/publishing, platform-connections, workspace
  members: new entities, Flyway migrations, controllers, then frontend wiring.

**This spec covers A + B.** C is deferred to its own spec.

## Goals

1. Every frontend surface with a backend endpoint today fetches real data by default.
2. When a call fails, a developer sees the status, path, and backend error code without
   opening the console.
3. Path drift is caught by an automated check rather than by a blank screen.
4. `VITE_USE_FIXTURES` remains a working offline/demo toggle, with `false` as a
   correct default.

## Non-goals

- Posts/publishing, platform-connections, and workspace-members endpoints (spec C).
  `postStore`, `connectionsStore`, and the workspace settings panel stay on fixtures.
- OAuth integration with any social platform.
- H2 support. Postgres is the only supported database (see [Environment](#environment)).
- Removing the fixture layer.

## Environment

Postgres only. The verification target is the Docker Compose stack in
[`backend/docker-compose.yml`](../../../backend/docker-compose.yml): `postgres`
(pgvector/pg16) + `fastapi-sbert` + `fastapi-transformer` + `spring-boot`, with Flyway
seed data from `V15` (module 4 campaigns) and `V18` (modules 2 and 3).

`application-h2.yml` and `src/main/resources/db/h2/` remain on disk but are **out of
scope and unverified**. They have already drifted from the Postgres set — `db/migration/V13`
adds `tbl_forecast_result.weekly_forecasts_json`, which has no H2 counterpart, and with
`ddl-auto: none` any read of that column fails on H2. The spec records this so the H2
path's continued existence is not mistaken for support. RUNNING.md should note that
Path B is unmaintained.

## Design

### Phase 0 — Foundation

Four pieces every later slice depends on.

#### 0.1 Type extraction

Domain types move from `services/fixtures/*` into `frontend/types.ts`:
`Market`, `ChartDataPoint`, `Airline`, `DemandAlert`, `CampaignInput`,
`CampaignHistoryEntry`, `PrescriptiveReport`, `PublishedPost`, `OmcsAuditResult`,
`CaptionMetadata`.

Fixture files import these types instead of declaring them. All component imports
update to `from '../../types'`. This is mechanical, touches ~15 files, and is a
prerequisite for everything else: afterwards a fixture can change or be deleted without
breaking a component's types.

#### 0.2 `ApiError`

`request()` in `apiClient.ts` stops throwing a bare
`Error("Request to /x failed with 404")`. It throws:

```ts
class ApiError extends Error {
  status: number;
  path: string;
  method: string;
  code?: string;      // Spring's structured code, e.g. MOD22_MARKETS_FAILED
  body?: unknown;     // parsed response body
}
```

Spring already returns `{code, message}` for module 2 failures
(`MOD22_MARKETS_FAILED`, `MOD22_PROFILE_NOT_READY`) and sets MDC codes for module 3
(`MOD3_COMPLIANCE_VALIDATION`). These reach the UI intact instead of being stringified away.

#### 0.3 `<ApiErrorPanel>`

One shared component in `components/shared/`, rendering three visually distinct cases:

| Case | Trigger | Renders |
|---|---|---|
| Missing dependency | Backend config-error code (see 0.5) | Names the exact fix: "`fastapi-sbert` unreachable at `:8000`", "`GROQ_API_KEY` not set" |
| Not ready | 409 `MOD22_PROFILE_NOT_READY` | "Complete onboarding first" — not a failure |
| Genuine failure | Everything else | Status, method, path, backend code and message verbatim |

Every wired surface renders this on error. No surface silently swallows a failure.

#### 0.4 Live contract-test harness

A new Vitest suite (`frontend/tests/contract/`) that:

1. Logs in as a seeded demo operator (see
   [`SEED_CREDENTIALS.md`](../../../backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md))
2. Calls every wired `apiClient` method against the running backend
3. Asserts HTTP status and response shape
4. **Auto-skips** when no backend answers a health probe, so it never breaks CI for a
   developer without Docker

This is the check that would have caught the `/api/markets` drift.

#### 0.5 Backend config-error codes

Spring and both FastAPI services must distinguish "dependency not configured" from
"dependency failed". A missing `GROQ_API_KEY` or an unreachable `fastapi-sbert` returns a
recognisable code, not a generic 503, so `<ApiErrorPanel>` can name the fix.

#### 0.6 JWT-derived endpoint variants

Several endpoints take `profileId` as a path variable or a required query param, but the
frontend has no `profileId` until `businessProfile.load()` resolves — login returns only
`operatorId`. Rather than give every module-2/3 call a hidden ordering dependency on the
profile fetch, add pathless variants that resolve the profile from the JWT, exactly as
`/notifications` and `/business-profile` already do:

| New | Existing (retained for compatibility) |
|---|---|
| `POST /api/v1/forecasting/analyze` | `POST /api/v1/forecasting/analyze/{profileId}` |
| `POST /api/v1/forecasting/ensure` | `POST /api/v1/forecasting/ensure/{profileId}` |
| `POST /api/v1/creative-direction/generate` | `POST /api/v1/creative-direction/generate/{profileId}` |
| `POST /api/v1/content/approve` (no `profileId` param) | `POST /api/v1/content/approve?profileId=` |

All resolve via `CurrentBusinessProfile.resolveOrValidate(null)`. `apiClient` never
handles `profileId`.

### Slice 1 — Module 2 (Dashboard & Market Radar)

Largest DTO work; all underlying data already exists in the database.

**Client fixes**

- `markets.list()` → `GET /api/v1/forecasting/markets`, unwrap `{markets:[…]}`
- `notifications.list()` → `GET /api/v1/notifications`, unwrap `{notifications:[…]}`
- `forecast.analyze()` → `POST /api/v1/forecasting/analyze` (JWT-derived, 0.6)
- `notifications.markRead` — currently PATCHes a nonexistent route and swallows the 404.
  Either add the endpoint or remove the call. Do not leave it silently broken.

**New backend**

- `GET /api/v1/forecasting/status` — `useDashboardState` already calls it to drive the
  existing `ai-down` banner. Reports reachability of `fastapi-transformer`.
- Category-scoped market ranking, replacing the fixture `CATEGORY_MARKET_SCORES`
  (see [`docs/module-2/backend/category-scoped-ranking.md`](../../module-2/backend/category-scoped-ranking.md))

**DTO extension**

`MarketDto` is missing eight fields the frontend `Market` type requires. Seven map to
columns that already exist:

| Frontend field | Source |
|---|---|
| `seasonalityScore` | `MarketScore.seasonality_score` |
| `spikeIndicator` | `MarketScore.spike_indicator` |
| `gdpValue` | `MarketScore.gdp_per_capita_growth` / `MarketEconomicTrend.gdp_latest` |
| `forexValue` | `MarketScore.forex_vs_php` / `MarketEconomicTrend.forex_latest` |
| `currency` | `MarketEconomicTrend.currency_code` |
| `forexLabel` | derived from `currency_code` (e.g. "PHP per 1 KRW") |
| `flag` | derived from market name / ISO code |
| `yoyRatio` | **no column** — see Risks |

Also reconcile: backend `AirlineDto` carries `duration` and `tier` that the frontend
`Airline` lacks; backend `spike` is `double` where the frontend expects `0 | 1`.

**Component changes**

- `MarketRadarDrawer` stops importing `MOCK_MARKETS`
- `useDashboardState` stops importing `marketsForCategory` / `CATEGORY_MARKET_SCORES`
- All error paths render `<ApiErrorPanel>`

### Slice 2 — Module 4 (Campaign Analytics)

Smallest surface; real seed data from `V15__module4_campaign_seed_data.sql`.

- `campaign.history()` → `GET /api/v1/analytics/history?weeks=4|8`, unwrap and map
  `CampaignSnapshot` → `CampaignHistoryEntry`
- `campaign.report()` → `POST /api/v1/analytics/report`
- `campaign.defaultInput()` → `GET /api/v1/analytics/metrics?weeks=`
- `IngestionForm` submits to `POST /api/v1/analytics/manual` instead of only seeding
  local state from `DEFAULT_CAMPAIGN_INPUT`
- `PesGauge` wires to `GET /api/v1/analytics/pes/{campaignId}`

**Multi-tenancy fix.** `EngagementMetricsController.metrics()` calls
`metricsSvc.defaultMetrics(weeks)` with no profile scoping, unlike `/history` and
`/manual` beside it which both resolve the current profile. Wiring the frontend to it
would make that isolation gap live. Add `CurrentBusinessProfile` scoping as part of this
slice.

### Slice 3 — Module 1 (Onboarding)

The wizard currently makes no network calls at all; this slice gives it its first.

- `AnalysisStep` → `POST /api/v1/classification/analyze`, then
  `POST /api/v1/classification/uniqueness`
- Wizard completion → `PUT /api/v1/business-profile`, so `uniquenessScore` persists and
  `ProfileCompletionGate`'s redirect decides against real state
- `BasicInfoStep` stops importing `DEMO_BUSINESS`
- `BusinessProfileSettings` currently reaches `apiClient.businessProfile` through an
  `as { … }` cast because no save method exists. Add a real `save()` method and remove
  the cast.
- An unavailable `fastapi-sbert` surfaces as a named dependency error (0.3), not a
  generic failure

### Slice 4 — Module 3 (Content Studio)

Most new work and most AI-dependent, so it goes last.

This is not a path fix. The backend endpoints require request bodies the frontend has
never assembled: `content/generate` takes
`{market, businessName, description, categories, trend}`, and `omcs-analyze` rejects a
blank `caption` or `imageUrl`. Today `content.list()` and `omcs.evaluate()` send nothing.

- Build the `content/generate` request from `ProfileContext` + the selected market;
  `ContentStudioView` and `AIContentMatrixPanel` stop importing `MOCK_CONTENT`
- `CompliancePanel` sends real `{caption, imageUrl}` to
  `POST /api/v1/compliance/omcs-analyze` instead of reading `MOCK_OMCS`
- `VisualDirectionBoard` → `POST /api/v1/creative-direction/generate` (JWT-derived)
- Content approval → `POST /api/v1/content/approve` (JWT-derived)
- `ContentBoard` stays on `MOCK_POSTS` — publishing is spec C

## Fixture toggle semantics

`VITE_USE_FIXTURES=true` remains a whole-app switch for offline UI work. What changes is
that `false` — the default — must actually work everywhere, which today it does not.

After this spec, components never import `MOCK_*` directly; fixtures are reachable only
through `apiClient`. The toggle becomes honest: it is never ambiguous whether a screen is
showing real or fixture data. Because types no longer live in fixture files, the toggle
can be removed later without touching a single component.

## Verification

Two layers, both against a real Postgres-backed stack:

1. **Live contract tests** (0.4) — every wired endpoint, asserting status and shape.
   Auto-skips without a backend.
2. **Playwright e2e** — extend `e2e/` to walk login → onboarding → dashboard → studio →
   analytics against the Docker stack, building on the existing `.github/workflows/e2e.yml`.

Each slice is done when its contract test passes and its screens render real seeded data.

**Accepted tradeoff.** Mocked-fetch unit tests and a static route-inventory check were
considered and declined. Consequently nothing guards against path drift in a pull request
where no backend is running. If CI cannot stand up the stack, drift can land unnoticed —
the same failure mode that produced the current state. Revisit if that happens again.

## Risks

1. **`Market.yoyRatio` has no database column.** Either add one fed by the forecasting
   pipeline, or render an explicit degraded state in the Seasonal Patterns tab. Decide
   during slice 1 planning; do not silently default it to a number.
2. **`GET /analytics/metrics` is not tenant-scoped.** The scoping fix and the frontend
   wiring both live in slice 2, and the fix must land first within that slice — wiring
   the endpoint before scoping it would expose one operator's metrics to another.
3. **`WorkspaceMember` (types.ts) conflicts with `WorkspaceMemberFixture`.** Two
   incompatible shapes for the same concept. Workspace is out of scope; recorded here and
   deferred to spec C.
4. **Verification depends on a running backend.** CI coverage is only as good as the
   stack CI can start.

## Open decisions for the implementation plan

- Whether `notifications.markRead` gets a backend endpoint or is removed
- Whether `yoyRatio` gets a column or a degraded state
- The exact shape of the category-scoped ranking response

## References

- [`backend/CONTRACT.md`](../../../backend/CONTRACT.md) — the frontend↔backend contract,
  including the "specified, not yet implemented" table that defines spec C
- [`ARCHITECTURE_SPEC.md`](../../../ARCHITECTURE_SPEC.md) — scoring and forecasting formulas
- [`RUNNING.md`](../../../RUNNING.md) — local setup
- [`CODEBASE_REVIEW-2026-08-25.md`](../../../CODEBASE_REVIEW-2026-08-25.md) — prior review
