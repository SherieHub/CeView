# Module 2.2 — Component Inventory

Module 2.2 covers **Forecasting & Market Scoring**: AI-powered demand forecasting (Groq LLM), XGBoost economic viability scoring, market ranking, and demand alert generation for Cebu MSME tourism operators.

---

## 1. Frontend — React View Components

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `MarketRadarView` | `ceview/components/module-2/2.2-market-radar/MarketRadarView.tsx` | React View Component | Main container for market analysis; loads ranked markets on mount via `listMarkets`; displays 3-column rank card grid with selected market detail panel (alerts, directives, charts, economic insights); "Refresh Forecast" button triggers `analyzeMarkets` pipeline |
| `HomeView` | `ceview/components/module-2/2.1-home/HomeView.tsx` | React View Component | Home tab notification feed; loads demand-alert notifications on mount via `listNotifications`; renders list of `TrendAlertCard` components; probes AI service health via `listMarkets`; displays amber degraded-service banner on 5xx errors |

---

## 2. Frontend — React Sub-components

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `DemandForecastChart` | `ceview/components/module-2/2.2-market-radar/components/DemandForecastChart.tsx` | React Chart Component | Multi-series Recharts `ComposedChart` displaying demand trends; shows history (solid navy line), forecast (dashed gold line), seasonality (blue area); supports 4WK/12WK timeframe toggle; includes demand-zone `ReferenceArea` bands (Low/Moderate/High Peak); renders lightning-bolt spike markers |
| `EconomicInsightsBoard` | `ceview/components/module-2/2.2-market-radar/components/EconomicInsightsBoard.tsx` | React Panel Component | Two-tab panel: Economy tab shows forex rate (PHP conversion), GDP growth KPIs, forex trend mini-chart, GDP 5-year mini-chart; Seasonality tab displays 12-month peak-month calendar grid and seasonality area chart |
| `LiveAlertBanner` | `ceview/components/module-2/2.2-market-radar/components/LiveAlertBanner.tsx` | React Banner Component | Conditional surge-alert strip (red-orange if spike current, gold if upcoming); displays market-specific action checklist for pricing, language, and booking tactics |
| `StrategicDirectivePanel` | `ceview/components/module-2/2.2-market-radar/components/StrategicDirectivePanel.tsx` | React Panel Component | Navy panel displaying Groq-generated strategic directive text; includes "Generate Content" CTA that navigates to Content Studio via `onNavigateToContent` callback |
| `MarketRankCard` | `ceview/components/module-2/2.2-market-radar/components/MarketRankCard.tsx` | React Composite Component | Market-selector tile showing rank badge, `ProgressBar` for matchScore, city, direct-flight pill; includes `SurgeBadge` overlay when spike detected; clickable to select market for detail view |
| `TrendAlertCard` | `ceview/components/module-2/2.1-home/components/TrendAlertCard.tsx` | React Composite Component | Single notification row showing date chip, market name, trend label, alert title; includes animated gold unread dot; click navigates to `MarketRadarView` pre-filtered to the alert's market |
| `MetricHighlight` | `ceview/components/module-2/2.2-market-radar/components/MetricHighlight.tsx` | React Base Component | Icon + label + value chip for displaying key metrics (Distance to Cebu, Route Type) |
| `ProgressBar` | `ceview/components/module-2/2.2-market-radar/components/ProgressBar.tsx` | React Base Component | Thin percentage fill bar with color coding (navy ≤75%, gold ≤85%, red-orange >85%); smooth CSS transitions |
| `SurgeBadge` | `ceview/components/module-2/2.2-market-radar/components/SurgeBadge.tsx` | React Base Component | Absolute-positioned ⚡ SURGE badge overlay on `MarketRankCard` when any `chartData` point has `spike === 1` |
| `MarketRankCardSkeleton` | `ceview/components/module-2/2.2-market-radar/components/MarketRankCardSkeleton.tsx` | React Skeleton Component | Skeleton loader for `MarketRankCard` during data loading |
| `TrendAlertCardSkeleton` | `ceview/components/module-2/2.1-home/components/TrendAlertCardSkeleton.tsx` | React Skeleton Component | Skeleton loader for `TrendAlertCard` during data loading |

---

