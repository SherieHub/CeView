# Testing the Demand / Surge Pipeline Locally

A stage-gated runbook for answering one question: **can the current
implementation actually receive market signals and surface a surge to an
operator on the dashboard?**

Stack setup is **not** covered here — see [`RUNNING.md`](RUNNING.md) §3 (Docker)
and §6 (seeded accounts). This guide picks up once `docker compose up` has
succeeded, and complements `RUNNING.md` §7's manual smoke test by going deep on
one pipeline instead of broad across all screens.

> **Read the stages in order and stop at the first failure.** Failures cascade:
> a rate-limited PyTrends fetch in Stage 1 shows up as an empty dashboard in
> Stage 6. If you skip ahead you will debug the wrong layer.

---

## What this proves — and what it can't

**Proves:** external trend data is reachable, gets persisted as trusted signal
records, survives the forecast pipeline into a demand alert, and renders as a
surge card the operator can click.

**Cannot prove anything if you test as a seeded operator.**
[`V18__module2_module3_seed_data.sql`](backend/spring-boot/src/main/resources/db/migration/V18__module2_module3_seed_data.sql)
hardcodes forecast results and market scores for all 9 demo operators, and
demand alerts for operators **1, 3, 5, 7, 9**. Ramon Dela Cruz (operator 1) shows
a surge card whether or not ingestion, PyTrends, or the forecaster work at all.
That is why Stage 0 uses him strictly as a control and everything after it uses
an account with no seeded rows.

### The two alert sources

The dashboard feed merges two independent chains. They fail independently, so
the runbook verifies them separately:

| | Demand alerts | Keyword-trend alerts |
| --- | --- | --- |
| Endpoint | `GET /api/notifications` | `GET /api/notifications/keyword-trends` |
| Backing data | Persisted `tbl_demand_alert` rows | Live PyTrends call, nothing persisted |
| Needs ingestion + forecast? | Yes | **No** |
| Latency | ~0.15s | Up to ~75s |
| Stage | 3–4 | 5 |

---

## Prerequisites

```bash
cd backend
GROQ_API_KEY=<key> HF_TOKEN=<token> docker compose up -d --build
docker compose ps
```

All four of `postgres`, `fastapi`, `fastapi-transformer`, `spring-boot` must be
up. **`fastapi-transformer` on `:8001` is the one that matters here** — it owns
every PyTrends call, and the `e2e-journey` CI job deliberately runs without it,
so "CI is green" does not mean this service works.

Frontend on `:3001` (`cd frontend && npm run dev`). `jq` recommended.

Shell snippets are Git Bash. On PowerShell, swap `$TOKEN` interpolation for
`$env:TOKEN` and drop the line continuations.

---

## Stage 0 — Control: does the read + render path work at all?

**~2 minutes. Do not skip.** If this fails, nothing downstream is worth running.

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}' \
  | jq -r '.token')
echo "${TOKEN:0:20}..."

curl -s http://localhost:8080/api/notifications \
  -H "Authorization: Bearer $TOKEN" | jq '.notifications | length'
```

**Expect:** a JWT, and `1` notification (Ramon's seeded Korea alert).

Then open `localhost:3001`, log in as Ramon, and confirm the dashboard renders
**Demand Surge Detected — South Korea**.

**If it fails:** the problem is auth, the DB, or the frontend — not the pipeline.
Check `docker compose logs spring-boot` and Flyway migration status. Stop here.

---

## Stage 1 — Is PyTrends reachable from this machine?

The single most likely failure, and the one that masquerades as everything else.

```bash
curl -s -X POST http://localhost:8001/internal/market-data/trends \
  -H 'Content-Type: application/json' \
  -d '{"market":"korea","categories":["Coastal & Island"]}' | jq
```

**Expect:** HTTP 200 and — this is the whole assertion — **`"source": "pytrends"`**.
Takes 10–30s; the service sleeps 4–12s per fetch by design
([`trend_service.py`](backend/fastapi-transformer/app/services/trend_service.py), `JITTER_MIN_S`/`JITTER_MAX_S`).

Then the 12-week backfill, which is what a first-time profile actually triggers:

```bash
curl -s -X POST http://localhost:8001/internal/market-data/trends/history \
  -H 'Content-Type: application/json' \
  -d '{"market":"korea","categories":["Coastal & Island"],"weeks":12}' \
  | jq '{source, points: (.weekly_series | length)}'
