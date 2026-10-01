# AWS Deployment (Pilot) — Design

**Date:** 2026-10-01
**Status:** Design approved, implementation plan pending
**Runbook:** [`docs/DEPLOY_AWS.md`](../../DEPLOY_AWS.md)

## Goal

Move CeView off the Render free-tier path and onto AWS for a **pilot with 20–100 real Cebu MSMEs**. The
target is about $30/mo; up to about $40/mo has been accepted. The deployment has to keep the 90-second
AI calls working, keep the `/r/{slug}` attribution links that live ads point at always warm, give the
Meta OAuth callback a stable HTTPS host, and produce evidence for a Data Privacy Act (DPA) review.

Out of scope: high availability, multiple environments (no staging), autoscaling, and moving any
service off its current framework.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Region | `ap-southeast-1` (Singapore) | Lowest latency to Cebu. Keeps data in one named region for the DPA record |
| Compute | One Lightsail **Medium 4GB x86** instance (Ubuntu 24.04), running Docker Compose | About $24/mo with IPv4 and 4TB transfer bundled. x86 means native CI image builds |
| Database | `pgvector/pgvector:pg16` container on the same instance, with data on an attached 20GB Lightsail block-storage disk | RDS would double the bill. AWS documents attached disks as encrypted at rest; it doesn't clearly say the same for the system disk |
| TLS / ingress | Caddy on the instance, with Let's Encrypt, for `api.<domain>` | No ALB, API Gateway or CloudFront in front of the API: their 30–60s timeouts are shorter than Spring's 90s FastAPI calls |
| Frontend | Private S3 bucket + CloudFront (OAC) + ACM certificate, at `<domain>` and `www.<domain>` | Static, effectively free, and on a CDN. A CloudFront Function handles SPA deep links and the www → apex redirect |
| DNS / domain | Domain registered in Route 53, plus a hosted zone | Lets ACM validate certificates in one click and supports apex alias records to CloudFront |
| Images | ECR, three repos, lifecycle policy that keeps the last 10 | Same account and region as the instance |
| CI/CD | `.github/workflows/deploy-aws.yml` runs on push to `release`. It authenticates through GitHub OIDC with no GitHub secrets | The deployer has WRITE but not admin on the private repo, so repo secrets and environments aren't available |
| Rollout | Pull-based. A systemd timer on the box polls SSM `/ceview/prod/release-sha` every 2 minutes, then syncs the release bundle from S3 and runs `docker compose up -d`. If health checks fail, it reverts to the previous SHA | Lightsail has no SSM Run Command or instance role. Pulling avoids storing SSH keys anywhere |
| Secrets | SSM Parameter Store SecureStrings under `/ceview/prod/`, rendered to `/opt/ceview/.env` (mode 600) at each deploy | Free (standard tier, `aws/ssm` key), audited by CloudTrail |
| Box credentials | IAM user `ceview-box` with a least-privilege policy; access key stored in `/root/.aws/credentials` | Lightsail has no instance roles. Rotate the key quarterly |
| Integrations live | Firebase Google sign-in, Meta Ads, SerpApi, Groq, HF Space (`FORECAST_ENGINE=bilstm`). TikTok off. W&B off | Pilot scope |
| Demo seed data | Deleted after the first migration by an idempotent script. The V26 reference corpus is kept, and its vectors are imported | The 9 demo logins have plaintext passwords published in the repo |
| Backups | Nightly `pg_dump -Fc` to the S3 ops bucket (SSE-S3, 30-day lifecycle), plus Lightsail automatic snapshots of the instance and data disk | Lose at most about 24 hours of data |
| Monitoring | AWS Budgets ($35), Lightsail CPU and status alarms, CloudWatch agent (memory and disk), Route 53 health check on `/actuator/health`, and a log metric filter on `DEPLOY_FAILED`. All alerts go out by email | Email-only alerting fits a pilot |
| Render | Delete `render.yaml` and `docs/DEPLOY_RENDER.md`. Repoint references in `README.md`, `RUNNING.md` and `.claude/CLAUDE.md` | One deployment path |

