# Module 2.2 — Market Radar (On-demand AI Pipeline)

Submodule 2.2 is the **on-demand** half of Module 2. It is triggered by user actions on the Market Radar view and runs the Groq demand forecasting + XGBoost economic scoring pipeline. Contrast with Submodule 2.1, which runs on scheduled cron jobs (PyTrends ingestion, seasonality detection) and feeds the signal records that 2.2 reads.

| Diagram | File | Scope |
|---|---|---|
| Class | [`class.mmd`](class.mmd) | Spring Boot services, entities, repositories, DTOs + FastAPI forecasting router and service modules (backend only) |
| ERD | [`er.mmd`](er.mmd) | 4 primary 2.2 tables + 2 referenced 2.1/anchor tables |
| Sequence | [`sequence.mmd`](sequence.mmd) | End-to-end flows for GET /markets (DB read) and POST /analyze (full AI pipeline), including frontend rendering impact |

---

## Two Request Flows

| Flow | Trigger | Path | AI Calls |
|---|---|---|---|
| **Load Markets** | Page mount / tab switch | `GET /api/v1/forecasting/markets?profileId=UUID` | None — pure DB read |
| **Refresh Forecast** | "Refresh Forecast" button | `POST /api/v1/forecasting/analyze/{profileId}` | Phase 0 (2.1 ingestion) → Phase B (1× Groq batch) → Phase C (3× XGBoost) |

---

## Backend Components

### Spring Boot

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Controller** | `ForecastingController` | `com/ceview/module2/ForecastingController.java` | Routes GET /markets → `loadMarketsFromDb`; POST /analyze → `forecastForProfile`; surfaces structured error codes on 4xx/5xx |
| **Service** | `ForecastingService` | `com/ceview/module2/submodule22/ForecastingService.java` | Orchestrates all 3 phases; DB-read fast path; `buildChartData()` assembles 24-point array (12 history + 12 forecast); `@Transactional` persistence in Phase C |
| **Service** | `EnrichedSequenceBuilder` | `com/ceview/module2/submodule22/EnrichedSequenceBuilder.java` | Reads `MarketSignalRecord` history → assembles Groq prompt payload: 12-week trend series, rolling 7d/30d stats, YoY ratio, seasonality score, forex, GDP, trend direction |
| **Service** | `ExternalMarketDataClient` | `com/ceview/module2/submodule21/ExternalMarketDataClient.java` | **2.2 use**: `fetchGdpTrend()` (World Bank 5-year series) + `fetchForexTrend()` (12 monthly CDN calls via `Flux.merge()`); static `getFlightReference()` |
| **Service** | `AIInferenceGatewayService` | `com/ceview/ai/AIInferenceGatewayService.java` | **2.2 methods**: `runForecastInferenceBatch(List)` → `/inference-batch`; `runMarketScoring(Map)` → `/score` |
| **Entity** | `ForecastResult` | `com/ceview/module2/submodule22/ForecastResult.java` | `tbl_forecast_result` — stored twice per market per run (4-week + 12-week horizons); `weekly_forecasts_json` holds the 12 Groq per-week values |
| **Entity** | `MarketScore` | `com/ceview/module2/submodule22/MarketScore.java` | `tbl_market_score` — composite score (0.40×demand + 0.35×seasonality + 0.25×economic); `market_rank` 1-3 updated after all-market sort |
| **Entity** | `DemandAlert` | `com/ceview/module2/submodule22/DemandAlert.java` | `tbl_demand_alert` — generated when `demand4w > rollingAvg7d × 1.2`; feeds the HomeView notification feed |
| **Entity** | `MarketEconomicTrend` | `com/ceview/module2/submodule21/MarketEconomicTrend.java` | `tbl_market_economic_trend` — GDP 5-year + forex 12-month JSON snapshots consumed by `EconomicInsightsBoard` mini-charts |
| **DTO** | `MarketDtos` | `com/ceview/module2/dto/MarketDtos.java` | `MarketsResponse`, `MarketDto`, `ChartDataPointDto`, `AirlineDto`, `GdpTrendPointDto`, `ForexTrendPointDto` |

### FastAPI Transformer (`backend/fastapi-transformer/`)

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Router** | `forecastingRouter` | `app/routers/forecasting.py` | `POST /inference-batch` — receives all 3 market sequences, returns 12 weekly forecasts per market in one Groq call; `POST /score` — XGBoost economic scoring per market |
| **Service** | `gemini_forecaster` | `app/services/gemini_forecaster.py` | `forecast_batch()` bundles all 3 prompts into 1 Groq API call; applies flat-line + ceiling/floor guards; `_stub_forecast()` fallback via linear regression |
| **Service** | `xgboost_scorer` | `app/services/xgboost_scorer.py` | 5-feature scoring (GDP, forex, direct flight binary, distance, flight frequency); XGBoost model or identical linear fallback; assembles composite `market_score` |
| **Service** | `forecast_validator` | `app/services/forecast_validator.py` | MAPE ≤ 15% quality gate (FR2.12); sets `low_confidence_disclaimer: true` when exceeded |

