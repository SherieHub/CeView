# Module 2 — Component Tables

---

## 2.1 Market Data Aggregation

The operator lands on the HomeView — a notification feed dashboard displaying a vertically scrolling list of TrendAlertCards, each showing a market name, a trend label (e.g., "Rising demand window"), and a pulsing gold dot in the top-left corner for unread items. Each card is fully clickable with a hover-activated shadow and a chevron arrow on the right edge, navigating the operator to the Market Radar view scoped to that specific market. During the initial load, multiple TrendAlertCardSkeleton placeholders animate in place of real cards to communicate that data is being fetched.

### Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| HomeView | Home dashboard displaying demand notifications and recent trend alerts. On mount calls `api.listNotifications()` to populate the alert feed and fires `api.listMarkets()` as a silent AI-service health probe. | React view component |
| TrendAlertCard | Individual notification card for a single demand or keyword-trend alert. Displays a pulsing gold unread indicator, market name, trend label, and a navigation chevron that routes to the Market Radar for the relevant market. | React composite |
| TrendAlertCardSkeleton | Animated skeleton placeholder rendered while the notification list is loading. | React base component |

### Back-End Components — Spring Boot

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| NotificationController | Exposes `GET /api/v1/notifications?profileId={id}`. Delegates to NotificationService and returns a merged NotificationsResponse combining demand-spike alerts and keyword-trend notifications. | Spring @RestController |
| NotificationService | Reads persisted DemandAlert rows from DemandAlertRepository and maps them to NotificationDto shape (FR2.15, FR2.17). Returns an empty list when no alerts exist — no stub fallback. | Spring @Service |
| CategoryRankNotificationService | For each of the business profile's categories, calls FastAPI `POST /api/v1/trends/rank-markets`. Maps the ranked-market result to a NotificationDto notifying the operator which market and keyword represent the strongest demand signal. Silently skips any category that errors so the notification list is never broken. | Spring @Service |
| MarketDataIngestionJob | `@Scheduled` cron component (`0 0 0 * * *`, daily 00:00 UTC). Iterates every saved business profile, calls `MarketDataIngestionService.ingestForProfile()` per profile, and persists an IngestionJobLog on completion. One profile failure never aborts the full run. | Spring @Component |
| MarketDataIngestionService | Orchestrates the ingestion pipeline per (profile, market) pair: (A) concurrent GDP/Forex fetch via ExternalMarketDataClient, (B) 12-week PyTrends backfill on first run via FastAPI `/trends/history`, (C) FastAPI `/seasonality` call for rolling stats and spike detection, (D) persist MarketSignalRecord. | Spring @Service |
| TrendFetchSchedulerService | `@Scheduled` weekly job (Sundays 00:00 UTC). Upserts PENDING TrendFetchJob rows for all 21 (category × market) combinations, then sequentially calls FastAPI `POST /api/v1/trends/fetch` per job. Tracks PENDING → IN_PROGRESS → SUCCESS/FAILED state with up to 3 retries per job. | Spring @Service |
| ExternalMarketDataClient | Fetches live GDP growth (World Bank API) and forex rates (fawazahmed0 CDN) with hardcoded fallback defaults for Korea, Japan, and USA. Provides static in-memory flight reference data (directFlight, distanceKm, airlines, flightFrequency) per market. | Spring @Service |
| IngestionTriggerController | Dev/test endpoint `POST /api/v1/admin/ingestion/trigger` — manually fires the nightly MarketDataIngestionJob without waiting for the 00:00 UTC cron schedule. Used for local development and integration testing. | Spring @RestController |
| AIInferenceGatewayService | Reactive WebClient bridge to fastapi-transformer (port 8001). Module 2.1 calls: `/internal/market-data/trends`, `/internal/market-data/trends/history`, `/internal/market-data/seasonality`, `/api/v1/trends/rank-markets`, `/api/v1/trends/fetch`. | Spring @Service |
| MarketSignalRecord | JPA entity for `tbl_market_signal_record`. Stores one weekly signal snapshot per (businessProfileId, targetMarket): trendIndex, forexRate, gdpGrowth, seasonalityScore, rollingAverage7d, rollingAverage30d, rollingStdDev, yoyRatio, spikeIndicator, aggregatedAt. | JPA entity |
| MarketSignalRecordRepository | `JpaRepository<MarketSignalRecord, UUID>` — queries chronological history per (profileId, market) for sequence building and backfill checks. | Spring Data repository |
| MarketEconomicTrend | JPA entity for `tbl_market_economic_trend`. Caches multi-point GDP and forex trend series (stored as JSON text) per market alongside latest scalar values (gdpLatest, forexLatest) and fetchedAt timestamp. | JPA entity |
| MarketEconomicTrendRepository | `JpaRepository<MarketEconomicTrend, UUID>` — queries cached economic trend series per market for chart data enrichment. | Spring Data repository |
| TrendFetchJob | JPA entity for `tbl_trend_fetch_job`. State-tracking row per (category, market, weekOf) triple with unique constraint. Stores status (PENDING/IN_PROGRESS/SUCCESS/FAILED), attemptCount, maxAttempts, and result snapshot on SUCCESS (trendIndex, rolling stats, spikeIndicator, seasonalityScore). | JPA entity |
| TrendFetchJobRepository | `JpaRepository<TrendFetchJob, UUID>` — queries retryable PENDING/FAILED jobs and upserts weekly job rows for the scheduler. | Spring Data repository |
| IngestionJobLog | JPA entity for `tbl_ingestion_job_log`. Audit record per daily ingestion run: jobName, status, marketsProcessed, recordsIngested, errorMessage, startedAt, completedAt. | JPA entity |
| IngestionJobLogRepository | `JpaRepository<IngestionJobLog, UUID>` — persists job execution audit records on completion of each daily run. | Spring Data repository |
| WeeklyDemandValue | JPA entity for `tbl_orig_weekly_demand_value`. Stores the original per-week demand snapshot with 7 category-level BigDecimal columns (beachCategory, adventure, cultural, themeParks, urban, culinary, accommodation), marketScore, strategy text, forex, GDP, marketRank, spikeMeaning, and seasonalityMeaning. | JPA entity |
| WeeklyDemandValueRepository | `JpaRepository<WeeklyDemandValue, UUID>` — stores and queries the enriched weekly demand snapshots for historical trend analysis. | Spring Data repository |
| Module2ErrorCodes | Constants class defining all Module 2 error code strings for MDC logging. 2.1 codes: MOD21_INGESTION_JOB_STARTED, MOD21_INGESTION_JOB_COMPLETED, MOD21_INGESTION_JOB_FAILED, MOD21_PYTRENDS_UNAVAILABLE, MOD21_EXTERNAL_API_ERROR, MOD21_ENRICHED_DATASET_EMPTY. | Java constants |
| NotificationDtos | Container class for all notification-related Java records: NotificationDto, NotificationsResponse, DetailsDto, KeywordTrendDto, TopInterestDto, StrategicInsightsDto, ContentStrategyDto. | Java records |