```

**Expect:** `{"source": "pytrends", "points": 12}`.

**If it fails:**

- **503 `MOD21_TRENDS_UNAVAILABLE`** — read the `cause` field. Google rate-limited
  you (429), the network is blocked, or `pytrends` failed to import. Wait
  15–30 minutes before retrying; hammering it extends the block.
- **`"source": "stub"`** — a fallback value, not real data. Rows written from
  this are rejected downstream by
  [`EnrichedSequenceBuilder`](backend/spring-boot/src/main/java/com/ceview/module2/submodule22/EnrichedSequenceBuilder.java#L79),
  which counts only `source='pytrends'`.
- **Connection refused** — `fastapi-transformer` isn't up.
  `docker compose logs fastapi-transformer`.

> The `/trends` docstring claims it "always returns 200: falls back to a curated
> seasonal stub." That is **stale** — `trend_service` raises `DependencyUnavailable`
> and the router only catches `ValueError`, so you get a 503. Trust the `source`
> field and the database, not the docstrings.

**Do not continue until `source` is `pytrends`.** Every later stage will produce
an empty dashboard otherwise, for a reason that has nothing to do with the
dashboard.

---

## Stage 2 — Pick the test account

Use an account with **no seeded Module 2 rows**. Easiest is one you already
onboarded (e.g. `Sunset Cove Beach Resort`) — reusing it avoids needing the
HuggingFace Space just to create a test subject.

```bash
docker compose exec postgres psql -U ceview -d ceview -c \
  "SELECT business_profile_id, business_name, categories, uniqueness_score
     FROM tbl_business_profile
    WHERE business_profile_id::text NOT LIKE '20000000-%'
    ORDER BY created_at DESC;"
```

Two requirements, both hard gates:

- **`categories` must be non-empty.** `ingestForProfile` logs
  `"has no categories set — skipping ingestion (0 pairs)"` and returns 0 otherwise.
- **`uniqueness_score` must be set,** or the frontend guard bounces you to
  `/onboarding` instead of `/dashboard`.

Export the id and a token for it:

```bash
PROFILE=<business_profile_id from above>
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<your test email>","password":"<your password>"}' | jq -r '.token')
```

Confirm the starting state is genuinely empty:

```bash
curl -s http://localhost:8080/api/notifications -H "Authorization: Bearer $TOKEN" \
  | jq '.notifications | length'   # expect 0
```

---

## Stage 3 — Ingestion → signal records

```bash
curl -s -X POST http://localhost:8080/api/admin/ingestion/trigger \
  -H "Authorization: Bearer $TOKEN" --max-time 3600