---

## Frontend Components

| Component | File | Renders From | What It Displays |
|---|---|---|---|
| `MarketRadarView` | `ceview/components/module-2/2.2-market-radar/MarketRadarView.tsx` | `Market[]` from `listMarkets()` / `analyzeMarkets()` | Container: 3 rank cards + selected market detail panel; "Refresh Forecast" button triggers POST /analyze |
| `MarketRankCard` | `components/MarketRankCard.tsx` | `market.rank`, `market.matchScore`, `market.chartData[].spike` | Rank badge, market name/city, ProgressBar for matchScore, SurgeBadge overlay when any spike=1 |
| `DemandForecastChart` | `components/DemandForecastChart.tsx` | `market.chartData[]` | Recharts ComposedChart — history (navy line), forecast (dashed gold), seasonality (blue area); 4WK/12WK toggle; lightning markers on spike=1 points |
| `EconomicInsightsBoard` | `components/EconomicInsightsBoard.tsx` | `market.gdpTrend`, `market.forexTrend`, `market.peakMonths`, `market.economyInsight`, `market.seasonalityInsight` | Economy tab: forex + GDP mini line charts; Seasonality tab: 12-month peak calendar + area chart |
| `LiveAlertBanner` | `components/LiveAlertBanner.tsx` | `market.chartData[].spike` | Visible only when spike=1 exists; red-orange if current, gold if upcoming; market-specific action checklist |
| `StrategicDirectivePanel` | `components/StrategicDirectivePanel.tsx` | `market.directive` | Navy panel with Groq-generated directive text; "Generate Content" CTA → navigates to Module 3 Content Studio |
| `MetricHighlight` ×2 | `components/MetricHighlight.tsx` | `market.distanceKm`, `market.directFlight` | Distance chip (e.g. "2,640 km") and Route chip ("Direct" or "Via Manila") |
| `ProgressBar` | `components/ProgressBar.tsx` | `market.matchScore` | Percentage fill bar; navy ≤75 / gold ≤85 / red-orange >85 |
| `SurgeBadge` | `components/SurgeBadge.tsx` | `market.chartData[].spike` | ⚡ SURGE overlay on MarketRankCard corner |

---

## API Response → Frontend Mapping

| `MarketDto` Field | Frontend Component | Effect |
|---|---|---|
| `rank` | `MarketRankCard` | `#1` / `#2` / `#3` badge |
| `matchScore` | `MarketRankCard` → `ProgressBar` | Bar fill % and colour |
| `chartData[].history` | `DemandForecastChart` | Solid navy history line |
| `chartData[].forecast` | `DemandForecastChart` | Dashed gold forecast line |
| `chartData[].seasonality` | `DemandForecastChart` | Blue area fill |
| `chartData[].spike` | `DemandForecastChart` | Lightning-bolt dot replacement |
| `chartData[].spike` | `SurgeBadge` | Overlay appears on card |
| `chartData[].spike` | `LiveAlertBanner` | Banner becomes visible; urgency level set |
| `directive` | `StrategicDirectivePanel` | Directive text body |
| `gdpTrend` | `EconomicInsightsBoard` | GDP 5-year mini line chart (Economy tab) |
| `forexTrend` | `EconomicInsightsBoard` | Forex 12-month mini line chart (Economy tab) |
| `economyInsight` | `EconomicInsightsBoard` | Gold callout paragraph (Economy tab) |
| `peakMonths` | `EconomicInsightsBoard` | Red-orange highlighted months in calendar grid (Seasonality tab) |
| `seasonalityInsight` | `EconomicInsightsBoard` | Beige callout paragraph (Seasonality tab) |
| `distanceKm` | `MetricHighlight` | "2,640 km" chip |
| `directFlight` | `MetricHighlight` | "Direct" (green) or "Via Manila" (gold) chip |

---

## Error Codes (POST /analyze)

| Code | HTTP | Meaning |
|---|---|---|
| `MOD22_PROFILE_NOT_READY` | 400 | Business profile has no categories — UC-1.1 must complete first |
| `MOD21_ENRICHED_DATASET_EMPTY` | 500 | No signal records exist — ingestion has never run |
| `MOD22_AI_QUOTA_EXCEEDED` | 503 | Groq daily token limit reached |
| `MOD22_AI_AUTH_FAILED` | 503 | Invalid or missing GROQ_API_KEY |
| `MOD22_AI_TIMEOUT` | 503 | Groq timed out after 3 retry attempts |
| `MOD22_AI_UNAVAILABLE` | 503 | General Groq / FastAPI failure |
| `MOD22_XGBOOST_MODEL_MISSING` | 503 | `xgboost_market.json` not found in fastapi-transformer container |
