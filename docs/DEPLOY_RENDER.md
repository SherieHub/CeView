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
  endpoints that route through it, and those screens show an error naming
  the unavailable service (nothing substitutes mock data in a deployed build).
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
   | `CEVIEW_ATTRIBUTION_IP_HASH_SALT` | any random string — the service refuses to start without it |
   | `CORS_ALLOWED_ORIGINS` | the frontend's Render URL, from step 6 (you'll circle back and fill this in once it exists) |
   | `EMAIL_PROVIDER` | `resend` — see [Email (Resend)](#email-resend) below; without it, codes are only written to the log and nobody can verify |
   | `RESEND_API_KEY` | your Resend API key |
   | `EMAIL_FROM` | e.g. `CeView <no-reply@yourdomain.com>`, on the domain you verified in Resend |

5. Health check path: `/actuator/health`.
6. Deploy. First build compiles the whole app inside Docker — expect several
   minutes.

### Email (Resend)

Sign-up verification and forgot-password email a 6-digit code. This costs nothing, but note two
constraints:

- **SMTP is blocked on Render's free tier.** Free web services cannot reach outbound ports 25, 465 or 587
  ([Render changelog](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)),
  so Gmail/SMTP will not work. CeView therefore sends over [Resend](https://resend.com)'s HTTPS API.
- **Resend's free tier** is 3,000 emails a month and **100 a day**, with one verified domain. Each
  sign-up or reset sends one email; resends send more. The backend also caps each account (60 s between
  codes, 5 an hour) and each IP (10 requests per 15 minutes) to stop one visitor burning the daily quota.
  When the quota is hit, users see "We could not send the email right now".

Setup:

1. Create a Resend account → **Domains** → **Add Domain** and enter a domain you own.
2. Add the DNS records Resend shows (SPF and DKIM; DMARC is recommended) at your DNS host and wait for
   the domain to show **Verified**. Without a verified domain Resend only delivers to your own address.
3. **API Keys** → create a key with "Sending access".
4. On the Spring Boot service set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=<key>` and
   `EMAIL_FROM=CeView <no-reply@yourdomain.com>` (an address on the verified domain). The service
   refuses to start if the key or sender is missing.
5. Do **not** set `CEVIEW_TEST_SUPPORT_ENABLED` here; the service refuses to start with it and Resend.

**The nine seeded demo operators cannot verify on Render.** Their addresses (`@ceview.local`) do not
exist, so no code can reach them and they stay locked out. That is intentional: demo accounts are for
local development. Register a real account on the deployed site instead.

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
   | `GROQ_API_KEY` | your key from https://console.groq.com/keys (required for captions, creative direction, the compliance audit and reports — without it those endpoints answer 503 naming the missing key) |
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
   | `FORECAST_ENGINE` | `bilstm` (the HuggingFace Space forecaster, same as the AWS deploy). The default `stub` is a naive placeholder. |
   | `SERPAPI_KEY` | your key from https://serpapi.com/manage-api-key — **required** for Market Radar trends; without it those calls answer 503 |
   | `HF_TOKEN` | optional read-only token, if the forecast Space is private or rate-limited |
   | `GROQ_API_KEY` | only if you set `FORECAST_ENGINE=groq` |

4. Health check path: `/healthz`.
5. Deploy, then copy its URL for Spring Boot's `FASTAPI_TRANSFORMER_BASE_URL`.

---

## 6. Frontend (`frontend/`)

Deployed as a Render **Static Site** — free with no sleep and no RAM ceiling,
since it's just built assets served from a CDN.

1. **New** → **Static Site**, same repo.
2. Build command: `cd frontend && npm ci && npm run build`
3. Publish directory: `frontend/dist`
4. Environment variables (read at build time; every `VITE_` value is public):
   - `VITE_API_BASE_URL` = the Spring Boot service's public Render URL from step 3
     (e.g. `https://ceview-spring-boot-xxxx.onrender.com`).
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
     `VITE_FIREBASE_APP_ID` for Google sign-in (optional, `RUNNING.md` §6).
   - `VITE_PRIVACY_URL` and `VITE_TERMS_URL` for the footer links.
   - Never set `VITE_USE_FIXTURES`; the production build refuses it.
5. Add a rewrite rule `/*` → `/index.html` (Rewrite) so deep links such as `/enquiry` load.
6. Deploy, then copy this static site's URL.

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
   sidebar (Dashboard, Content Studio, Calendar, Performance, Settings) —
   same checklist as the local smoke test (`RUNNING.md` §7), just against the
   deployed URLs instead of `localhost`.
4. Remember the first request to any sleeping free service takes 30-60s to
   wake up — don't mistake a cold start for a broken deploy.

---

## Optional: one-click Blueprint deploy

`render.yaml` at the repo root declares all five pieces (Postgres + 3 backend
services + frontend) as a Render **Blueprint**. From the Render dashboard:
**New** → **Blueprint** → select this repo. Render reads `render.yaml` and
proposes all five services at once; it will prompt you for the `sync: false`
values (`GROQ_API_KEY`, `HF_TOKEN`, `SERPAPI_KEY`, `CORS_ALLOWED_ORIGINS`,
`RESEND_API_KEY`, `EMAIL_FROM`, and the frontend's `VITE_API_BASE_URL`) during
setup. The frontend's URL values depend on the backend's public URL, so on the
first pass you may need to fill them in after the services exist and redeploy.

This is a convenience layer over the manual steps above, not a replacement
for understanding them — the same free-tier caveats apply, and
`SPRING_DATASOURCE_URL` still needs to be set by hand after the blueprint
creates the database (Render's blueprint `fromDatabase` helper doesn't
produce a JDBC-prefixed URL automatically; see the comment in `render.yaml`).