## 3. Frontend — Services & Types

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `api.listMarkets` | `ceview/services/apiClient.ts` | API Client Method | `GET /api/forecasting/markets` — fetches ranked market list from Spring Boot |
| `api.analyzeMarkets` | `ceview/services/apiClient.ts` | API Client Method | `POST /api/forecasting/analyze/{profileId}` — triggers full AI ingestion + forecast + scoring pipeline |
| `api.listNotifications` | `ceview/services/apiClient.ts` | API Client Method | `GET /api/notifications` — fetches demand-alert notifications for the HomeView feed |
| `Market` | `ceview/types.ts` | TypeScript Interface | Defines the Market data structure: rank, name, city, matchScore, directive, flight info, accessibility, airlines, peakMonths, economic/seasonality insights, chartData array, GDP/forex trends |
| `ChartDataPoint` | `ceview/types.ts` | TypeScript Interface | Defines a single chart point: week label, history/forecast/seasonality values, forex, gdp, spike indicator |
| `Notification` | `ceview/types.ts` | TypeScript Interface | Defines notification structure: id, date, title, market, marketId, trend, isRead, optional details |

---

## 4. Spring Boot — Controllers

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `ForecastingController` | `backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java` | Spring REST Controller | Exposes `GET /api/forecasting/markets` (DB-only market list) and `POST /api/forecasting/analyze/{profileId}` (full AI pipeline); includes structured error responses with MDC codes |
| `NotificationController` | `backend/spring-boot/src/main/java/com/ceview/module2/NotificationController.java` | Spring REST Controller | Exposes `GET /api/notifications?profileId=UUID` — returns demand-alert notification list for the HomeView |

---

## 5. Spring Boot — Services

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `ForecastingService` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java` | Spring Service | Orchestrates 3-phase pipeline (ingestion → batch Groq inference → XGBoost scoring); provides fast DB-read path via `loadMarketsFromDb()`; assembles 24-point chart data; `@Transactional` ensures atomic DB writes across all three markets |
| `EnrichedSequenceBuilder` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/EnrichedSequenceBuilder.java` | Spring Utility Service | Builds Groq prompt payload from `MarketSignalRecord` history; computes trend series (last 12 weeks), 7d/30d rolling stats, YoY ratio, seasonality score, forex, GDP, holiday flag |
| `NotificationService` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/NotificationService.java` | Spring Service | Queries `DemandAlert → MarketScore → ForecastResult` chain; maps to `NotificationDto`; delegates category-rank supplementary notifications to `CategoryRankNotificationService` |
| `CategoryRankNotificationService` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/CategoryRankNotificationService.java` | Spring Service | Calls FastAPI `/api/trends/rank-markets` per business category; builds cross-market keyword-volume notifications |
| `MarketDataIngestionService` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java` | Spring Service | Per-market ingestion: concurrent GDP + forex fetch → PyTrends (12-week backfill on first run, current-week on updates) → seasonality computation → persists `MarketSignalRecord`; includes 2σ fallback when FastAPI unreachable |
| `ExternalMarketDataClient` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/ExternalMarketDataClient.java` | Spring Service | World Bank GDP API client (5-year) and fawazahmed0 forex CDN client (12 concurrent monthly calls via `Flux.merge()`); static flight references; includes graceful fallbacks with hardcoded defaults |
| `TrendFetchSchedulerService` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchSchedulerService.java` | Spring Scheduled Service | `@Scheduled` every Sunday 00:00 UTC; processes 21 (7 category × 3 market) PyTrends jobs sequentially; implements `PENDING → IN_PROGRESS → SUCCESS/FAILED` state machine with 3-attempt retry |
| `MarketDataIngestionJob` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionJob.java` | Spring Job | Daily scheduled ingestion job coordinator; triggers `MarketDataIngestionService` for all business profiles; persists audit trail to `tbl_ingestion_job_log` |
| `AIInferenceGatewayService` | `backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java` | Spring Service | WebClient bridge to `fastapi-transformer` (port 8001); Module 2 methods: `fetchTrends`, `fetchTrendHistory`, `computeSeasonality`, `runForecastInferenceBatch`, `runMarketScoring`, `rankMarketsForCategory` |

---

## 6. Spring Boot — JPA Entities