```

Two things that surprise people:

- **It is JWT-gated** despite the `/api/admin/` path — only `/api/auth/**`,
  `/actuator/**` and `/error` are `permitAll`
  ([`SecurityConfig.java:42`](backend/spring-boot/src/main/java/com/ceview/config/SecurityConfig.java#L42)).
- **It runs synchronously on the request thread, for every profile in the
  database** — ~27+ (market, category) pairs across all 9 seeded operators plus
  yours, each with a 12-week fetch and jitter sleeps. Budget **20–60 minutes**.
  `--max-time 3600` is not paranoia.

Watch it rather than waiting blind:

```bash
docker compose logs -f spring-boot | grep -iE "ingest|MOD21"
```

Then verify what landed — this is the step that separates "the job ran" from
"the job produced usable data":

```bash
docker compose exec postgres psql -U ceview -d ceview -c \
  "SELECT target_market, category, source, count(*) AS rows, max(aggregated_at) AS newest
     FROM tbl_market_signal_record
    WHERE business_profile_id='$PROFILE'
    GROUP BY 1,2,3 ORDER BY 1,2;"
```

**Expect:** `source = pytrends` with **`rows >= 4`** for each (market, category) —
`MIN_RECORDS` in
[`EnrichedSequenceBuilder.java:29`](backend/spring-boot/src/main/java/com/ceview/module2/submodule22/EnrichedSequenceBuilder.java#L29).
A successful first run backfills ~12 weeks per pair, so expect 12, not 4.

**If it fails:**

- **`rows` present but `source` is `stub` or `unknown`** — Stage 1 regressed
  mid-run (rate limit). These rows are dead weight; the forecaster ignores them.
- **Zero rows** — check the logs for `has no categories set` (Stage 2 gate) or
  `MOD21_INGESTION_JOB_FAILED`.
- **Nothing happens at all** — `ceview.ingestion.enabled` is `false` under the
  `h2` profile ([`application-h2.yml:25`](backend/spring-boot/src/main/resources/application-h2.yml#L25)).
  This runbook requires the Docker/Postgres path.

---

## Stage 4 — Forecast → market score → demand alert

```bash
curl -s -X POST http://localhost:8080/api/forecasting/analyze \
  -H "Authorization: Bearer $TOKEN" --max-time 300 | jq
```

**Expect:** 200 with a `markets` array.

**A 503 `MOD22_NO_MARKET_DATA` means Stage 3 did not produce enough trusted
rows.** Go back to Stage 3; do not debug forward. This is deliberate design —
[`ForecastingService.java:481`](backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java#L481)
refuses to fabricate a baseline series, because an invented "demand is ~50"
reading is indistinguishable from a real one once forecast.

Verify the chain persisted:

```bash
docker compose exec postgres psql -U ceview -d ceview -c \
  "SELECT f.target_market, s.market_score_id IS NOT NULL AS scored,
          a.alert_level, a.trend, a.window_open_date
     FROM tbl_forecast_result f
     LEFT JOIN tbl_market_score s ON s.forecast_result_id = f.forecast_result_id
     LEFT JOIN tbl_demand_alert  a ON a.market_score_id   = s.market_score_id
    WHERE f.business_profile_id='$PROFILE'
    ORDER BY f.generated_at DESC LIMIT 10;"

curl -s http://localhost:8080/api/notifications -H "Authorization: Bearer $TOKEN" \
  | jq '.notifications | length'
```

**Expect:** forecast rows, scored rows, and ≥1 alert row; a non-zero
notification count.

**Forecast rows but no alert row** is a legitimate outcome, not a bug — an alert
is only persisted when predicted demand clears the threshold. It means the
pipeline works and the market is quiet. Note it and continue.

---

## Stage 5 — The keyword-trend track

Independent of Stages 3–4. It needs **no** forecast rows, so it works even on a
brand-new profile.

```bash
time curl -s http://localhost:8080/api/notifications/keyword-trends \
  -H "Authorization: Bearer $TOKEN" --max-time 120 | jq
```

**Expect:** up to ~75s (`rank-markets-timeout-seconds: 90`), then a
`notifications` array with one entry per operator category, titled
`Keyword Trend Alert — <Category>`.

**If it fails:** same causes as Stage 1 — this path hits PyTrends via
`rank-markets`. The frontend swallows failures here by design
([`useDashboardState.ts`](frontend/components/module-2/2.1-dashboard/useDashboardState.ts),
the keyword-trends `.catch(() => {})`), so a failure is **silent in the UI**.
Curl is the only way to see it.

---

## Stage 6 — Does the operator actually receive the surge?

Log in at `localhost:3001` as the Stage 2 account.

Check, in order:

1. **Signal summary tiles** — "Unread alerts", "Confirmed surges", "Top market now".
2. **Surge Alerts feed** — cards, skeletons, or an empty state?
3. **Click an alert** — the markets column should reveal ranked markets.
4. **Click a rank card** — the Market Radar drawer opens with `?market=<id>` in the URL.
5. **Sidebar Dashboard badge** — compare it to the feed.

### The mismatch check

Compare what you counted in Stages 4 and 5 against the screen:

| Stage 4 alerts | Stage 5 alerts | Feed should show |
| --- | --- | --- |
| ≥1 | any | Cards for both sources merged |
| 0 | 0 | "No notifications yet" |
| 0 | ≥1 | **Cards — but currently shows "No notifications yet"** |

That third row is a **known defect**, and it is the specific thing this stage
exists to reproduce. `mode` is derived from `alerts.length` — primary demand
alerts only ([`useDashboardState.ts`](frontend/components/module-2/2.1-dashboard/useDashboardState.ts),
the `mode` memo) — while `unreadCount` is derived from `myAlerts`, which
*includes* keyword alerts. And
[`AlertFeed.tsx:47`](frontend/components/module-2/2.1-dashboard/AlertFeed.tsx#L47)
returns the empty state whenever `mode === 'empty'`, ignoring the alerts passed
to it.

**Symptom:** the badge and the "Unread alerts" tile show a non-zero count while
the feed says "No notifications yet". A real surge signal reaches the operator's
screen as a number they cannot act on.

Record whether you reproduced it. Fixing it is out of scope for this runbook.

---

## Stage 7 — Induced failure states

None of these are covered by an automated test (see Known Gaps), so they are
worth exercising by hand at least once.

### `ai-down` — amber banner, alerts still render from cache

```bash
docker compose stop fastapi-transformer
# reload the dashboard
docker compose start fastapi-transformer
```

`forecast.status()` fails → `aiServiceDown` → mode resolves to `ai-down`
**before** `empty`. Order matters: a failed load also leaves `alerts` empty, and
"your data may be stale" is honest where "you have nothing" is not.

**Expect:** amber banner, existing alerts still visible.

### `MOD22_NO_MARKET_DATA` — refresh fails loudly

```bash
docker compose exec postgres psql -U ceview -d ceview -c \
  "DELETE FROM tbl_market_signal_record WHERE business_profile_id='$PROFILE';"
```

Click **Refresh forecast**.

**Expect:** the button disables, shows a spinner label, then surfaces an error.
**This wipes Stage 3's work** — do it last, or be ready to re-run a 20–60 minute
ingestion.

### `empty` — no forecast has ever run

Log in as a fresh account, or as seeded operator 2, 4, 6, or 8 (Ferdie,
Teresita, Nena, Krizia). They have forecast and market-score rows but **no**
demand alert, so `GET /api/notifications` returns `[]`.

**Expect:** "No notifications yet" and the copy about market trend data
appearing after the first forecast run.

---

## Symptom → cause

| Symptom | Likely cause | Go to |
| --- | --- | --- |
| Dashboard empty, `/api/notifications` returns `[]` | No `tbl_demand_alert` rows for this profile | Stage 4 |
| `analyze` returns 503 `MOD22_NO_MARKET_DATA` | Fewer than 4 `source='pytrends'` signal rows | Stage 3 |
| Signal rows exist but forecast still 503s | Rows are `source='stub'`/`'unknown'` — untrusted by policy | Stage 1 |
| Ingestion returns instantly, writes nothing | Profile has no `categories`, or `h2` profile disables ingestion | Stage 2 |
| Transformer 503 `MOD21_TRENDS_UNAVAILABLE` | Google rate limit, network block, or pytrends import failure | Stage 1 |
| Badge shows a count, feed says "No notifications yet" | Keyword alerts counted but not rendered — known defect | Stage 6 |
| Keyword alerts never appear, no error anywhere | Frontend swallows keyword-trend failures by design | Stage 5 |
| Alerts render for Ramon but nobody else | You are reading V18 seed data, not pipeline output | Stage 0 |
| Everything works, then stops overnight | Nothing re-ran — the cron needs the service awake at 00:00 UTC | Known Gaps |

---

## Known gaps this run will expose

Findings, not action items. Each is a deliberate observation about the current
implementation, verified against the code.

1. **Keyword alerts are counted but not rendered** when no demand alerts exist
   (Stage 6). Two derivations disagree about what counts as an alert.

2. **Nothing triggers a forecast on dashboard load.** The backend has
   `POST /api/forecasting/ensure` — "runs the pipeline only when the profile's
   newest forecast is missing or older than 12h" — but **`ensure` does not exist
   in [`frontend/services/apiClient.ts`](frontend/services/apiClient.ts) at all.**
   A newly-onboarded operator sits on the empty state until they manually click
   Refresh forecast, which then 503s unless ingestion has already run.

3. **Ingestion depends on an in-process cron.** `@EnableScheduling` plus
   [`MarketDataIngestionJob`](backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionJob.java#L43)
   at 00:00 UTC daily and
   [`TrendFetchSchedulerService`](backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchSchedulerService.java#L102)
   Sundays 00:00 UTC. A stopped or sleeping container runs neither. This is the
   reason the pipeline cannot work unattended on a free-tier host that spins
   down after 15 minutes of inactivity.

4. **The dashboard has no automated coverage.** All 10 cases in
   [`e2e/tests/dashboard.spec.ts`](e2e/tests/dashboard.spec.ts) are
   `test.describe.skip` + `test.fixme()` stubs — including every state in
   Stage 7. The only spec exercising the dashboard for real is
   `journey.spec.ts`, and it logs in as seeded operator 1, whose V18 rows mean
   it would pass with the ingestion pipeline completely broken.

5. **Manual ingestion is a synchronous, all-tenant operation.**
   [`IngestionTriggerController.trigger()`](backend/spring-boot/src/main/java/com/ceview/module2/submodule21/IngestionTriggerController.java#L25)
   calls `runDailyIngestion()` on the request thread for every profile in the
   database. Fine as a dev tool, unusable as an operator-facing action.