## Architecture

```
Browser ─HTTPS─> CloudFront (<domain>, www.<domain>) ─OAC─> S3 ceview-prod-site-<acct>
   │
   └─HTTPS─> api.<domain> ─A─> Lightsail static IP
              Lightsail firewall: 443, 80 (ACME + redirect), 22 (your IP + browser SSH)
              └ caddy ──> spring-boot:8080 ──> fastapi-sbert:8000 ──┐
                                           ──> fastapi-transformer:8001
                                           ──> postgres:5432 <──────┘
                 compose network is internal. Only caddy publishes ports.
                 /data (attached encrypted disk): pgdata/, hf-cache/

Box ─(IAM user ceview-box)─> ECR pull · SSM read /ceview/prod/* · S3 ops: releases/ (read), backups/ (write)
                              · CloudWatch Logs /ceview/prod · CloudWatch metrics (CWAgent)
GitHub Actions ─(OIDC role ceview-github-deploy, sub = repo:SherieHub/CeView:ref:refs/heads/release)─>
     ECR push · S3 site sync · S3 ops releases/<sha>/ + bootstrap/ · CloudFront invalidation
     · SSM put /ceview/prod/release-sha (last step)
```

### Components

**`deploy/aws/deploy.env`** (committed, non-secret)
- AWS region and account ID, domain, the site and ops bucket names, the CloudFront distribution ID and
  the GitHub deploy role ARN.
- Read by the workflow and shipped to the box in the release bundle.

**`deploy/aws/frontend.production.env`** (committed, public)
- `VITE_API_BASE_URL=https://api.<domain>`, the `VITE_FIREBASE_*` web config, and the `VITE_PRIVACY_URL`,
  `VITE_TERMS_URL` and `VITE_CONTACT_EMAIL` values.
- The workflow copies it to `frontend/.env.production.local` before `npm run build`.

**`deploy/aws/docker-compose.prod.yml`**
- Services: `caddy`, `postgres`, `fastapi-sbert`, `fastapi-transformer`, `spring-boot`.
- Images: `${ECR_REGISTRY}/ceview/<svc>:${IMAGE_TAG}`.
- `restart: unless-stopped`, logging through the `awslogs` driver to `/ceview/prod`.
- Memory limits: sbert 2200m, spring-boot 900m (`JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75`),
  transformer 600m, postgres 512m, caddy 64m.
- sbert:
  - `PRELOAD_E5_ENCODER=true`, `ENABLE_WANDB=false`, `SERPAPI_KEY` passed through.
  - Health check `start_period: 600s`. spring-boot does **not** wait on sbert health.
- spring-boot:
  - `SERVER_FORWARD_HEADERS_STRATEGY=native`, `CEVIEW_INGESTION_ADMIN_TRIGGER_ENABLED=false`,
    `INGESTION_ENABLED=true`.
  - URL settings derived from `DOMAIN`.
- transformer: `FORECAST_ENGINE=bilstm`.
- Volumes: bind mounts `/data/pgdata` and `/data/hf-cache`, plus named volumes for caddy's data and
  config.

**`deploy/aws/Caddyfile`**
- `api.{$DOMAIN}` → `reverse_proxy spring-boot:8080`, with HSTS.
- Caddy's defaults pass `X-Forwarded-For` and `X-Forwarded-Proto` and impose no response timeout.

**`deploy/aws/postgres-init/01-extensions-and-roles.sh`**
- As superuser `postgres`: creates the `ceview` login role (password `DB_APP_PASSWORD`) and the `ceview`
  database owned by it.
- Creates the `vector` and `pgcrypto` extensions in that database. Flyway V1's
  `CREATE EXTENSION IF NOT EXISTS` then becomes a no-op.

