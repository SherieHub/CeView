# Module 2 — Market Radar & Notifications

Reference index for every frontend and backend component in Module 2. Companion diagrams:

| File | Contents |
|---|---|
| [`class.mmd`](class.mmd) | UML class diagram — Spring Boot services, entities, repositories, DTOs, and FastAPI service modules (backend only) |
| [`sequence.mmd`](sequence.mmd) | Backend sequence diagram for two flows: GET /markets (DB-only read) and POST /analyze (full AI pipeline) |
| [`er.mmd`](er.mmd) | Entity-relation diagram for all 7 Module 2 database tables with full column detail |

---

## Frontend Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **View** | `MarketRadarView` | [`ceview/components/module-2/2.2-market-radar/MarketRadarView.tsx`](../../ceview/components/module-2/2.2-market-radar/MarketRadarView.tsx) | Main container; loads markets on mount via `listMarkets`; 3-column rank card grid; selected-market detail panel (alert, directive, chart, insights); "Refresh Forecast" button → `analyzeMarkets`; `ServerErrorBanner` on API failure |
| **View** | `HomeView` | [`ceview/components/module-2/2.1-home/HomeView.tsx`](../../ceview/components/module-2/2.1-home/HomeView.tsx) | Loads demand-alert notifications on mount; renders `TrendAlertCard` list; AI service health probe via `listMarkets`; amber degraded-service banner on 5xx |
| **Module** | `DemandForecastChart` | [`ceview/components/module-2/2.2-market-radar/components/DemandForecastChart.tsx`](../../ceview/components/module-2/2.2-market-radar/components/DemandForecastChart.tsx) | Recharts `ComposedChart` — history (solid navy line), forecast (dashed gold line), seasonality (blue area fill); 4WK/12WK timeframe toggle; demand-zone `ReferenceArea` bands (Low/Moderate/High Peak); lightning-bolt spike markers; synthetic week interpolation |
| **Module** | `EconomicInsightsBoard` | [`ceview/components/module-2/2.2-market-radar/components/EconomicInsightsBoard.tsx`](../../ceview/components/module-2/2.2-market-radar/components/EconomicInsightsBoard.tsx) | Two-tab panel: **Economy** — forex rate, GDP growth KPIs, forex trend mini-chart, GDP 5-year mini-chart; **Seasonality** — 12-month peak-month calendar grid, seasonality area chart |
| **Module** | `LiveAlertBanner` | [`ceview/components/module-2/2.2-market-radar/components/LiveAlertBanner.tsx`](../../ceview/components/module-2/2.2-market-radar/components/LiveAlertBanner.tsx) | Conditional surge-alert strip (red-orange if spike is current, gold if upcoming); market-specific action checklist (pricing, language, booking tactics) |
| **Module** | `StrategicDirectivePanel` | [`ceview/components/module-2/2.2-market-radar/components/StrategicDirectivePanel.tsx`](../../ceview/components/module-2/2.2-market-radar/components/StrategicDirectivePanel.tsx) | Navy panel with Groq-generated strategic directive text; "Generate Content" CTA → `onNavigateToContent(marketId)` callback to Content Studio |
| **Composite** | `MarketRankCard` | [`ceview/components/module-2/2.2-market-radar/components/MarketRankCard.tsx`](../../ceview/components/module-2/2.2-market-radar/components/MarketRankCard.tsx) | Market-selector tile — rank badge, `ProgressBar` for matchScore, city, direct-flight pill, `SurgeBadge` overlay when spike detected; selected-state border ring |
| **Composite** | `TrendAlertCard` | [`ceview/components/module-2/2.1-home/components/TrendAlertCard.tsx`](../../ceview/components/module-2/2.1-home/components/TrendAlertCard.tsx) | Single notification row — date chip, market name, trend label, alert title, animated gold unread dot; click navigates to `MarketRadarView` pre-filtered to that market |
| **Base** | `MetricHighlight` | [`ceview/components/module-2/2.2-market-radar/components/MetricHighlight.tsx`](../../ceview/components/module-2/2.2-market-radar/components/MetricHighlight.tsx) | Icon + label + value chip; used for Distance to Cebu and Route Type (Direct / Via Manila) |
| **Base** | `ProgressBar` | [`ceview/components/module-2/2.2-market-radar/components/ProgressBar.tsx`](../../ceview/components/module-2/2.2-market-radar/components/ProgressBar.tsx) | Thin percentage fill bar; navy ≤75 / gold ≤85 / red-orange >85; smooth CSS transition |
| **Base** | `SurgeBadge` | [`ceview/components/module-2/2.2-market-radar/components/SurgeBadge.tsx`](../../ceview/components/module-2/2.2-market-radar/components/SurgeBadge.tsx) | Absolute-positioned ⚡ SURGE badge overlaid on `MarketRankCard` when `chartData` contains any `spike === 1` |
| **Service** | `apiClient` | [`ceview/services/apiClient.ts`](../../ceview/services/apiClient.ts) | Module 2 methods: `listNotifications(profileId?)`, `listMarkets(profileId?)`, `analyzeMarkets(profileId)` |