| Component Name | File Path | Type | DB Table | Description |
|---|---|---|---|---|
| `ForecastResult` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastResult.java` | JPA Entity | `tbl_forecast_result` | Stores predicted demand (4w + 12w horizons), MAPE, MAE, RMSE, confidence, and `weekly_forecasts_json` (12-element JSON array of weekly forecasts) |
| `MarketScore` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/MarketScore.java` | JPA Entity | `tbl_market_score` | Stores composite `market_score` (demand × 0.40 + seasonality × 0.35 + economic × 0.25), `market_rank` (1–3), and economic features |
| `DemandAlert` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/DemandAlert.java` | JPA Entity | `tbl_demand_alert` | Surge notifications generated when `demand4w > rollingAvg7d × 1.2`; includes alert level, message, window/alert dates, trend label, and `is_read` flag |
| `MarketSignalRecord` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecord.java` | JPA Entity | `tbl_market_signal_record` | Weekly snapshot: trend index, 7d/30d rolling averages, rolling std-dev, YoY ratio, spike indicator; primary input for `EnrichedSequenceBuilder` |
| `MarketEconomicTrend` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketEconomicTrend.java` | JPA Entity | `tbl_market_economic_trend` | GDP 5-year and forex 12-month trend JSON arrays per market; sourced by `EconomicInsightsBoard` charts on the frontend |
| `TrendFetchJob` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchJob.java` | JPA Entity | `tbl_trend_fetch_job` | Implements job state machine (`PENDING → IN_PROGRESS → SUCCESS/FAILED`) for weekly Google Trends fetch scheduling |
| `IngestionJobLog` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/IngestionJobLog.java` | JPA Entity | `tbl_ingestion_job_log` | Audit trail for daily ingestion runs (job name, status, markets processed, records ingested, errors) |
| `WeeklyDemandValue` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/WeeklyDemandValue.java` | JPA Entity | `tbl_orig_weekly_demand_value` | Seed/reference data table with category breakdowns, flight data, forex, GDP, market_rank, and seasonality meaning |

---

## 7. Spring Boot — JPA Repositories

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `ForecastResultRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastResultRepository.java` | JPA Repository | Spring Data JPA repository for `ForecastResult` |
| `MarketScoreRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/MarketScoreRepository.java` | JPA Repository | Spring Data JPA repository for `MarketScore` |
| `DemandAlertRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/DemandAlertRepository.java` | JPA Repository | Spring Data JPA repository for `DemandAlert` |
| `MarketSignalRecordRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecordRepository.java` | JPA Repository | Spring Data JPA repository for `MarketSignalRecord` |
| `MarketEconomicTrendRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketEconomicTrendRepository.java` | JPA Repository | Spring Data JPA repository for `MarketEconomicTrend` |
| `TrendFetchJobRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchJobRepository.java` | JPA Repository | Spring Data JPA repository for `TrendFetchJob` |
| `IngestionJobLogRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/IngestionJobLogRepository.java` | JPA Repository | Spring Data JPA repository for `IngestionJobLog` |
| `WeeklyDemandValueRepository` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/WeeklyDemandValueRepository.java` | JPA Repository | Spring Data JPA repository for `WeeklyDemandValue` |

---

## 8. Spring Boot — DTOs & Utilities

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `MarketDtos` | `backend/spring-boot/src/main/java/com/ceview/module2/dto/MarketDtos.java` | DTO Record Class | Immutable records: `MarketsResponse`, `MarketDto`, `AirlineDto`, `ChartDataPointDto`, `GdpTrendPointDto`, `ForexTrendPointDto` — data carriers for REST responses |
| `NotificationDtos` | `backend/spring-boot/src/main/java/com/ceview/module2/dto/NotificationDtos.java` | DTO Record Class | Immutable records: `NotificationsResponse`, `NotificationDto`, `DetailsDto`, `KeywordTrendDto`, `TopInterestDto`, `StrategicInsightsDto` — data shapes for notification responses |
| `Module2ErrorCodes` | `backend/spring-boot/src/main/java/com/ceview/module2/Module2ErrorCodes.java` | Utility Class | Constants for structured error codes (`MOD22_*`) used in API error responses |
| `MarketRadarDataSeeder` | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/MarketRadarDataSeeder.java` | Spring Component | Development/test data seeder for pre-populating Module 2 tables with sample market data |

---

## 9. FastAPI Transformer — Routers

