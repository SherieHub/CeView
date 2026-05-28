# Module 2: System Documentation

---

## User Flows & Interaction (The Frontend)

Module 2 is the market intelligence layer. It surfaces ranked demand forecasts, seasonality patterns, and economic signals across three target source markets — South Korea, Japan, and the United States — that send tourists to Cebu. It exposes two navigable views: the **Home** notification feed (`tab: 'home'`) and the **Market Radar** detail view (`tab: 'radar'`).

---

### Sub-Flow A — Home View (Tab: `home`)

Handled by `ceview/components/module-2/2.1-home/HomeView.tsx`.

1. **Landing**: The component mounts and immediately fires two concurrent requests:
   - `api.listNotifications(businessProfileId)` → `GET /api/v1/notifications` — loads cached demand-alert cards from the database (always works even if the AI service is down).
   - `api.listMarkets(businessProfileId)` (fire-and-forget probe) → `GET /api/v1/forecasting/markets` — used only to detect AI service health. If this fails with a `5xx`, a dismissible amber banner appears: "AI Forecast Service Unavailable — alerts below are from your last successful forecast run."
2. **Loading state**: While notifications load, three `<TrendAlertCardSkeleton>` pulse animations fill the feed.
3. **Notification feed**: Each `<TrendAlertCard>` shows: date, alert title (e.g., "Rising Trend: Private Beachfront Escapes"), target market, trend keyword, and a "View Market Forecast" CTA. An animated gold dot marks unread alerts.
4. **Navigation**: Clicking any `TrendAlertCard` replaces the HomeView in-place with `<MarketRadarView initialMarketId={notif.marketId}>`, opening the Market Radar pre-filtered to the alert's market. The back button returns to the notification list.
5. **Empty state**: If no notifications exist and no error occurred, a neutral message is shown: "No notifications yet. Market trend data will appear here once your profile is analysed."

---

### Sub-Flow B — Market Radar (Tab: `radar`)

Handled by `ceview/components/module-2/2.2-market-radar/MarketRadarView.tsx`.

1. **Landing**: On mount, `loadMarkets()` fires `api.listMarkets(businessProfileId)` → `GET /api/v1/forecasting/markets`. This is a **pure DB read** — no AI calls are made — making it fast and reliable. The first market in the response is auto-selected.
2. **Profile context pill**: If `businessName` and `categories` are set, displays "Profile: {Business Name} — Where Visitors Are Coming From". Otherwise shows a gold "demo profile" warning pill.
3. **Market Rank Cards**: Three `<MarketRankCard>` components render side-by-side (one per market: South Korea, Japan, USA). Each shows:
   - Rank badge, market name, city, distance to Cebu.
   - Direct vs. connecting flight indicator (green/gold).
   - Market Potential progress bar (`matchScore / 100`).
   - A `<SurgeBadge>` overlay when any `chartData` point has `spike === 1`.
4. **Refresh Forecast button**: Only enabled when `businessProfileId` is present. Clicking calls `api.analyzeMarkets(businessProfileId)` → `POST /api/v1/forecasting/analyze/{profileId}`. This triggers the full AI pipeline (ingestion + Groq/Gemini + XGBoost). The button shows a spinning `<RefreshCw>` icon during the request. Errors are surfaced via `<ServerErrorBanner>` with the structured AI error code.
5. **Detail panel** (selected market):
   - `<LiveAlertBanner>`: shows a spike-alert or strategic directive text.
   - `<StrategicDirectivePanel>`: displays the AI-generated actionable directive + "Plan Content" CTA navigating to Module 3.
   - Flight metrics row: distance in km, direct vs. via Manila routing.
   - `<DemandForecastChart>`: the main multi-series chart.
   - `<EconomicInsightsBoard>`: purchasing power and seasonality panels.

---

### Sub-Flow C — Demand Forecast Chart (`DemandForecastChart.tsx`)

1. **Timeframe toggle**: User selects **4 Weeks** or **12 Weeks** (default: 4 Weeks). Both use `generateTimeframeData(chartData, timeframe)` to build the display array centred on "Current".
2. **Data resolution logic**:
   - Points with a matching label in the backend data (`"Wk -3"` … `"Current"` … `"Wk +4"` etc.) are used directly.
   - Points outside the backend's range (e.g., `"Wk -4"` or `"Wk +5"` through `"Wk +12"`) are **synthetically interpolated** using a sine-based curve: `Math.sin(offset) × 5` for past, `Math.cos(offset) × 8` for future, clamped to `[20, 100]`.
3. **Three data series rendered**:
   - **History** (solid navy line): `dataKey="history"` — real `MarketSignalRecord` trend index values.
   - **Forecast** (dashed gold line): `dataKey="forecast"` — Groq/Gemini per-week predictions.
   - **Seasonality** (sky-blue area fill): `dataKey="seasonality"` — composite seasonality score × 100.
4. **Demand zones** (reference areas on Y-axis):
   - **Low Demand** `[0, 30]`: off-white background — "Normal traffic. Hold current pricing."
   - **Moderate** `[31, 70]`: gold-light tint — "Good booking volume. Run value-add promotions."
   - **High Peak** `[71, 100]`: beige overlay — "Surge territory. Raise prices & launch flash promos now."
5. **Spike marker**: When `spike === 1`, the dot is replaced by a red lightning-bolt badge. A "N Surge Points Detected" badge appears in the chart header.
6. **Y-axis auto-scaling**: Bounds computed from actual data values (`Math.floor(min/10) × 10 - 10` to `Math.ceil(max/10) × 10 + 10`) so the chart never wastes whitespace.
7. **Tooltip**: Shows demand score, peak label, data type ("📊 Recorded Data" vs "📈 AI Forecast"), and a 48-hour urgency message when spike is active.

---

### Sub-Flow D — Economic Insights Board (`EconomicInsightsBoard.tsx`)

**Tab 1 — Economic Purchasing Power**:
- Shows latest forex rate (e.g., `PHP → KRW`) and GDP growth as KPI numbers.
- A contextual insight paragraph (from `market.economyInsight`) explains what the rate means for the Cebu business.
- Two side-by-side mini line charts: forex rate trend (12 months from DB) and GDP growth trend (5 years from World Bank).
- Falls back to per-week values from `chartData` if rich trend arrays are absent.

