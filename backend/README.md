# CeView Backend

The backend supports business classification, demand intelligence, content generation and publishing, and campaign reporting. Spring Boot owns the public application API and coordinates two FastAPI services and PostgreSQL.

For repository onboarding, frontend setup, and contribution guidance, start with the [Developer README](../DEVELOPER_README.md). [RUNNING.md](../RUNNING.md) contains the full local setup and troubleshooting guide.

## Services

| Compose service | Source | Host port | Responsibility |
|---|---|---|---|
| `spring-boot` | [`spring-boot/`](spring-boot/) | 8080 | Authentication, tenant-scoped APIs, persistence, AI orchestration, platform connections, publishing jobs, attribution, and metrics |
| `fastapi` | [`fastapi-sbert/`](fastapi-sbert/) | 8000 | SBERT/E5 classification and uniqueness, localized captions, creative direction, compliance review, and reports |
| `fastapi-transformer` | [`fastapi-transformer/`](fastapi-transformer/) | 8001 | Market-data/trend integration, selectable demand forecasting, and market scoring |
| `postgres` | pgvector/PostgreSQL 16 image | 5433 → 5432 | Relational data and embeddings; schema managed by Flyway |

## Implementation status

- All four product modules have backend implementations. Operator-owned resources are scoped to the authenticated business; public auth, OAuth callback, media, and traveler attribution routes have separate access rules.
- Forecast engines are selected with `FORECAST_ENGINE=stub|groq|bilstm`. The default `stub` is a deterministic placeholder; `bilstm` calls the hosted BiLSTM + Transformer model. See the [model integration guide](../docs/module-2/TRANSFORMER_MODEL_INTEGRATION.md).
- Social publishing persists media, platform grants, post lifecycle/checkpoints, and metric snapshots. Facebook uses native scheduling; Instagram and TikTok use the dispatcher. TikTok delivery is an inbox draft handoff. Meta ads remain paused until an operator launches them in Ads Manager.
- Attribution includes tracked redirects, hosted enquiries, logged bookings, campaign lift, and walk-in voucher redemption.
- Workspace members and invitations remain unimplemented. Live platform delivery and account-specific requirements still need the checks in [social publishing setup](../docs/SOCIAL_PUBLISHING_SETUP.md).

## Run locally

From the repository root, with Docker Desktop running:

```bash
cd backend
cp .env.example .env      # first setup only; Windows PowerShell: copy .env.example .env
# Edit .env before starting: JWT_SECRET and CEVIEW_ATTRIBUTION_IP_HASH_SALT are required.
docker compose up --build
```

Use [`.env.example`](.env.example) and [RUNNING.md's environment reference](../RUNNING.md#5-environment-variables) for configuration. Groq powers content/report features; SerpApi supplies trends. Missing provider configuration leaves dependent features unavailable. The first SBERT/E5 startup downloads a large model and can take several minutes.

Additional integration setup:

| Feature | Guide |
|---|---|
| Email codes, Google sign-in, phone verification, demo accounts | [Authentication and local setup](../RUNNING.md#6-authentication--seeded-demo-accounts) |
| Meta/TikTok ad-account connections and encrypted token storage | [Ad platform setup](../AD_PLATFORM_SETUP.md) |
| Media storage, creator connections, scheduling, publishing, post metrics | [Social publishing setup](../docs/SOCIAL_PUBLISHING_SETUP.md) |
| Tracking links and hosted enquiries | [Link attribution setup](../LINK_ATTRIBUTION_SETUP.md) |

**Use Docker/PostgreSQL for social publishing and media workflows.** The native H2 path in [RUNNING.md](../RUNNING.md#path-b-native-no-docker) supports lighter development but does not provide the full publishing schema or PostgreSQL job-locking behavior.

From `backend/`, inspect or rebuild services with:

```bash
docker compose ps
docker compose logs -f --tail 100 spring-boot
docker compose up -d --build spring-boot
```

Health endpoints:

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8000/healthz
curl http://localhost:8001/healthz
```

## Tests and validation

Run each command from the indicated directory:

| Directory | Command | Scope |
|---|---|---|
| `backend/spring-boot/` | `./mvnw test` (Windows: `.\mvnw.cmd test`) | JUnit/MockMvc tests, normally using H2 |
| `backend/fastapi-sbert/` | `python -m pytest tests/ -v` | Classification/content service tests |
| `backend/fastapi-transformer/` | `python -m pytest tests/ -v` | Demand service tests |

Use Java 21 for Maven. For each Python service, use a separate Python 3.12 virtual environment and install `requirements.txt` plus `requirements-dev.txt` before testing. See [test setup](../RUNNING.md#8-running-the-tests).

H2 tests do not validate Flyway migrations or PostgreSQL locking. For publishing/database changes, use the disposable PostgreSQL procedure in the [social publishing verification record](../docs/superpowers/plans/2026-10-20-social-publishing-verification.md#reproducing-the-optional-database-check). For browser tests and the Compose test overlay, see the [Developer README](../DEVELOPER_README.md#end-to-end-tests).

## Backend reference

- [API contract](CONTRACT.md), [system architecture](../ARCHITECTURE.md), and [formula specification](../ARCHITECTURE_SPEC.md).
- Module guides: [1](../docs/module-1/README.md), [2](../docs/module-2/README.md), [3](../docs/module-3/README.md), [4](../docs/module-4/README.md).
- Deployment: [AWS](../docs/DEPLOY_AWS.md) and [Render](../docs/DEPLOY_RENDER.md). Check the social publishing guide for additional media-storage requirements.