---

## Backend Components

### Spring Boot

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Controller** | `ForecastingController` | `com/ceview/module2/ForecastingController.java` | `GET /api/v1/forecasting/markets` → DB-only market list; `POST /api/v1/forecasting/analyze/{profileId}` → full AI pipeline; structured error responses with MDC codes |
| **Controller** | `NotificationController` | `com/ceview/module2/NotificationController.java` | `GET /api/v1/notifications?profileId=UUID` → demand-alert notification list |
| **Service** | `ForecastingService` | `com/ceview/module2/submodule22/ForecastingService.java` | Orchestrates 3-phase pipeline (ingestion → batch Groq inference → XGBoost scoring); DB-read fast path; 24-point chart data assembly; insight text generation; `@Transactional` persistence |
| **Service** | `EnrichedSequenceBuilder` | `com/ceview/module2/submodule22/EnrichedSequenceBuilder.java` | Builds Groq prompt payload from `MarketSignalRecord` history: trend series (last 12 weeks), 7d/30d rolling stats, YoY ratio, seasonality score, forex, GDP, holiday flag |
| **Service** | `NotificationService` | `com/ceview/module2/submodule22/NotificationService.java` | Queries `DemandAlert → MarketScore → ForecastResult` chain; maps to `NotificationDto`; delegates category-rank supplementary notifications |
| **Service** | `CategoryRankNotificationService` | `com/ceview/module2/submodule22/CategoryRankNotificationService.java` | Calls FastAPI `/api/v1/trends/rank-markets` per business category; builds cross-market keyword-volume notifications |
| **Service** | `MarketDataIngestionService` | `com/ceview/module2/submodule21/MarketDataIngestionService.java` | Per-market ingestion: concurrent GDP + forex fetch → PyTrends (12-week backfill or current-week) → seasonality → persist `MarketSignalRecord`; inline 2σ fallback when FastAPI is unreachable |
| **Service** | `ExternalMarketDataClient` | `com/ceview/module2/submodule21/ExternalMarketDataClient.java` | World Bank GDP API (5-year), fawazahmed0 forex CDN (12 concurrent monthly calls via `Flux.merge()`), static flight references; graceful fallbacks with hardcoded defaults |
| **Service** | `TrendFetchSchedulerService` | `com/ceview/module2/submodule21/TrendFetchSchedulerService.java` | `@Scheduled` every Sunday 00:00 UTC; processes 21 (7 category × 3 market) PyTrends jobs sequentially; `PENDING → IN_PROGRESS → SUCCESS/FAILED` state machine with 3-attempt retry |
| **Service** | `AIInferenceGatewayService` | `com/ceview/ai/AIInferenceGatewayService.java` | WebClient bridge to `fastapi-transformer` (port 8001); methods for Module 2: `fetchTrends`, `fetchTrendHistory`, `computeSeasonality`, `runForecastInferenceBatch`, `runMarketScoring`, `rankMarketsForCategory` |
| **Entity** | `ForecastResult` | `com/ceview/module2/submodule22/ForecastResult.java` | `tbl_forecast_result` — predicted demand (4w + 12w horizons), MAPE, MAE, RMSE, confidence, `weekly_forecasts_json` (12-element JSON array) |
| **Entity** | `MarketScore` | `com/ceview/module2/submodule22/MarketScore.java` | `tbl_market_score` — composite `market_score` (demand × 0.40 + seasonality × 0.35 + economic × 0.25), `market_rank` (1-3), economic features |
| **Entity** | `DemandAlert` | `com/ceview/module2/submodule22/DemandAlert.java` | `tbl_demand_alert` — demand window notifications; generated when `demand4w > rollingAvg7d × 1.2`; `is_read` flag for HomeView unread dot |
| **Entity** | `MarketSignalRecord` | `com/ceview/module2/submodule21/MarketSignalRecord.java` | `tbl_market_signal_record` — weekly snapshot: trend index, 7d/30d rolling averages, rolling std-dev, YoY ratio, spike indicator; primary input for `EnrichedSequenceBuilder` |
| **Entity** | `MarketEconomicTrend` | `com/ceview/module2/submodule21/MarketEconomicTrend.java` | `tbl_market_economic_trend` — GDP 5-year + forex 12-month trend JSON arrays; sourced by frontend `EconomicInsightsBoard` charts |
| **DTO** | `MarketDtos` | `com/ceview/module2/dto/MarketDtos.java` | Records: `MarketsResponse`, `MarketDto`, `AirlineDto`, `ChartDataPointDto`, `GdpTrendPointDto`, `ForexTrendPointDto` |
| **DTO** | `NotificationDtos` | `com/ceview/module2/dto/NotificationDtos.java` | Records: `NotificationsResponse`, `NotificationDto`, `DetailsDto`, `KeywordTrendDto`, `TopInterestDto`, `StrategicInsightsDto` |

