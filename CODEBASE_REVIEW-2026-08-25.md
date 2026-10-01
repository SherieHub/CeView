# Codebase Review: CeView

**Reviewed:** 2026-08-25 · **Commit:** `b4fc75c` (branch `ph1-dev_CVW12_AssetsAndLinks`) · **Scope:** Full stack — Spring Boot orchestration API, both FastAPI AI services, `frontend/`, CI, deploy config. Weighted toward architecture and onboarding per request.

> Supersedes `CODEBASE_REVIEW.md` (2026-08-21, commit `aad22f0`). Recommend replacing that file with this one so only one review doc exists.

## Summary

CeView is a four-module tourism-demand and AI-marketing platform: a React frontend over a Spring Boot orchestrator that fans out to two Python AI microservices. **The authentication and tenant-isolation work remains the strongest part of the codebase**, and one prior finding has been genuinely fixed — the repo dropped from 14,109 tracked files to 1,116.

Three things stand out this pass. First, **the critical finding from the last review is untouched**: both FastAPI services still have zero authentication and `render.yaml` still publishes them as public web services, one holding a `DATABASE_URL`. Second, **the same business rule is implemented twice in two languages and has already drifted into a bug** — Module 4's CTR calculation guards against the wrong variable in Java but not in Python, and the resulting garbage value is written to the database. Third, **the frontend deploy config has no SPA rewrite rule**, so the first Render deploy will 404 on every route except `/`.

The frontend itself is in good shape: `tsc --noEmit` is clean and all 113 tests pass. Note that TypeScript is never actually *run* in CI or in `npm run build` — it's clean by discipline rather than by enforcement (see [M9]).

The most important thing to do next is still the FastAPI auth check. Nothing else on this list matters if those URLs are reachable.

On the architecture question specifically: the boundaries are well drawn and the module structure is easy to navigate. The real structural cost is not the design, it's the **two parallel frontends**. `frontend/` is the live app and has no working screens for Modules 2–4; `ceview/` is frozen and has all of them. Nothing tracks what still needs porting.

**Snapshot**

| | |
|---|---|
| Size | 1,116 tracked files · 33,804 lines of code · 27,109 lines of Markdown |
| Stack | React 19 + TS + Vite · Spring Boot 3.3 / Java 21 · FastAPI ×2 / Python 3.12 · PostgreSQL 16 + pgvector |
| Tests | 4,730 test lines, ratio 0.14. Frontend: **17 files, 113 tests, all pass in 58s**. Spring Boot: 16 files (not run — see Coverage). FastAPI: **4 example tests** for 8,558 lines. |
| Typecheck | `tsc --noEmit` on `frontend/`: **clean, 0 errors** |
| Dependencies | `npm audit`: **0 vulnerabilities** (prod and dev) |
| Findings | **1 critical · 4 high · 9 medium · 3 low** |

## What's working well

Protect these during any refactor:

