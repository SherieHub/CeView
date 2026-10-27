# CeView Developer README

Start here to run, test, or contribute to CeView. The [root README](README.md) introduces the product and its current progress; this guide directs development work to the relevant documentation.

## Find the right guide

| Task | Start here |
|---|---|
| Install prerequisites, configure services, or troubleshoot local development | [RUNNING.md](RUNNING.md) |
| Run or change the backend | [Backend README](backend/README.md) |
| Run, build, or test the active web application | [Frontend README](frontend/README.md) |
| Understand service boundaries and request flows | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Understand algorithms and scoring formulas | [ARCHITECTURE_SPEC.md](ARCHITECTURE_SPEC.md) |
| Change or consume API endpoints | [Backend contract](backend/CONTRACT.md) |
| Configure ad-account reporting | [AD_PLATFORM_SETUP.md](AD_PLATFORM_SETUP.md) |
| Configure uploads, platform connections, and social publishing | [Social publishing setup](docs/SOCIAL_PUBLISHING_SETUP.md) |
| Configure campaign links and booking capture | [LINK_ATTRIBUTION_SETUP.md](LINK_ATTRIBUTION_SETUP.md) |
| Work on the public sample-data demo | [Demo experience](docs/DEMO_EXPERIENCE.md) |
| Deploy | [AWS guide](docs/DEPLOY_AWS.md) or [Render guide](docs/DEPLOY_RENDER.md) |

## First local run