### Back-End Components — FastAPI (fastapi-transformer)

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| market_data.py | FastAPI router mounted at `/internal/market-data`. Exposes `POST /trends` — current PyTrends index for a (market, categories) pair; `POST /trends/history` — N-week backfill series for first-run ingestion; `POST /seasonality` — full SeasonalShift Detection pipeline returning seasonality_score (0–1), rolling averages, spike_indicator, and yoy_ratio. | FastAPI router |
| trends_router.py | FastAPI router mounted at `/api/v1/trends`. Exposes `POST /fetch` — fetches Google Trends data for one (market, category) pair with all SeasonalShift metrics; `POST /rank-markets` — aggregates keyword search volumes across 3 markets for one category and returns markets ranked by total volume. | FastAPI router |
| pytrends_client.py | Wraps the PyTrends library. Resolves localized keywords (Hangul for KR, Kanji/Kana for JP) to avoid near-zero English proxy volumes. Applies 4–12 s random jitter sleep to avoid Google rate-limiting. Falls back to a deterministic stub index when pytrends is unavailable. | Python service |
| seasonal_shift_detector.py | Implements CeView SeasonalShift Detection spec: 7-period and 30-period rolling averages, 2σ spike detection (`current > rolling_7d_avg + 2 × rolling_7d_std`), YoY ratio (requires ≥ 59 data points), and composite seasonality score 0–1. | Python service |
| market_data_processor.py | Normalizes raw trend index values to the 0–100 range before passing them to SeasonalShiftDetector. Provides a single `normalize_trend_index()` utility used by both the market_data and trends_router routers. | Python service |
| trend_service.py | Orchestrates the full per-(market, category) fetch workflow: invokes pytrends_client, passes the time series to seasonal_shift_detector, and assembles the TrendsFetchResponse. Contains `rank_markets_by_category()` which runs 3 × 2 PyTrends batch calls and aggregates keyword volumes per market. | Python service |
| keyword_mapping.py | Dual-layer keyword mapping config. MACRO_TREND_MAPPING provides 2–4 native-language umbrella keywords per (category, market geo) pair for PyTrends queries; CATEGORY_KEYWORDS provides 10 detailed keywords per category for the rank-markets volume aggregation. Keys match CATEGORY_LABELS in ml_classifier.py. | Python config |
| ml_stubs.py | Deterministic mock outputs keyed by a hash of the input. Provides stable fallback values for forecast_markets() and other endpoints when AI models or PyTrends are unavailable, ensuring the frontend always receives a valid response. | Python service |

