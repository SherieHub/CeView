# Codebase Review: CeView

**Reviewed:** 2026-08-21 · **Commit:** `aad22f0` (branch `feat/assets-and-links`) · **Scope:** Full stack — Spring Boot orchestration API, both FastAPI AI services, `frontend/`, CI, and deployment config. The frozen `ceview/` build and the `docs/` tree were mapped but not reviewed in depth.

## Summary

CeView is a four-module tourism-demand and AI-marketing platform for Cebu MSMEs, built as a React frontend over a Spring Boot orchestrator that fans out to two Python AI microservices. The **authentication and multi-tenancy work is genuinely good** — `CurrentBusinessProfile.resolveOrValidate` is a clean pattern and Modules 2 and 3 apply it consistently. The problems are concentrated elsewhere: the two FastAPI services have **no authentication at all** and `render.yaml` publishes them as public web services; the frontend **production build is broken on this branch** and CI doesn't run here to catch it; and Module 4's analytics, PES score, and AI-generated report are computed from **hardcoded demo constants** rather than the operator's data.

The single most important thing to do next is put an auth check in front of the FastAPI `/internal/*` routes before anything else deploys — right now anyone who finds those URLs can spend your Groq budget, and `fastapi-sbert` holds a `DATABASE_URL`.

Much of what looks broken in Modules 2–4 of `frontend/` is deliberate work-in-progress (the components are TODO stubs, per `CLAUDE.md`). I've flagged those as deployment-readiness risks rather than defects, but they need a decision before the Render blueprint is used.

**Snapshot**