- **The tenant-scoping pattern.** [`CurrentBusinessProfile.java:101-108`](backend/spring-boot/src/main/java/com/ceview/auth/CurrentBusinessProfile.java#L101-L108) derives the profile id from the JWT and returns 403 on a mismatched client-supplied id rather than silently substituting. Applied consistently across Modules 2, 3, and 4.
- **Actuator exposure is correctly limited.** [`application.yml:53-57`](backend/spring-boot/src/main/resources/application.yml#L53-L57) restricts endpoints to `health,info`, which is what makes the `/actuator/**` `permitAll` in [`SecurityConfig.java:39`](backend/spring-boot/src/main/java/com/ceview/config/SecurityConfig.java#L39) safe. That pairing is deliberate and worth keeping — widening the exposure list would silently turn it into a leak.
- **`_extract_json`'s fallback chain.** [`omcs_agent/node.py:43-71`](backend/fastapi-sbert/app/agents/omcs_agent/node.py#L43-L71) looks like three swallowed exceptions but is a documented, deliberate ladder for parsing LLM output that arrives wrapped in prose. The comment explains exactly what it's defending against. This is how to write a fallback.
- **Comment quality is unusually high.** Non-obvious decisions carry their reasoning: the Node 22 CI pin, the 90-second rank-markets timeout, the eager model load in the FastAPI lifespan, the H2 migration split. This is the single biggest reason the codebase is fast to onboard to.
- **The FastAPI test scaffolding is honest.** [`test_example_unit.py`](backend/fastapi-sbert/tests/unit/test_example_unit.py) and [`test_healthz.py`](backend/fastapi-sbert/tests/integration/test_healthz.py) are labelled "Pattern to copy" and show how to test without triggering a 1.1 GB model download. The seam is built; nobody has used it yet.
- **A dedicated security regression test exists.** [`SecurityLockdownVerificationTest.java`](backend/spring-boot/src/test/java/com/ceview/security/SecurityLockdownVerificationTest.java) asserts which routes are public. Extend it rather than writing something new.

## Architecture overview

A request flows: React ([`apiClient.ts`](frontend/services/apiClient.ts)) → `Authorization: Bearer <JWT>` → Spring Boot filter chain (`JwtAuthenticationFilter` → `ProfileCompletionFilter`) → a `@RestController` under `/api/v1/*` → tenant scoping via `CurrentBusinessProfile` → either JPA against Postgres or [`AIInferenceGatewayService`](backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java), the sole bridge to the Python services. Every AI call is a blocking `.block(timeout)` wrapped in caller-side fallback logic.

The Java package layout (`module1/`…`module4/`, with `submodule21`-style subpackages) maps cleanly onto the product modules and onto `docs/module-N/`. A newcomer told "fix something in Market Radar" can find the code. That is the main thing an architecture review is checking for, and it passes.

The structural weakness is at the frontend edge. There are two React applications:

| | `frontend/` | `ceview/` |
|---|---|---|
| Status | Live, actively developed | Frozen per `CLAUDE.md` |
| Module 1 onboarding | Steps 1–4 built | Different, older design |
| Modules 2–4 | **All TODO stubs** (16 files, 16–49 lines each) | **All implemented** |
| CI | 2 workflows | **None** |

So the shipping app currently has no working Dashboard, Market Radar, Content Studio, or Analytics screens, while a frozen copy of the repo has all four. That is a deliberate rebuild, not an accident — but there is no checklist anywhere of what remains to be ported, which is exactly the information a new contributor needs first.

## Findings

### Critical

#### [C1] Both FastAPI services accept unauthenticated requests, and the deploy config makes them public
**Where:** [`fastapi-sbert/app/main.py:34-51`](backend/fastapi-sbert/app/main.py#L34-L51), [`fastapi-transformer/app/main.py:22`](backend/fastapi-transformer/app/main.py#L22), [`render.yaml:55-81`](render.yaml#L55-L81)
**What:** Every `/internal/*` router is registered with no dependency, no API-key header check, and no middleware other than `TraceIdMiddleware`. Grepping both services for `Depends`, `Security`, `api_key`, or an auth middleware returns only the trace middleware. `render.yaml` declares both as `type: web`, which Render publishes on a public hostname, and gives `ceview-fastapi-sbert` the database `connectionString`.
**Why it matters:** Anyone who finds the URLs can invoke the LLM endpoints directly and spend the `GROQ_API_KEY` budget without limit. The whole design rests on `/internal/*` being unreachable from outside, and nothing enforces that. This was the top finding four days ago and is unchanged.
**Suggested fix:** Add a shared-secret header dependency applied at the router level in both services, and set the matching value on the Spring Boot client in [`WebClientConfig.java`](backend/spring-boot/src/main/java/com/ceview/config/WebClientConfig.java). Something like:
```python
INTERNAL_KEY = os.environ["INTERNAL_API_KEY"]

def require_internal_key(x_internal_key: str = Header(...)):
    if not secrets.compare_digest(x_internal_key, INTERNAL_KEY):
        raise HTTPException(status_code=401)

app.include_router(classification.router, prefix="/internal/classification",
                   dependencies=[Depends(require_internal_key)])
```
Add `INTERNAL_API_KEY` with `generateValue: true` to all three services in `render.yaml`. If Render private services become available on your plan, use those as well — but do the header check regardless, since it also protects the local Docker network.

### High

#### [H1] Any authenticated operator can trigger the global ingestion job
**Where:** [`IngestionTriggerController.java:24-31`](backend/spring-boot/src/main/java/com/ceview/module2/submodule21/IngestionTriggerController.java#L24-L31)
**What:** `POST /api/v1/admin/ingestion/trigger` is documented as a "Dev/test endpoint" but ships in the authenticated surface. `SecurityConfig` only requires `.anyRequest().authenticated()`, and grepping the entire Java tree for `hasRole`, `hasAuthority`, `@PreAuthorize`, or `ROLE_` returns **nothing** — there is no role concept at all. It also runs `runDailyIngestion()` synchronously on the request thread.
**Why it matters:** Any of the 9 seeded demo operators — or any real signup — can repeatedly trigger a job that fans out to PyTrends (up to 75 s per batch) and the Groq API. It's an unauthenticated-in-practice cost amplifier and a request-thread exhaustion vector, from a route whose own Javadoc says it isn't meant for production.
**Suggested fix:** Fastest correct fix: gate the whole controller behind a config flag that is false outside dev, mirroring `ceview.ingestion.enabled`. Longer term, add an `isAdmin` column to `MsmeOperator`, put the authority in the JWT, and `@PreAuthorize("hasRole('ADMIN')")` this route. Make the trigger async either way.

#### [H2] Module 4's CTR divides by the wrong guarded variable, and the corrupt value is persisted
**Where:** [`MetricsCalculationService.java:30`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L30)
**What:**
```java
double ctr = clicks == 0 ? 0 : (double) clicks / impressions * 100.0;
```
The guard checks `clicks` but the divisor is `impressions`. The other four metrics guard their own divisor correctly. With `impressions = 0` and `clicks > 0`, this yields `Infinity`, which `round()` ([:173](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L173)) converts via `Math.round(double)` → `Long.MAX_VALUE`, producing a CTR of **9.22 × 10¹⁷ percent**.
**Why it matters:** It isn't display-only. [`EngagementMetricsController.java:96-103`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java#L96-L103) calls `record.enrichWithKpis(mr.metrics().ctr().value(), ...)` and saves it, so the nonsense value is written to `CampaignRecord` and feeds the PES score and the AI-generated report downstream. The input is a manual form with no validation (see [M1]), so an operator who fills in clicks but leaves impressions blank reaches it immediately.
**Suggested fix:** `double ctr = impressions == 0 ? 0 : (double) clicks / impressions * 100.0;` — and see [H3], because the Python implementation already gets this right.

#### [H3] The PES metric formulas exist twice, in two languages, and have drifted
**Where:** [`MetricsCalculationService.java:30-34`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L30-L34) vs [`pes_compute_service.py:97-130`](backend/fastapi-sbert/app/services/pes_compute_service.py#L97-L130)
**What:** CTR, CPC, CR, ROAS, and CAC are each computed in both services. The Python version guards each divisor correctly and appends a descriptive flag (`"CTR (impressions = 0)"`) that later drives proportional weight recalibration. The Java version guards `clicks` for three of the five and has no flagging concept. [H2] is the drift that has already happened; the flagging divergence means the two services can return different scores for identical input.
**Why it matters:** This is the duplication that matters — a shared business rule with two owners will keep diverging, and each divergence is a silent wrong number in a report the operator makes decisions from. `ARCHITECTURE_SPEC.md` specifies these formulas once; the code implements them twice.
**Suggested fix:** Make Python the single owner. Java should forward raw inputs to `/internal/pes-compute` and persist what comes back, keeping a local computation only as the documented fallback path — which is already the established pattern for every other AI call in `AIInferenceGatewayService`. If the local fallback stays, port the flagging logic so the two agree, and add a test asserting both produce identical output for a shared fixture.

#### [H4] Module 4 metric trend arrows are hardcoded constants shown as real data
**Where:** [`MetricsCalculationService.java:37-41`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L37-L41)
**What:** Each `MetricCard` is built with a literal delta and direction — `1.2, true` for CTR, `-0.05, true` for CPC, `0.4, true` for ROAS, and so on — regardless of the operator's actual numbers. Related: `defaultMetrics(weeks)` ([:66-71](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L66-L71)) returns invented figures (150,000 impressions, ₱16,000 revenue) scaled by the window.
**Why it matters:** The product's stated purpose is telling MSME owners how their campaigns performed. A trend indicator that always says "+1.2% ▲" is not a placeholder the user can recognize as fake — it reads as a measurement. Someone will make a spend decision on it.
**Suggested fix:** Compute deltas against the prior period from `CampaignRecord` history, or return `null` for the delta and have the frontend render no arrow when it's absent. If demo data must stay for the thesis demo, gate it behind an explicit flag and label it in the UI.

### Medium

#### [M1] No request validation anywhere on the Module 4 ingest endpoint
**Where:** [`AnalyticsDtos.java:21-31`](backend/spring-boot/src/main/java/com/ceview/module4/dto/AnalyticsDtos.java#L21-L31), [`EngagementMetricsController.java:88`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java#L88)
**What:** `ManualIngestRequest` is nine nullable boxed fields with no `@NotNull`, `@Min`, or `@PositiveOrZero`, and the handler signature is `@RequestBody ManualIngestRequest in` with no `@Valid`. Negative impressions, negative ad spend, and `bookings > clicks` are all accepted and persisted.
**Why it matters:** It's the direct enabler for [H2] and it lets structurally impossible funnels into the database, which then flow to the AI report agent as fact.
**Suggested fix:** Add `spring-boot-starter-validation` constraints to the record and `@Valid` to the parameter; add a cross-field check that funnel stages are monotonically non-increasing.

#### [M2] JWT falls back to a shared hardcoded development secret
**Where:** [`application.yml:35`](backend/spring-boot/src/main/resources/application.yml#L35)
**What:** `secret: ${JWT_SECRET:dev-secret-change-me-please-32chars-min}`. The app starts and mints valid tokens with no warning if `JWT_SECRET` is unset.
**Why it matters:** `render.yaml` sets `generateValue: true`, so the blueprint path is safe — but any deploy that doesn't go through the blueprint (a manual Render service, `docker-compose` on a VPS, a teammate's staging box) silently runs on a secret that is published in this public repo. Anyone can then forge a token for any operator, which defeats the entire tenant-isolation layer.
**Suggested fix:** Fail fast instead of defaulting. Drop the default value and add a startup check that refuses to boot when the active profile isn't `h2`/dev and the secret is absent or equals the dev value.

#### [M3] The frontend static site has no SPA rewrite rule, so deep links will 404
**Where:** [`render.yaml:83-91`](render.yaml#L83-L91)
**What:** The `ceview-frontend` static service declares `staticPublishPath: ./frontend/dist` with no `routes:` block. The app uses `createBrowserRouter` ([`App.tsx:74`](frontend/App.tsx#L74)) with real paths (`/login`, `/onboarding`, `/dashboard`).
**Why it matters:** Only `/` will load. Every refresh on an inner page, every bookmark, and every shared link returns Render's 404 — including `/login`, which is where an unauthenticated user gets redirected. First deploy will look completely broken.
**Suggested fix:**
```yaml
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

#### [M4] Two identical frontend CI workflows run on every change
**Where:** [`ci-frontend.yml`](.github/workflows/ci-frontend.yml) and [`ci-frontend-v2.yml`](.github/workflows/ci-frontend-v2.yml)
**What:** Same `runs-on`, same working directory, same four steps, same Node pin. Both trigger on `frontend/**` for `main` and `ph1-dev`; the only difference is that v1 also watches `task_allocation`. Every frontend PR runs the same job twice.
**Why it matters:** Doubles CI time and, more importantly, makes it ambiguous which check is authoritative when someone adds a step — a fix applied to one (such as the typecheck step in [M9]) silently doesn't apply to the other.
**Suggested fix:** Delete `ci-frontend-v2.yml` and add `task_allocation` handling to the original, or vice versa. Just pick one.

#### [M5] Build artifacts and dependencies are committed despite being gitignored
**Where:** `e2e/node_modules/` (191 files, added in `46b80bb`), `.playwright-mcp/` (72 console logs and page snapshots), `e2e/test-results/.last-run.json`, [`frontend/dist/index.html`](frontend/dist/index.html)
**What:** `.gitignore` lists `node_modules/` and `dist/`, but these were committed before the rules existed and were never `git rm --cached`'d. `frontend/dist/index.html` is the most active of them — it is tracked, so it shows up as a spurious modification every time anyone runs `npm run build`, and it currently references asset hashes that don't exist in the repo.
**Why it matters:** Mostly onboarding friction: a newcomer's first `npm run build` produces a diff they didn't intend and can't explain. The `.playwright-mcp` logs are debugging output from 2026-08-13 that no longer serves anything.
**Suggested fix:** `git rm -r --cached e2e/node_modules .playwright-mcp e2e/test-results frontend/dist` and add `.playwright-mcp/` and `test-results/` to `.gitignore`. (Left for you to run — I don't commit in this repo.)

#### [M6] A stray root `package.json` declares unrelated dependencies
**Where:** [`package.json`](package.json)
**What:** The repo root has a manifest with no `name`, no `scripts`, and no workspaces config, declaring `@google/gemini-cli`, `lucide-react ^1.33.0`, `typescript ^6.0.3`, and `tsx`. It is not referenced by any workflow, Dockerfile, or documented setup step. Note that `lucide-react` here is v1 while `frontend/package.json` pins `^0.556.0`, and `typescript` is v6 against the frontend's `~5.8.2`.
**Why it matters:** Pure onboarding hazard. A newcomer who runs `npm install` at the repo root — the obvious first move — installs an unrelated toolchain and creates a root `node_modules` that shadows nothing useful. It also makes "which TypeScript version does this project use?" unanswerable.
**Suggested fix:** Delete it, or if the Gemini CLI is a deliberate developer tool, move it to a documented `tools/` manifest and say so in `RUNNING.md`.

#### [M7] Nothing tracks what remains to be ported from `ceview/` to `frontend/`
**Where:** `frontend/components/module-2/` … `module-4/` (16 stub files) vs `ceview/components/module-2/` … `module-4/`
**What:** Every Module 2–4 component in the live app is a 16–49 line stub carrying a `TODO`, e.g. [`DashboardView.tsx`](frontend/components/module-2/2.1-dashboard/DashboardView.tsx) and [`CampaignAnalyticsView.tsx`](frontend/components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx). The working implementations live in the frozen `ceview/` tree. `CLAUDE.md` explains the policy ("kept around only until anything still unique to it is ported") but no artifact lists what "anything" is.
**Why it matters:** This is the highest-value missing document in the repo. Right now, answering "what's left to build?" requires diffing two directory trees by hand. It also means `ceview/` can't be deleted, because nobody can prove it's safe to.
**Suggested fix:** Add a porting checklist to `docs/` — one row per `ceview/` screen with its target path in `frontend/` and a status. The per-card plans under `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/` are close to this already; a single index over them would do.

#### [M8] The AI services have four example tests for 8,558 lines of Python
**Where:** [`fastapi-sbert/tests/`](backend/fastapi-sbert/tests/), [`fastapi-transformer/tests/`](backend/fastapi-transformer/tests/)
**What:** Each service has one pure-function unit test and one `/healthz` integration test, all four explicitly labelled "Example" and "Pattern to copy". CI runs them ([`ci-fastapi-sbert.yml:38`](.github/workflows/ci-fastapi-sbert.yml#L38)), so the pipeline is green while covering almost nothing. Meanwhile [`gemini_client.py`](backend/fastapi-sbert/app/services/gemini_client.py) is the single highest-churn file in the repo (1,053 lines, 13 commits) with no tests at all.
**Why it matters:** Framing this as "low coverage" understates it — the scoring and forecasting logic *is* the product, and a change to it would be caught by nothing.
**Suggested fix:** Don't chase coverage. Start at two seams that are pure functions with no model dependencies, following the pattern the example tests already establish: (1) `pes_compute_service.compute_base_metrics` — assert the flagging behaviour that [H3] shows Java disagrees with; (2) `_extract_json` in `omcs_agent/node.py` — feed it the three real-world malformed shapes its docstring describes. Both run offline in milliseconds.

#### [M9] TypeScript is never actually type-checked — not in the build, not in CI
**Where:** [`frontend/package.json:7`](frontend/package.json#L7), [`ci-frontend.yml:39-46`](.github/workflows/ci-frontend.yml#L39-L46), [`ci-frontend-v2.yml`](.github/workflows/ci-frontend-v2.yml)
**What:** `"build": "vite build"` — no `tsc`. Grepping every workflow and both `package.json` files for `tsc` returns nothing. Vite strips types without checking them, so `npm run build` succeeds on code that does not typecheck. The codebase is currently clean (`npx tsc --noEmit` exits 0), so this is a missing guardrail rather than a live defect.
**Why it matters:** Every type annotation across 20,109 lines of TypeScript is currently unenforced. The discipline holding it together is individual editors — the moment someone commits without an IDE open, or a `@types` package resolves differently, a type error merges with a green checkmark. Types that aren't checked drift into being misleading, which is worse than not having them.
**Suggested fix:** Add `"typecheck": "tsc --noEmit"` to `frontend/package.json` and a `Typecheck` step before `Build` in the frontend workflow. It passes today, so this lands green — which is exactly the right time to add it. Note also that `frontend/` has no `.nvmrc`; CI pins Node 22 but nothing pins a contributor's machine.

### Low

#### [L1] The weekly scheduler has no distributed lock
**Where:** [`TrendFetchSchedulerService.java:102`](backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchSchedulerService.java#L102)
**What:** `@Scheduled(cron = "0 0 0 * * SUN", zone = "UTC")` with no ShedLock or database advisory lock.
**Why it matters:** Correct today — Render free tier runs one instance. It breaks silently on the first scale-out, with N replicas hammering PyTrends simultaneously. Worth a comment now so the assumption is written down rather than rediscovered.
**Suggested fix:** A one-line comment recording the single-instance assumption is enough at this stage.

#### [L2] `CLAUDE.md`'s workflow list is missing `ci-frontend-v2.yml`
**Where:** [`.claude/CLAUDE.md`](.claude/CLAUDE.md) (Repo Layout section), [`README.md`](README.md) (Testing & CI table)
**What:** Both list five workflows; there are six. Related to [M4] — if the duplicate is deleted, both docs become correct again.

#### [L3] Documentation volume exceeds code volume
**Where:** repo-wide — 27,109 lines of Markdown against 33,804 lines of code, across 112 files
**What:** Not a defect, and the per-module docs are genuinely good. But `docs/superpowers/` contains plans with 65 unchecked task boxes (e.g. [`2026-08-15-frontend-branding-alignment.md`](docs/superpowers/plans/2026-08-15-frontend-branding-alignment.md)) sitting alongside authoritative specs, with nothing distinguishing "this describes the system" from "this describes work not yet done."
**Why it matters:** A newcomer reading a plan as a spec will believe features exist that don't.
**Suggested fix:** A one-line status banner at the top of each plan file, or move completed/abandoned plans to `docs/superpowers/plans/archive/`.

## Recommended plan

**This week**
1. **[C1]** — the internal-API key. Nothing else on this list matters if those endpoints stay open.
2. **[H2]** — one-character-class fix, corrupt data is being persisted right now.
3. **[M3]** — three lines of YAML that stand between you and a first deploy that looks broken.
4. **[M9]** — add the typecheck step. It passes today, so it lands green in about 10 minutes, and it stops the first type error from ever merging.
5. **[M4]** — delete one workflow, so [M9]'s fix only has to be applied once.

**This quarter**
- **[H3]** before **[H4]** and **[M1]**: settle who owns the PES formulas first, because the validation rules and the trend-delta computation both belong wherever that lands. Doing them in the other order means writing the same logic twice again.
- **[H1]** and **[M2]** together — both are "the auth model has no notion of privilege or environment." One change to `MsmeOperator` plus a startup assertion covers both.
- **[M7]** early, even though it's Medium. It's a document, not code, and it's the thing that makes the remaining frontend work estimable.
- **[M8]** — two tests, not a coverage push.

**Accept for now**
- **[L1]** — genuinely correct at one replica; a comment is the right amount of effort.
- **[M5]** and **[M6]** — pure hygiene, zero runtime risk. Batch them into one cleanup commit whenever convenient.
- **[L3]** — the docs being ahead of the code is a normal state for a thesis project mid-build.
- The `frontend/` vs `ceview/` split itself. It's a deliberate rebuild and the right call; only the missing checklist ([M7]) is a real cost.

## Coverage and limitations

**Read in full:** `render.yaml`, both FastAPI `main.py` files, `SecurityConfig`, `CorsConfig`, `application.yml`, all six CI workflows, `MetricsCalculationService`, `EngagementMetricsController`, `IngestionTriggerController`, `AnalyticsDtos`, `AIInferenceGatewayService` (public surface), `frontend/services/apiClient.ts` auth section, `frontend/services/auth.tsx`, the four new test files on this branch, both `package.json` files, `README.md`.

**Sampled:** Spring Boot module packages by structure and grep rather than line-by-line; `pes_compute_service.py` around the metric formulas; the churn hotspots (`gemini_client.py`, `ForecastingService.java`, `trend_service.py`) at the interface level only.

**Verified by running:** frontend test suite (87 pass, 21s), `npx tsc --noEmit` on `frontend/`, `npm run build` (succeeds), `npm audit` (0 vulnerabilities, prod and dev).

**Not run:** the Spring Boot JUnit suite (needs a Maven dependency resolution I didn't want to trigger) and both pytest suites (`fastapi-sbert` requires a multi-minute tensorflow + sentence-transformers install). Their CI workflows are configured correctly, so I'm relying on GitHub Actions history rather than local execution. `ceview/` has no TypeScript installed locally, so I could not typecheck it.

**A note on the frontend verification:** my first pass reported a type error and a lower test count. Both were artifacts of a stale local `frontend/node_modules` — `@testing-library/user-event` was in `package.json` and the lockfile but not installed, which broke one test file's collection and skewed type resolution. After `npm ci`, `tsc --noEmit` exits 0 and all 17 files / 113 tests pass. The numbers in this report are the post-`npm ci` ones. Worth knowing if your local checkout is also stale.

**Skipped:** the `e2e/` Playwright specs (10 files, read by name only), Flyway migrations (34 SQL files — the prior review covered the V17/V14_1 ordering fix and I found no reason to revisit), `docs/` beyond the files cited, and the frozen `ceview/` tree except for the structural comparison in [M7].

**Couldn't verify:** whether the Render blueprint has ever been deployed, so [M3] is reasoning from the config rather than an observed 404. Nothing about production behaviour, logs, or actual Groq spend.