**`deploy/aws/scripts/`**
- `bootstrap.sh <ops-bucket>`, run as root once (re-running is safe):
  - Formats and mounts the attached disk at `/data` (only if it isn't already formatted).
  - Sets up a 2GB swap file.
  - Installs Docker Engine and the Compose plugin, `amazon-ecr-credential-helper`, unattended-upgrades
    and the CloudWatch agent (in on-premises mode, reading the same credentials file).
  - Gives `dockerd` the credentials path so the `awslogs` driver works.
  - Installs the systemd units and the `/usr/local/bin/ceview-compose` wrapper.
  - Runs `deploy.sh` once.
- `deploy.sh`:
  - Takes a `flock`, then reads `release-sha` from SSM. If unchanged or missing, it exits 0.
  - Otherwise it syncs `s3://<ops>/releases/<sha>/` to `/opt/ceview/releases/<sha>/`, runs
    `fetch-secrets.sh`, and points `/opt/ceview/current` at the new release.
  - Runs `ceview-compose pull && up -d`, then waits up to 10 minutes for spring-boot `/actuator/health`
    UP and the containers' Docker health checks.
  - On success, records the SHA in `/opt/ceview/state/deployed-sha`. On failure, restores the previous
    symlink, runs `up -d`, and logs `DEPLOY_FAILED sha=<sha>`.
  - Logs go to `/var/log/ceview/deploy.log`, which the CloudWatch agent ships.
- `fetch-secrets.sh`: renders `/ceview/prod/*` SecureStrings to `/opt/ceview/.env`, skipping
  `release-sha`.
- `backup.sh`: runs `pg_dump -Fc` inside the postgres container and streams it to
  `s3://<ops>/backups/pg/<UTC date>.dump`.
- `init-data.sh`, idempotent and run once after the first deploy:
  - Imports `uniqueness-corpus.sql`, skipping it if reference embeddings already exist.
  - Runs `sql/delete-demo-data.sql`.

**`deploy/aws/systemd/`**
- `ceview-deploy.{service,timer}`: every 2 minutes.
- `ceview-backup.{service,timer}`: daily at 18:00 UTC (02:00 PHT).

**`deploy/aws/sql/delete-demo-data.sql`**
- Removes the 9 `@ceview.local` operators, their `20000000-…` profiles, and every row that hangs off
  them (V15/V18/V40 seeds). Deletes run in foreign-key-safe order inside one transaction.
- Never touches `is_reference` rows (`25000000-…`).

**`deploy/aws/cloudfront/spa-rewrite.js`** (viewer-request function)
- Contains a `__DOMAIN__` placeholder that the operator replaces with the apex domain when pasting it
  into the console (runbook B5).
- `www.` host → 301 to the apex.
- Paths with no file extension → `/index.html`.

**`deploy/aws/iam/`**
- `github-deploy-trust.json`, `github-deploy-policy.json`, `box-user-policy.json`.

**`.github/workflows/deploy-aws.yml`**
- Runs on `push: release` and `workflow_dispatch`, with `permissions: id-token: write, contents: read`.
- Jobs:
  - `images`: matrix of 3 services, buildx with the GHA cache, pushes `:<github.sha>`.
  - `bundle`: uploads `deploy/aws/` and `uniqueness-corpus.sql` to `releases/<sha>/`, and copies
    `bootstrap.sh` to `bootstrap/`.
  - `frontend`: build, `s3 sync` (assets get `max-age=31536000,immutable`, `index.html` gets
    `no-cache`), then invalidates `/index.html`.
  - `publish`: needs all three jobs; writes `release-sha`.

### Code changes (pre-go-live fixes)

1. **`IngestionTriggerController`:** add
   `@ConditionalOnProperty(name = "ceview.ingestion.admin-trigger-enabled", havingValue = "true", matchIfMissing = true)`.
   Prod sets it to `false`. Today any logged-in operator can run the full daily ingestion synchronously,
   which also burns SerpApi quota.
2. **`ClickTrackingService.destinationFor`:**
   - Hosted links currently redirect to `{attribution base}/attribution/enquiry`, which serves nothing.
   - New target: `{ceview.attribution.enquiry-base-url}/enquiry`, the frontend route at
     `frontend/App.tsx:175`, which reads `?cv=`.
   - The new property binds to `${FRONTEND_BASE_URL:http://localhost:5173}`.
   - Unit test.
3. **Forwarded headers:** prod sets `SERVER_FORWARD_HEADERS_STRATEGY=native`. Tomcat's RemoteIpValve
   trusts private ranges (Docker's 172.x), so `EnquiryRateLimitFilter` and `RedirectController` see the
   real client IP. Config only, no code change.
4. **`backend/fastapi-sbert/Dockerfile`:** install `torch` from `https://download.pytorch.org/whl/cpu`
   before `requirements.txt`. The default Linux wheel pulls in CUDA libraries, adding several GB.
5. **`backend/fastapi-sbert/app/main.py`:** a startup hook gated by `PRELOAD_E5_ENCODER=true` calls
   `_BertModel.get()` (`app/core/BertModel.py`), so E5 loads before `/healthz` answers and the first
   uniqueness request doesn't exceed Spring's 90s timeout. Test.
6. **Local `backend/docker-compose.yml`:** pass `SERPAPI_KEY` to the `fastapi` service too, so dev
   matches prod.

## Data flow: a release

1. A maintainer fast-forwards `release` to a commit on `main` that has passed CI, and pushes it.
2. The workflow builds and pushes the images, uploads the bundle, and publishes the frontend.
3. As its last step, it writes `release-sha`.
4. Within 2 minutes, the box's `deploy.sh` notices the new SHA and rolls out.
   - Flyway migrations run when spring-boot starts.
   - If health checks fail, the box reverts to the previous release and an email alarm fires.

The frontend can be live up to about 2 minutes before its matching backend, so API changes must stay
backward compatible across one release.

## Error handling and recovery

- **Bad release:** automatic rollback of the backend containers. For a full rollback, `git revert` on
  `main` and fast-forward `release`.
- **Backend-only emergency rollback:** `aws ssm put-parameter --name /ceview/prod/release-sha --value <old-sha> --overwrite`.
  It works while ECR still holds those images (the last 10).
- **Schema changes are forward-only:** rolling the app back across a migration that dropped or renamed
  columns fails Hibernate `validate`. Write migrations additively.
- **Lost instance:** create a new instance from the latest Lightsail snapshot (or a fresh one with
  bootstrap), restore the newest `backups/pg/*.dump`, then repoint the static IP.
- **E5 download failure:** sbert stays unhealthy and Spring's classification calls degrade as they do
  locally. The `hf-cache` on `/data` survives restarts, so the download happens once.

## Risks accepted

- Single instance: a deploy or restart causes a 30–90s API blip. Release outside Cebu business hours.
- A static IAM key sits on the box. Mitigations: least-privilege policy, quarterly rotation, CloudTrail.
- SerpApi's free quota is likely too small for daily ingestion at 20–100 businesses, and a paid plan
  exceeds the budget. Measure on day 1.
- Groq free-tier rate limits.
- The HF Space sleeps when idle, so the first forecast call after a quiet spell is slow.
- Meta Ads for non-tester users needs App Review and Business Verification. Until then, add pilot MSMEs
  as app testers.
- Future Flyway migrations that seed rows referencing the deleted demo IDs will fail in prod. Rule: no
  demo seed data in `db/migration` from now on.
- Business profiles, images and captions are sent to Groq, Hugging Face and SerpApi, outside the
  Philippines. The privacy notice must disclose this.

## Testing

- **Unit tests:** `ClickTrackingService` redirect target; `IngestionTriggerController` absent when the
  property is `false` (`@WebMvcTest` or context test); sbert preload hook called or skipped based on the
  env var.
- **Static checks:** `docker compose -f deploy/aws/docker-compose.prod.yml config`, `shellcheck`
  `deploy/aws/scripts/*.sh`, `actionlint` on the workflow.
- **Local rehearsal:** run the prod compose with a local `.env` and images built locally.
  - spring-boot healthy; sbert healthz only after E5 loads.
  - `/r/<slug>` → `<FRONTEND_BASE_URL>/enquiry?cv=…`.
  - `init-data.sh` run twice gives the same result.
  - The admin trigger returns 404.
- **Post-deploy:** the go-live checklist in `docs/DEPLOY_AWS.md` §B17.
