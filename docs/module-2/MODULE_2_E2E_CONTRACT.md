# Module 2 E2E Contract — Step 1 of 20

**Status:** Frozen decision record for the Module 2 E2E workstream.
**Scope:** Contract freeze only. This step modifies no production code, schema, data, fixtures, or tests.
**Authority:** This document resolves the open implementation choices identified in [MODULE_2_E2E_STATUS_AND_DATA_MAPPING.md](MODULE_2_E2E_STATUS_AND_DATA_MAPPING.md). Later Module 2 work must conform to it. If older comments, diagrams, or documents disagree, this contract wins.

## 1. Forex unit

### 1.1 Canonical unit

The sole Module 2 forex unit is **PHP per 1 foreign-currency unit**.

- `0.0416` KRW means `1 KRW = 0.0416 PHP`.
- `0.3800` JPY means `1 JPY = 0.3800 PHP`.
- `57.0000` USD means `1 USD = 57.0000 PHP`.

No Module 2 writer may store “foreign units per PHP” after this contract is implemented.

| Location / interface | Required unit |
| --- | --- |
| `tbl_market_signal_record.forex_rate` | PHP per 1 foreign unit |
| `tbl_market_score.forex_vs_php` | PHP per 1 foreign unit |
| `tbl_market_economic_trend.forex_trend_json[*].value` | PHP per 1 foreign unit |
| `tbl_market_economic_trend.forex_latest` | PHP per 1 foreign unit |
| FastAPI `EconomicScoreRequest.forex_vs_php` and XGBoost scorer input | PHP per 1 foreign unit |
| `MarketDto.forexValue` and `forexTrend[*].value` | PHP per 1 foreign unit |
| UI label | Exact template: `PHP per 1 {currency}` |

### 1.2 Existing-data conversion

The migration must classify values by provenance, not invert every stored number.

| Existing source | Existing unit | Required migration action |
| --- | --- | --- |
| Live ingestion written through `ExternalMarketDataClient` | foreign units per PHP | For each non-zero finite value `v`, write `1 / v` to `tbl_market_signal_record.forex_rate`, `tbl_market_score.forex_vs_php`, `tbl_market_economic_trend.forex_latest`, and each corresponding `forex_trend_json[*].value`. |
| V18 seed data | PHP per foreign unit | Preserve as-is; do not invert. |

Zero, null, non-finite, or malformed historic values are not invertible. They remain null and are handled by the explicit feature-matrix rules in §3.4; they must never be turned into an invented exchange rate.

## 2. Signal cadence and identity

### 2.1 One signal row equals one ISO week

One `tbl_market_signal_record` row represents exactly this tuple:

```text
(business_profile_id, category, target_market, iso_week_year, iso_week_number)
```

- `iso_week_year` is the ISO-8601 week-based year, which can differ from the Gregorian calendar year.
- `iso_week_number` is `1` through `53`.
- Time zone is **UTC**.
- The week begins Monday at `00:00:00 UTC`.
- `week_start_at` is the Monday timestamp that identifies the observation week. `aggregated_at` remains the write/refresh timestamp and is not part of the business key.
- `category` is required for all new rows.

The implementation must add non-null `week_start_at`, `iso_week_year`, and `iso_week_number` after migration backfill, plus a database unique constraint for the five-column tuple above. Legacy category-less records cannot satisfy this key until they are backfilled or removed.

### 2.2 Daily cron semantics

The daily cron calculates the current UTC ISO week and upserts one row for every applicable `(profile, category, market)` tuple.

- It overwrites that current week’s signal values, derived rolling fields, provenance fields, and `aggregated_at` using the latest aggregation.
- It never creates a second row merely because a new UTC day has started.
- It does not modify a closed historical week except through the explicit backfill process.

### 2.3 Backfill semantics

Historical ingestion writes one row per historical PyTrends week, with the source week’s Monday UTC used as `week_start_at`. It uses the same conflict key, so rerunning a backfill updates that source week instead of duplicating it.