---

## 2.2 Forecasting and Market Scoring

The operator sees the MarketRadarView, which opens with three MarketRankCards stacked vertically (ranked 1–3), each displaying the market name, city, distance to Cebu, route type, and an animated ProgressBar colour-coded by match score — plus a red SurgeBadge pinned to the top-right corner of the card when a demand spike is detected. When a spike is active or upcoming, a full-width LiveAlertBanner appears above the rank cards — red for a live surge with a 48–72 hour action window, gold for an upcoming projected surge — with a two-column panel showing a business impact summary and a four-item action checklist. Clicking a card selects it and populates the panels below: a StrategicDirectivePanel with the AI-generated strategic directive and a gold "Generate Content" CTA button, a DemandForecastChart with a 4WK/12WK toggle rendering history (solid navy) and forecast (dashed gold) demand lines with spike dots, and an EconomicInsightsBoard with Economy and Seasonality tabs; a Refresh button at the top triggers the full AI pipeline while MarketRankCardSkeleton placeholders animate in place of the cards.

### Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| MarketRadarView | Primary Module 2 view. On mount calls `api.listMarkets()` (DB-only read). When the user clicks Refresh calls `api.analyzeMarkets(profileId)` to run the full Gemini + XGBoost pipeline. Manages selected-market state and passes market data to all child panels. | React view component |
| MarketRankCard | Rank card (1–3) showing market name, city, distance to Cebu, route type, animated ProgressBar, MetricHighlight cells, and an absolute-positioned SurgeBadge when spikeIndicator is true. Applies scale/shadow transform on selection. | React composite |
| MarketRankCardSkeleton | Animated skeleton placeholder rendered during initial market load or on pipeline refresh. | React base component |
| LiveAlertBanner | Contextual alert panel shown above the rank cards when the selected market has a detected spike in its chartData. Renders red ("Live Alert — Right Now") when a historical data point has spike = 1, and gold ("Upcoming Surge Detected") when a forecast point has spike = 1. Displays a business impact summary and a four-item action checklist tailored to the market. | React module component |
| MetricHighlight | Two-column metric cell displaying an icon, label, and formatted value string. Used inside MarketRankCard to present Distance to Cebu and Route Type (Direct/Via MNL). | React composite |
| ProgressBar | Animated match-score horizontal bar. Colour-coded by score threshold: RED_ORANGE (> 85), GOLD (> 75), NAVY (≤ 75). Used inside MarketRankCard. | React base component |
| StrategicDirectivePanel | Navy background panel showing the AI-generated strategic directive text for the selected market. Contains the "Generate Content" CTA button that fires `onNavigateToContent(marketId)` and transitions to ContentStudioView. | React composite |
| SurgeBadge | Small absolute-positioned red badge with a lightning Zap icon, affixed to the top-right corner of a MarketRankCard when the market's spikeIndicator is true. | React base component |
| DemandForecastChart | Recharts ComposedChart rendering 4WK or 12WK demand forecast. History line (solid navy), forecast line (dashed gold), seasonality area fill, Low/Moderate/High reference bands. Renders custom spike dots (16 px red circle with inline SVG lightning) at spike data points. User toggles 4WK/12WK timeframe. | React module component |
| EconomicInsightsBoard | Dual-tab panel toggling between Economy and Seasonality views. Economy tab: forex line chart (Recharts LineChart) and GDP growth line chart. Seasonality tab: 12-month peak calendar heatmap and seasonality area chart. | React module component |

