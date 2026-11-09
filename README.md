# CeView

**Tourism-demand intelligence and AI-assisted marketing for Cebu's small businesses.**

CeView helps Cebu-based micro, small, and medium enterprises (MSMEs)—such as dive shops, cafés, tour operators, and boutique stays—connect business positioning, traveler demand, marketing content, and campaign results in one workflow.

An operator describes their business, explores demand signals from South Korea, Japan, and the United States, prepares localized content, and tracks the resulting engagement and bookings.

**Live deployment:** <https://ceview.online> (web app) · <https://api.ceview.online/actuator/health> (API health) — hosted on AWS, Singapore region (`ap-southeast-1`). A sample-data demo that needs no account is at <https://ceview.online/demo>.

**Developing or contributing? Start with the [Developer README](DEVELOPER_README.md)** for setup, backend/frontend instructions, testing, and contribution guidance.

## The product

| Module | What it helps operators do |
|---|---|
| [1 — Business Classification & Uniqueness](docs/module-1/README.md) | Classify a business into tourism categories, compare its positioning with a reference cohort, and maintain its profile. |
| [2 — Market Radar & Notifications](docs/module-2/README.md) | Explore category-specific market rankings, demand forecasts, trend signals, and surge alerts. |
| [3 — Content Studio](docs/module-3/README.md) | Generate localized captions and creative direction, review compliance, manage media, and prepare or schedule platform content. |
| [4 — Campaign Analytics & Reporting](docs/module-4/README.md) | Review campaign and post metrics, track booking evidence, compare campaign lift, and request AI-generated recommendations. |

## Current status and progress

As of **October 27, 2026**, the repository contains an integrated application across all four modules, a public sample-data demo, and deployment tooling. External integrations still require configuration and live-account verification; implementation status does not establish production readiness.

Implemented in the current codebase:

- **Account and business onboarding:** email/password authentication, email verification and password reset, optional Firebase-backed Google sign-in and phone verification, and operator-scoped business data.
- **Demand-to-content workflow:** business classification and uniqueness scoring, market analysis and alerts, localized content generation, creative guidance, and compliance review.
- **Social publishing:** media uploads, Facebook Page and linked Instagram connections, TikTok creator connections, persisted publishing requests, scheduling, cancellation, and delivery status. Facebook and Instagram delivery clients are implemented; TikTok hands drafts to the creator's inbox for completion in TikTok.
- **Paid-ad preparation:** Meta campaign, ad-set, creative, and ad creation with spending-limit checks. Ads are created **paused** for review and launch in Ads Manager.
- **Performance and attribution:** ad-account insights, post metrics, tracked links, hosted enquiries, operator-logged bookings, campaign lift, walk-in vouchers, and AI reports.
- **Product exploration:** a landing-page showcase and an account-free `/demo` experience using sample data. Demo actions are simulated and do not publish content or call the backend.

Current boundaries and remaining work:

- **Forecasting is configurable.** Local setup defaults to a deterministic placeholder (`FORECAST_ENGINE=stub`). Groq and hosted BiLSTM + Transformer adapters are available; meaningful model evaluation requires the selected engine and measured input history.
- **Live publishing needs verification.** Consent flows, permissions, public callbacks, media access, account-specific ad requirements, and actual delivery/insights need tester-account checks. See [social publishing setup and verification notes](docs/SOCIAL_PUBLISHING_SETUP.md).
- **Workspace collaboration is unfinished.** Member management and invitations do not yet have a backend implementation.
- **Data availability matters.** AI output, trends, and platform metrics depend on configured providers and available data. Demo and seeded data are illustrative; missing live metrics should not be read as measured zeroes.

## Technology and architecture

| Layer | Stack |
|---|---|
| Web application | React 19, TypeScript, Vite, Tailwind CSS |
| Orchestration API | Spring Boot 3.3, Java 21, JWT authentication |
| Classification and content AI | Python 3.12, FastAPI, SBERT/E5, LangGraph, Groq |
| Demand intelligence | FastAPI, selectable forecast engines, XGBoost/linear market scoring, SerpApi trends |
| Persistence | PostgreSQL 16, pgvector, Flyway |
| Automated checks | Vitest, JUnit, pytest, Playwright, GitHub Actions |

