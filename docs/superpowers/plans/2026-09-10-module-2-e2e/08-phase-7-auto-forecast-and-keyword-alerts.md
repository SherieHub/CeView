# Phase 7 — Auto-forecast & keyword alerts

Implements plan decisions **P-1**, **P-2**, **P-3** — audit items **C-07, C-08,
C-09, C-17, C-18**.

- **P-3 / C-17 / C-18** (persisted keyword-trend alerts) landed earlier on this
  branch — commit `6b16d062 feat(module-2): persist weekly keyword alerts`.

---

## Step 16 of 20 — Close the scheduler → forecast gap (C-07, C-08, C-09) ✅

### Decision on C-07 — retire the weekly grid as a signal source (option b)

The profile-agnostic weekly 21-job Google Trends grid
(`TrendFetchSchedulerService`) and the per-profile `tbl_market_signal_record`
model **cannot be bridged cleanly**: a grid row has no `business_profile_id`, and
every forecast reader (`EnrichedSequenceBuilder`, `loadCategoryScopedHistory`,
chart history) queries by `(business_profile_id, market, category)`. Option (a)
would require fabricating a profile id per grid row, or making signal records
"shared" nullable-profile rows and teaching every reader a fallback — a large
change to the read model for a subsystem that **frozen decision P-1 already says
"feeds nothing the UI reads"**, and it would keep the grid double-billing the
rate-limited PyTrends API that per-profile ingestion already hits.

**Resolution: stop trying to reconcile the mismatch.**
`MarketDataIngestionService.ingestForProfile` is the correct, live, per-profile
writer. The grid becomes an **opt-in warm cache / diagnostic**:

- `TrendFetchSchedulerService.runWeeklyTrendFetch` is gated behind
  `ceview.trend-fetch.enabled` (**default `false`**, env `TREND_FETCH_ENABLED`).
  P-1 said this gate exists; it did not — the `@Scheduled` was unconditional.
- The class and `tbl_trend_fetch_job` are kept: the forecast pipeline still reads
  `tbl_trend_fetch_job.last_error` as the `cause` breadcrumb in
  `MOD22_NO_MARKET_DATA`. "Retired" = dormant by default, not dropped.

### C-08 — forecast after ingestion

`MarketDataIngestionJob.runDailyIngestion` now calls
`forecastingService.forecastForProfile(profileId, refresh=false)` after each
profile's ingest.

- **Sequential (bound = 1), deliberately.** The pipeline's Groq batch call is
  globally ~1 RPM, so parallel forecast runs would only contend on that limit —
  the effective safe concurrency is 1.
- **Per-profile failure isolation.** Each forecast is in its own `try/catch`; a
  failure is appended to `IngestionJobLog.errorMessage` (`forecast profile=<id>:
  <msg>`) and logged, and does not abort the run. The run's status stays
  `COMPLETED` when any records were ingested — one down forecaster is not fatal.
- **Skipped when `ingested == 0`** (profile has no categories → the pipeline
  would only return `MOD22_NO_MARKET_DATA`).
- The summary log line and `tbl_ingestion_job_log` now carry
  `forecastsRun` / `forecastsFailed`.

### C-09 — make `POST /api/forecasting/ensure` non-dead

The backend was already correct: `ForecastingService.ensureFreshForecast`
fast-fails an unknown profile, gates on the newest 4-week forecast's age
(`maxAgeHours`, default 12), returns `loadMarketsFromDb` (a pure DB read) when
fresh, and runs `forecastForProfile(id, true)` when stale/missing; the controller
maps the incomplete-profile case to `409 MOD22_PROFILE_NOT_READY`. It was dead
only because **nothing called it** — a frontend wiring task:

- `apiClient.forecast.ensure(maxAgeHours = 12)` → `POST /api/forecasting/ensure`.
- `useDashboardState` calls it on mount in its own effect (not folded into the
  primary load — it may run the ~seconds-long pipeline and the feed must render
  immediately from whatever exists). On success it reloads
  `notifications.list()`. A `409` is routed into `state.error`, where the
  existing `ApiErrorPanel` + `isProfileNotReady` render the "Complete onboarding
  first" panel; any other failure is swallowed (`forecast.status` already owns
  the degraded-mode signal).

### Config

`application.yml`: new `ceview.trend-fetch.enabled: ${TREND_FETCH_ENABLED:false}`.
No new required env var. `ceview.ingestion.enabled` (default `true`) still gates
the daily job.

### Tests

- `MarketDataIngestionJobTest` (`@TestPropertySource ceview.ingestion.enabled=true`,
  `@MockBean` ingestion + forecasting services): trigger fires per profile; one
  profile's forecast throwing does not block the other two and is recorded on the
  job log with status `COMPLETED`; a profile that ingested nothing is not
  forecasted.
- `EnsureFreshForecastTest` (`@SpringBootTest`, `@MockBean` `ai` /
  `externalClient` / `ingestionService`): fresh forecast → `verifyNoInteractions(ai)`
  (DB-read path); stale forecast (`generatedAt = now-24h`) → the pipeline runs
  (`verify(ai).runForecastInferenceBatch(any())`); unknown profile → fast
  `IllegalArgumentException`, no AI.

Full `com.ceview.module2.**`: 99 run, the same 8 pre-existing branch failures,
zero new. Frontend `tsc` + module-2 `vitest`: unchanged (1 pre-existing
`MarketsRevealPanel` failure).

---

## Not done in Step 16 (carried forward in this phase)

- The daily job forecasts every profile it ingests, but a **brand-new operator
  who onboards mid-day** still relies on the `ensure`-on-mount nudge until the
  next 00:00 UTC run — the two together close the "must press Refresh" gap.
- `TrendFetchSchedulerService` has no unit test for the new gate (the task asked
  only for the trigger and `ensure` tests); the gate is a one-line early-return
  mirroring `MarketDataIngestionJob`'s existing (also untested) `enabled` gate.