### Back-End Components — Spring Boot

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| ForecastingController | Exposes `GET /api/v1/forecasting/markets?profileId={id}` (DB-only read, no AI) and `POST /api/v1/forecasting/analyze/{profileId}` (full pipeline). Delegates both to ForecastingService. Returns MarketsResponse or a structured Module2ErrorCodes response. | Spring @RestController |
| ForecastingService | Main 2.2 pipeline orchestrator. `loadMarketsFromDb()` reads latest ForecastResult/MarketScore rows and reconstructs MarketDto objects with chart data. `runPipeline()` executes Phase A (EnrichedSequenceBuilder), Phase B (Gemini batch inference), Phase C (XGBoost scoring + persist ForecastResult, MarketScore, DemandAlert), ranks markets, and builds MarketDto list. | Spring @Service |
| EnrichedSequenceBuilder | Builds the Gemini prompt payload per (profileId, market): assembles chronological trendSeries from MarketSignalRecord history, attaches rolling stats, spike, YoY, seasonality, forex, GDP, and a holiday flag derived from ISO week number. Throws `IllegalStateException("enriched_dataset_empty")` when fewer than 4 signal records exist. | Spring @Service |
| MarketRadarDataSeeder | `ApplicationRunner` component that seeds realistic mock MarketSignalRecord and MarketEconomicTrend rows into the DB on startup when no forecast data exists yet for any business profile. Idempotent: skipped entirely if tbl_forecast_result already has rows for the target profile. | Spring @Component |
| AIInferenceGatewayService | Reactive WebClient bridge to fastapi-transformer (port 8001). Module 2.2 calls: `POST /internal/forecasting/inference-batch` (Gemini batch forecast) and `POST /internal/forecasting/score` (XGBoost scoring). Applies extended timeout for batch inference calls. | Spring @Service |
| ForecastResult | JPA entity for `tbl_forecast_result`. Stores Gemini output per (businessProfileId, targetMarket): predictedDemand, forecastConfidence, mapeScore, mae, rmse, forecastHorizonWeeks, weeklyForecastsJson (JSON array of per-week predictions), generatedAt. | JPA entity |
| ForecastResultRepository | `JpaRepository<ForecastResult, UUID>` — queries latest forecast result per (profileId, market) for the DB-only load path. | Spring Data repository |
| MarketScore | JPA entity for `tbl_market_score`. Stores XGBoost scoring output: marketScore (composite 0–1), seasonalityScore, spikeIndicator, gdpPerCapitaGrowth, forexVsPhp, marketRank (1–3). FK to tbl_forecast_result. | JPA entity |
| MarketScoreRepository | `JpaRepository<MarketScore, UUID>` — queries latest scores per profileId for market ranking and demand alert generation. | Spring Data repository |
| DemandAlert | JPA entity for `tbl_demand_alert`. Created by ForecastingService when spikeIndicator is true. Stores alertLevel (WARNING/CRITICAL), alertMessage, trend, isRead, windowOpenDate, alertDate. FK to tbl_market_score. Read by NotificationService (2.1) for the notification feed. | JPA entity |
| DemandAlertRepository | `JpaRepository<DemandAlert, UUID>` — queries alerts by marketScoreId; read by NotificationService to assemble the demand-spike notification feed. | Spring Data repository |
| MarketDtos | Container class for all market-related Java records: MarketDto, MarketsResponse, ChartDataPointDto (week, history, forecast, seasonality, forex, gdp, spike), AirlineDto, GdpTrendPointDto, ForexTrendPointDto. | Java records |
| Module2ErrorCodes | Constants class. Module 2.2 codes used in this pipeline: MOD22_FORECAST_STARTED, MOD22_FORECAST_MAPE_WARNING, MOD22_SCORING_FAILED, MOD22_INFERENCE_FAILED, MOD22_PROFILE_NOT_READY, MOD22_ALERT_GENERATED. | Java constants |

### Back-End Components — FastAPI (fastapi-transformer)

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| forecasting.py | FastAPI router mounted at `/internal/forecasting`. Exposes `POST /inference` — single-market Gemini demand forecast (4w/12w predictions, MAPE, MAE, RMSE, confidence, weekly_forecasts); `POST /inference-batch` — batches all markets into one Gemini call to avoid RPM exhaustion; `POST /score` — XGBoost economic viability scoring computing market_score = 0.40 × demand + 0.35 × seasonality + 0.25 × economic_viability. | FastAPI router |
| gemini_forecaster.py | Constructs a structured Gemini prompt from the enriched sequence (trend series, rolling stats, spike, seasonality, forex, GDP, holiday flag, GDP trend direction). Calls Gemini API at temperature=0.1 in JSON mode. Retries up to 3 times. Exposes `forecast()` (single market) and `forecast_batch()` (all markets in one call). | Python service |
| xgboost_scorer.py | Loads trained `xgboost_market.json` model from `/app/models/`. Scores economic viability from 5 features: gdpGrowth, forexVsPhp, directFlight, distanceKm, flightFrequency. Combines demand, seasonality, and economic viability into the final composite market_score. | Python service |
| forecast_validator.py | Validates Gemini forecast output quality: checks MAPE threshold (≤ 15%), returns `passed` flag and a `low_confidence_disclaimer` flag with a human-readable warning message when MAPE exceeds the threshold (FR2.12). | Python service |
| bilstm_transformer.py | Legacy BiLSTM + Transformer demand forecasting model (superseded by Gemini in Phase 2). Architecture: BiLSTM hidden=64 → Transformer encoder d_model=128 → Dense (128→64→2) outputting predicted_demand_4w and predicted_demand_12w. Retained for reference and potential offline fallback if weights are provided. | Python service (legacy) |
| ml_stubs.py | Deterministic mock outputs for forecast and market-data models keyed by an MD5 hash of the input. Provides stable three-market ranked forecasts and seasonality scores when AI models or PyTrends are unavailable, ensuring the frontend always receives a valid structured response. | Python service |