An initial backfill must retrieve and persist **at least 64 ISO weeks** per `(profile, category, market)` where the external source provides them. This covers the 12-week model window and the 59-week YoY requirement. A source with fewer weeks is still persisted honestly; forecasting begins only once it has 12 valid weekly rows. A missing YoY prevents a CRITICAL alert under §6.2.

## 3. Feature matrix

### 3.1 Shape and order

Every forecasting engine receives exactly 12 chronological weekly rows, oldest first. The immutable feature order is:

```text
[trend_index, forex_rate, gdp_growth, seasonality_score, spike_indicator, holiday_flag]
```

The request may be field-named, but its encoder must yield this exact order. Adding, removing, or reordering a feature requires a new versioned model contract.

Every value is a finite `float`. `spike_indicator` and `holiday_flag` are `0.0` or `1.0`, never a JSON boolean, null, NaN, or infinity.

`W = 12` and `MIN_RECORDS = 12`. A request with fewer than 12 valid weekly rows fails with the existing structured missing-input response (HTTP 424). The pipeline must not pad an insufficient history with synthetic weeks.

### 3.2 Time correctness

For a forecast ending at week `t`, the matrix contains `t-11` through `t`. Every feature in a row uses information available no later than the end of that row’s week. Seasonality and spike are computed from the history up to that row; future weeks must never influence an earlier feature row.

### 3.3 No-null invariant

No matrix cell can be null, NaN, or infinite. Spring owns matrix construction and follows §3.4. A rule that says **fail** returns HTTP 424; it must not substitute a generic midpoint, zero, or one.

### 3.4 Imputation rules

| Feature | Required rule within the same profile/category/market chronological series |
| --- | --- |
| `trend_index` | Use the measured weekly index. For a missing current value, carry forward the most recent usable earlier weekly index. If no earlier usable value exists, fail with HTTP 424. |
| `forex_rate` | Use the canonical-unit weekly rate. If missing, carry forward the most recent usable earlier rate for the market. If unavailable in signals, use the most recent usable canonical `tbl_market_economic_trend.forex_latest`; if still unavailable, fail with HTTP 424. |
| `gdp_growth` | Use the recorded annual GDP growth. If missing, carry forward the most recent usable earlier rate for the market. If unavailable in signals, use the most recent usable `tbl_market_economic_trend.gdp_latest`; if still unavailable, fail with HTTP 424. |
| `seasonality_score` | Recompute deterministically for each row from its trend history with `seasonal_shift_detector.compute`; never copy a later row’s score. |
| `spike_indicator` | Recompute deterministically for each row from its trend history with the same detector; encode true as `1.0`, false as `0.0`. |
| `holiday_flag` | Derive from that market’s fixed UTC ISO-week calendar in `EnrichedSequenceBuilder.HOLIDAY_WEEKS`; encode calendar membership as `1.0`, otherwise `0.0`. |

## 4. Forecast response contract

Every engine behind `POST /internal/forecasting/inference` and `POST /internal/forecasting/inference-batch` returns this exact object for each market. Field names remain snake_case because Spring consumes those names today.

| Field | JSON type | Required range / semantics |
| --- | --- | --- |
| `predicted_demand_4w` | number | Finite float, 0–100 inclusive; the near-term four-week demand estimate. |
| `predicted_demand_12w` | number | Finite float, 0–100 inclusive; the twelve-week outlook. |
| `weekly_forecasts` | array of number | Exactly 12 finite floats, each 0–100 inclusive, ordered `[Wk+1, …, Wk+12]`. |
| `mape` | number | Finite float `>= 0`. |
| `mae` | number | Finite float `>= 0`. |
| `rmse` | number | Finite float `>= 0`. |
| `confidence` | number | Finite float from `0.0` through `1.0` inclusive. |
| `passed` | boolean | Engine validation outcome. |
| `low_confidence_disclaimer` | boolean | `true` exactly when the UI must treat the result as low confidence. |
| `message` | string | Empty string when no warning exists; otherwise a user-safe warning. Never null. |
| `source` | string | Exact engine identifier: `stub`, `groq`, or `bilstm`. |

