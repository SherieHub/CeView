# Module 2 — Architecture Diagrams

> Scope: Backend only (Spring Boot + FastAPI-Transformer).
> Designed for OOP — covers database schema, business logic, and AI data models.

---

## 2.1 Market Data Aggregation Service

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class NotificationDto {
        <<Record>>
        +String id
        +String date
        +String title
        +String market
        +String marketId
        +String trend
        +boolean isRead
        +DetailsDto details
    }

    class NotificationsResponse {
        <<Record>>
        +List~NotificationDto~ notifications
    }

    class KeywordTrendDto {
        <<Record>>
        +String keyword
        +int volume
        +int growth
        +String market
    }

    %% ── Entities ──────────────────────────────────────────────────────────────

    class MarketSignalRecord {
        <<Entity>>
        -UUID signalRecordId
        -UUID businessProfileId
        -String targetMarket
        -Double trendIndex
        -Double forexRate
        -Double gdpGrowth
        -Double seasonalityScore
        -Double rollingAverage7d
        -Double rollingAverage30d
        -Double rollingStdDev
        -Boolean spikeIndicator
        -Double yoyRatio
        -OffsetDateTime aggregatedAt
    }

    class TrendFetchJob {
        <<Entity>>
        -UUID jobId
        -String category
        -String market
        -String status
        -String weekOf
        -int attemptCount
        -int maxAttempts
        -Double trendIndex
        -Double seasonalityScore
        -Boolean spikeIndicator
        -OffsetDateTime createdAt
    }

    class IngestionJobLog {
        <<Entity>>
        -UUID jobLogId
        -String jobName
        -String status
        -Integer marketsProcessed
        -Integer recordsIngested
        -String errorMessage
        -OffsetDateTime startedAt
        -OffsetDateTime completedAt
    }

    class DemandAlert {
        <<Entity>>
        -UUID demandAlertId
        -UUID marketScoreId
        -String alertLevel
        -String alertMessage
        -String trend
        -Boolean isRead
        -OffsetDateTime windowOpenDate
        -OffsetDateTime alertDate
    }

    %% ── Repositories ──────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class MarketSignalRecordRepository {
        <<Interface>>
        +findByBusinessProfileIdAndTargetMarket(UUID, String) List~MarketSignalRecord~
    }

    class TrendFetchJobRepository {
        <<Interface>>
        +findByStatusInAndAttemptCountLessThan(List, int) List~TrendFetchJob~
    }

    class IngestionJobLogRepository {
        <<Interface>>
        +save(IngestionJobLog) IngestionJobLog
    }

    class DemandAlertRepository {
        <<Interface>>
        +findByMarketScoreId(UUID) List~DemandAlert~
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class NotificationController {
        <<RestController>>
        -NotificationService notificationService
        +list(UUID profileId) NotificationsResponse
    }

    %% ── Spring Services ───────────────────────────────────────────────────────

    class NotificationService {
        <<Service>>
        -CategoryRankNotificationService categoryRankService
        -DemandAlertRepository alertRepo
        +getNotificationsForProfile(UUID profileId) NotificationsResponse
    }

    class CategoryRankNotificationService {
        <<Service>>
        -AIInferenceGatewayService ai
        +buildForCategories(List~String~ categories) List~NotificationDto~
    }

    class MarketDataIngestionJob {
        <<Component>>
        -MarketDataIngestionService ingestionService
        -IngestionJobLogRepository logRepo
        +runDailyIngestion() void
    }

    class MarketDataIngestionService {
        <<Service>>
        -MarketSignalRecordRepository signalRepo
        -ExternalMarketDataClient extClient
        -AIInferenceGatewayService ai
        +ingestForProfile(BusinessProfile profile) int
        -ingestMarket(BusinessProfile, String market) void
    }

    class TrendFetchSchedulerService {
        <<Service>>
        -TrendFetchJobRepository jobRepo
        -AIInferenceGatewayService ai
        +runWeeklyTrendFetch() void
    }

    class ExternalMarketDataClient {
        <<Service>>
        +fetchGdpGrowth(String marketId) GdpDataDto
        +fetchForexRate(String marketId) ForexDataDto
        +fetchGdpTrend(String marketId) GdpTrendDto
        +fetchForexTrend(String marketId) ForexTrendDto
        +getFlightReference(String marketId) FlightReferenceDto
    }

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient transformerClient
        -Duration timeout
        +fetchTrends(Map payload) Map
        +fetchSeasonality(Map payload) Map
        +fetchTrendFetch(Map payload) Map
        +rankMarkets(Map payload) Map
    }

    %% ── FastAPI: Routers ──────────────────────────────────────────────────────

    class MarketDataRouter {
        <<FastAPI Router – market_data.py>>
        +POST_trends(req TrendsRequest) TrendsResponse
        +POST_trends_history(req TrendHistoryRequest) TrendHistoryResponse
        +POST_seasonality(req SeasonalityRequest) SeasonalityResponse
    }

    class TrendsRouter {
        <<FastAPI Router – trends_router.py>>
        +POST_fetch(req TrendsFetchRequest) TrendsFetchResponse
        +POST_rank_markets(req RankMarketsRequest) RankMarketsResponse
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. MarketSignalRecordRepository : implements
    JpaRepository <|.. TrendFetchJobRepository : implements
    JpaRepository <|.. IngestionJobLogRepository : implements
    JpaRepository <|.. DemandAlertRepository : implements

    NotificationController --> NotificationService : delegates
    NotificationController ..> NotificationsResponse : returns

    NotificationService --> CategoryRankNotificationService : calls
    NotificationService --> DemandAlertRepository : queries
    NotificationService ..> NotificationDto : assembles

    CategoryRankNotificationService --> AIInferenceGatewayService : rankMarkets
    NotificationsResponse *-- NotificationDto : contains
    NotificationDto *-- KeywordTrendDto : nested in details

    MarketDataIngestionJob --> MarketDataIngestionService : calls
    MarketDataIngestionJob --> IngestionJobLogRepository : persists log

    MarketDataIngestionService --> MarketSignalRecordRepository : persists
    MarketDataIngestionService --> ExternalMarketDataClient : fetches GDP/Forex
    MarketDataIngestionService --> AIInferenceGatewayService : fetchSeasonality
    MarketSignalRecordRepository --> MarketSignalRecord : manages

    TrendFetchSchedulerService --> TrendFetchJobRepository : reads/updates
    TrendFetchSchedulerService --> AIInferenceGatewayService : fetchTrendFetch
    TrendFetchJobRepository --> TrendFetchJob : manages

    AIInferenceGatewayService ..> MarketDataRouter : HTTP POST /seasonality
    AIInferenceGatewayService ..> TrendsRouter : HTTP POST /fetch · /rank-markets
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant NTC as NotificationController
    participant NS as NotificationService
    participant CRS as CategoryRankNotificationService
    participant GW as AIInferenceGatewayService
    participant TR as TrendsRouter
    participant MDS as MarketDataIngestionService
    participant TFS as TrendFetchSchedulerService
    participant MR as MarketDataRouter
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-2.1a — Load Notifications
        Client->>NTC: GET /api/v1/notifications?profileId={id}
        NTC->>NS: getNotificationsForProfile(profileId)

        NS->>CRS: buildForCategories(profile.categories)
        loop per category
            CRS->>GW: rankMarkets({category})
            GW->>TR: POST /api/v1/trends/rank-markets
            TR->>TR: fetch PyTrends volumes × 3 markets
            TR-->>GW: RankMarketsResponse
            GW-->>CRS: Map result
            CRS->>CRS: map to NotificationDto
        end

        NS->>DB: SELECT tbl_demand_alert WHERE market_score_id IN (...)
        DB-->>NS: DemandAlert rows
        NS->>NS: merge keyword + demand notifications
        NS-->>NTC: NotificationsResponse
        NTC-->>Client: 200 NotificationsResponse
    end

    rect rgb(255, 248, 230)
        Note over TFS,DB: UC-2.1b — Weekly Trend Fetch (Spring Scheduler, Sundays 00:00 UTC)
        TFS->>DB: UPSERT tbl_trend_fetch_job for 21 (category × market) combos
        loop per PENDING / FAILED job (max 3 attempts)
            TFS->>TFS: mark job IN_PROGRESS
            TFS->>GW: fetchTrendFetch({market, category})
            GW->>TR: POST /api/v1/trends/fetch
            TR->>TR: PyTrends fetch + 4–12 s jitter + SeasonalShiftDetector
            TR-->>GW: TrendsFetchResponse (trendIndex, rolling stats, spike, seasonalityScore)
            GW-->>TFS: Map result
            TFS->>DB: UPDATE tbl_trend_fetch_job SET status=SUCCESS, result fields
        end
    end

    rect rgb(235, 255, 242)
        Note over MDS,DB: UC-2.1c — Daily Market Data Ingestion (Spring Scheduler, 00:00 UTC)
        MDS->>DB: SELECT tbl_market_signal_record per (profileId, market)
        DB-->>MDS: existing signal history rows
        alt first run or < 12 rows
            MDS->>GW: fetchTrendHistory({market, categories, weeks=12})
            GW->>MR: POST /internal/market-data/trends/history
            MR-->>GW: TrendHistoryResponse (weekly series)
            GW-->>MDS: backfill series
            MDS->>DB: INSERT 12 × tbl_market_signal_record (backfill)
        end
        MDS->>GW: fetchSeasonality({market, weeklyHistory})
        GW->>MR: POST /internal/market-data/seasonality
        MR->>MR: SeasonalShiftDetector — rolling avgs, 2σ spike, YoY, score 0–1
        MR-->>GW: SeasonalityResponse
        GW-->>MDS: Map result
        MDS->>DB: UPSERT tbl_market_signal_record (current week)
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_business_profile {
        UUID business_profile_id PK
        UUID user_id FK
        VARCHAR business_name
        TEXT categories
        FLOAT uniqueness_score
    }

    tbl_market_signal_record {
        UUID signal_record_id PK
        UUID business_profile_id FK
        VARCHAR target_market
        DOUBLE trend_index
        DOUBLE forex_rate
        DOUBLE gdp_growth
        DOUBLE seasonality_score
        DOUBLE rolling_average_7d
        DOUBLE rolling_average_30d
        DOUBLE rolling_std_dev
        BOOLEAN spike_indicator
        DOUBLE yoy_ratio
        TIMESTAMPTZ aggregated_at
    }

    tbl_market_economic_trend {
        UUID economic_trend_id PK
        VARCHAR market
        VARCHAR currency_code
        DOUBLE gdp_latest
        TEXT gdp_trend_json
        DOUBLE forex_latest
        TEXT forex_trend_json
        TIMESTAMPTZ fetched_at
    }

    tbl_trend_fetch_job {
        UUID job_id PK
        VARCHAR category
        VARCHAR market
        VARCHAR status
        VARCHAR week_of
        INT attempt_count
        INT max_attempts
        DOUBLE trend_index
        DOUBLE seasonality_score
        BOOLEAN spike_indicator
        TIMESTAMPTZ created_at
        TIMESTAMPTZ completed_at
    }

    tbl_ingestion_job_log {
        UUID job_log_id PK
        VARCHAR job_name
        VARCHAR status
        INT markets_processed
        INT records_ingested
        TEXT error_message
        TIMESTAMPTZ started_at
        TIMESTAMPTZ completed_at
    }

    tbl_demand_alert {
        UUID demand_alert_id PK
        UUID market_score_id FK
        VARCHAR alert_level
        TEXT alert_message
        VARCHAR trend
        BOOLEAN is_read
        TIMESTAMPTZ window_open_date
        TIMESTAMPTZ alert_date
    }

    tbl_business_profile ||--o{ tbl_market_signal_record : "has signal history"
    tbl_business_profile ||--o{ tbl_trend_fetch_job : "tracks fetch jobs"
    tbl_market_signal_record }o--|| tbl_market_economic_trend : "enriched by"
```

---
---

## 2.2 Market Radar & Demand Forecasting

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class MarketDto {
        <<Record>>
        +String id
        +int rank
        +String name
        +String city
        +int matchScore
        +String directive
        +boolean directFlight
        +int distanceKm
        +List~ChartDataPointDto~ chartData
        +List~GdpTrendPointDto~ gdpTrend
        +List~ForexTrendPointDto~ forexTrend
        +List~AirlineDto~ airlines
    }

    class MarketsResponse {
        <<Record>>
        +List~MarketDto~ markets
    }

    class GeminiForecastRequest {
        <<Pydantic Model>>
        +String profileId
        +String market
        +List~float~ trendSeries
        +float rolling7dAvg
        +float rolling30dAvg
        +float rollingStd7d
        +boolean spikeIndicator
        +float seasonalityScore
        +float forexRate
        +float gdpGrowth
        +boolean holidayFlag
    }

    class EconomicScoreRequest {
        <<Pydantic Model>>
        +String market
        +float predicted_demand
        +float seasonality_score
        +boolean spike_indicator
        +float gdp_growth
        +float forex_vs_php
        +boolean direct_flight
        +int distance_km
        +int flight_frequency
    }

    %% ── Entities ──────────────────────────────────────────────────────────────

    class ForecastResult {
        <<Entity>>
        -UUID forecastResultId
        -UUID businessProfileId
        -String targetMarket
        -Double predictedDemand
        -Double forecastConfidence
        -Double mapeScore
        -Double mae
        -Double rmse
        -Integer forecastHorizonWeeks
        -String weeklyForecastsJson
        -OffsetDateTime generatedAt
    }

    class MarketScore {
        <<Entity>>
        -UUID marketScoreId
        -UUID forecastResultId
        -Double marketScore
        -Double seasonalityScore
        -Boolean spikeIndicator
        -Double gdpPerCapitaGrowth
        -Double forexVsPhp
        -Integer marketRank
        -OffsetDateTime evaluatedAt
    }

    %% ── Repositories ──────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class ForecastResultRepository {
        <<Interface>>
        +findTopByBusinessProfileIdAndTargetMarketOrderByGeneratedAtDesc(UUID, String) Optional~ForecastResult~
    }

    class MarketScoreRepository {
        <<Interface>>
        +findTopByForecastResultIdOrderByEvaluatedAtDesc(UUID) Optional~MarketScore~
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class ForecastingController {
        <<RestController>>
        -ForecastingService forecastingService
        +markets(UUID profileId) ResponseEntity~MarketsResponse~
        +analyze(UUID profileId) ResponseEntity~MarketsResponse~
    }

    %% ── Spring Services ───────────────────────────────────────────────────────

    class ForecastingService {
        <<Service>>
        -EnrichedSequenceBuilder seqBuilder
        -AIInferenceGatewayService ai
        -ForecastResultRepository forecastRepo
        -MarketScoreRepository scoreRepo
        +forecastForProfile(UUID profileId, boolean refresh) MarketsResponse
        +loadMarketsFromDb(UUID profileId) MarketsResponse
        #runPipeline(UUID profileId) MarketsResponse
        -buildChartData(List~MarketSignalRecord~, List~float~) List~ChartDataPointDto~
        -buildDirective(String market, int matchScore, boolean spike) String
    }

    class EnrichedSequenceBuilder {
        <<Service>>
        -MarketSignalRecordRepository signalRepo
        +buildSequence(UUID profileId, String market) Map
    }

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient transformerClient
        -Duration timeout
        -Duration rankMarketsTimeout
        +batchForecast(Map payload) Map
        +scoreMarket(Map payload) Map
    }

    %% ── FastAPI: Router ───────────────────────────────────────────────────────

    class ForecastingRouter {
        <<FastAPI Router – forecasting.py>>
        +POST_inference(req GeminiForecastRequest) ForecastResponse
        +POST_inference_batch(req GeminiBatchForecastRequest) GeminiBatchForecastResponse
        +POST_score(req EconomicScoreRequest) EconomicScoreResponse
    }

    %% ── FastAPI: Services ─────────────────────────────────────────────────────

    class GeminiForecaster {
        <<Service – gemini_forecaster.py>>
        +forecast(market, trend_series, ...) dict
        +forecast_batch(markets_data list) dict
    }

    class XGBoostScorer {
        <<Service – xgboost_scorer.py>>
        -XGBModel model
        +score(payload dict) dict
    }

    class ForecastValidator {
        <<Service – forecast_validator.py>>
        +validate(result dict) dict
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. ForecastResultRepository : implements
    JpaRepository <|.. MarketScoreRepository : implements

    ForecastingController --> ForecastingService : delegates
    ForecastingController ..> MarketsResponse : returns

    ForecastingService --> EnrichedSequenceBuilder : builds sequence
    ForecastingService --> AIInferenceGatewayService : batch forecast + score
    ForecastingService --> ForecastResultRepository : persists/reads
    ForecastingService --> MarketScoreRepository : persists/reads
    ForecastingService ..> MarketDto : constructs
    ForecastingService ..> MarketsResponse : returns

    ForecastResultRepository --> ForecastResult : manages
    MarketScoreRepository --> MarketScore : manages
    MarketScore ..> ForecastResult : FK forecastResultId

    MarketsResponse *-- MarketDto : contains

    AIInferenceGatewayService ..> ForecastingRouter : HTTP POST /inference-batch · /score

    ForecastingRouter --> GeminiForecaster : forecast_batch
    ForecastingRouter --> XGBoostScorer : score
    ForecastingRouter --> ForecastValidator : validate
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant FC as ForecastingController
    participant FS as ForecastingService
    participant SB as EnrichedSequenceBuilder
    participant GW as AIInferenceGatewayService
    participant FAST as ForecastingRouter
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-2.2a — Load Markets from DB (no AI)
        Client->>FC: GET /api/v1/forecasting/markets?profileId={id}
        FC->>FS: loadMarketsFromDb(profileId)
        loop per market (korea, japan, usa)
            FS->>DB: SELECT tbl_forecast_result WHERE profile_id = ? ORDER BY generated_at DESC LIMIT 1
            DB-->>FS: ForecastResult row
            FS->>DB: SELECT tbl_market_score WHERE forecast_result_id = ?
            DB-->>FS: MarketScore row
            FS->>DB: SELECT tbl_market_signal_record WHERE profile_id = ? AND market = ?
            DB-->>FS: signal history rows
            FS->>FS: buildChartData(signals, weeklyForecastsJson)
            FS->>FS: buildDirective(market, matchScore, spikeIndicator)
            FS->>FS: construct MarketDto
        end
        FS->>FS: sort by marketScore DESC → assign ranks 1–3
        FS-->>FC: MarketsResponse
        FC-->>Client: 200 MarketsResponse
    end

    rect rgb(255, 235, 235)
        Note over Client,DB: UC-2.2b — Full Forecast Pipeline (Gemini + XGBoost)
        Client->>FC: POST /api/v1/forecasting/analyze/{profileId}
        FC->>FS: forecastForProfile(profileId, refresh=true)
        FS->>FS: runPipeline(profileId)

        Note over FS,DB: Phase A — Build Enriched Sequences
        loop per market
            FS->>SB: buildSequence(profileId, market)
            SB->>DB: SELECT tbl_market_signal_record chronological history
            DB-->>SB: signal rows
            SB->>SB: assemble trendSeries, rolling stats, holiday flag
            SB-->>FS: Map payload
        end

        Note over FS,FAST: Phase B — Gemini Batch Forecast (1 RPM call)
        FS->>GW: batchForecast(allMarketsPayload)
        GW->>FAST: POST /internal/forecasting/inference-batch
        FAST->>FAST: construct Gemini prompt for all markets
        FAST->>FAST: call Gemini API (temperature=0.1, JSON mode)
        FAST->>FAST: ForecastValidator — MAPE ≤ 15% check
        FAST-->>GW: GeminiBatchForecastResponse {korea, japan, usa}
        GW-->>FS: Map per-market ForecastResponse

        Note over FS,DB: Phase C — XGBoost Scoring + Persist
        loop per market
            FS->>GW: scoreMarket({predictedDemand, seasonality, gdp, forex, flight…})
            GW->>FAST: POST /internal/forecasting/score
            FAST->>FAST: XGBoostScorer — market_score = 0.40×demand + 0.35×seasonality + 0.25×economic
            FAST-->>GW: EconomicScoreResponse
            GW-->>FS: Map score
            FS->>DB: INSERT tbl_forecast_result
            FS->>DB: INSERT tbl_market_score
            alt spikeIndicator == true
                FS->>DB: INSERT tbl_demand_alert (alertLevel=WARNING/CRITICAL)
            end
        end

        FS->>FS: sort by marketScore DESC → assign marketRank 1–3
        FS->>FS: buildChartData + buildDirective per market → List~MarketDto~
        FS-->>FC: MarketsResponse
        FC-->>Client: 200 MarketsResponse
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_business_profile {
        UUID business_profile_id PK
        UUID user_id FK
        VARCHAR business_name
        TEXT categories
        FLOAT uniqueness_score
    }

    tbl_market_signal_record {
        UUID signal_record_id PK
        UUID business_profile_id FK
        VARCHAR target_market
        DOUBLE trend_index
        DOUBLE seasonality_score
        DOUBLE rolling_average_7d
        BOOLEAN spike_indicator
        DOUBLE yoy_ratio
        TIMESTAMPTZ aggregated_at
    }

    tbl_forecast_result {
        UUID forecast_result_id PK
        UUID business_profile_id FK
        VARCHAR target_market
        DOUBLE predicted_demand
        DOUBLE forecast_confidence
        DOUBLE mape_score
        DOUBLE mae
        DOUBLE rmse
        INT forecast_horizon_weeks
        TEXT weekly_forecasts_json
        TIMESTAMPTZ generated_at
    }

    tbl_market_score {
        UUID market_score_id PK
        UUID forecast_result_id FK
        DOUBLE market_score
        DOUBLE seasonality_score
        BOOLEAN spike_indicator
        DOUBLE gdp_per_capita_growth
        DOUBLE forex_vs_php
        INT market_rank
        TIMESTAMPTZ evaluated_at
    }

    tbl_demand_alert {
        UUID demand_alert_id PK
        UUID market_score_id FK
        VARCHAR alert_level
        TEXT alert_message
        VARCHAR trend
        BOOLEAN is_read
        TIMESTAMPTZ window_open_date
        TIMESTAMPTZ alert_date
    }

    tbl_orig_weekly_demand_value {
        UUID demand_value_id PK
        UUID business_profile_id FK
        TIMESTAMPTZ week
        VARCHAR target_market
        DECIMAL beach_category
        DECIMAL adventure
        DECIMAL cultural
        DECIMAL theme_parks
        DECIMAL urban
        DECIMAL culinary
        DECIMAL accommodation
        DECIMAL market_score
        INT market_rank
        DECIMAL forex
        DECIMAL gdp
    }

    tbl_business_profile ||--o{ tbl_market_signal_record : "has signal history"
    tbl_business_profile ||--o{ tbl_forecast_result : "has forecast results"
    tbl_business_profile ||--o{ tbl_orig_weekly_demand_value : "has demand values"
    tbl_forecast_result ||--o| tbl_market_score : "scored by"
    tbl_market_score ||--o{ tbl_demand_alert : "generates alerts"
```