The browser calls Spring Boot, which coordinates persistence, the two Python services, and platform integrations. Authenticated operator workflows use tenant-scoped data; authentication, traveler-facing attribution, and OAuth callbacks have dedicated public routes.

The active web application lives in `frontend/`. The earlier `ceview/` application is frozen legacy code.

## Setup

Prerequisites: Git, Docker Desktop 4.30+, Node.js 20+, and API keys for Groq and SerpApi (the app starts without them; the features that need them report which key is missing). Full guide, including running without Docker: [RUNNING.md](RUNNING.md).

```bash
# 1. Get the code and create the backend settings file (never commit .env)
git clone https://github.com/SherieHub/CeView.git
cd CeView/backend
cp .env.example .env        # Windows: copy .env.example .env
#    then set JWT_SECRET (openssl rand -hex 32), CEVIEW_ATTRIBUTION_IP_HASH_SALT (openssl rand -hex 16),
#    GROQ_API_KEY and SERPAPI_KEY in backend/.env

# 2. Start PostgreSQL + pgvector, Spring Boot and both FastAPI services
docker-compose up --build

# 3. Once, after spring-boot is up: import the uniqueness reference corpus
docker exec -i ceview-postgres psql -U ceview -d ceview < spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql

# 4. In a second terminal, from the CeView folder, start the web app and open http://localhost:3001
cd frontend
npm install
npm run dev
```

Health checks: `http://localhost:8080/actuator/health`, `http://localhost:8000/healthz`, `http://localhost:8001/healthz`. Locally, email verification codes are printed in the Spring Boot log (`EMAIL_PROVIDER=log`). Production deployment: [docs/DEPLOY_AWS.md](docs/DEPLOY_AWS.md).

## Environment variables (names only)

Values are never committed: `backend/.env` and `frontend/.env` are gitignored, and the `.env.example` files list the names. In production the values come from AWS Systems Manager Parameter Store.

| Component | Variables |
|---|---|
| Spring Boot API | `JWT_SECRET`, `CEVIEW_ATTRIBUTION_IP_HASH_SALT`, `SPRING_PROFILES_ACTIVE`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_BASE_URL`, `CEVIEW_ATTRIBUTION_BASE_URL`, `FASTAPI_SBERT_BASE_URL`, `FASTAPI_TRANSFORMER_BASE_URL` |
| Email | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` |
| Google sign-in | `FIREBASE_CREDENTIALS_JSON` |
| Social and ad platforms | `META_APP_ID`, `META_APP_SECRET`, `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`, `TOKEN_ENCRYPTION_KEY`, `OAUTH_REDIRECT_BASE_URL` |
| Media storage | `MEDIA_STORAGE`, `MEDIA_PUBLIC_BASE_URL`, `MEDIA_LOCAL_DIR` |
| AI services (FastAPI) | `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_TRANSLATION_MODEL`, `HF_TOKEN`, `HF_SPACE_ID`, `SERPAPI_KEY`, `FORECAST_ENGINE`, `DATABASE_URL` |
| Testing only | `CEVIEW_TEST_SUPPORT_ENABLED` |
| Web app (public `VITE_` values) | `VITE_API_BASE_URL`, `VITE_USE_FIXTURES`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_WALKTHROUGH_URL`, `VITE_LEAD_FORM_ENDPOINT`, `VITE_CONTACT_EMAIL`, `VITE_PRIVACY_URL`, `VITE_TERMS_URL` |

## Explore the repository

- [Developer README](DEVELOPER_README.md) — run locally, test, contribute, and find operational guides.
- [System architecture](ARCHITECTURE.md) — service boundaries and end-to-end flows.
- [Architecture specification](ARCHITECTURE_SPEC.md) — algorithms, scoring formulas, and design rationale.
- [Backend overview](backend/README.md) and [API contract](backend/CONTRACT.md) — services and integration contracts.
- [Public demo guide](docs/DEMO_EXPERIENCE.md) — how the sample-data experience works.
- [Social publishing verification record](docs/superpowers/plans/2026-10-20-social-publishing-verification.md) — recorded automated checks and outstanding live-account validation.
