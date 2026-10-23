# CeView Backend

Four services, run together by `docker-compose.yml` in this folder:

| Service (compose name) | Folder | Port | Role |
|---|---|---|---|
| `spring-boot` | `spring-boot/` | 8080 | Orchestration API: auth (JWT), persistence, REST endpoints, scheduled jobs |
| `fastapi` | `fastapi-sbert/` | 8000 | Classification + uniqueness (E5), captions, creative direction, compliance audit, reports |
| `fastapi-transformer` | `fastapi-transformer/` | 8001 | Demand forecasting, Google Trends (SerpApi), market scoring (XGBoost) |
| `postgres` | — | 5433 → 5432 | PostgreSQL 16 + pgvector, migrated by Flyway |

## Run

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
# set JWT_SECRET and CEVIEW_ATTRIBUTION_IP_HASH_SALT (required), plus GROQ_API_KEY / SERPAPI_KEY
docker compose up --build
```

Rebuild one service after a change: `docker compose up -d --build spring-boot`.

Health:

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8000/healthz
curl http://localhost:8001/healthz
```

## Test

```bash
# each from backend/
cd spring-boot && ./mvnw test                      # JUnit on H2, no services needed
cd fastapi-sbert && pytest tests/unit tests/integration
cd fastapi-transformer && pytest tests/unit tests/integration
```

Install the Python test deps first: `pip install -r requirements.txt -r requirements-dev.txt`.

## More

- [`../RUNNING.md`](../RUNNING.md): every environment variable, the no-Docker (H2) path, e2e tests, troubleshooting.
- [`CONTRACT.md`](CONTRACT.md): REST endpoints.
- [`../docs/DEPLOY_AWS.md`](../docs/DEPLOY_AWS.md) and [`../docs/DEPLOY_RENDER.md`](../docs/DEPLOY_RENDER.md): deployment.