| Component Name | File Path | Type | Endpoints | Description |
|---|---|---|---|---|
| Forecasting Router | `backend/fastapi-transformer/app/routers/forecasting.py` | FastAPI Router | `POST /inference`, `POST /inference-batch`, `POST /score` | Handles single-market Groq forecast, all-3-markets batch forecast (1 RPM slot), and XGBoost economic viability scoring |
| Market Data Router | `backend/fastapi-transformer/app/routers/market_data.py` | FastAPI Router | `POST /trends`, `POST /trends/history`, `POST /seasonality` | Handles current-week PyTrends index, N-week backfill history, and 4-step seasonal shift detection |
| Trends Router | `backend/fastapi-transformer/app/api/trends_router.py` | FastAPI Router | `POST /api/trends/fetch`, `POST /api/trends/rank-markets` | Single (market, category) trend fetch for `TrendFetchSchedulerService`; cross-market keyword volume ranking |

---

## 10. FastAPI Transformer — Services

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `gemini_forecaster` | `backend/fastapi-transformer/app/services/gemini_forecaster.py` | Python Service | Groq `llama-3.3-70b-versatile` demand forecasting; produces 12 weekly forecasts; includes flat-line detection, ceiling/floor guards, 3-attempt exponential back-off, linear-regression fallback |
| `xgboost_scorer` | `backend/fastapi-transformer/app/services/xgboost_scorer.py` | Python Service | 5-feature XGBoost economic viability scoring (GDP growth, forex, direct flight, distance, flight frequency); linear-sum fallback when model absent |
| `seasonal_shift_detector` | `backend/fastapi-transformer/app/services/seasonal_shift_detector.py` | Python Service | 4-step SeasonalShift pipeline: 7d/30d rolling averages → 2σ spike test → YoY ratio (52-week lookback) → composite seasonality score [0, 1] |
| `pytrends_client` | `backend/fastapi-transformer/app/services/pytrends_client.py` | Python Service | PyTrends wrapper with 4–12 s jitter sleep per request; native-language keyword mappings per (category, geo); curated 52-week stub series on HTTP 429 |
| `forecast_validator` | `backend/fastapi-transformer/app/services/forecast_validator.py` | Python Service | MAPE ≤ 15% quality gate (FR2.12); returns `low_confidence_disclaimer: true` when threshold exceeded |
| `trend_service` | `backend/fastapi-transformer/app/services/trend_service.py` | Python Service | High-level trend fetching and processing; coordinates `pytrends_client` and `seasonal_shift_detector` |
| `market_data_processor` | `backend/fastapi-transformer/app/services/market_data_processor.py` | Python Service | Market data transformation utilities; data cleaning and normalization helpers |
| `ml_stubs` | `backend/fastapi-transformer/app/services/ml_stubs.py` | Python Utility | Fallback stubs for when ML models or external services are unavailable |

---

## 11. FastAPI Transformer — Pydantic Schemas

| Component Name | File Path | Type | Description |
|---|---|---|---|
| `GeminiForecastRequest` | `backend/fastapi-transformer/app/routers/forecasting.py` | Pydantic Schema | Forecast request payload: trend series, rolling stats, spike indicator, YoY ratio, seasonality score, economic context |
| `ForecastResponse` | `backend/fastapi-transformer/app/routers/forecasting.py` | Pydantic Schema | Forecast response: weekly forecasts array, MAPE, MAE, RMSE, confidence score, `low_confidence_disclaimer` flag |
| `GdpTrendPoint` | `backend/fastapi-transformer/app/routers/forecasting.py` | Pydantic Schema | Annual GDP growth data point (year, value) |
| `ForexTrendPoint` | `backend/fastapi-transformer/app/routers/forecasting.py` | Pydantic Schema | Monthly forex rate data point (month, rate) |
| `TrendsRequest` | `backend/fastapi-transformer/app/routers/market_data.py` | Pydantic Schema | Current-week trends request: market, category, geo |
| `TrendsResponse` | `backend/fastapi-transformer/app/routers/market_data.py` | Pydantic Schema | Current-week trends response: trend index, keywords used, fetch timestamp, source |
| `TrendHistoryRequest` | `backend/fastapi-transformer/app/routers/market_data.py` | Pydantic Schema | Historical trends backfill request: market, category, geo, number of weeks |
| `TrendHistoryResponse` | `backend/fastapi-transformer/app/routers/market_data.py` | Pydantic Schema | Historical trends response: weekly series with ISO dates and index values |
| `SeasonalityRequest` | `backend/fastapi-transformer/app/routers/market_data.py` | Pydantic Schema | Seasonality computation request: trend series, market, geo |
| `TrendsFetchRequest` | `backend/fastapi-transformer/app/api/trends_router.py` | Pydantic Schema | Single (market, category) pair trend fetch request for the scheduler service |