The batch envelope remains `{ "results": { "market-id": ForecastResponse } }`. Spring must reject a result that omits a field, has a non-finite number, has another weekly-forecast length, or uses an unknown source identifier.

## 5. Forecast engine switch

`FORECAST_ENGINE` selects the FastAPI forecasting implementation.

| Value | Definition |
| --- | --- |
| `stub` | Deterministic local contract engine. It is the default when `FORECAST_ENGINE` is absent. |
| `groq` | Existing external Groq forecasting engine. Selected only explicitly and only with available credentials. |
| `bilstm` | The trained BiLSTM + Transformer adapter. Selected only explicitly and only after its artifact, scaler, and loader pass readiness checks. |

Any other setting is a configuration error: startup must fail with an error that names `FORECAST_ENGINE` and the three allowed values.

The real trained BiLSTM + Transformer artifact is **out of scope** for this E2E workstream. The workstream prepares only the stable input/output seam. Until it is delivered, `stub` is mandatory, local, deterministic for identical input, network-independent, and strictly compliant with §4. It identifies itself with `source: "stub"`.

The stub output is explicitly unvalidated:

```text
mape = 100.0
mae = 100.0
rmse = 100.0
confidence = 0.0
passed = false
low_confidence_disclaimer = true
message = "Deterministic stub forecast — not a validated model prediction."
```

This makes it impossible for a non-model forecast to masquerade as a validated forecast.

## 6. Alert rules

All rules use unrounded numeric values. UI formatting happens only after persistence.

### 6.1 WARNING

```text
WARNING when predicted_demand_4w > rolling_7d_avg × 1.2
```

### 6.2 CRITICAL

```text
CRITICAL when WARNING
AND spike_indicator = true
AND yoy_ratio is not null
AND yoy_ratio >= 1.0
```

**Exact null behavior:** a null `yoy_ratio` can produce a WARNING if its threshold is met, but it can never produce a CRITICAL. Null means insufficient comparable history, not a confirmed recurring surge.

`rolling_7d_avg` must be finite and greater than zero. If it is missing, zero, negative, NaN, or infinite, the pipeline fails with HTTP 424 and does not create an alert.

### 6.3 Uplift

For every created alert, persist and return:

```text
uplift_pct = (predicted_demand_4w / rolling_7d_avg − 1) × 100
```

`tbl_demand_alert.uplift_pct` stores full precision. The UI formats it as `{uplift_pct.toFixed(1)}%`. Alert prose must use that persisted calculation, never the fixed 20% threshold amount.

## 7. One surge vocabulary

An **active surge** means a persisted current forecast with `surgeLevel` equal to `WARNING` or `CRITICAL` under §6. A spike indicator alone is not a surge; it is only one condition for CRITICAL.

`MarketDto` will expose category-scoped `surgeLevel: null | "WARNING" | "CRITICAL"` and `upliftPct: number | null`. Each surface has one source of truth:

| UI surface | Exact text | Required field / behavior |
| --- | --- | --- |
| Alert card chip | `Surge` | Render when `DemandAlert.alertLevel` is `WARNING` or `CRITICAL`. |
| Dashboard tile | `Confirmed surges` | Count visible operator alerts whose `alertLevel` is `WARNING` or `CRITICAL`. The implementation renames this exact label to `Active surges`. |
| RankCard chip | `Surge active` | Render when `Market.surgeLevel` is `WARNING` or `CRITICAL`; do not inspect `chartData[].spike`. |
| Drawer banner | `Surge confirmed` / `No active surge` | Render `Surge confirmed` only for `Market.surgeLevel === "CRITICAL"`; render `Active demand window` for `WARNING`; render `No active surge` for null. Do not read `spikeIndicator` directly. |

## Appendix A — affected files

These are exact audited locations that later steps must change. This appendix is a change map, not authorization to modify them in Step 1.