### FastAPI Transformer (`backend/fastapi-transformer/`)

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Router** | `forecastingRouter` | `app/routers/forecasting.py` | `POST /inference` (single-market Groq forecast), `POST /inference-batch` (all 3 markets in 1 Groq call, 1 RPM slot), `POST /score` (XGBoost economic viability scoring) |
| **Router** | `marketDataRouter` | `app/routers/market_data.py` | `POST /trends` (current-week PyTrends index), `POST /trends/history` (N-week backfill), `POST /seasonality` (4-step seasonal shift detection pipeline) |
| **Router** | `trendsRouter` | `app/api/trends_router.py` | `POST /fetch` (single category × market trend job for `TrendFetchSchedulerService`), `POST /rank-markets` (cross-market keyword volume ranking) |
| **Service** | `gemini_forecaster` | `app/services/gemini_forecaster.py` | Groq `llama-3.3-70b-versatile` demand forecasting; 12 individual weekly forecasts; flat-line and ceiling/floor guards; 3-attempt exponential back-off; linear-regression stub fallback |
| **Service** | `xgboost_scorer` | `app/services/xgboost_scorer.py` | 5-feature economic viability: GDP growth, forex, direct flight (binary), distance, flight frequency; XGBoost model inference with identical linear-sum fallback when model absent |
| **Service** | `seasonal_shift_detector` | `app/services/seasonal_shift_detector.py` | 4-step CeView SeasonalShift pipeline: 7d/30d rolling averages → 2σ spike test → YoY ratio (52-week lookback, ≥59 points required) → composite seasonality score [0,1] |
| **Service** | `pytrends_client` | `app/services/pytrends_client.py` | PyTrends wrapper; 4–12 s jitter sleep per request (sole rate-limit mitigation); native-language keyword mappings per (category, geo); curated 52-week stub series on HTTP 429 |
| **Service** | `forecast_validator` | `app/services/forecast_validator.py` | MAPE ≤ 15% quality gate (FR2.12); returns `low_confidence_disclaimer: true` when threshold exceeded; stub always produces MAPE ≤ 14.9% |

---

## REST Endpoints

### Public — Frontend → Spring Boot

| Method | Path | Controller Method | Frontend Caller |
|---|---|---|---|
| `GET` | `/api/v1/forecasting/markets?profileId=UUID` | `ForecastingController.markets` | `apiClient.listMarkets()` — `MarketRadarView` on mount |
| `POST` | `/api/v1/forecasting/analyze/{profileId}` | `ForecastingController.analyze` | `apiClient.analyzeMarkets()` — "Refresh Forecast" button |
| `GET` | `/api/v1/notifications?profileId=UUID` | `NotificationController.list` | `apiClient.listNotifications()` — `HomeView` on mount |

### Internal — Spring Boot → FastAPI Transformer

| Method | Path | Spring Boot Caller | FastAPI Handler |
|---|---|---|---|
| `POST` | `/internal/market-data/trends` | `AIInferenceGatewayService.fetchTrends` | `pytrends_client.fetch_trends` |
| `POST` | `/internal/market-data/trends/history` | `AIInferenceGatewayService.fetchTrendHistory` | `pytrends_client.fetch_trend_history` |
| `POST` | `/internal/market-data/seasonality` | `AIInferenceGatewayService.computeSeasonality` | `seasonal_shift_detector.compute` |
| `POST` | `/internal/forecasting/inference` | `AIInferenceGatewayService.runForecastInference` | `gemini_forecaster.forecast` |
| `POST` | `/internal/forecasting/inference-batch` | `AIInferenceGatewayService.runForecastInferenceBatch` | `gemini_forecaster.forecast_batch` |
| `POST` | `/internal/forecasting/score` | `AIInferenceGatewayService.runMarketScoring` | `xgboost_scorer.score` |
| `POST` | `/api/v1/trends/fetch` | `TrendFetchSchedulerService` | `trend_service.fetch_and_process` |
| `POST` | `/api/v1/trends/rank-markets` | `AIInferenceGatewayService.rankMarketsForCategory` | `trend_service.rank_markets_by_category` |
