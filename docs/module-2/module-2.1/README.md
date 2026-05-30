# Module 2.1 — Market Data Ingestion (Scheduled)

Submodule 2.1 is the **scheduled** half of Module 2. It runs two independent cron jobs that collect market intelligence data and persist it as `MarketSignalRecord` rows, which Submodule 2.2 reads to build AI forecast inputs. No user action triggers 2.1 — it runs entirely in the background.

| Diagram | File | Scope |
|---|---|---|
| Class | [`class.puml`](class.puml) | Spring Boot ingestion services, entities, repositories + FastAPI market-data and trends routers |
| ERD | [`er.puml`](er.puml) | 4 tables owned by 2.1 + 2 Module 1 anchor tables |
| Sequence | [`sequence.puml`](sequence.puml) | Flow A: daily ingestion job; Flow B: weekly Google Trends state machine |

---

## Two Scheduled Jobs

| Job | Class | Schedule (UTC) | Scope |
|---|---|---|---|
| **Daily Ingestion** | `MarketDataIngestionJob` | `0 0 0 * * *` — every day at midnight | GDP + forex fetch, PyTrends current-week or 12-week backfill, seasonality computation, persist `MarketSignalRecord` |
| **Weekly Trends** | `TrendFetchSchedulerService` | `0 0 0 * * SUN` — every Sunday at midnight | 21 (7 category × 3 market) PyTrends jobs processed sequentially; `PENDING → IN_PROGRESS → SUCCESS/FAILED` state machine with 3-attempt retry; idempotent `UNIQUE(category, market, week_of)` |

---

## Backend Components

### Spring Boot

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Job** | `MarketDataIngestionJob` | `com/ceview/module2/submodule21/MarketDataIngestionJob.java` | `@Scheduled` cron entry point; queries all `BusinessProfile` records, calls `MarketDataIngestionService.ingestForProfile()` per profile |
| **Controller** | `IngestionTriggerController` | `com/ceview/module2/submodule21/IngestionTriggerController.java` | Manual trigger endpoint (`POST /api/v1/ingestion/trigger`) for development / ops use |
| **Service** | `MarketDataIngestionService` | `com/ceview/module2/submodule21/MarketDataIngestionService.java` | Per-market ingestion pipeline: concurrent GDP + forex fetch → PyTrends backfill or current-week → seasonality computation via FastAPI → persist `MarketSignalRecord`; inline 2σ spike fallback when FastAPI is unreachable |
| **Service** | `TrendFetchSchedulerService` | `com/ceview/module2/submodule21/TrendFetchSchedulerService.java` | Weekly 21-job state machine; sequential processing to respect PyTrends rate limits (4–12 s jitter per request); auto-retry on next Sunday for FAILED jobs below `max_attempts` |
| **Service** | `ExternalMarketDataClient` | `com/ceview/module2/submodule21/ExternalMarketDataClient.java` | World Bank GDP API (5-year annual growth, 10 s timeout), fawazahmed0 forex CDN (12 concurrent monthly calls via `Flux.merge()`, 30 s combined timeout), static flight references; hardcoded graceful fallbacks |
| **Entity** | `MarketSignalRecord` | `com/ceview/module2/submodule21/MarketSignalRecord.java` | `tbl_market_signal_record` — weekly snapshot: trend index, rolling 7d/30d averages, std-dev, YoY ratio, spike indicator, seasonality score (0–1); primary input for `EnrichedSequenceBuilder` in 2.2 |
| **Entity** | `MarketEconomicTrend` | `com/ceview/module2/submodule21/MarketEconomicTrend.java` | `tbl_market_economic_trend` — GDP 5-year + forex 12-month trend JSON snapshots; consumed by `EconomicInsightsBoard` mini-charts via `ForecastingService` |
| **Entity** | `IngestionJobLog` | `com/ceview/module2/submodule21/IngestionJobLog.java` | `tbl_ingestion_job_log` — audit trail for each daily ingestion run (markets processed, records ingested, error message, start/end timestamps) |
| **Repository** | `MarketSignalRecordRepository` | `com/ceview/module2/submodule21/MarketSignalRecordRepository.java` | Primary query interface used by both 2.1 (saves) and 2.2 (`EnrichedSequenceBuilder` reads) |
| **Repository** | `MarketEconomicTrendRepository` | `com/ceview/module2/submodule21/MarketEconomicTrendRepository.java` | `findTopByMarketOrderByFetchedAtDesc` for 2.2 economic trend lookups |
| **Repository** | `IngestionJobLogRepository` | `com/ceview/module2/submodule21/IngestionJobLogRepository.java` | Audit log persistence |
| **Repository** | `TrendFetchJobRepository` | `com/ceview/module2/submodule21/TrendFetchJobRepository.java` | `tbl_trend_fetch_job` — state machine persistence with `UNIQUE(category, market, week_of)` constraint enabling idempotent upserts |
| **Gateway** | `AIInferenceGatewayService` | `com/ceview/ai/AIInferenceGatewayService.java` | **2.1 methods**: `fetchTrends`, `fetchTrendHistory`, `computeSeasonality` → WebClient calls to FastAPI transformer (port 8001) |

### FastAPI Transformer (`backend/fastapi-transformer/`)

| Router | Service | Endpoint | Responsibility |
|---|---|---|---|
| `marketDataRouter` | `pytrends_client` | `POST /internal/market-data/trends` | Current-week Google Trends index (0–100) for a market + category list; 4–12 s jitter sleep per request |
| `marketDataRouter` | `pytrends_client` | `POST /internal/market-data/trends/history` | N-week (4–52) backfill: returns `weekly_series` of `{date, trend_index}` objects |
| `marketDataRouter` | `seasonal_shift_detector` | `POST /internal/market-data/seasonality` | 4-step CeView SeasonalShift pipeline: rolling 7d/30d averages → 2σ spike test → YoY ratio (52-week lookback) → composite seasonality score [0, 1] |
| `trendsRouter` | `trend_service` | `POST /api/v1/trends/fetch` | Single (category, market) trend job called by `TrendFetchSchedulerService` |
| `trendsRouter` | `trend_service` | `POST /api/v1/trends/rank-markets` | Cross-market keyword volume ranking by business category; consumed by `CategoryRankNotificationService` in 2.2 |

---

## Database Tables

See [`er.puml`](er.puml) for full column detail and relationships.

| Table | Owner | Key Columns |
|---|---|---|
| `tbl_market_signal_record` | 2.1 (written) · 2.2 (read) | `business_profile_id`, `target_market`, `trend_index`, `seasonality_score`, `spike_indicator`, `yoy_ratio`, `aggregated_at` |
| `tbl_ingestion_job_log` | 2.1 | `job_name`, `status`, `markets_processed`, `records_ingested`, `started_at`, `completed_at` |
| `tbl_trend_fetch_job` | 2.1 | `category`, `market`, `status`, `week_of` — `UNIQUE(category, market, week_of)` |
| `tbl_market_economic_trend` | 2.1 (written) · 2.2 (read) | `market`, `gdp_trend_json`, `forex_trend_json`, `currency_code`, `fetched_at` |

---

## Fallback Behaviour

When `fastapi-transformer` is unreachable during ingestion:
- **Seasonality**: Spring Boot falls back to an inline 2σ spike computation using only the existing signal records; `seasonality_score` is set to a conservative `0.5`.
- **PyTrends**: FastAPI uses a deterministic curated stub series (HTTP 429 from Google or network failure); `source` field in the response is set to `"stub"` instead of `"live"`.