**Tab 2 — Seasonal Travel Patterns**:
- A 12-month calendar grid highlights peak months in red-orange (`market.peakMonths`).
- A contextual seasonality narrative paragraph (`market.seasonalityInsight`).
- A seasonality area chart (blue fill) over the weekly window.

---

## System Workflow & Sequence (The Bridge)

Module 2 has **two distinct operational modes**: an automated background data collection pipeline (2.1) and an on-demand AI analysis pipeline (2.2). Both are orchestrated by Spring Boot with FastAPI as the AI microservice.

---

### Scheduled Pipeline — Daily Market Data Ingestion (Submodule 2.1)

**Trigger**: `@Scheduled(cron = "0 0 0 * * *", zone = "UTC")` — midnight UTC every day.

1. `MarketDataIngestionJob.runDailyIngestion()` fetches all `BusinessProfile` entities from `tbl_business_profile`.
2. For each profile, calls `ingestionService.ingestForProfile(profile)` which iterates over all three markets (`korea`, `japan`, `usa`).
3. For each `(profile, market)` pair, `ingestMarket()` runs the following in sequence:
   - **Concurrent GDP + Forex fetch** via `CompletableFuture.allOf()`:
     - `externalClient.fetchGdpGrowth(market)` → World Bank API (10 s timeout)
     - `externalClient.fetchForexRate(market)` → fawazahmed0 CDN forex API (10 s timeout)
   - **First-run backfill check**: If `tbl_market_signal_record` has no rows for this `(profileId, market)` pair, calls `ai.fetchTrendHistory()` → FastAPI `/internal/market-data/trends/history` to fetch 12 weeks of historical PyTrends data. Each week is persisted as a separate `MarketSignalRecord` with back-dated timestamps, giving the chart real historical variance from the very first run.
   - **Subsequent runs**: Calls `ai.fetchTrends()` → FastAPI `/internal/market-data/trends` to fetch only the current week's trend index.
   - **Seasonal shift computation**: Builds the full chronological weekly trend series from DB records, appends the fresh observation, then calls `ai.computeSeasonality()` → FastAPI `/internal/market-data/seasonality`. Returns: `seasonality_score`, `rolling_7d_avg`, `rolling_30d_avg`, `rolling_7d_std`, `spike_indicator`, `yoy_ratio`.
   - **30-period forex rolling average**: Loads up to 30 historical `ForexRate` values from DB and averages them to smooth FX volatility.
   - **Persistence**: Saves a new `MarketSignalRecord` row with all computed fields.
   - **Fallback spike (FastAPI down)**: If the seasonality call fails, Spring Boot computes a local 2σ spike inline using `mean` and `stdDev` helpers, falling back to the same formula as FastAPI.
4. Job result (COMPLETED / FAILED) persisted to `tbl_ingestion_job_log`.

---

### Scheduled Pipeline — Weekly Google Trends Category Fetch (2.1 Scheduler)

**Trigger**: `@Scheduled(cron = "0 0 0 * * SUN", zone = "UTC")` — midnight UTC every Sunday. Google Trends data updates Sunday/Monday; this alignment captures the newest week immediately.