1. Follow [prerequisites](RUNNING.md#1-prerequisites). Use Node.js 22 to match frontend CI. Docker runs the backend services; native development and host-side backend tests need Java 21 and Python 3.12.
2. Follow the [backend README](backend/README.md#run-locally): copy `backend/.env.example` to `backend/.env`, set the required secrets, and start Docker Compose. PostgreSQL is required for the complete publishing workflow.
3. In a separate terminal, start the frontend from the repository root:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

   Open `http://localhost:3001`. The default API is `http://localhost:8080`. Copy `frontend/.env.example` to `frontend/.env` if you need overrides; see the [frontend guide](frontend/README.md).

4. Use the [seeded local demo accounts](backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md), or register and follow [local email verification](RUNNING.md#5b-email-verification-codes-in-local-development). With `EMAIL_PROVIDER=log`, verification codes appear in Spring Boot's logs.
5. Follow the [manual smoke test](RUNNING.md#7-end-to-end-smoke-test-manual) for the core application, then the relevant integration guide for publishing, attribution, or ad accounts.

For UI-only work, the frontend supports `VITE_USE_FIXTURES=true`; production builds reject that setting. The public `/demo` route has its own sample-data mode. Neither mode validates backend integration. Forecasting separately defaults to `FORECAST_ENGINE=stub`; select and configure a real engine before evaluating predictions.

Keep backend secrets in the gitignored environment file. Frontend `VITE_` values are included in the browser bundle and must not contain secrets. Full environment behavior is documented in [RUNNING.md](RUNNING.md#5-environment-variables) and the service `.env.example` files.

## Testing

Run commands from the directory shown, after installing that component's dependencies. The full setup and troubleshooting reference is [RUNNING.md — tests](RUNNING.md#8-running-the-tests).

| Component / directory | Commands | Requirements |
|---|---|---|
| Frontend — `frontend/` | `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build` | `npm ci`; unit/integration checks do not require the backend |
| API contract — `frontend/` | `npm run test:contract` | Running backend on `VITE_API_BASE_URL` |
| Spring Boot — `backend/spring-boot/` | `./mvnw test` (Windows: `.\mvnw.cmd test`) | Java 21; ordinary tests use H2/mocks |
| Classification/content — `backend/fastapi-sbert/` | `python -m pytest tests/ -v` | Python 3.12 virtual environment; install `requirements.txt` and `requirements-dev.txt` |
| Demand intelligence — `backend/fastapi-transformer/` | `python -m pytest tests/ -v` | Separate Python 3.12 virtual environment with both requirements files |

For database changes, validate migrations against PostgreSQL as well as running the focused tests. The [optional publishing PostgreSQL check](docs/superpowers/plans/2026-10-20-social-publishing-verification.md#reproducing-the-optional-database-check) exercises migrations and concurrent job claims against a disposable local database. Its test is skipped unless explicitly configured.

### End-to-end tests

Install frontend dependencies first. With `backend/.env` configured, start the backend using the checked-in test overlay, from the repository root:

```bash
cd backend
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build
```

The [overlay](backend/docker-compose.e2e.yml) enables test hooks, log-only email, test CORS origins, and fake Meta endpoints. For tests that store platform tokens, set `TOKEN_ENCRYPTION_KEY` using the instructions in [ad platform setup](AD_PLATFORM_SETUP.md#6-environment-variables). Use this configuration only for local/test environments.

In another terminal, from the repository root:

```bash
cd e2e
npm ci
npx playwright install chromium
npx playwright test
# Focus one screen:
npx playwright test tests/login.spec.ts
```

[Playwright configuration](e2e/playwright.config.ts) starts frontend servers on ports **3012 and 3013**; it does not start the backend. Global setup starts the fake Meta server. Inspect skipped tests: absent backend/test hooks and placeholder suites can leave coverage incomplete even when a run is green. After testing, recreate the backend with the base Compose file to return to normal development configuration.

### Feature-specific verification and CI

- [Demand pipeline walkthrough](TESTING_DEMAND_PIPELINE.md) and [Module 2 contract](docs/module-2/MODULE_2_E2E_CONTRACT.md) cover signal ingestion, forecasts, and alerts. The walkthrough and dated audits include historical behavior; cross-check them against the current engine and service configuration.
- [Social publishing setup](docs/SOCIAL_PUBLISHING_SETUP.md) separates automated checks from the live tester-account checks still needed. Mocked platform success does not prove live delivery.
- CI definitions: [frontend](.github/workflows/ci-frontend.yml), [Spring Boot](.github/workflows/ci-spring-boot.yml), [classification/content](.github/workflows/ci-fastapi-sbert.yml), [demand service](.github/workflows/ci-fastapi-transformer.yml), and [Playwright](.github/workflows/e2e.yml). Consult their current commands and filters when reproducing CI.

## Contributing

1. **Read the relevant module guide before changing logic:** [Module 1](docs/module-1/README.md), [Module 2](docs/module-2/README.md), [Module 3](docs/module-3/README.md), or [Module 4](docs/module-4/README.md). Use the architecture documents and API contract as the design references. Dated plans and audit records are historical context, not proof that a feature is currently complete.
2. **Keep changes scoped and within module boundaries.** Active UI work belongs in `frontend/`, with module UI under `frontend/components/module-N/`. Do not add work to frozen `ceview/` or `ceview/old-components/`.
3. **Preserve tenant isolation.** Resolve operator-owned resources from the authenticated business context and check ownership on every data-access path.
4. **Keep contracts and documentation aligned.** Update affected API contracts, module documentation, migrations, and environment examples when behavior changes. Describe external configuration or manual checks needed to use the change.
5. **Validate the affected behavior.** Run focused tests and the relevant type/build checks. Include PostgreSQL validation for database-specific behavior and browser checks for cross-stack flows. Record failures and skips alongside successes.
6. **Prepare a reviewable change.** Explain the problem, resulting behavior, validation performed, and remaining limitations in the pull-request description.

[AGENTS.md](AGENTS.md) contains the shared repository rules for coding agents, including no destructive Git operations and no agent-run commits or pushes. Repository workflows in `.claude/skills/` supplement that guide; read only the workflow relevant to the task.

## Repository map

| Path | Purpose |
|---|---|
| `frontend/` | Active React application, unit/integration/contract tests, and development fixtures |
| `backend/spring-boot/` | Java orchestration API, Flyway migrations, and JUnit tests |
| `backend/fastapi-sbert/` | Classification, content, compliance, and report services |
| `backend/fastapi-transformer/` | Demand data, forecasting engines, and market scoring |
| `e2e/` | Playwright tests and browser-test support |
| `docs/` | Module documentation, deployment guides, designs, and dated verification records |
| `deploy/` | Deployment configuration and infrastructure support |
| `scripts/` | Development and data utilities; see [mock-data tooling](scripts/mock-data/README.md) |
| `ceview/` | Frozen legacy frontend |