| Decision | Affected files and line ranges |
| --- | --- |
| Forex (§1) | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/ExternalMarketDataClient.java:42-47, 140-154, 239-304`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketEconomicTrend.java:21-22, 50-53`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java:476-478, 615-617, 839, 965-967`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/MarketScore.java:19-24`; `backend/spring-boot/src/main/java/com/ceview/module2/dto/MarketDtos.java:76-84`; `backend/fastapi-transformer/app/routers/forecasting.py:87-100`; `backend/fastapi-transformer/app/services/xgboost_scorer.py:6-18, 68-98, 145-155`; `backend/spring-boot/src/main/resources/db/migration/V18__module2_module3_seed_data.sql:91-104, 129-145`; new PostgreSQL and H2 migrations. |
| Cadence (§2) | `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecord.java:18-38`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecordRepository.java:11-48`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionJob.java:16-44`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java:53-90`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchSchedulerService.java:24-52, 88-90`; `backend/spring-boot/src/main/resources/db/migration/V1__init_schema.sql:68-79`; new PostgreSQL and H2 migrations. |
| Feature matrix (§3) | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/EnrichedSequenceBuilder.java:10-25, 29, 51-145`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java:476-569`; `backend/fastapi-transformer/app/routers/forecasting.py:35-58, 113-184, 189-261`; `backend/fastapi-transformer/app/services/seasonal_shift_detector.py:85-92`; `backend/fastapi-transformer/app/services/bilstm_transformer.py:47-79, 124-136`; `backend/spring-boot/src/test/java/com/ceview/module2/submodule22/CategoryForecastTest.java:47-90`; `backend/spring-boot/src/test/java/com/ceview/module2/submodule22/ChartDataVisualTest.java:80-300`. |
| Forecast contract / engine (§4-§5) | `backend/fastapi-transformer/app/routers/forecasting.py:35-84, 113-261`; `backend/fastapi-transformer/app/main.py:14-53`; `backend/fastapi-transformer/app/services/gemini_forecaster.py:27-53, 58-101, 291-301, 319-322`; `backend/fastapi-transformer/app/services/bilstm_transformer.py:1-79`; `backend/fastapi-transformer/app/unavailable.py:1-83`; `backend/fastapi-transformer/Dockerfile:6-18`; `backend/fastapi-transformer/tests/conftest.py:1-11`; `backend/fastapi-transformer/tests/integration/test_healthz.py:1-20`; `backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java:78-160`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java:550-569`. |
| Alerts (§6) | `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java:61, 628-638, 740-752`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/DemandAlert.java:10-39`; `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/NotificationService.java:58-143`; `backend/spring-boot/src/main/java/com/ceview/module2/dto/NotificationDtos.java:57-74`; `backend/spring-boot/src/main/resources/db/migration/V1__init_schema.sql:123-129`; new PostgreSQL and H2 migrations. |
| Surge vocabulary (§7) | `frontend/types.ts:217-245, 471-475`; `frontend/components/module-2/2.1-dashboard/AlertCard.tsx:42-70`; `frontend/components/module-2/2.1-dashboard/useDashboardState.ts:59-63, 161-166, 211-214`; `frontend/components/module-2/2.1-dashboard/SignalSummary.tsx:58-69`; `frontend/components/module-2/2.1-dashboard/RankCard.tsx:19-66`; `frontend/components/module-2/2.2-market-radar/DrawerChartPanel.tsx:29-58`; `frontend/components/module-2/2.1-dashboard/MarketsRevealPanel.test.tsx:56-60`; `frontend/components/module-2/2.2-market-radar/RadarPanels.test.tsx:21-31`; `frontend/tests/contract/module2.contract.test.ts:35-53`; `e2e/tests/dashboard.spec.ts:6-50`; `e2e/tests/market-radar-drawer.spec.ts:6-32`. |

## Appendix B — excluded from Step 1

- Supplying or loading the real trained BiLSTM + Transformer artifact and scaler.
- Retraining the model or changing its learned normalization.
- Replacing static flight data or narrative templates.
- Implementing database migrations, APIs, UI behavior, fixtures, or tests.

Those are later steps and must implement this frozen contract.