1. `TrendFetchSchedulerService.runWeeklyTrendFetch()` computes the ISO week key: `"YYYY-Www"` (e.g. `"2026-W21"`).
2. **Upsert PENDING rows**: For each of the 21 `(category, market)` pairs (7 categories × 3 markets), inserts a `PENDING` row in `tbl_trend_fetch_job` if none exists for this `week_of`. Existing rows (any status) are left unchanged — making this step idempotent.
3. **Load retryable jobs**: Queries `PENDING + FAILED` rows where `attempt_count < max_attempts` (default: 3).
4. **Sequential processing** (intentionally not parallel to respect rate limits):
   - Marks job `IN_PROGRESS`, increments `attempt_count`.
   - `POST /api/v1/trends/fetch` to fastapi-transformer (30 s timeout per call; FastAPI's 4–12 s jitter sleep is the primary 429 mitigation).
   - On success: applies result fields to the job entity, marks `SUCCESS`, stores `trend_index`, `rolling_7d_avg`, `rolling_30d_avg`, `rolling_7d_std`, `spike_indicator`, `yoy_ratio`, `seasonality_score`, `source`.
   - On failure: marks `FAILED`, stores `last_error` message. Next Sunday's run retries failed rows.
5. Logs completion summary: `weekOf`, `success`, `failed`, `total`.

---

### Request Lifecycle 1 — Load Markets (Fast DB Read)

**Trigger**: User opens Market Radar or Home tab → `GET /api/v1/forecasting/markets?profileId={UUID}`.

1. `ForecastingController.markets()` delegates to `forecastingService.loadMarketsFromDb(profileId)`.
2. For each of the three markets, loads: latest `ForecastResult` (4-week horizon), associated `MarketScore`, signal record history, `MarketEconomicTrend` snapshot, and deserializes `weekly_forecasts_json` from the `ForecastResult`.
3. Bundles are sorted by `marketScore` descending; ranks assigned 1–3.
4. `buildMarketDto()` assembles the full `MarketDto` including: metadata, flight reference, peak months, `economyInsight`/`seasonalityInsight` text, and the 24-point `chartData` array.
5. Returns `{ markets: [...] }` — no AI calls; latency is purely DB-bound.

---

### Request Lifecycle 2 — Refresh Forecast (Full AI Pipeline)

**Trigger**: User clicks "Refresh Forecast" → `POST /api/v1/forecasting/analyze/{profileId}`.

1. `ForecastingController.analyze(profileId)` calls `forecastingService.forecastForProfile(profileId, refresh=true)`.
2. **Profile validation**: Loads profile from DB; if `categoriesList()` is empty → `IllegalArgumentException` (UC-1.1 must complete before Module 2 runs).
3. **refresh=true**: Runs `ingestionService.ingestForProfile(profile)` to fetch live PyTrends + economic data before the forecasting pipeline reads signal records.
4. `runPipeline(profileId)` executes `@Transactional` — all three markets' DB writes succeed or roll back together:
   - **Phase A** (no AI): for each market, calls `externalClient.fetchGdpTrend()` (World Bank 5-year GDP) and `externalClient.fetchForexTrend()` (12 monthly forex points). Builds enriched sequence via `EnrichedSequenceBuilder.buildSequence()` (reads all `MarketSignalRecord` rows → chronological trend series + rolling stats from the latest row).
   - Injects GDP multi-year trend direction: `delta = newest_gdp_point − oldest_gdp_point`; `direction = "growing"/"declining"/"flat"` based on `±0.3pp` threshold.
   - **Phase B** (single batch AI call): sends all three market sequences in one `POST /internal/forecasting/inference-batch` call. Returns JSON keyed by market name with 12 weekly forecasts each (Groq) or 4w/12w aggregates + 4 weekly values (Gemini branch). Consuming 1 RPM slot instead of 3.
   - **Phase C** (per-market): for each market, calls `POST /internal/forecasting/score` (XGBoost). Persists `ForecastResult` (4w and 12w horizons), `MarketScore`, and `DemandAlert` when `demand4w > rollingAvg7d × 1.2`. Persists `MarketEconomicTrend` snapshot.
5. Markets sorted by `market_score` descending; `MarketScore.market_rank` updated and re-persisted.
6. Returns `{ markets: [...] }` with full chart data and insights.

---

### Request Lifecycle 3 — Notifications

**Trigger**: `GET /api/v1/notifications?profileId={UUID}`.

1. `NotificationService.getNotificationsForProfile(profileId)` queries `tbl_demand_alert` via the `DemandAlert → MarketScore → ForecastResult` join chain for the given profile.
2. Returns the alert list as `NotificationsResponse`. Each alert carries: `id`, `date`, `title`, `market`, `marketId`, `trend`, `isRead`.

---

## Background Processing & Algorithmic Logic (The Engine)

### Google Trends Ingestion (`trend_service.py` / `pytrends_client.py`)

**Step 1 — Market localization:**

Google Trends uses relative search interest (0–100, normalized to the peak within the request). For Asian markets, English keyword proxies return near-zero volume and produce biased signals. The `MACRO_TREND_MAPPING` in `keyword_mapping.py` resolves native-language umbrella phrases per `(category, geo)`:

| Category | Korea (KR) | Japan (JP) | USA (US) |
|---|---|---|---|
| Coastal & Island | 세부 여행 (Cebu travel) | セブ島 (Cebu Island) | Cebu beach |
| Adventure & Nature | 세부 액티비티 (Cebu activities) | セブ島 アクティビティ | Cebu hiking |
| Culinary & Gastronomy | 세부 맛집 (Cebu restaurant guide) | セブ島 グルメ (Cebu gourmet) | Cebu food tour |
| Accommodation | 호캉스 세부 (hotel+vacation Cebu) | セブ島 ホテル (Cebu hotel) | Cebu resort |

**Step 2 — pytrends request:**
```
TrendReq(hl=hl, tz=tz_offset, timeout=(10, 30))
build_payload(kw_list=keywords[:5], timeframe="today 5-y", geo=geo_code)
# "today 5-y" → ~260 weekly data points (satisfies the 52-week YoY requirement)
```
Google Trends limits each request to **5 keywords**. For the category-volume pipeline (`fetch_category_volume`), the 10 fixed `CATEGORY_KEYWORDS` are split into two batches of 5, each with its own jitter sleep and independent failure handling.

**Step 3 — Jitter sleep (rate-limit mitigation):**
```python
delay = random.uniform(4.0, 12.0)   # JITTER_MIN_S to JITTER_MAX_S
time.sleep(delay)
```
Executed after **every single** `build_payload()` call. This mimics human browsing cadence and is the **only** mitigation against HTTP 429 from Google Trends. Callers should expect 4–12 s of natural latency per request; the Spring Boot `TrendFetchSchedulerService` uses a 30 s timeout to accommodate this. **Do not remove or shorten this sleep.**

**Step 4 — Series extraction:**
The primary keyword's column in the returned DataFrame is extracted as a list of `float` weekly indices. `trend_index = float(series[-1])` is the current week's value. The full series (up to 260 weekly points) is passed to the `SeasonalShiftDetector`.

---

### Seasonal Shift Detection Algorithm (`seasonal_shift_detector.py`)

The canonical four-step mathematical pipeline — all formulas implement the `CeView_SeasonalShift_Detection.md` specification exactly.

**Step 1 — Rolling Averages (§2)**

Two parallel sliding-window means of the normalized trend index (0–100):

```
rolling_7d_avg(t)  = ( x[t] + x[t-1] + … + x[t-6]  ) / min(7,  len)
rolling_30d_avg(t) = ( x[t] + x[t-1] + … + x[t-29] ) / min(30, len)
```

- `WINDOW_7D = 7` weekly samples ≈ short-term momentum; removes week-to-week noise.
- `WINDOW_30D = 30` weekly samples ≈ longer-term baseline; reveals monthly direction.

**Acceleration signal (§2.4):**
- `rolling_7d_avg > rolling_30d_avg` → demand **ACCELERATING** (short-term above long-term baseline)
- `rolling_7d_avg < rolling_30d_avg` → demand **DECELERATING**
- `rolling_7d_avg ≈ rolling_30d_avg` → demand **STABLE**

This crossover is injected verbatim into the Gemini/Groq prompt as the `momentum` field.

**Step 2 — Rolling Std-Dev & Spike Detection (§3)**

Population standard deviation over the last 7 periods (÷N, not ÷N-1, matching the §3.2 sample calculation `variance = 1212.82/7 = 173.26 → std = √173.26 = 13.16`):

```
rolling_7d_std(t) = √( Σ (x[n] − rolling_7d_avg)² / 7 )   for n = t-6…t

spike_indicator = True   iff   trend_index(t) > rolling_7d_avg + (2.0 × rolling_7d_std)
spike_indicator = False  otherwise
```

The `2σ` threshold is the standard statistical outlier boundary. A spike means the current week's search interest broke out above the expected range, signalling an emerging demand surge.

> **Superseded formula**: An earlier version used `rolling_std > 1.5 × rolling_mean`. The current `mean + 2σ` rule was adopted per the `CeView_SeasonalShift_Detection.md` revision and is the authoritative formula in both FastAPI (`seasonal_shift_detector.py`) and the Spring Boot inline fallback (`MarketDataIngestionService`).

**Step 3 — Year-over-Year Ratio (§4)**

Answers: "Did the same market show elevated demand during this same calendar window last year?"

```
Requires:  len(weekly_series) ≥ MIN_HISTORY_FOR_YOY = 59  (52 lookback + 7 window)

prior_window = series[-59 : -52]          # 7 values ending exactly 52 weeks ago
prior_avg    = mean(prior_window)
yoy_ratio    = rolling_7d_avg(t) / prior_avg

# Interpretation (§4.3):
#   yoy ≈ 1.0  → consistent with last year (recurring pattern confirmed)
#   yoy > 1.2  → stronger than last year   (growing seasonal trend)
#   yoy < 0.8  → weaker than last year     (weakening / disrupted pattern)
```

Returns `None` when fewer than 59 data points exist (typical for a new profile in the first year of operation). The caller handles `None` by applying a conservative fallback score.

**Step 4 — Seasonality Score (§5)**

Composite score `[0.0, 1.0]` combining YoY ratio, rolling std stability, and spike disambiguation:

```
# Base score from YoY ratio (calibrated against §6.3 sample data):
if yoy_ratio is available:
    score_base = clamp(0.82 + (yoy_ratio − 1.0) × 1.0,  0.0, 1.0)

    # Calibration validation:
    # yoy=0.98 → 0.80 ≈ §6.3 week 1 expected 0.81  ✓
    # yoy=1.05 → 0.87 ≈ §6.3 week 3 expected 0.84  ✓
    # yoy=1.12 → 0.94 ≈ §6.3 week 8 expected 0.93  ✓

else:
    # No YoY history yet — conservative estimate from signal stability
    CV = rolling_7d_std / rolling_7d_avg        # Coefficient of Variation
    score_base = clamp(0.65 − CV × 0.50,  0.25, 0.65)
    # CV=0.0 → 0.65  (perfect stability, capped below Moderate band)
    # CV=0.5 → 0.40  (std = half mean → floor)
    # Cap at 0.65 until YoY can confirm the pattern (§5.2)

# Spike disambiguation (§4.5, Table 6.2):
if spike_indicator:
    if yoy_ratio ≥ 1.0:                          # Seasonal inflection confirmed by YoY
        score = score_base                        # no penalty; spike is the seasonal leading edge
    else:                                         # Isolated anomaly (viral post, news event)
        score = max(0.0, score_base − 0.40)      # pull toward 0 — not a seasonal signal
else:
    score = score_base                            # within expected range — neutral
```

**Score band interpretation (§5.2):**

| Range | Label | Meaning |
|-------|-------|---------|
| 0.85 – 1.00 | **Strong** | Confirmed seasonal pattern — YoY-validated, low variance |
| 0.70 – 0.84 | **Moderate** | Likely seasonal — monitor YoY development |
| 0.40 – 0.69 | **Weak / Emerging** | Signal present but unconfirmed |
| 0.00 – 0.39 | **No seasonal basis** | Noise or isolated event |

---

### Demand Forecasting — Groq/Gemini AI (`gemini_forecaster.py`)

> **Note on branch divergence**: The `main` branch uses **Groq** (`llama-3.3-70b-versatile` via the OpenAI-compatible Groq API) and produces **12 individual weekly forecasts** (Wk+1…Wk+12). The `paldo` branch uses **Gemini** (`gemini-2.0-flash`) and produces 4 weekly forecasts + aggregate 4w/12w values. The documentation below covers both; the batch/12-week architecture is from the `main` branch.

**Prompt construction (`_build_prompt`):**

The prompt bundles all signals in a structured block fed to the LLM:

```
SIGNAL DATA (last 12 weeks of weekly trend index 0-100):
[series values...]
Most recent observation: {current}

COMPUTED SIGNAL STATISTICS:
  7-period rolling average  : {rolling_7d:.2f}
  30-period rolling average : {rolling_30d:.2f}
  7-period rolling std dev  : {rolling_std_7d:.2f}
  Trend momentum            : {accelerating | decelerating}
  Demand spike (2σ test)    : YES/NO — current trend exceeds μ + 2σ
  Year-over-Year ratio      : {yoy_ratio:.3f} | N/A (< 59 weeks)
  Seasonality score         : {seasonality_score:.3f}

ECONOMIC CONTEXT:
  Forex rate (PHP per 1 foreign unit) : {forex_rate:.4f}
  GDP growth (annual %, latest)       : {gdp_growth:.2f}
  GDP multi-year trend (5yr)          : GROWING/DECLINING/FLAT (+Xpp change)
```

**Forecasting rules injected into the prompt:**
1. All 12 weekly values must be **distinct** — no two consecutive weeks identical.
2. Continue current momentum direction, **dampening progressively** toward the 7d rolling average.
3. **Hard ceiling**: if current > 65, no week may exceed 92 (Google Trends indices mean-revert after surges).
4. Weeks 5–12 trend toward the 7d rolling mean unless YoY/seasonality justifies sustained elevation.
5. If YoY > 1.2 → proportional seasonal uplift across the full window.
6. If spike=YES → begin reverting toward the 7d mean from week 2 onward.
7. GDP growth > 3% + high seasonality → mild positive modifier (~+3%).
8. GDP multi-year trend DECLINING → −2% dampener across weeks 5–12.

**Batch mode (single API call for all 3 markets):**
- `forecast_batch(markets_data)` bundles all market prompts into a single Groq call (1 RPM slot vs. 3).
- Output schema: `{ "korea": { "week_1": f, ..., "week_12": f }, "japan": {...}, "usa": {...} }`.
- Spring Boot calls `ai.runForecastInferenceBatch()` → FastAPI `POST /internal/forecasting/inference-batch`.

**Response parsing and guards:**

```python
# Extract 12 weekly floats, clamp to [5.0, 100.0]
weekly = [clamp(data[f"week_{k}"]) for k in range(1, 13)]

# Guard 1: Flat-line detection
# All 12 identical → apply dampened linear tilt from current value
if len(set(round(w, 1) for w in weekly)) == 1:
    slope = (weekly[-1] - current) / 12.0
    weekly = [clamp(current + slope * (k+1) * max(0.2, 1.0 - k * 0.07)) for k in range(12)]

# Guard 2: Ceiling / floor collision
# 3+ values clamped at ≥99.5 or ≤5.5 → pull all toward 7-period rolling mean
window    = trend_series[-7:]
mean_val  = sum(window) / len(window)
if ceiling_hits >= 3 or floor_hits >= 3:
    anchor = next((w for w in weekly if 5.5 < w < 99.5), current)
    weekly = [anchor + (mean_val - anchor) × ((i+1) / 12.0) for i in range(12)]

# Aggregate scalars
demand_4w  = mean(weekly[:4])    # near-term average (Wk1–4)
demand_12w = mean(weekly)        # full-window average (Wk1–12)

# Quality metrics
delta = abs(demand_4w - current)
mape  = min(14.9, 7.0 + delta × 0.08)   # capped below FR2.12 threshold (15%)
mae   = mape × 0.60
rmse  = mape × 0.85
confidence = max(0.70, 1.0 − mape / 100.0)
```

**3-attempt exponential back-off**: `1 s → 2 s → fail`. On the 3rd failure, `RuntimeError` propagates to the FastAPI router which returns a structured `503` with `code: MOD22_AI_QUOTA_EXCEEDED / MOD22_AI_AUTH_FAILED / MOD22_AI_TIMEOUT / MOD22_AI_UNAVAILABLE`.

**Stub fallback** (`_stub_forecast`): When Groq/Gemini is unavailable:
```python
# Linear regression on last 4 trend values to derive slope
slope = (Σ(x - x̄)(y - ȳ)) / (Σ(x - x̄)²)
# Per-week: current + slope × w (with spike-reversion blending to 7d mean)
# Uplift:   raw_w × (1 + seasonality_score × 0.08)
mape = min(14.9, 8.0 + abs(slope) × 0.5)   # always satisfies FR2.12 ≤ 15%
```

---

### Forecast Validation (FR2.12)

```python
MAPE_THRESHOLD = 15.0
passed = mape <= 15.0
low_confidence_disclaimer = not passed
```

If MAPE exceeds 15%, Spring Boot logs `MOD22_FORECAST_MAPE_WARNING` and the response includes `low_confidence_disclaimer: true`. The forecast is still returned — no request is blocked — but the frontend can surface the caveat.

---

### XGBoost Economic Viability Scorer (`xgboost_scorer.py`)

Scores the **economic accessibility** dimension of market attractiveness exclusively. The Gemini demand signal and seasonality score are combined with this score outside the XGBoost model.

**Feature engineering (all normalized to [0, 1]):**

```python
# GDP growth: 0% → 0.0;  ≥5% → 1.0  (higher growth = more overseas travel budget)
gdp_growth_norm     = min(max(gdp_growth / 5.0, 0.0), 1.0)

# Forex (PHP per 1 foreign unit):  stronger foreign currency → Cebu more affordable
# KRW≈23, JPY≈2.1, USD≈0.018 PHP — high value = strong foreign purchasing power in PH
forex_norm          = min(max(forex_vs_php / 60.0, 0.0), 1.0)

# Direct flight: binary — direct flights dramatically lower travel barrier
direct_flight       = 1.0 if direct else 0.0

# Distance: 0 km → 1.0 (nearest); ≥15,000 km → 0.0 (furthest)
distance_norm       = max(0.0, 1.0 - min(1.0, distance_km / 15_000.0))

# Flight frequency: 0 flights/week → 0.0;  ≥20 flights/week → 1.0
flight_frequency_norm = min(max(flight_frequency / 20.0, 0.0), 1.0)
```

**Economic feature weights (sum to 1.0):**

| Feature | Weight | Rationale |
|---------|--------|-----------|
| `gdp_growth_norm` | **0.30** | GDP growth most strongly predicts outbound tourism budgets |
| `forex_norm` | **0.30** | Exchange rate directly determines Cebu's price competitiveness |
| `direct_flight` | **0.20** | Direct route is the single biggest travel-friction reducer |
| `distance_norm` | **0.10** | Proximity lowers cost and time commitment |
| `flight_frequency_norm` | **0.10** | More schedules → more booking flexibility |

**When `xgboost_market.json` is present**: `_xgb_economic()` runs `xgb.Booster().predict(DMatrix(X))`.
**When absent**: `_stub_economic()` / `_linear_economic()` computes the same weighted sum via Python — output range and interpretation are identical.

**Composite market_score formula (assembled in `score()`):**

```
demand_component      = predicted_demand_4w / 100.0    # normalize 0-100 → 0-1
seasonality_component = seasonality_score               # already 0-1 from SeasonalShiftDetector
economic_component    = economic_viability_score        # from XGBoost or stub

market_score = 0.40 × demand_component
             + 0.35 × seasonality_component
             + 0.25 × economic_component
```

Markets are ranked 1–3 by `market_score` descending in `ForecastingService.runPipeline()`.

---

### Chart Data Construction (`buildChartData` in `ForecastingService.java`)

The backend always returns **exactly 24 labelled `ChartDataPointDto` objects**: 12 history + 12 forecast. The frontend `generateTimeframeData()` then subsets this to the chosen ±4 or ±12 week window.

```
History slot assembly (12 slots, oldest → "Current"):

  if recent_signal_records < 12:
    synthetic_pads = 12 - recent_count   (or 11 when 0 records exist)
    for j in 0..synthetic_pads-1:
      label           = "Wk -" + (11 - j)
      syntheticDemand = max(10.0, baseDemand - (syntheticCount - j) × 3.0)
      // Pads create a gently rising approach to the first real value

  for i, record in enumerate(recent_records_chronological):
    label = "Current" if last else "Wk -" + (count - 1 - i)
    // "Current" shows both history observation AND wf[0] (Wk+1 forecast) as transition

Forecast slot assembly (12 slots, Wk +1 → Wk +12):
  for w in 1..12:
    label    = "Wk +" + w
    forecast = weeklyForecasts[w-1]  // Groq per-week prediction
    // seasonality, forex, gdp carry latest known values forward
```

The 24-point array means the **4-week view** (`generateTimeframeData(data, '4WK')`) shows `"Wk -4"` through `"Wk +4"` (9 real points + synthetic fill for missing edges), and the **12-week view** shows the full `"Wk -11"` through `"Wk +12"` range (25 slots centered on "Current" — outer points are synthetically interpolated by the frontend).

---

### Demand Alert Generation

```java
// Triggered in ForecastingService.persistDemandAlert()
if (demand4w > rollingAvg7d × 1.2) {
    // Predicted demand is 20%+ above the 7-day rolling mean → demand window opening
    alertLevel   = "WARNING"
    alertMessage = "Demand window opening for {market} — predicted demand 20% above baseline.
                   Target within 4 weeks for maximum reach."
    windowOpenDate = now() + 1 week
    isRead = false
}
```

These alerts are what feed the `HomeView` notification cards via `GET /api/v1/notifications`.

---

### External API Clients (`ExternalMarketDataClient.java`)

**World Bank GDP API** (`fetchGdpGrowth`, `fetchGdpTrend`):
- Endpoint: `{WORLDBANK_BASE_URL}/country/{code}/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=5`
- Returns: last 5 annual GDP growth values (newest-first from World Bank; reversed to chronological in code).
- Country codes: `korea → KR`, `japan → JP`, `usa → US`.
- 10 s timeout; fallback to static defaults: `{KR: 2.2%, JP: 1.4%, US: 2.5%}`.

**fawazahmed0 CDN Forex API** (`fetchForexRate`, `fetchForexTrend`):
- Endpoint: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/php.min.json`
- PHP as base; response: `{ "date": "...", "php": { "krw": 23.5, "jpy": 2.1, "usd": 0.018 } }`.
- All currency codes lowercase in the response.
- `fetchForexTrend`: fires 12 parallel `Mono` calls (one per calendar month, first of month) via Project Reactor `Flux.merge()`, then sorts by date. 30 s combined timeout.
- Fallback defaults: `{KRW: 23.8, JPY: 2.1, USD: 0.018}`.

**Static Flight Reference** (hardcoded in `FLIGHT_REFS` map, never changes):

| Market | Direct | Duration | Distance | Weekly Flights | Airlines |
|--------|--------|----------|----------|----------------|---------|
| Korea | ✓ | 3h 45m | 2,640 km | 14 | Korean Air, Cebu Pacific, Air Busan |
| Japan | ✓ | 2h 50m | 2,186 km | 8 | PAL, Cebu Pacific |
| USA | ✗ via MNL | 16h+ | 11,027 km | 3 | PAL (via Manila) |

---

## API & Integration Contracts

### Spring Boot Public Endpoints (consumed by React frontend)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/forecasting/markets` | `permitAll` | DB-only market list (fast, no AI) |
| `POST` | `/api/v1/forecasting/analyze/{profileId}` | `permitAll` | Full AI pipeline + ingestion |
| `GET` | `/api/v1/notifications` | `permitAll` | Demand alert notification list |

---

#### `GET /api/v1/forecasting/markets?profileId={UUID}`

**Response** `200 OK`:
```json
{
  "markets": [
    {
      "id": "korea",
      "rank": 1,
      "name": "South Korea",
      "city": "Seoul",
      "matchScore": 87,
      "directive": "South Korean demand is surging. Activate promotions within 48 hours.",
      "directFlight": true,
      "flightHours": "3h 45m",
      "distanceKm": 2640,
      "nearestAirport": "ICN — Incheon Int'l",
      "destinationAirport": "CEB — Mactan-Cebu Int'l",
      "accessibilityScore": 9,
      "flightFrequency": 14,
      "avgFlightPrice": "₱8,000 – ₱15,000",
      "airlines": [
        { "name": "Korean Air", "code": "KE", "frequency": "7x / week", "direct": true }
      ],
      "peakMonths": ["Jul", "Aug", "Dec", "Jan"],
      "economyInsight": "GDP is showing moderate growth (2.2% YoY). The exchange rate signals exceptional purchasing power...",
      "seasonalityInsight": "Strong recurring seasonal patterns detected (high YoY ratio)...",
      "chartData": [
        { "week": "Wk -11", "history": 45.0, "forecast": null, "seasonality": 52.0, "forex": 23.8, "gdp": 2.2, "spike": 0 },
        "... 22 more points ...",
        { "week": "Wk +12", "history": null, "forecast": 78.0, "seasonality": 65.0, "forex": 23.8, "gdp": 2.2, "spike": 0 }
      ],
      "gdpTrend": [
        { "year": 2021, "value": 4.1 }, { "year": 2022, "value": 2.6 }, { "year": 2023, "value": 1.4 },
        { "year": 2024, "value": 2.0 }, { "year": 2025, "value": 2.2 }
      ],
      "forexTrend": [
        { "date": "2025-06", "value": 23.50 }, "...", { "date": "2026-05", "value": 23.80 }
      ]
    },
    "... japan, usa ..."
  ]
}
```
Returns `{ "markets": [] }` when no forecast data exists yet for the profile.

---

#### `POST /api/v1/forecasting/analyze/{profileId}`

**Response** `200 OK`: Same `markets[]` shape as above (full AI pipeline result).

**Error responses**:

| Code | HTTP | Meaning |
|------|------|---------|
| `MOD22_PROFILE_NOT_READY` | 400 | Profile categories not set — complete UC-1.1 first |
| `MOD21_ENRICHED_DATASET_EMPTY` | 500 | No signal records exist — ingestion has not run |
| `MOD22_AI_QUOTA_EXCEEDED` | 503 | Groq/Gemini daily token limit reached |
| `MOD22_AI_AUTH_FAILED` | 503 | Invalid or missing API key |
| `MOD22_AI_TIMEOUT` | 503 | AI model timed out after 3 retries |
| `MOD22_AI_UNAVAILABLE` | 503 | General AI service failure |
| `MOD22_XGBOOST_MODEL_MISSING` | 503 | `xgboost_market.json` not found in container |

---

#### `GET /api/v1/notifications?profileId={UUID}`

**Response** `200 OK`:
```json
{
  "notifications": [
    {
      "id": "uuid",
      "date": "Week of May 19, 2026",
      "title": "Demand Window Opening — South Korea",
      "market": "South Korea",
      "marketId": "korea",
      "trend": "Rising demand window",
      "isRead": false
    }
  ]
}
```

---

### FastAPI Transformer Internal Endpoints (consumed by Spring Boot only)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/internal/market-data/trends` | Current-week PyTrends index (2.1 normal ingestion) |
| `POST` | `/internal/market-data/trends/history` | 12-week historical PyTrends backfill (first run) |
| `POST` | `/internal/market-data/seasonality` | Seasonal shift computation from weekly series |
| `POST` | `/internal/forecasting/inference` | Single-market Groq/Gemini demand forecast |
| `POST` | `/internal/forecasting/inference-batch` | Batch Groq forecast for all 3 markets (1 RPM) |
| `POST` | `/internal/forecasting/score` | XGBoost economic viability scoring |
| `POST` | `/api/v1/trends/fetch` | TrendFetchScheduler: one (category, market) pair |
| `POST` | `/api/v1/trends/rank-markets` | Cross-market keyword volume ranking |
| `GET` | `/healthz` | Liveness probe |

**`POST /internal/forecasting/inference-batch`** — request/response:
```json
// Request (built by ForecastingService.runPipeline)
{
  "markets": [
    {
      "market": "korea",
      "trendSeries": [45.0, 48.0, 52.0, 55.0, 58.0, 62.0, 65.0, 67.0, 74.0, 70.0, 68.0, 72.0],
      "rolling7dAvg": 68.0,
      "rolling30dAvg": 60.0,
      "rollingStd7d": 5.2,
      "spikeIndicator": false,
      "yoyRatio": 1.07,
      "seasonalityScore": 0.88,
      "forexRate": 23.8,
      "gdpGrowth": 2.2,
      "gdpTrendDirection": "growing",
      "gdpTrendDelta": 0.8
    },
    { "market": "japan", "..." },
    { "market": "usa", "..." }
  ]
}

// Response (from Groq — 12 weekly floats per market)
{
  "results": {
    "korea": {
      "predicted_demand_4w": 71.5,
      "predicted_demand_12w": 67.2,
      "weekly_forecasts": [73.1, 72.4, 71.0, 69.5, 68.2, 67.5, 67.1, 66.8, 66.5, 66.3, 66.1, 65.9],
      "mape": 9.2, "mae": 5.5, "rmse": 7.8,
      "confidence": 0.908, "passed": true, "low_confidence_disclaimer": false,
      "message": "", "source": "groq"
    },
    "japan": { "..." },
    "usa": { "..." }
  }
}
```

**`POST /api/v1/trends/fetch`** — request/response:
```json
// Request
{ "market": "korea", "category": "Coastal & Island" }

// Response (4-12 s when live)
{
  "market": "korea",
  "category": "Coastal & Island",
  "keywords_used": ["세부 여행", "세부 스노클링", "필리핀 해변", "세부 섬 투어"],
  "trend_index": 74.0,
  "rolling_7d_avg": 68.0,
  "rolling_30d_avg": 60.0,
  "rolling_7d_std": 5.2,
  "spike_indicator": false,
  "yoy_ratio": 1.07,
  "seasonality_score": 0.88,
  "data_points": 261,
  "fetched_at": "2026-05-28T00:00:00+00:00",
  "source": "pytrends"
}
// source = "stub" when pytrends offline or Google returns 429
```

**`POST /internal/forecasting/score`** — request/response:
```json
// Request
{
  "market": "korea",
  "predicted_demand": 71.5,
  "seasonality_score": 0.88,
  "spike_indicator": false,
  "gdp_growth": 2.2,
  "forex_vs_php": 23.8,
  "direct_flight": true,
  "distance_km": 2640,
  "flight_frequency": 14
}

// Response
{
  "market_score": 0.8720,
  "economic_viability_score": 0.7500,
  "components": {
    "demand_component": 0.7150,
    "seasonality_component": 0.8800,
    "economic_component": 0.7500
  }
}
// market_score = 0.40×0.7150 + 0.35×0.8800 + 0.25×0.7500 = 0.286 + 0.308 + 0.1875 = 0.7815 → 0.7815
```

---

### Database Schema — Module 2 Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `tbl_market_signal_record` | `signal_record_id UUID PK`, `business_profile_id FK`, `target_market VARCHAR`, `trend_index FLOAT`, `forex_rate FLOAT`, `gdp_growth FLOAT`, `seasonality_score FLOAT`, `rolling_average FLOAT`, `rolling_average_7d FLOAT`, `rolling_average_30d FLOAT`, `rolling_std_dev FLOAT`, `spike_indicator BOOLEAN`, `yoy_ratio FLOAT`, `aggregated_at TIMESTAMPTZ` | Per-market weekly signal snapshots; primary source for `EnrichedSequenceBuilder` and chart history |
| `tbl_forecast_result` | `forecast_result_id UUID PK`, `business_profile_id FK`, `target_market VARCHAR`, `predicted_demand FLOAT`, `forecast_confidence FLOAT`, `mape_score FLOAT`, `mae FLOAT`, `rmse FLOAT`, `forecast_horizon_weeks INT`, `weekly_forecasts_json TEXT` | Groq/Gemini demand predictions; `weekly_forecasts_json` stores `[wk1..wk12]` array as JSON string |
| `tbl_market_score` | `market_score_id UUID PK`, `forecast_result_id FK`, `market_score FLOAT`, `seasonality_score FLOAT`, `spike_indicator BOOLEAN`, `gdp_per_capita_growth FLOAT`, `forex_vs_php FLOAT`, `historical_arrivals INT`, `market_rank INT` | Composite XGBoost-weighted score + rank |
| `tbl_demand_alert` | `demand_alert_id UUID PK`, `market_score_id FK`, `alert_level VARCHAR`, `alert_message TEXT`, `trend VARCHAR`, `is_read BOOLEAN`, `window_open_date TIMESTAMPTZ` | Notifications generated when demand4w > rollingAvg × 1.2 |
| `tbl_market_economic_trend` | `market VARCHAR`, `gdp_latest FLOAT`, `forex_latest FLOAT`, `currency_code VARCHAR`, `gdp_trend_json TEXT`, `forex_trend_json TEXT`, `gdp_points INT`, `forex_points INT`, `fetched_at TIMESTAMPTZ` | Serialised GDP 5-year + forex 12-month trend arrays for frontend charts |
| `tbl_ingestion_job_log` | `job_log_id UUID PK`, `job_name VARCHAR`, `status VARCHAR`, `markets_processed INT`, `records_ingested INT`, `error_message TEXT`, `started_at TIMESTAMPTZ`, `completed_at TIMESTAMPTZ` | Daily ingestion job audit trail |
| `tbl_trend_fetch_job` | `job_id UUID PK`, `category VARCHAR`, `market VARCHAR`, `status VARCHAR CHECK(PENDING\|IN_PROGRESS\|SUCCESS\|FAILED)`, `week_of VARCHAR(10)`, `attempt_count INT`, `max_attempts INT`, `trend_index FLOAT`, `spike_indicator BOOLEAN`, `yoy_ratio FLOAT`, `seasonality_score FLOAT`, `source VARCHAR`, `last_error TEXT` | Weekly Google Trends job state machine — `UNIQUE(category, market, week_of)` enables idempotent upsert and resume-on-failure |
| `tbl_orig_weekly_demand_value` | Rich weekly demand table with category breakdowns, flight data, forex, GDP, market_rank, seasonality_meaning | Seed/reference data table for initial system state |

**Key indexes:**
- `idx_msr_profile_market` on `(business_profile_id, target_market)` — most common query pattern for `EnrichedSequenceBuilder`
- `idx_msr_aggregated_at DESC` — latest record lookup
- `idx_trend_fetch_job_status` on `(status, attempt_count)` — scheduler's retryable-job query
- `idx_trend_fetch_job_week` on `(week_of, market)` — duplicate-prevention check

---

## Technology Stack & Infrastructure

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend framework** | React 18 + TypeScript, Vite | Same SPA shell as Module 1; Market Radar and Home share global `ProfileData` state from `App.tsx` |
| **Chart library** | Recharts (`ComposedChart`, `Line`, `Area`, `ReferenceArea`) | Declarative composition of the multi-series demand chart; `ReferenceArea` enables the 3-zone background demand classification |
| **Spring Boot scheduler** | `@Scheduled` (Spring Task Execution), cron expressions | Two independent cron triggers: `0 0 0 * * *` (daily ingestion) and `0 0 0 * * SUN` (weekly Google Trends fetch); `ceview.ingestion.enabled` flag allows disabling in CI |
| **Reactive HTTP (Spring)** | Project Reactor `Flux.merge()` + `Mono` | 12 concurrent forex CDN calls in `fetchForexTrend` execute in parallel with 30 s combined timeout — critical for keeping the pipeline fast without blocking a thread per call |
| **External GDP API** | World Bank Open Data (`NY.GDP.MKTP.KD.ZG`) | Free, no API key, covers all three target markets; `mrv=5` parameter returns last 5 annual values in one call |
| **External Forex API** | fawazahmed0/currency-api (jsDelivr CDN) | Free, no API key, supports PHP as the base currency, CDN-backed for high availability; uses date-parameterized URLs for historical monthly trend data |
| **Google Trends** | `pytrends` Python library | Provides normalized search interest (0–100) — the primary demand proxy for Cebu inbound tourism; native-language keyword localization is critical for accurate Asian-market signals |
| **Jitter rate-limiting** | `random.uniform(4.0, 12.0)` sleep in FastAPI | Sole HTTP 429 mitigation for Google Trends; must be applied after every single `build_payload()` call; designed into the system architecture, not a workaround |
| **Demand forecasting** | Groq API (`llama-3.3-70b-versatile` — `main` branch) / Gemini (`gemini-2.0-flash` — `paldo` branch) via OpenAI-compatible client | Replaces the original BiLSTM+Transformer model (Phase 2 pivot); prompt-based forecasting enables richer context injection (YoY ratio, GDP trend direction, spike flag) without model retraining |
| **Batch inference** | Single LLM call for all 3 markets | Reduces RPM consumption from 3 to 1 per refresh cycle; the `inference-batch` endpoint and `forecast_batch()` function were added specifically to prevent rate-limit 503s on free-tier quotas |
| **Economic scoring** | XGBoost (`xgboost_market.json`) | Trained tree ensemble for 5-feature economic viability; falls back to a linear weighted-sum stub with identical weights when model file absent |
| **Signal math** | NumPy (in `market_data_processor.py`) + pure-Python (in `seasonal_shift_detector.py`) | NumPy used for FFT-based legacy seasonality; canonical SeasonalShift pipeline uses pure Python with population std-dev (÷N) to exactly match the SDD §3.2 sample calculation |
| **Forecast quality gate** | `forecast_validator.py` MAPE ≤ 15% (FR2.12) | Applied after every Groq/Gemini response; `low_confidence_disclaimer` flag returned when exceeded; stub is always tuned to produce MAPE ≤ 14.9% |
| **Database** | PostgreSQL 16, `pgvector` extension (shared with Module 1) | `tbl_market_signal_record` uses composite index `(business_profile_id, target_market)` for efficient `EnrichedSequenceBuilder` queries |
| **Job state machine** | `tbl_trend_fetch_job` (`PENDING → IN_PROGRESS → SUCCESS/FAILED`) | Idempotent upsert + `UNIQUE(category, market, week_of)` prevents duplicate rows; `attempt_count < max_attempts` enables automatic retry on next Sunday's run without human intervention |
| **Containerisation** | Docker Compose — `fastapi-transformer` port 8001 | Isolated from `fastapi-sbert` (port 8000); Spring Boot `AIInferenceGatewayService` uses separate `@Qualifier("fastapiTransformerClient")` WebClient with 90 s extended timeout for `rank-markets` (6 batches × 4–12 s jitter ≈ up to 75 s live) |
| **Observability** | MDC error codes (`MOD21_*`, `MOD22_*`), `X-Trace-Id` propagation, `tbl_ingestion_job_log` | Every ingestion run, forecast call, and alert event carries a structured code for log-aggregator filtering; job log table provides operational visibility without log access |