| | |
|---|---|
| Size | ~750 source files, ~33,000 lines of code (14,109 files tracked — see [M8](#m8)) |
| Stack | React 19 + TS + Vite · Spring Boot 3.3.4 / Java 21 · FastAPI ×2 / Python 3.12 · PostgreSQL 16 + pgvector |
| Tests | 4,215 test lines, ratio 0.13. Frontend: **77 pass**. Spring Boot: 16 files, not run locally. FastAPI: **4 example tests** for 8,558 lines. |
| Findings | **1 critical · 7 high · 15 medium · 7 low** |

## What's working well

Worth protecting during any refactor:

- **The tenant-scoping pattern.** [`CurrentBusinessProfile.java:101-108`](backend/spring-boot/src/main/java/com/ceview/auth/CurrentBusinessProfile.java#L101-L108) derives the profile id from the JWT and rejects a mismatched client-supplied one with a 403 rather than silently substituting. Modules 2 and 3 use it at every entry point — [`ForecastingController.java:46`](backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java#L46), [`:67`](backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java#L67), [`:87`](backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java#L87), [`NotificationController.java:32`](backend/spring-boot/src/main/java/com/ceview/module2/NotificationController.java#L32), [`ContentController.java:62`](backend/spring-boot/src/main/java/com/ceview/module3/ContentController.java#L62), [`:82`](backend/spring-boot/src/main/java/com/ceview/module3/ContentController.java#L82). This is the right design and it's applied with discipline.
- **No SQL injection anywhere.** I grepped every raw-SQL and query construction site. [`embedding_store.py:61-78`](backend/fastapi-sbert/app/services/embedding_store.py#L61-L78) and [`:110-127`](backend/fastapi-sbert/app/services/embedding_store.py#L110-L127) use parameter binding correctly; the only two `@Query` annotations in the Java tree are JPQL with named parameters.
- **Server-side enforcement of the profile-completion gate.** [`ProfileCompletionFilter.java`](backend/spring-boot/src/main/java/com/ceview/auth/ProfileCompletionFilter.java) exists specifically so the requirement can't be bypassed by calling the API directly. That instinct — not trusting the frontend's redirect — is exactly right.
- **Derived rather than stored state.** [`MsmeOperator.isProfileCompleted()`](backend/spring-boot/src/main/java/com/ceview/auth/MsmeOperator.java#L39-L41) computes from `contactNumber` instead of a duplicate column, with the reasoning written down in [`V19__auth_google_identity.sql:2-4`](backend/spring-boot/src/main/resources/db/migration/V19__auth_google_identity.sql#L2-L4).
- **Comment quality is unusually high.** Non-obvious decisions carry their reasoning — the 90 s rank-markets timeout, the Node 22 pin in CI, the H2 migration split. This made the review substantially faster and will do the same for new contributors.

## Architecture overview

Four product modules, each spanning frontend → Spring Boot → one or both FastAPI services.

A request flows: React (`frontend/services/apiClient.ts`) → `Authorization: Bearer <JWT>` → Spring Boot filter chain ([`JwtAuthenticationFilter`](backend/spring-boot/src/main/java/com/ceview/auth/JwtAuthenticationFilter.java) → [`ProfileCompletionFilter`](backend/spring-boot/src/main/java/com/ceview/auth/ProfileCompletionFilter.java)) → a `@RestController` under `/api/v1/*` → tenant scoping via `CurrentBusinessProfile` → either JPA against Postgres or [`AIInferenceGatewayService`](backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java), which is the sole bridge to the two Python services. Every AI call is a blocking `.block(timeout)` wrapped in a caller-side try/catch that falls back to deterministic local logic.

The two Python services are pure compute: `fastapi-sbert` (E5 embeddings, Keras classifier, LangGraph content/creative/report agents, Groq) and `fastapi-transformer` (PyTrends ingestion, XGBoost, Groq forecasting). Both expose `/internal/*` routes intended for Spring Boot only. `fastapi-sbert` additionally holds its own `DATABASE_URL` for the pgvector embedding corpus.

The critical structural assumption is that `/internal/*` is unreachable from outside. That assumption is not enforced anywhere, and `render.yaml` breaks it.

---

## Findings

### Critical

#### <a name="c1"></a>[C1] FastAPI `/internal/*` routes have no authentication and are deployed publicly

**Where:** [`backend/fastapi-sbert/app/main.py:43-50`](backend/fastapi-sbert/app/main.py#L43-L50), [`backend/fastapi-transformer/app/main.py:48-50`](backend/fastapi-transformer/app/main.py#L48-L50), and [`render.yaml:47-73`](render.yaml#L47-L73)

**What:** Neither service has any authentication, API-key check, or `Depends()` guard on any route — the only middleware installed is `TraceIdMiddleware`. I grepped both `app/` trees for `Depends(`, `HTTPBearer`, `Security(`, and `Authorization`; the only matches are log strings and a commented-out line in `creative_director_agent/tools.py:15`. Meanwhile `render.yaml` declares both as `type: web`, which gives each a public `onrender.com` hostname.

**Why it matters:** Anyone who discovers the hostnames can call `/internal/content/generate`, `/internal/report/generate`, `/internal/omcs/analyze`, and `/internal/forecasting/*` without credentials. Concretely: unmetered spending against your `GROQ_API_KEY`, unmetered PyTrends/SerpAPI usage, and free access to the LangGraph agents. `fastapi-sbert` also receives `DATABASE_URL` (the full Postgres connection string) and exposes `/internal/classification/uniqueness`, which reads the entire embedding corpus — so an unauthenticated caller can enumerate how many businesses are in the system. FastAPI also serves `/docs` and `/openapi.json` by default, which hands an attacker the complete route list.

**Suggested fix:** Two changes, both small:
1. Add a shared-secret dependency to both services and send it from `WebClientConfig`:
   ```python
   # app/security.py
   from fastapi import Header, HTTPException
   import hmac, os
   _TOKEN = os.environ["INTERNAL_API_TOKEN"]

   def require_internal_token(x_internal_token: str = Header(...)):
       if not hmac.compare_digest(x_internal_token, _TOKEN):
           raise HTTPException(status_code=401, detail="unauthorized")
   ```
   then `app.include_router(content.router, prefix=..., dependencies=[Depends(require_internal_token)])` for every `/internal/*` router, and add `INTERNAL_API_TOKEN` to `render.yaml` with `generateValue: true` on the Spring service and `sync: false` on the two Python ones.
2. Disable the public schema in production: `FastAPI(..., docs_url=None, redoc_url=None, openapi_url=None)`.

If Render offers private services on your plan, switching both from `type: web` to a private service is a stronger fix and should be done as well — but do the token first, since it protects you regardless of hosting.

---

### High

#### <a name="h1"></a>[H1] The frontend production build is broken on this branch

**Where:** [`frontend/App.tsx:6`](frontend/App.tsx#L6) and [`frontend/App.tsx:12-13`](frontend/App.tsx#L12-L13)

**What:** `OnboardingWizard` is imported twice (lines 6 and 13), and line 12 imports `DEMO_OB_DRAFT` from `obDraft`, which doesn't export it — [`obDraft.tsx`](frontend/components/module-1/onboarding/obDraft.tsx) exports `EMPTY_DRAFT`, not `DEMO_OB_DRAFT`. Line 33 also passes an `initial` prop that `ObDraftProvider` doesn't accept. I ran it with a clean working tree and freshly installed dependencies:

```
$ npm run build
✗ Build failed in 1.75s
Duplicate declaration "OnboardingWizard"
$ npx tsc --noEmit
App.tsx(6,8): error TS2300: Duplicate identifier 'OnboardingWizard'.
App.tsx(12,27): error TS2305: Module './components/module-1/onboarding/obDraft' has no exported member 'DEMO_OB_DRAFT'.
App.tsx(33,28): error TS2322: Property 'initial' does not exist ...
services/auth.tsx(74,18): error TS2345: Type 'null' is not assignable to type 'string'.
```

This has the shape of a bad merge — `aad22f0` is a merge commit, and the duplicate import is the classic both-sides-added conflict resolution.

**Why it matters:** `render.yaml:75-79` builds the frontend with `cd frontend && npm install && npm run build`, so a deploy from this branch fails outright. The 77 passing Vitest tests don't catch it because none of them import `App.tsx`.

**Suggested fix:** Delete line 13, and make lines 12/33 consistent with what `obDraft` actually exports — either rename `EMPTY_DRAFT` usage in, or add the `DEMO_OB_DRAFT` constant and the `initial` prop. Separately fix `auth.tsx:74` by widening `AuthUser.email` to `string | null` (the fixture branch at `apiClient.ts:153` legitimately returns `null`).

#### <a name="h2"></a>[H2] CI doesn't run on this branch, which is why H1 went unnoticed

**Where:** [`.github/workflows/ci-frontend.yml:5`](.github/workflows/ci-frontend.yml#L5) and [`:10`](.github/workflows/ci-frontend.yml#L10) — and the same filter in all five other workflows

**What:** Every workflow triggers only on `branches: [main, task_allocation, ph1-dev]`. The current branch is `feat/assets-and-links`, so no CI has run against it.

**Why it matters:** Feature branches get zero automated feedback until they target one of three named branches. A broken build can live on a branch indefinitely and only surfaces at merge time, which is the worst moment to find it. `task_allocation` also appears to be a stale branch name still carried in the filters.

**Suggested fix:** Change the `pull_request` triggers to fire on PRs into `main`/`ph1-dev` regardless of source branch (that's the default when you list target branches — but push triggers should broaden too). Simplest correct version:
```yaml
on:
  push:
    branches: [main, ph1-dev]
  pull_request:              # any source branch, targeting anything
```
Also add `npx tsc --noEmit` as a CI step — `vite build` happened to catch the duplicate identifier, but it would not have caught the `auth.tsx:74` type error.

#### <a name="h3"></a>[H3] Module 4's metrics, PES score, and AI report are computed from hardcoded demo constants

**Where:** [`MetricsCalculationService.java:64-70`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L64-L70)

**What:** `defaultMetrics(weeks)` returns fixed numbers — 150,000 impressions, 7,200 clicks, ₱5,000 spend, ₱16,000 revenue — scaled ×2 when `weeks == 8`. It never touches `CampaignRecordRepository`. Four endpoints build on it: `GET /api/v1/analytics/metrics` ([`EngagementMetricsController.java:65`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java#L65)), `POST /report` ([`PrescriptiveReportController.java:66`](backend/spring-boot/src/main/java/com/ceview/module4/report/PrescriptiveReportController.java#L66)), `POST /pes-analysis` ([`:103`](backend/spring-boot/src/main/java/com/ceview/module4/report/PrescriptiveReportController.java#L103)), and `GET /pes/{campaignId}`.

`GET /pes/{campaignId}` is the sharpest case — [`PesComputationController.java:36-41`](backend/spring-boot/src/main/java/com/ceview/module4/pes/PesComputationController.java#L36-L41) accepts `campaignId` as a path variable and then never uses it:
```java
public PesResponse pes(@PathVariable String campaignId, @RequestParam ... int weeks) {
    return pesSvc.compute(metricsSvc.defaultMetrics(weeks).metrics());
}
```

Separately, the trend deltas in `compute()` are hardcoded literals — `1.2, -0.05, 0.4, -0.5, 5.0` at [`:37-41`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L37-L41) — so even on the `/manual` path, where real operator-entered numbers *are* used and persisted, the up/down arrows next to each KPI are fiction.

**Why it matters:** Every operator sees identical KPIs, an identical PES score, and an AI-generated "prescriptive report" that reads as personalised analysis of their campaign. The product's stated purpose is telling an MSME owner what to do about their marketing performance. Shipping confident, specific, fabricated advice is worse than shipping nothing, and an operator has no way to tell the difference. `POST /manual` and `GET /history` are the two endpoints that do use real data ([`:26`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java#L94), [`:80-82`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java#L149-L151)) — the pattern exists, it just isn't applied.

**Suggested fix:** Read from `campaignRepo` scoped to `currentBusinessProfile.resolveProfileId()`, the way `/history` already does. Have `/pes/{campaignId}` load that campaign and 403 if it belongs to another profile. Compute deltas from the previous period's record, and return `null` (rendered as "—") when there's no prior period rather than a made-up number. Until that lands, these four endpoints should return `409` with a "no campaign data yet" code rather than demo values.

#### <a name="h4"></a>[H4] A database failure silently turns every uniqueness score into a perfect 100

**Where:** [`embedding_store.py:156-162`](backend/fastapi-sbert/app/services/embedding_store.py#L156-L162) feeding [`classification.py:50-56`](backend/fastapi-sbert/app/routers/classification.py#L50-L56)

**What:** `fetch_others()` catches every exception, logs a warning, and returns `[]`. The caller treats an empty corpus as a legitimate result:
```python
other_embeddings = embedding_store.fetch_others(req.businessProfileId)
semantic_score = ml_classifier.compute_semantic_uniqueness(..., other_embeddings)
# Corpus too small (< 3 businesses) → trivially unique, score 100
final_semantic_score = semantic_score if semantic_score is not None else 100.0
```

**Why it matters:** "Postgres is unreachable" and "you are the first three businesses in Cebu" produce byte-identical responses. A transient DB blip during onboarding gives the operator a 100/100 semantic uniqueness score, which is then averaged into `overallScore` at [`:64`](backend/fastapi-sbert/app/routers/classification.py#L64) and persisted to their profile. The failure mode flatters the user, so nobody reports it — and Module 1's uniqueness score is an input to Module 3's content generation, so the error propagates.

**Suggested fix:** Distinguish the two cases. Let `fetch_others` raise on a genuine DB error (keep returning `[]` only for the `RuntimeError` "DATABASE_URL not set" dev path), and have the router return a `503` with a `MOD1_CORPUS_UNAVAILABLE` code. If a degraded score must be returned, mark it — add `"semanticsScoreConfidence": "unavailable"` to the response and have the UI say so rather than showing 100.

#### <a name="h5"></a>[H5] 14 of 19 frontend API paths don't exist on the backend, and fixtures default to off

**Where:** [`frontend/services/apiClient.ts:19`](frontend/services/apiClient.ts#L19) and the endpoint list at [`:79-130`](frontend/services/apiClient.ts#L79-L130)

**What:** `USE_FIXTURES` is `import.meta.env.VITE_USE_FIXTURES === 'true'` — off unless explicitly enabled, and `render.yaml:75-83` doesn't set it. The non-fixture branches call paths that have no corresponding Spring Boot route. Backend prefixes are `/api/v1/auth`, `/api/v1/business-profile`, `/api/v1/classification`, `/api/v1/forecasting`, `/api/v1/notifications`, `/api/v1/content`, `/api/v1/creative-direction`, `/api/v1/compliance`, `/api/v1/analytics`, `/api/v1/admin/ingestion`. The client calls:

| Frontend calls | Backend has |
|---|---|
| `/api/markets`, `/api/markets/{id}/chart`, `/api/markets/category-scores` | nothing (closest: `/api/v1/forecasting`) |
| `/api/notifications` | `/api/v1/notifications` — missing `/v1` |
| `/api/content` | `/api/v1/content` — missing `/v1` |
| `/api/campaigns/history`, `/api/campaigns/report`, `/api/campaigns/default-input` | `/api/v1/analytics/*` |
| `/api/omcs/rubric`, `/api/omcs/evaluate` | nothing |
| `/api/posts`, `/api/posts/{id}/metrics` | nothing |
| `/api/connections/*` | nothing |
| `/api/workspace/members`, `/api/workspace/invite` | nothing |

Only `/api/v1/auth/*` and `/api/v1/business-profile` line up.

**Why it matters:** A production deploy from `render.yaml` gives you an app where login works and everything else 404s. I recognise from `CLAUDE.md` that Modules 2–4 in `frontend/` are intentionally unbuilt stubs, so this is expected mid-rebuild — but the deploy config doesn't know that, and `README.md` describes the app as fully wired. The mismatch is worth resolving deliberately rather than discovering it on Render.

**Suggested fix:** Set `VITE_USE_FIXTURES=true` in `render.yaml` explicitly while the rebuild is in progress, so the deployed app is honestly a demo rather than a broken one. Fix the two that are pure prefix typos now (`/api/notifications` → `/api/v1/notifications`, `/api/content` → `/api/v1/content`). Consider centralising the prefix as a constant so it can't drift again.

#### <a name="h6"></a>[H6] Expired JWTs strand the user in a broken authenticated shell

**Where:** [`frontend/services/auth.tsx:34-37`](frontend/services/auth.tsx#L34-L37) and [`:96`](frontend/services/auth.tsx#L96), with [`apiClient.ts:37-39`](frontend/services/apiClient.ts#L37-L39)

**What:** `isAuthenticated` is `!!user`, and `user` is set purely from the *presence* of a token in localStorage — the JWT's `exp` claim is never decoded or checked. `apiClient.request` throws a bare `Error` on any non-OK response and has no 401 branch. Tokens expire after 24 hours ([`application.yml:36`](backend/spring-boot/src/main/resources/application.yml#L36)).

**Why it matters:** A user who returns the next day is routed straight past `AuthGate` into the app, then every single API call throws `Request to /api/... failed with 401`. There's no logout, no redirect to `/login`, no error banner explaining it. The only escape is manually clearing localStorage — which an MSME owner will not do. They will conclude the product is broken.

**Suggested fix:** In `request()`, on `res.status === 401`, call `clearTokens()` and redirect to `/login`. Additionally decode `exp` in `hydrateUser()` and treat an expired token as no token, so the app doesn't render a doomed authenticated shell for even one frame.

#### <a name="h7"></a>[H7] Any authenticated operator can trigger the full live ingestion job

**Where:** [`IngestionTriggerController.java:24-31`](backend/spring-boot/src/main/java/com/ceview/module2/submodule21/IngestionTriggerController.java#L24-L31)

**What:** `POST /api/v1/admin/ingestion/trigger` runs `ingestionJob.runDailyIngestion()` synchronously. It's `authenticated()` via the catch-all rule in [`SecurityConfig.java:40`](backend/spring-boot/src/main/java/com/ceview/config/SecurityConfig.java#L40), but there is no role or ownership check — and there are no roles in the system at all: [`JwtAuthenticationFilter.java:31`](backend/spring-boot/src/main/java/com/ceview/auth/JwtAuthenticationFilter.java#L31) builds every principal with `List.of()` authorities. The `/admin/` path segment is naming convention only. The class doc calls it a "Dev/test endpoint".

**Why it matters:** Any of the 9 seeded demo accounts — or any self-registered user — can invoke the nightly ingestion on demand, repeatedly. That job makes live PyTrends, World Bank, and forex calls. Consequences run from rate-limit bans on shared upstream APIs to a trivial denial of service, since each call ties up a request thread for a long time (see [M6](#m6)).

**Suggested fix:** Gate it. Cheapest correct version is a config flag — bind it to `ceview.ingestion.trigger-enabled` defaulting to `false` and 404 when disabled, so it stays available in dev and vanishes in production. Better: add a `role` column to `tbl_msme_operator`, populate authorities in `JwtAuthenticationFilter`, and require `hasRole('ADMIN')`.

#### <a name="h8"></a>[H8] 8,558 lines of Python AI and scoring logic have four example tests

**Where:** [`backend/fastapi-sbert/tests/`](backend/fastapi-sbert/tests/) and [`backend/fastapi-transformer/tests/`](backend/fastapi-transformer/tests/)

**What:** Each service has exactly two test files: a `test_healthz.py` and a `test_example_unit.py`. Both are explicitly scaffolding — their docstrings read *"Example pure unit test… Pattern to copy"*. Between them they cover `compute_pes`, `compute_base_metrics`, and `validate`. Nothing covers `gemini_client.py` (1,053 lines), `trend_service.py` (708), `gemini_forecaster.py` (467), `ml_classifier.py` (282), any of the three LangGraph agents, or `embedding_store.py`.

**Why it matters:** This is where the scoring formulas from `ARCHITECTURE_SPEC.md` actually live, and it's the highest-churn code in the repo — `gemini_client.py` has 13 commits, `ForecastingService.java` has 11. Churn × zero coverage is precisely where regressions hide. The CI job runs `pytest tests/ -v` and goes green regardless, which makes the green check actively misleading. It's also why [H4](#h4) was never caught.

**Suggested fix:** Don't chase coverage percentage. Start with the seams that are pure functions and don't need models loaded — the same pattern the example tests already demonstrate. Highest value first: `embedding_store.fetch_others` error paths (would have caught H4), the XGBoost scoring and forecast-validation math, and `gemini_client`'s fallback branches with `GROQ_API_KEY` unset (already deterministic by design — [`gemini_client.py:25-42`](backend/fastapi-sbert/app/services/gemini_client.py#L25-L42) — so they're cheap to assert on).

---

### Medium

#### <a name="m1"></a>[M1] psycopg2 connections leak whenever a query fails

**Where:** [`embedding_store.py:56-89`](backend/fastapi-sbert/app/services/embedding_store.py#L56-L89) and [`:106-162`](backend/fastapi-sbert/app/services/embedding_store.py#L106-L162)

**What:** Both functions open a connection, then rely on reaching `conn.close()` at the end of the happy path. There's no `try/finally` and no context manager, so any exception raised by `cur.execute()`, `conn.commit()`, or `fetchall()` skips the close entirely — the `except` block only logs.

**Why it matters:** Each failed uniqueness or embedding call permanently burns a Postgres connection. Because the errors are swallowed ([H4](#h4)), the service keeps serving requests and keeps leaking until Postgres refuses new connections — at which point *every* service sharing that database, including Spring Boot, starts failing. On Render's free Postgres tier the connection ceiling is low enough to reach quickly.

**Suggested fix:** Use context managers, which handle both commit/rollback and close:
```python
with _connect() as conn, conn.cursor() as cur:
    cur.execute(...)
```
While you're there, a module-level `psycopg2.pool.ThreadedConnectionPool` would remove the per-call connection setup cost too.

#### <a name="m2"></a>[M2] JWT secret has a working insecure default

**Where:** [`application.yml:35`](backend/spring-boot/src/main/resources/application.yml#L35), also [`docker-compose.yml:67`](backend/docker-compose.yml#L67)

**What:** `secret: ${JWT_SECRET:dev-secret-change-me-please-32chars-min}` — the fallback is exactly 32 characters, so `Keys.hmacShaKeyFor` accepts it and the app boots normally with a publicly-known signing key.

**Why it matters:** If `JWT_SECRET` is ever unset or misspelled in a deployed environment, the app starts successfully and silently signs tokens with a secret published in this repo. Anyone can then forge a JWT for any operator UUID and read that tenant's data. `render.yaml:44-45` does use `generateValue: true`, so the blueprint path is safe — but the failure is silent for every other path, and silence is the problem.

**Suggested fix:** Remove the default so the app refuses to start without it: `secret: ${JWT_SECRET}`. A missing required secret should be a startup crash, not a downgrade.

#### <a name="m3"></a>[M3] A JWT stays valid after its operator is deleted; there's no revocation

**Where:** [`JwtAuthenticationFilter.java:28-36`](backend/spring-boot/src/main/java/com/ceview/auth/JwtAuthenticationFilter.java#L28-L36), confirmed by [`SecurityLockdownVerificationTest.java:55-59`](backend/spring-boot/src/test/java/com/ceview/security/SecurityLockdownVerificationTest.java#L55-L59)

**What:** The filter validates the signature and expiry, then authenticates — it never checks the operator still exists. `ProfileCompletionFilter.java:171-172` looks the operator up but explicitly passes through when absent (`op.isPresent() && !op.get().isProfileCompleted()`). The existing test proves this: it issues a token for `UUID.randomUUID()` — an operator that has never existed — and asserts a **200**.

**Why it matters:** There is no logout-everywhere, no way to revoke a leaked token, and deleting an operator row doesn't cut off their access. Their token keeps working for up to 24 hours. Combined with [M4](#m4) (tokens in localStorage, exfiltratable via XSS), there's no incident response available beyond rotating `JWT_SECRET` and logging out every user simultaneously.

**Suggested fix:** Short term, have the filter reject when `repo.findById(subject)` is empty. Longer term, add a `token_version` integer on the operator, embed it as a claim, and reject on mismatch — that gives you per-user revocation for a single column and one comparison.

#### <a name="m4"></a>[M4] Registration accepts any non-empty password

**Where:** [`AuthController.java:46`](backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java#L46)

**What:** `@NotBlank String password` is the only constraint. `"a"` is a valid password. There's no length floor, no complexity requirement, no breach-list check, and no rate limiting on `POST /login`.

**Why it matters:** Single-character passwords on accounts that own a business's marketing data and can spend against connected ad platforms. With no login rate limiting, brute-forcing a weak password is trivial. BCrypt protects the stored hash, not a guessable input.

**Suggested fix:** Add `@Size(min = 12)` at minimum. Add rate limiting on `/login` — Bucket4j or a simple per-IP counter in the filter chain. Consider checking candidates against the Have I Been Pwned k-anonymity API on registration.

#### <a name="m5"></a>[M5] Downstream error bodies are echoed to API clients

**Where:** [`ApiExceptionHandler.java:30-34`](backend/spring-boot/src/main/java/com/ceview/common/ApiExceptionHandler.java#L30-L34), [`:37-41`](backend/spring-boot/src/main/java/com/ceview/common/ApiExceptionHandler.java#L37-L41), [`:25-28`](backend/spring-boot/src/main/java/com/ceview/common/ApiExceptionHandler.java#L25-L28)

**What:** Three handlers put `e.getMessage()` straight into the response. For `WebClientResponseException` that message contains the downstream status line and a prefix of the FastAPI response body. For `WebClientRequestException` it contains the connection failure — including the internal hostname and port. For `MethodArgumentNotValidException` it's Spring's verbose internal `toString`, listing DTO class names and field paths.

**Why it matters:** A client calling a Module 3 endpoint while `fastapi-sbert` is down receives something like `Connection refused: fastapi/172.18.0.4:8000` — internal service names, container IPs, and topology, handed to any authenticated user. It's also poor UX: the frontend has nothing user-presentable to show.

**Suggested fix:** Log the full exception server-side keyed by `traceId` (the plumbing already exists), and return only the stable `error`/`code`/`traceId` triple to the client. For validation, map `e.getBindingResult()` into a `{field: message}` map instead of dumping `getMessage()`.

#### <a name="m6"></a>[M6] Long blocking AI calls occupy request threads

**Where:** [`AIInferenceGatewayService.java:83-88`](backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java#L83-L88), with the timeouts at [`application.yml:30-33`](backend/spring-boot/src/main/resources/application.yml#L30-L33)

**What:** Every AI call is `.block(timeout)` on the Tomcat request thread. `rankMarketsForCategory` blocks for up to **90 seconds** by design (PyTrends does 6 batches with 4–12 s jitter each); everything else blocks up to 30.

**Why it matters:** Tomcat's default pool is 200 threads. 200 concurrent rank-markets calls exhaust it and the whole API — including `/login` and `/actuator/health` — stops responding. Render's health check then fails and the service is restarted mid-request. Given [H7](#h7) lets any user trigger long-running work on demand, this is a one-line denial of service.

**Suggested fix:** Since `spring-boot-starter-webflux` is already a dependency, the cheapest fix is returning `Mono<T>`/`CompletableFuture<T>` from the controller so Servlet async releases the thread while waiting. Failing that, make rank-markets a job: return `202 Accepted` with a job id and let the client poll. At minimum, bound concurrency with a semaphore so long calls can't consume the entire pool.

#### <a name="m7"></a>[M7] CTR and CPC guard on the wrong variable, producing 9.2 × 10¹⁷ metrics

**Where:** [`MetricsCalculationService.java:30-31`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L30-L31)

**What:**
```java
double ctr = clicks == 0 ? 0 : (double) clicks / impressions * 100.0;
double cpc = clicks == 0 ? 0 : adSpend / clicks;
```
CTR guards `clicks` but divides by `impressions`. With `impressions = 0, clicks = 5` the result is `Infinity`, and `round()` at [`:173-176`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L173-L176) turns that into `Long.MAX_VALUE / 10.0` = **922,337,203,685,477.6**. (CPC's guard is correct; only CTR is mismatched.) `convRate` at [`:32`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/MetricsCalculationService.java#L32) is correct too.

**Why it matters:** `POST /manual` accepts operator-entered numbers with no `@Valid` and no constraints, so this is reachable by typing 0 impressions and any nonzero clicks — a plausible typo. The garbage value is displayed as a KPI *and* persisted via `enrichWithKpis` at [`EngagementMetricsController.java:96-102`](backend/spring-boot/src/main/java/com/ceview/module4/engagement/EngagementMetricsController.java#L96-L102), permanently corrupting that operator's history chart. Negative inputs are accepted too.

**Suggested fix:** `double ctr = impressions == 0 ? 0 : (double) clicks / impressions * 100.0;`. Add `@Valid` to the `/manual` handler and `@PositiveOrZero` to every numeric field on `ManualIngestRequest`. A record with `clicks > impressions` should be rejected as incoherent rather than stored.

#### <a name="m8"></a>[M8] 13,225 of 14,109 tracked files are build artifacts

**Where:** [`.gitignore`](.gitignore) — the entire file is one line, `backend/.env`

**What:** Committed to the repo: `node_modules` in four locations (root, `ceview/`, `e2e/`, plus nested copies) totalling 13,225 files; 126 `__pycache__/*.pyc` files; `frontend/dist/`; and three runtime logs — `backend/spring-boot/spring-run.log`, `spring.err`, `spring.log`. `.git` is 111 MB. Roughly 750 files are actual source.

**Why it matters:** Slow clones and slow CI checkouts; `git status` and `git log --stat` are noisy enough to hide real changes; committed `.pyc` files can shadow edited source and produce "impossible" debugging sessions. Committed `dist/` means a stale build can be served if anything deploys from the checkout. The `.log` files should be checked for leaked credentials — I did not open them, since a review shouldn't echo secrets, but you should.

**Suggested fix:** Write a real `.gitignore` (`node_modules/`, `__pycache__/`, `*.pyc`, `dist/`, `target/`, `*.log`, `.env`), then `git rm -r --cached` each tree. Note this rewrites nothing — the history stays 111 MB — so if you want the size back you'd need `git filter-repo`, which is a coordinated operation across the team and probably not worth it right now.

#### <a name="m9"></a>[M9] Dependencies are stale, unpinned, and unscanned

**Where:** [`pom.xml:8`](backend/spring-boot/pom.xml#L8), [`fastapi-sbert/requirements.txt`](backend/fastapi-sbert/requirements.txt), [`fastapi-transformer/requirements.txt`](backend/fastapi-transformer/requirements.txt)

**What:** Spring Boot is pinned to **3.3.4**, released September 2024 — roughly two years old as of this review, and past its OSS support window. Every Python dependency is an open-ended `>=` with no lockfile and no hashes; the only upper bound in either file is `numpy<2.0`. No workflow runs `dependabot`, `pip-audit`, `npm audit`, or an OWASP dependency check — I checked all six.

**Why it matters:** Two separate problems. The stale pin means you're missing two years of Spring Framework and Tomcat security patches. The unpinned Python means two CI runs a week apart can install different versions of `langgraph`, `transformers`, or `openai` — so a build can break, or subtly change AI behaviour, with no commit to blame. `pip install --no-cache-dir -r requirements.txt` in both Dockerfiles resolves fresh on every image build.

**Suggested fix:** Bump `spring-boot-starter-parent` to the current 3.3.x or 3.4.x patch and read the release notes for breaking changes. Generate `requirements.lock` with `pip-compile` (or switch to `uv`) and install from the lock in Docker and CI. Enable Dependabot — it's a single `.github/dependabot.yml` covering Maven, npm, and pip.

#### <a name="m10"></a>[M10] Google sign-in can 500 on an unverified email that matches an existing account

**Where:** [`AuthController.java:103-121`](backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java#L103-L121)

**What:** When no operator matches the Google UID, the linking branch requires `decoded.isEmailVerified() && email != null`. If the email is *not* verified, control falls through to `repo.save(o)` with an email that may already exist — and `email` is `UNIQUE` in both the entity ([`MsmeOperator.java:20`](backend/spring-boot/src/main/java/com/ceview/auth/MsmeOperator.java#L20)) and the schema ([`V1__init_schema.sql:9`](backend/spring-boot/src/main/resources/db/migration/V1__init_schema.sql#L9)).

**Why it matters:** The insert throws `DataIntegrityViolationException`, which `ApiExceptionHandler` has no handler for — there's no catch-all `@ExceptionHandler(Exception.class)` — so it falls through to Spring's default error path as a bare 500. The user sees a generic failure with no explanation and no route forward.

**Suggested fix:** Handle the collision explicitly: return `409` with a message directing them to sign in with their password and link Google from settings. (Refusing to auto-link on an unverified email is the right call — don't relax that.) Separately, add a catch-all handler so no unmapped exception ever reaches Spring's default error page.

#### <a name="m11"></a>[M11] Multi-tenant isolation is a headline claim with no test

**Where:** [`SecurityLockdownVerificationTest.java`](backend/spring-boot/src/test/java/com/ceview/security/SecurityLockdownVerificationTest.java)

**What:** The security test covers the *authentication* boundary well — public routes, missing token, garbage token, valid token. No test anywhere covers the *authorization* boundary: no test issues a token for operator A and asserts that requesting operator B's `profileId` returns 403. `CurrentBusinessProfileTest` exists but unit-tests the resolver in isolation, not the controllers that call it.

**Why it matters:** `README.md` and `CLAUDE.md` both state that data is isolated per operator. The implementation is correct today (see What's working well), but nothing stops the next controller from omitting `resolveOrValidate` — [`PesComputationController`](backend/spring-boot/src/main/java/com/ceview/module4/pes/PesComputationController.java) and [`UniquenessScoringController`](backend/spring-boot/src/main/java/com/ceview/module1/uniquenessscoring/UniquenessScoringController.java) already do. The property most load-bearing for a multi-tenant product is the one property with no regression test.

**Suggested fix:** Add a cross-tenant test class: seed two operators with profiles, then for every `profileId`-accepting endpoint assert that A's token requesting B's id returns 403. That's a table-driven test over a route list, and it fails loudly the moment someone adds an unscoped controller.

#### <a name="m12"></a>[M12] `UniquenessScoringController` forwards a client-supplied profile id unvalidated

**Where:** [`UniquenessScoringController.java:19-28`](backend/spring-boot/src/main/java/com/ceview/module1/uniquenessscoring/UniquenessScoringController.java#L19-L28)

**What:** It takes `req.businessProfileId()` from the request body and passes it to `ai.computeUniqueness()` without touching `CurrentBusinessProfile`. Downstream, that value becomes the `exclude_profile_id` in [`fetch_others`](backend/fastapi-sbert/app/services/embedding_store.py#L92).

**Why it matters:** Lower impact than it first appears — the parameter only *excludes* a row from the comparison corpus, so the worst a caller can do is exclude someone else's embedding or include their own, skewing their own score. It's not a data read of another tenant. But it's an unvalidated cross-tenant identifier on a path where every sibling controller validates, which makes it a latent trap if the parameter's meaning ever widens.

**Suggested fix:** `UUID resolved = currentBusinessProfile.resolveOrValidate(req.businessProfileId());` — one line, consistent with Modules 2 and 3.

#### <a name="m13"></a>[M13] `ci-frontend.yml` and `ci-frontend-v2.yml` are duplicates

**Where:** [`.github/workflows/ci-frontend.yml`](.github/workflows/ci-frontend.yml) and [`.github/workflows/ci-frontend-v2.yml`](.github/workflows/ci-frontend-v2.yml)

**What:** I diffed them. They differ only in the workflow `name`, the `paths` self-reference, the presence of `task_allocation` in the branch list, and the wording of one comment. Both run `npm ci`, `test:unit`, `test:integration`, `build` against the same `frontend/` directory.

**Why it matters:** Every frontend push to `main` or `ph1-dev` runs the full suite twice — double the minutes, double the queue time, two status checks that always agree. It also creates ambiguity about which one is authoritative, and they've already drifted (`task_allocation`).

**Suggested fix:** Delete `ci-frontend-v2.yml` and fold the branch filter fix from [H2](#h2) into `ci-frontend.yml`.

#### <a name="m14"></a>[M14] No linter, formatter, or typecheck anywhere in the project

**Where:** repo-wide

**What:** No ESLint config, no Prettier, no Ruff, no Black, no `.editorconfig` — I searched the tracked tree and the only hits were inside `node_modules`. `frontend/package.json` has no `lint` or `typecheck` script. No CI job runs any static analysis.

**Why it matters:** Nothing catches unused imports, unhandled promise rejections, missing React hook dependencies, or accidental `any`. The `auth.tsx:74` type error in [H1](#h1) is exactly the class of bug a `tsc --noEmit` step catches in two seconds. On a multi-contributor project this also means style is negotiated in code review rather than by a tool.

**Suggested fix:** Add `typecheck: tsc --noEmit` to `frontend/package.json` and wire it into CI first — highest value, zero configuration debate. Then ESLint with `typescript-eslint` and `eslint-plugin-react-hooks`, and Ruff for both Python services (fast, single config, replaces flake8+isort+black).

#### <a name="m15"></a>[M15] All three containers run as root

**Where:** [`backend/spring-boot/Dockerfile`](backend/spring-boot/Dockerfile), [`backend/fastapi-sbert/Dockerfile`](backend/fastapi-sbert/Dockerfile), [`backend/fastapi-transformer/Dockerfile`](backend/fastapi-transformer/Dockerfile)

**What:** None of the three has a `USER` directive, so every process runs as uid 0.

**Why it matters:** Standard container hardening. Any RCE in a dependency — and the Python services pull in a large transitive tree including `tensorflow-cpu`, `sentence-transformers`, and `langgraph` — starts with root inside the container, which materially widens what a container-escape can reach.

**Suggested fix:** Add to each Dockerfile before `CMD`/`ENTRYPOINT`:
```dockerfile
RUN useradd --create-home --shell /bin/false app && chown -R app:app /app
USER app
```
For `fastapi-sbert`, make sure the HuggingFace cache volume mount is writable by that uid.

---

### Low

- **<a name="l1"></a>[L1] JWT stored in localStorage.** [`authStorage.ts:20-22`](frontend/services/authStorage.ts#L20-L22). Any XSS exfiltrates a 24-hour token. The file's own docstring anticipates swapping to an httpOnly cookie — worth doing before launch, but it's a real tradeoff against CSRF (currently disabled at [`SecurityConfig.java:35`](backend/spring-boot/src/main/java/com/ceview/config/SecurityConfig.java#L35)), so it's a deliberate decision, not an oversight.

- **<a name="l2"></a>[L2] The client throws away the backend's structured error body.** [`apiClient.ts:37-39`](frontend/services/apiClient.ts#L37-L39) raises `new Error(\`Request to ${path} failed with ${res.status}\`)` without reading the response. `ApiExceptionHandler` carefully assembles `{error, status, traceId, code, message}` specifically so the frontend can show a traceId and match it against logs — and the client discards all of it. Parse the body and attach it to the thrown error.

- **<a name="l3"></a>[L3] User enumeration on registration.** [`AuthController.java:58-59`](backend/spring-boot/src/main/java/com/ceview/auth/AuthController.java#L58-L59) returns `"email already registered"`, confirming which addresses have accounts. Standard mitigation is a generic response plus an email to the existing address. Low priority for a 9-operator pilot; worth fixing before public signup.

- **<a name="l4"></a>[L4] A developer's LAN IP is hardcoded in CORS.** [`docker-compose.yml:68`](backend/docker-compose.yml#L68) lists `http://192.168.1.194:3000` and `:5173`. Harmless but confusing for other contributors — move it to a `.env` override.

- **<a name="l5"></a>[L5] Docs reference `GEMINI_API_KEY`; the code reads `GROQ_API_KEY`.** Both Dockerfiles' header comments and [`fastapi-transformer/app/main.py:34`](backend/fastapi-transformer/app/main.py#L34) mention Gemini, but [`gemini_client.py:25`](backend/fastapi-sbert/app/services/gemini_client.py#L25) and [`AgentLLMModel.py:33`](backend/fastapi-sbert/app/core/AgentLLMModel.py#L33) both read `GROQ_API_KEY` — and `/healthz/models` reports the key as `"groq"` while its own docstring says "requires GEMINI_API_KEY". Leftover from a provider migration; someone will set the wrong variable and get silent stub output.

- **<a name="l6"></a>[L6] `apiClient`'s docstring contradicts its code.** [`apiClient.ts:2-3`](frontend/services/apiClient.ts#L2-L3) says fixtures activate "when VITE_USE_FIXTURES=true **(or the backend base URL is unset)**", but line 19 only checks the flag, and line 20 falls back to `http://localhost:8080`. Relevant because it's the behaviour [H5](#h5) turns on.

- **<a name="l7"></a>[L7] No validation on the OMCS image URL.** [`ComplianceController.java:47`](backend/spring-boot/src/main/java/com/ceview/module3/ComplianceController.java#L47) checks only that `imageUrl` is non-blank before forwarding it to [`omcs_agent/node.py:114`](backend/fastapi-sbert/app/agents/omcs_agent/node.py#L114), which hands it to Groq's vision API as an `image_url` block. The fetch happens on Groq's infrastructure rather than yours, so this is **not** a server-side request forgery against your network — but a scheme/host allowlist is cheap defence in depth if that ever changes.

- **<a name="l8"></a>[L8] `ProfileCompletionFilter` queries the database on every request.** [`ProfileCompletionFilter.java:171`](backend/spring-boot/src/main/java/com/ceview/auth/ProfileCompletionFilter.java#L171) does a `findById` per authenticated request purely to read a boolean. Negligible at pilot scale; the natural fix is a `profileCompleted` JWT claim refreshed on the completion PATCH, which also removes the round trip.

- **<a name="l9"></a>[L9] Prompt injection via business description.** [`gemini_client.py:78-86`](backend/fastapi-sbert/app/services/gemini_client.py#L78-L86) f-strings operator-supplied text (`description`, `uvp`, `business_name`) directly into the prompt. Impact is mostly self-inflicted — the output returns to the same tenant — but a crafted description could make the model emit arbitrary text that then flows into Module 3 captions and past the compliance gate. Delimit user content and instruct the model to treat it as data.

---

## Recommended plan

**This week**

1. **[C1]** — add the shared-secret dependency to both FastAPI services and disable `/docs` in production. Nothing else matters as much, and it's under an hour.
2. **[H1]** — fix `App.tsx`; the branch can't deploy until it builds.
3. **[H2] + [M13]** — broaden the CI triggers and delete the duplicate workflow. Do this immediately after H1 so the fix is actually verified, and so the next H1 gets caught automatically.
4. **[M2]** — delete the JWT secret default. One line.
5. **[H7]** — put the ingestion trigger behind a config flag. One line, removes a trivial DoS.
6. **[M7]** — fix the CTR divide-by-zero guard. One character, prevents permanent data corruption.
7. **[M8]** — write a real `.gitignore` and `git rm -r --cached` the artifacts. Don't rewrite history; just stop adding to it.

**This quarter**

- **[H3]** is the biggest piece of product work here: wire Module 4 to `CampaignRecordRepository` the way `/history` already does. Sequence it before [H5](#h5)'s frontend wiring, so the screens connect to endpoints that return real data.
- **[H4] + [M1]** together — both live in `embedding_store.py` and both are about failure handling. Fix them in one pass, and write the tests from [H8](#h8) against that module first; it's the clearest seam in the Python tree.
- **[H6]** — 401 handling and token expiry. Small, and it's the difference between "the app broke" and "please sign in again."
- **[M11] + [M12]** — add the cross-tenant test class, then fix the two unscoped controllers it catches. Tests first here: the test is what stops the problem recurring.
- **[M14]** then **[M9]** — get `tsc --noEmit` and Ruff into CI, then do the Spring Boot bump. Static analysis first, so the dependency upgrade has a safety net.
- **[H5]** — decide explicitly whether the deployed app is a fixture demo or a live product, and make `render.yaml` say so.
- **[M6]** — revisit the blocking AI calls once real traffic exists. It's a genuine ceiling but not urgent at 9 operators.

**Accept for now**

- **[L1]** localStorage tokens — moving to httpOnly cookies means re-enabling CSRF protection and reworking the auth flow. The current design is a defensible tradeoff and the docstring shows it was chosen, not stumbled into. Revisit before public launch.
- **[L3]** user enumeration — irrelevant while signup is a closed pilot.
- **[L8]** the per-request profile lookup — measurably fine at this scale; optimising now is premature.
- **The frozen `ceview/` directory** — 138 source files of superseded frontend. Leave it until the port to `frontend/` is finished, then delete it in one commit. Reviewing or fixing it would be wasted effort.
- **Rewriting git history to reclaim the 111 MB** — the disruption to every contributor's clone outweighs the benefit right now.

---

## Coverage and limitations

**Read in full:** the entire `auth/` package; `SecurityConfig`, `CorsConfig`, `ApiExceptionHandler`; `application.yml` and `application-h2.yml`; `MetricsCalculationService`, `EngagementMetricsController`, `PesComputationController`, `PrescriptiveReportController`, `UniquenessScoringController`, `IngestionTriggerController`, `ComplianceController`; `embedding_store.py`; both FastAPI `main.py` files; `frontend/App.tsx`, `apiClient.ts`, `auth.tsx`, `authStorage.ts`, `firebase.ts`; all six CI workflows; all three Dockerfiles; `render.yaml`; `docker-compose.yml`; `pom.xml`; both `requirements.txt`; `SecurityLockdownVerificationTest`; and all four Python test files.

**Sampled:** `AIInferenceGatewayService` (first 90 of 308 lines); `ForecastingController`, `NotificationController`, `ContentController`, `CreativeDirectionController` (tenant-scoping call sites only); `gemini_client.py` (the uniqueness and content-generation prompts); `omcs_agent/node.py` (image handling only); the Flyway migration list and `V1`/`V19` in full.

**Verified by running:**
- `npx tsc --noEmit` → **5 errors** (after `npm install` to correct a stale local `node_modules`)
- `npm run build` → **fails**
- `npm run test` → **77 tests pass, 13 files, 21 s**
- Targeted greps confirming no SQL injection, no hardcoded live credentials, and no auth dependency in either FastAPI service

**Could not verify:**
- **Spring Boot tests did not run.** This machine has only JDK 23 and JRE 8; the project targets Java 21, and Lombok under the Spring Boot 3.3.4 dependency tree can't process annotations on JDK 23 — every `@Data`-generated accessor fails with `cannot find symbol`. **This is a local toolchain artifact, not a repo defect** — `ci-spring-boot.yml:27` pins Java 21 and runs `./mvnw -B test`, which should pass. Install a JDK 21 to confirm.
- **pytest did not run** for either Python service — `tensorflow-cpu` and `sentence-transformers` aren't installed locally and are too heavy to pull in for this pass. Given the suites contain four example tests, the coverage conclusion in [H8](#h8) stands regardless of whether they pass.
- **Playwright e2e did not run** — requires the full Dockerised stack plus a `GROQ_API_KEY`.
- **`spring.log`, `spring.err`, and `spring-run.log` were not opened.** They're committed ([M8](#m8)) and may contain credentials or tokens; a review shouldn't echo secrets. Check them yourself, and rotate anything you find — it's already in git history.

**Not reviewed:** the frozen `ceview/` tree (138 source files, deliberately out of scope per `CLAUDE.md`); the `docs/` tree (157 files) beyond using it for orientation; `ForecastingService.java` (884 lines) and the Module 2 ingestion pipeline internals; `trend_service.py` (708), `keyword_mapping.py` (774), `gemini_forecaster.py` (467); the three LangGraph agent graphs; the frontend component bodies for Modules 2–4, which are TODO stubs; and the 34 SQL migrations beyond the schema checks noted above.

**A deeper pass would cover:** the Module 2 forecasting pipeline end-to-end against `ARCHITECTURE_SPEC.md`'s stated formulas — it's the highest-churn code in the repo (`ForecastingService.java`, 11 commits; `gemini_client.py`, 13) and I only sampled it. Verifying the implemented math against the spec is the most valuable thing not done here.
