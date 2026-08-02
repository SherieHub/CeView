# Deploying CeView to Render (Free Tier)

This guide deploys the full stack — Postgres, Spring Boot, both FastAPI
microservices, and the React frontend — to [Render](https://render.com) using
only free-tier resources. Read the caveats section first: this stack has real
services that push against what the free tier is designed for, and you should
decide up front how much of that risk you're willing to accept for a demo
deployment.

If you'd rather deploy everything in one pass instead of following the manual
steps below, see [Optional: one-click Blueprint deploy](#optional-one-click-blueprint-deploy).

---

## 1. Free tier reality check — read this first

Render's free tier gives you, per service:

| Constraint | Detail |
|---|---|
| RAM / CPU | 512MB RAM, 0.1 CPU |
| Sleep | Spins down after 15 minutes with no traffic; next request pays a ~30-60s cold-start penalty |
| Persistent disk | None on free web services — anything written to disk (caches, downloads) is gone on every restart/redeploy |
| Postgres | Free databases are deleted after their trial period expires (currently 30 days) — you must recreate and re-migrate, or upgrade to a paid instance to keep it |
| Hours | 750 free instance-hours/month shared across your free services |

**The specific risk in this project: `fastapi-sbert`.** It loads
`tensorflow-cpu` + `sentence-transformers` and downloads a ~1.1GB
multilingual E5 encoder on startup (`app/core/BertModel.py`). That alone is
likely to exceed 512MB RAM on the free plan — the process may be OOM-killed
before `/healthz` ever returns 200, or the download itself may be too slow
within Render's health-check start window. Two ways to handle this:

- **Accept the risk for a demo deploy.** Follow this guide as-is. If
  `fastapi-sbert` fails to boot, everything else (Spring Boot, frontend,
  `fastapi-transformer`, Postgres) still works — you lose the classification
  endpoints that route through it, and the frontend falls back to mock data
  for those views (per `RUNNING.md`'s fallback behavior).
- **Upgrade just that one service.** Deploy the other three pieces free, and
  put `fastapi-sbert` on Render's cheapest paid instance type (more RAM). This
  guide still applies to the other services either way.

Because there's no persistent disk, `fastapi-sbert` also **re-downloads the
1.1GB model on every deploy and every cold-start wake-up** — slow, but
functionally fine once it's up.

---

## 2. Postgres

1. Render dashboard → **New** → **PostgreSQL**.
2. Name: `ceview-db`, Database: `ceview`, User: `ceview`, Plan: **Free**.
3. Once provisioned, open the database page and note the **Internal
   Database URL** (used by services also hosted on Render) and the individual
   host/port/user/password fields (used to build Spring's JDBC URL below).
4. Enable pgvector — open the **Connect** shell (or `psql` from your machine
   using the External URL) and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   This matches the `pgvector/pgvector:pg16` image used locally in
   `backend/docker-compose.yml` — Render's managed Postgres supports the same
   extension, it just isn't enabled by default.

---

## 3. Spring Boot (`backend/spring-boot`)

The existing `Dockerfile` now builds in two stages (source → jar → runtime
image) specifically so Render can build it standalone — it no longer expects
a pre-built jar the way the local `RUNNING.md` workflow historically did.

1. Render dashboard → **New** → **Web Service** → connect this repo.
2. Root directory: leave at repo root; **Dockerfile path**:
   `backend/spring-boot/Dockerfile`; **Docker build context**:
   `backend/spring-boot`.
3. Plan: **Free**.
4. Environment variables:

   | Key | Value |
   |---|---|
   | `SPRING_PROFILES_ACTIVE` | `postgres` |
   | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<db-host>:5432/ceview` (build from the Postgres page's host — **not** the same string as the Internal Database URL, which isn't JDBC-prefixed) |
   | `SPRING_DATASOURCE_USERNAME` | `ceview` |
   | `SPRING_DATASOURCE_PASSWORD` | (from the Postgres page) |
   | `SPRING_FLYWAY_VALIDATE_ON_MIGRATE` | `false` (matches docker-compose locally) |
   | `FASTAPI_SBERT_BASE_URL` | the `fastapi-sbert` service's Render URL, from step 4 |
   | `FASTAPI_TRANSFORMER_BASE_URL` | the `fastapi-transformer` service's Render URL, from step 5 |
   | `JWT_SECRET` | any random 32+ char string |
   | `CORS_ALLOWED_ORIGINS` | the frontend's Render URL, from step 6 (you'll circle back and fill this in once it exists) |

5. Health check path: `/actuator/health`.
6. Deploy. First build compiles the whole app inside Docker — expect several
   minutes.

---

## 4. fastapi-sbert (`backend/fastapi-sbert`)

Its `Dockerfile` is already self-contained (no changes needed).

1. **New** → **Web Service**, same repo. **Dockerfile path**:
   `backend/fastapi-sbert/Dockerfile`; **Docker build context**:
   `backend/fastapi-sbert`.
2. Plan: **Free** (see the [caveat above](#1-free-tier-reality-check--read-this-first)
   about RAM).
3. Environment variables:

   | Key | Value |
   |---|---|
   | `GROQ_API_KEY` | your key from https://console.groq.com/keys (optional here — degrades to fallback responses without it) |
   | `HF_TOKEN` | your token from https://huggingface.co/settings/tokens (optional, avoids HF rate limits on the model download) |
   | `DATABASE_URL` | `postgresql://ceview:<password>@<db-host>:5432/ceview` |

4. Health check path: `/healthz`. Give it a generous health-check timeout in
   the service settings if Render exposes one — the model download can take
   several minutes on a cold start.
5. Deploy, then copy this service's `https://ceview-fastapi-sbert-xxxx.onrender.com`
   URL for use in Spring Boot's `FASTAPI_SBERT_BASE_URL`.

---

## 5. fastapi-transformer (`backend/fastapi-transformer`)

1. **New** → **Web Service**, same repo. **Dockerfile path**:
   `backend/fastapi-transformer/Dockerfile`; **Docker build context**:
   `backend/fastapi-transformer`.
2. Plan: **Free**.
3. Environment variables:

   | Key | Value |
   |---|---|
   | `GROQ_API_KEY` | **required** — this service raises `RuntimeError` and refuses to start without it (see `RUNNING.md`) |

4. Health check path: `/healthz`.
5. Deploy, then copy its URL for Spring Boot's `FASTAPI_TRANSFORMER_BASE_URL`.

---

## 6. Frontend (`ceview/`)

Deployed as a Render **Static Site** — free with no sleep and no RAM ceiling,
since it's just built assets served from a CDN.

1. **New** → **Static Site**, same repo.
2. Build command: `cd ceview && npm install && npm run build`
3. Publish directory: `ceview/dist`
4. Environment variable: `VITE_API_BASE_URL` = the Spring Boot service's
   Render URL from step 3 (e.g. `https://ceview-spring-boot-xxxx.onrender.com`).
   `ceview/services/apiClient.ts` already reads this at build time — no code
   changes needed.
5. Deploy, then copy this static site's URL.

---

## 7. Wire it together

1. Go back to the Spring Boot service's environment variables and set
   `CORS_ALLOWED_ORIGINS` to the frontend's URL from step 6, then redeploy it.
2. Verify each piece is actually up, mirroring the smoke test in
   `RUNNING.md`:
   ```bash
   curl https://ceview-spring-boot-xxxx.onrender.com/actuator/health
   curl https://ceview-fastapi-sbert-xxxx.onrender.com/healthz
   curl https://ceview-fastapi-transformer-xxxx.onrender.com/healthz
   ```
3. Open the frontend URL, open DevTools → Network, and click through the
   sidebar tabs (Home, Campaign Analytics, Business Profile, Uniqueness
   Score) — same checklist as the local smoke test, just against the deployed
   URLs instead of `localhost`.
4. Remember the first request to any sleeping free service takes 30-60s to
   wake up — don't mistake a cold start for a broken deploy.

---

## Optional: one-click Blueprint deploy

`render.yaml` at the repo root declares all five pieces (Postgres + 3 backend
services + frontend) as a Render **Blueprint**. From the Render dashboard:
**New** → **Blueprint** → select this repo. Render reads `render.yaml` and
proposes all five services at once; it will prompt you for the `sync: false`
secrets (`GROQ_API_KEY`, `HF_TOKEN`, `CORS_ALLOWED_ORIGINS`) during setup.

This is a convenience layer over the manual steps above, not a replacement
for understanding them — the same free-tier caveats apply, and
`SPRING_DATASOURCE_URL` still needs to be set by hand after the blueprint
creates the database (Render's blueprint `fromDatabase` helper doesn't
produce a JDBC-prefixed URL automatically; see the comment in `render.yaml`).
