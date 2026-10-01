# BiLSTM + Transformer Forecasting Model — Module 2 Integration Plan

> **Status:** Plan only. No production code changes have been made for this plan.
> **Branch inspected:** `feat/module2-complete` (current working branch), plus `origin/CVW-35-forecasting-model-integration` commits `30def534`, `21424c7b`, `7f710117`.

---

## 1. Executive Summary

The model-serving layer **already exists and is already merged into this branch**, but nothing calls it. That single fact reshapes the whole integration.

Three findings drive this plan:

1. **The model server is built, wired, and unreachable.** `backend/fastapi-sbert/app/routers/demand_forecast.py` is mounted at `/internal/forecasting` in `backend/fastapi-sbert/app/main.py:40`. A repo-wide grep for `demand-prediction`, `forecast/series`, `HF_DEMAND_SPACE`, and `ceview-demand` across `backend/spring-boot/src/main/java` and `frontend/services` returns **zero callers**. The work remaining is *connecting*, not *building*.

2. **The per-`(market, category)` forecasting defect described in the brief is already fixed on this branch.** `ForecastingService.java:477` builds "one sequence per (market, category) pair", using a `CategorySequence` record and a `{market}::{category}` batch key. `primaryCategory = categories.get(0)` no longer exists. **The plan's job is to not regress this, not to fix it.**

3. **The real blocker is history depth, and it is cheaply solvable.** The model requires exactly **52** weeks; ingestion requests **12** (`MarketDataIngestionService.java:159`), the DB holds exactly 12 per pair (verified against the live database), and `SequenceForecastRequest.sequence` is pinned to exactly 12. But `trend_service.fetch_trend_history` **already fetches ~52 weekly points** from SerpApi via the `"today 12-m"` preset and then discards 40 of them with `[-weeks:]`. Raising that number costs **no additional SerpApi quota** — it is the same single call.

**Recommended architecture:** implement `BilstmForecastEngine` inside `fastapi-transformer`'s existing engine registry, replacing `BilstmUnavailableEngine`. Selecting it is then a one-line env change (`FORECAST_ENGINE=bilstm`). **Spring's pipeline, DTOs, database schema, API contracts, and the entire frontend remain unchanged**, because the existing batch contract already carries `category`, already keys results per `(market, category)`, and `engineLabel()` in the frontend already renders `'bilstm'` as "BiLSTM + Transformer".

**Explicitly rejected:** the `build_52week_history()` helper on CVW-35 pads missing weeks by repeating the oldest observed value (`demand_forecast_service.py`, `pad_val = float(trend_series[0])`). At today's data depth that is **40 of 52 rows (77%) fabricated**, which directly violates this repository's `docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md` contract that Module 2 enforces everywhere else (`MOD22_NO_MARKET_DATA`, `requireNum`, `DependencyUnavailable`). This plan fails loudly instead.

**Change surface:** 2 Python files materially changed, 1 Java constant, 1 additive Pydantic field, 1 additive Java payload field. No migration. No API change. No frontend change.

---

## 2. Current Module 2 E2E Architecture

### 2.1 Verified flow

```text
Refresh button / dashboard mount
   ↓  POST /api/forecasting/analyze  |  POST /api/forecasting/ensure
ForecastingController.java:133 / :175
   ↓
ForecastingService.forecastForProfile(profileId, refresh)        :140
   ↓  (refresh=true) MarketDataIngestionService.ingestForProfile  :159  ← SerpApi trend history
ForecastingService.runPipeline(profileId)   @Transactional        :455
   ↓
Phase A  :477-550   per market × per category → EnrichedSequenceBuilder.buildSequence()
   ↓                 → 12-row feature matrix + key "{market}::{category}"
Phase B  :551-561   ONE call → AIInferenceGatewayService.runForecastInferenceBatch()  :140
   ↓                 POST http://localhost:8001/internal/forecasting/inference-batch
fastapi-transformer  app/routers/forecasting.py:224  run_inference_batch()
   ↓                 ACTIVE_ENGINE.forecast_batch()  →  forecast_engine.py
   ↓                 results keyed "{market}::{category}"
Phase C  :562-700   per pair: requireNum / optionalNum / requireWeeklyForecasts
   ↓                 → XGBoost runMarketScoring → persist:
   ↓                    tbl_forecast_result (4w + 12w) · tbl_market_score · tbl_demand_alert
   ↓
loadMarketsFromDb()  :258   (pure DB read path for GET /markets)
   ↓  MarketDto[]
GET /api/forecasting/markets?category=X   ·   GET /api/notifications
   ↓
frontend/services/apiClient.ts  markets.forCategory() :163 · notifications.list()
   ↓
useDashboardState.ts  → SignalSummary · RankCard · AlertFeed · MarketRadarDrawer/DrawerChartPanel
```

### 2.2 Component registry (exact paths)

| Layer | Path | Role |
|---|---|---|
| Controller | `backend/spring-boot/.../module2/ForecastingController.java` | `/status`, `/markets`, `/ensure`, `/analyze` |
| Orchestrator | `.../module2/submodule22/ForecastingService.java` | `runPipeline` Phases A/B/C; persistence; alerts |
| Feature matrix | `.../module2/submodule22/EnrichedSequenceBuilder.java` | 12-row × 6-feature matrix + `imputedMask` |
| Gateway | `.../ai/AIInferenceGatewayService.java:140` | `runForecastInferenceBatch` → transformer |
| Market catalog | `.../module2/MarketCatalog.java` | `IDS = ["korea","japan","usa"]`, display names |
| Engine registry | `backend/fastapi-transformer/app/services/forecast_engine.py` | `stub` \| `groq` \| `bilstm`, `ACTIVE_ENGINE` |
| Batch endpoint | `backend/fastapi-transformer/app/routers/forecasting.py:224` | `/internal/forecasting/inference-batch` |
| Ingestion (trends) | `backend/fastapi-transformer/app/services/trend_service.py:282` | `fetch_trend_history(..., weeks=12)` |
| **Model server (orphan)** | `backend/fastapi-sbert/app/routers/demand_forecast.py` | `/forecast`, `/forecast/series`, `/status` — **no callers** |
| **Model client (orphan)** | `backend/fastapi-sbert/app/services/demand_forecast_service.py` | Gradio client, normalization, 52-wk tensor |
| **Model schemas (orphan)** | `backend/fastapi-sbert/app/model/DemandForecastInputClass.py` | Input/output Pydantic contracts |
| Frontend chart | `frontend/components/module-2/2.2-market-radar/DrawerChartPanel.tsx` | `engineLabel()`, confidence banner, chart |

---

## 3. Current Forecasting Implementation

- **Trigger:** synchronous, request-scoped. `ensure` runs the live pipeline only when the newest 4-week forecast is missing or older than `maxAgeHours` (default 12); otherwise it serves cached DB rows (`ForecastingService.java:195-231`).
- **Input to inference:** exactly 12 chronological weekly rows per `(market, category)`, fields `[isoYear, isoWeek, weekStartDate, trendIndex, forexRate, gdpGrowth, seasonalityScore, spikeIndicator, holidayFlag]` plus a parallel 12-row `imputedMask`. Enforced by `SequenceForecastRequest` (`forecasting.py:112-113`, `min_length = max_length = WINDOW_LENGTH = 12`) with `model_config = ConfigDict(extra="forbid")`.
- **Persistence:** two `tbl_forecast_result` rows per pair (`forecast_horizon_weeks` 4 and 12), one `tbl_market_score`, and at most one `tbl_demand_alert`.
- **Fields the frontend consumes:** `matchScore`, `chartData[]` (24 points: 12 history + 12 forecast), `forecastConfidence`, `lowConfidence`, `forecastSource`, `surgeLevel`, `upliftPct`, `windowOpenDate`, plus alert text from `tbl_demand_alert.alert_message`.
- **Response contract (`ForecastResponse`, `forecasting.py:159-173`):** `predicted_demand_4w`, `predicted_demand_12w` and `confidence` are **required floats**; `mape`, `mae`, `rmse` are **`float | None`**; `weekly_forecasts` must contain **exactly 12** values (`requireWeeklyForecasts`, `ForecastingService.java:1429`).

---

## 4. Confirmed Root Problems

### Confirmed from code

| # | Finding | Evidence |
|---|---|---|
| C1 | Model serving exists but is unreachable from Module 2 | Router mounted `fastapi-sbert/app/main.py:40`; grep for callers in Spring/frontend returns nothing |
| C2 | **`categories.get(0)` defect is already fixed** on this branch | `ForecastingService.java:477` `CategorySequence`, composite key `{market}::{category}`; no `primaryCategory` symbol remains |
| C3 | Model needs 52 weeks; system supplies 12 | `DemandForecastInputClass.py` docstring "exactly 52 rows"; `MarketDataIngestionService.java:159` `"weeks", 12`; `EnrichedSequenceBuilder.java:38,40` `W = MIN_RECORDS = 12`; live DB = 12 rows/pair |
| C4 | CVW-35 fabricates the missing 40 weeks | `demand_forecast_service.build_52week_history`: `pad_val = float(trend_series[0]); [pad_val] * pad_count + …` |
| C5 | 52 real weeks are already fetched then discarded | `trend_service.py:310` `preset = "today 12-m"`; line 345 `[-weeks:]` |
| C6 | `trend_scaled` normalization is ambiguous | `val / 100.0 if val > 1.0 else val` → raw `1.0` scales to `1.0` (i.e. 100), raw `0.5` to `0.5` (i.e. 50) |
| C7 | Both FastAPI services expose `/internal/forecasting` | sbert `main.py:40` (8000) vs transformer `main.py` (8001) |
| C8 | Model emits no `mape`/`mae`/`rmse`/`confidence` | `DemandForecastOutputClass` has only weekly + 2 means + metadata |
| C9 | Frontend already renders the bilstm label | `DrawerChartPanel.tsx:37` `if (source === 'bilstm') return 'BiLSTM + Transformer'` |
| C10 | `'stub-v1'` already falls through `engineLabel` unmatched | `DrawerChartPanel.tsx:35` matches `'stub'`, stub emits `'stub-v1'` |

### Assumptions requiring external verification (cannot be answered by this repo)

| # | Assumption | How to verify |
|---|---|---|
| A1 | The HF Space `JamJamzz/ceview-demand-prediction-model` is live, and its `/forecast` signature matches `DemandForecastInputClass` | Call `GET /internal/forecasting/status` on sbert, then one live `POST /forecast/series` (Step 0 below) |
| A2 | The Space tolerates the ZeroGPU quota for ~6–21 calls per refresh | Observed this session: the *sbert classifier* Space exhausted free ZeroGPU quota. Same account/token → same risk |
| A3 | `model.status: "provisional"` is the intended signal for "not production-validated" | Confirm with the model author |

---

## 5. New Model Contract

**Transport:** Gradio client → HF Space `JamJamzz/ceview-demand-prediction-model`, `api_name="/forecast"`. Env override `HF_DEMAND_SPACE`, auth via existing `HF_TOKEN`.

### Input

| Field | Type | Meaning / unit |
|---|---|---|
| `history_json` | `str` (JSON) | Exactly **52** rows, oldest-first, each `[trend_scaled, week_sin, week_cos]` |
| `trend_scaled` | float `[0,1]` | Google Trends index ÷ 100 |
| `week_sin`/`week_cos` | float `[-1,1]` | `sin/cos(2π·week/52)`, week ∈ `[1,52]` |
| `market` | `'JP'\|'KR'\|'US'` | Origin market |
| `category` | snake_case literal | One of 7 (see §8) |

### Output

| Field | Type | Meaning / unit |
|---|---|---|
| `market`, `category` | str | Echo of the requested pair — **the forecast identity** |
| `weekly_forecasts[].week_ahead` | int 1–12 | Horizon index |
| `weekly_forecasts[].google_trends` | float 0–100 | **Google Trends search-interest index** — not a count, not a percentage, not a probability |
| `mean_demand_4_weeks` | float 0–100 | Mean of weeks 1–4 |
| `mean_demand_12_weeks` | float 0–100 | Mean of weeks 1–12 |
| `model.*` | dict | `model_version`, `checkpoint_sha256`, `architecture`, `seed`, `best_epoch`, `status`, `protocol_version`, `dataset_version`, `mean_basis` |

**Unit lock:** `google_trends` is the *same unit and scale* as `MarketSignalRecord.trendIndex` (0–100 Google Trends index) already used across Module 2. `46.5` means "index 46.5", never 46.5%, 46.5 tourists, or p=0.465. This is what makes the mapping in §6 semantically safe.

---

## 6. Field Mapping Contract

| Model field | Meaning | Module 2 destination | Transformation | Frontend usage |
|---|---|---|---|---|
| `mean_demand_4_weeks` | 4-wk mean index | `ForecastResponse.predicted_demand_4w` → `tbl_forecast_result.predicted_demand` (horizon 4) | none (identical unit/scale) | `matchScore` via `0.40·demand`; alert uplift baseline |
| `mean_demand_12_weeks` | 12-wk mean index | `ForecastResponse.predicted_demand_12w` → `tbl_forecast_result.predicted_demand` (horizon 12) | none | stored; long-horizon toggle |
| `weekly_forecasts[].google_trends` | per-week index | `ForecastResponse.weekly_forecasts` → `tbl_forecast_result.weekly_forecasts_json` | order by `week_ahead` asc → `List<Double>` of exactly 12 | `chartData[]` forecast half (dashed line), 4WK/12WK toggle |
| `weekly_forecasts[].week_ahead` | horizon index | — | used only to **sort**; never persisted | — |
| `market` / `category` | forecast identity | batch result key `{market}::{category}` | denormalize `KR`→`korea`, `coastal_island`→`Coastal & Island` | alert titles, drawer tabs |
| `model.status` | provisional/validated | `ForecastResponse.confidence` + `low_confidence_disclaimer` | `"provisional"` → `confidence = 0.5`, `low_confidence_disclaimer = true` | "Unvalidated forecast" banner (threshold 0.7) |
| `model.model_version` | checkpoint id | **log only** (+ optional `message`) | — | not exposed |
| `checkpoint_sha256`, `seed`, `best_epoch`, `architecture`, `protocol_version`, `dataset_version`, `mean_basis` | provenance | **log only** | — | not exposed |
| *(absent)* | accuracy metrics | `mape` / `mae` / `rmse` | **`null`** — legitimate per `ForecastResponse` typing | MAPE banner suppressed (already null-guarded) |
| *(constant)* | engine identity | `ForecastResponse.source` = `"bilstm"` | literal | `engineLabel()` → "BiLSTM + Transformer" |

**Why `predicted_demand = mean_demand_4_weeks`:** the existing `predicted_demand` (horizon 4) is consumed by (a) `market_score = 0.40·demand + 0.35·seasonality + 0.25·economic_viability`, (b) the demand-window rule `demand4w > rolling7dAverage × 1.2`, and (c) the XGBoost `predicted_demand` input bounded `ge=0, le=100`. All three expect a 0–100 Google-Trends-scale 4-week demand level. `mean_demand_4_weeks` is exactly that. **No rescaling, no unit conversion.**

**Model metadata must not reach the frontend.** `MarketDto` has no field for it and the UI has no place for it; `forecastSource` already answers "which engine" for the user.

---

## 7. Market Mapping Contract

| Model | Module 2 canonical (DB, Java, API, frontend `marketId`) | Display label | Flag |
|---|---|---|---|
| `KR` | `korea` | South Korea | KR |
| `JP` | `japan` | Japan | JP |
| `US` | `usa` | United States | US |

- Canonical internal representation = **lowercase `korea`/`japan`/`usa`** (`MarketCatalog.IDS`). It is what the DB stores (`tbl_forecast_result.target_market`), what the API returns as `MarketDto.id`, and what the frontend routes on (`?market=japan`).
- Display names come from `MarketCatalog.displayName()` — **the only place** that conversion may happen.
- Model codes are an **edge concern**: `KR`/`JP`/`US` must appear *only* inside the engine adapter, never in Java, the DB, the API, or the frontend.
- CVW-35's `MARKET_NORMALIZATION_MAP` already covers `korea→KR`, `japan→JP`, `usa→US`. Reuse it; do not write a second one.

---

## 8. Category Mapping Contract

| Model value | Backend canonical / DB value / API / frontend value | Display label |
|---|---|---|
| `accommodation_staycation` | `Accommodation & Staycation` | Accommodation & Staycation |
| `adventure_nature` | `Adventure & Nature` | Adventure & Nature |
| `coastal_island` | `Coastal & Island` | Coastal & Island |
| `culinary_gastronomy` | `Culinary & Gastronomy` | Culinary & Gastronomy |
| `cultural_heritage` | `Cultural & Heritage` | Cultural & Heritage |
| `theme_parks_entertainment` | `Theme Parks / Entertainment` | Theme Parks / Entertainment |
| `urban_city` | `Urban & City` | Urban & City |

- Canonical internal representation = **the Title-case display string**, stored verbatim in `tbl_business_profile.categories` (comma-joined), `tbl_market_signal_record.category`, `tbl_forecast_result.category`, `tbl_demand_alert.category`, and matched literally by the frontend (`BUSINESS_CATEGORIES` in `BasicInfoStep.tsx`, `CATEGORY_LABELS` in `ml_classifier.py`, `MACRO_TREND_MAPPING` keys in `keyword_mapping.py`).
- **Do not** introduce a snake_case category anywhere outside the adapter. The single wart worth noting: `Theme Parks / Entertainment` contains a `/`, which is why it must never be used in a URL path segment unencoded.
- CVW-35's `CATEGORY_NORMALIZATION_MAP` covers all 7 via lowercased lookup (`"theme parks / entertainment"` → `theme_parks_entertainment`). Reuse it; extend it only if a new category is added to `BUSINESS_CATEGORIES`.

---

## 9. Proposed Integration Architecture

**Decision: adapt the model to Module 2's existing contract inside the transformer service's engine registry.**

```text
Spring ForecastingService (UNCHANGED shape)
   ↓  one sequence per (market, category), 12-row matrix + full trendHistory (new, additive)
POST /internal/forecasting/inference-batch      ← unchanged endpoint, unchanged batch shape
   ↓
forecast_engine.ACTIVE_ENGINE            FORECAST_ENGINE=bilstm
   ↓
BilstmForecastEngine  (replaces BilstmUnavailableEngine)
   ↓  per request: validate ≥52 real weeks → build 52×3 tensor → normalize market/category
bilstm_forecaster.py  ── gradio_client ──►  HF Space JamJamzz/ceview-demand-prediction-model  /forecast
   ↓  DemandForecastOutputClass
ADAPTER: model output → ForecastResponse shape
   ↓  {predicted_demand_4w, predicted_demand_12w, weekly_forecasts[12],
   ↓   mape=None, mae=None, rmse=None, confidence, passed, source="bilstm"}
results keyed "{market}::{category}"        ← unchanged keying
   ↓
Spring Phase C (UNCHANGED) → tbl_forecast_result / tbl_market_score / tbl_demand_alert
   ↓
GET /markets (UNCHANGED) → MarketDto (UNCHANGED) → frontend (UNCHANGED)
```

### Why not call `fastapi-sbert`'s endpoints from Spring

| Criterion | Option A — engine in transformer (**chosen**) | Option B — Spring calls sbert directly |
|---|---|---|
| Spring changes | 1 constant + 1 additive payload field | New gateway method, new Java DTOs, new adapter, Phase B rewrite |
| Batch contract | Untouched | Broken — sbert has no batch endpoint; N sequential HTTP calls from Java |
| Market/category conversion | One place (Python adapter) | Duplicated into Java |
| Service boundaries | Module 2 forecasting stays in the Module 2 service | Module 2 forecasting split across two services |
| Rollback | `FORECAST_ENGINE=stub` | Revert Java + redeploy |
| Engine parity | stub/groq/bilstm remain interchangeable | bilstm becomes a special case outside the registry |

Option A also means the `/internal/forecasting` prefix collision (C7) never has to be resolved to ship — the sbert endpoints simply remain available for manual/Postman use.

---

## 10. Files That Need Modification

### Forecasting model / FastAPI (transformer)

```text
File: backend/fastapi-transformer/app/services/bilstm_forecaster.py        [NEW]
Current responsibility: —
Required change: New module. Port the Gradio client, MARKET_NORMALIZATION_MAP,
  CATEGORY_NORMALIZATION_MAP and tensor construction from
  fastapi-sbert/app/services/demand_forecast_service.py, with two deliberate changes:
  (1) NO padding — raise DependencyUnavailable when <52 real weeks are supplied;
  (2) trend_scaled = value / 100.0 unconditionally (fixes C6).
  Expose forecast(request) and forecast_batch(requests) keyed "{market}::{category}".
Why: the engine registry is the only seam Spring already understands.
Risk: MEDIUM — new network dependency, ZeroGPU quota (A2). Mitigated by FORECAST_ENGINE rollback.
```

```text
File: backend/fastapi-transformer/app/services/forecast_engine.py
Current responsibility: engine registry; BilstmUnavailableEngine raises MOD22_BILSTM_UNAVAILABLE
Required change: replace BilstmUnavailableEngine with BilstmForecastEngine delegating to
  bilstm_forecaster; update model_health() "bilstm" from hardcoded "missing" to a real probe.
Why: flips the already-declared engine from a stub to the real implementation.
Risk: LOW — additive; stub/groq paths untouched; ALLOWED_ENGINES already contains "bilstm".
```

```text
File: backend/fastapi-transformer/app/routers/forecasting.py
Current responsibility: SequenceForecastRequest / ForecastResponse contracts, /inference-batch
Required change: add ONE optional field to SequenceForecastRequest:
    trend_history: list[float] = Field(default_factory=list,
        validation_alias=AliasChoices("trendHistory", "trend_history"))
  and carry it through engine_payload().
Why: model_config uses extra="forbid" — Spring cannot send a field the schema does not declare.
  Default-empty keeps stub/groq and every existing caller valid.
Risk: LOW — additive with a default; no existing field changes.
  ORDERING: this must deploy BEFORE the Spring change that starts sending the field.
```

```text
File: backend/fastapi-transformer/app/services/trend_service.py
Current responsibility: SerpApi trend fetch; fetch_trend_history(..., weeks: int = 12)
Required change: none to logic — only confirm the "today 12-m" preset path is used for weeks<=52
  (it already is, line 310) so a 52-week request costs the same single SerpApi call.
Why: 52 real weeks with zero extra quota (C5).
Risk: NONE (no change) — listed so the reviewer verifies the assumption holds.
```

```text
File: backend/fastapi-transformer/requirements.txt
Current responsibility: transformer service deps
Required change: add gradio_client>=2.0.0
Why: the transformer service does not currently have it (only fastapi-sbert does).
Risk: LOW.
```

### Backend (Spring)

```text
File: backend/spring-boot/.../module2/submodule21/MarketDataIngestionService.java   (line 159)
Current responsibility: first-ingest backfill via ai.fetchTrendHistory(... "weeks", 12)
Required change: 12 → 52, ideally as a named constant (BACKFILL_WEEKS = 52).
Why: the model's 52-week lookback. Same SerpApi call cost (C5).
Risk: MEDIUM — 52 upserts per (market, category) instead of 12 on first ingest; longer first run.
  The uq_msr_profile_category_market_iso_week constraint already makes this idempotent.
```

```text
File: backend/spring-boot/.../module2/submodule22/EnrichedSequenceBuilder.java
Current responsibility: builds the 12-row matrix; already loads the FULL chronological history
  ("kept whole, not truncated to W") before slicing to W
Required change: add the full real trend series to the payload:
    payload.put("trendHistory", <chronological trendIndex values, oldest first>);
  W and MIN_RECORDS stay 12 — the 12-week contract is NOT changed.
Why: delivers 52 weeks to the model without touching the frozen 12-row sequence contract.
Risk: LOW — additive map entry; the full list is already in scope in that method.
```

### Database

```text
No migration required. See §12.
```

### Frontend

```text
No changes required. See §11/§14.
```

### Tests

```text
backend/fastapi-transformer/tests/unit/test_bilstm_forecaster.py            [NEW]
backend/fastapi-transformer/tests/unit/test_forecasting_contract.py        [EXTEND — optional trendHistory]
backend/spring-boot/.../submodule22/ForecastPipelineNoPlaceholderTest.java [EXTEND — per §17]
backend/spring-boot/.../submodule21/*IngestionTest.java                    [EXTEND — 52-week backfill]
```

### Documentation

```text
docs/module-2/TRANSFORMER_MODEL_INTEGRATION.md  — add the "engine registry" wiring; mark the
  fastapi-sbert endpoints as manual/diagnostic rather than the Module 2 path.
docs/module-2/MODULE_2_E2E_CONTRACT.md          — record trendHistory as an optional field and
  the 52-week ingestion depth.
RUNNING.md                                       — FORECAST_ENGINE=bilstm + HF_DEMAND_SPACE.
```

---

## 11. Files That Should NOT Change

- **All Spring Phase A/B/C control flow** beyond the single `trendHistory` line — the per-`(market, category)` loop, composite keys, `requireNum`/`optionalNum`/`requireWeeklyForecasts`, XGBoost scoring, and `persistDemandAlert`'s replace-not-accumulate behaviour are correct as-is.
- `ForecastingController.java`, `AIInferenceGatewayService.java`, `MarketDtos.java`, `loadMarketsFromDb()`, `buildMarketDto()`, `buildChartData()`.
- `MarketCatalog.java`, `MarketRouteReference`, `ExternalMarketDataClient` (GDP/forex/flight).
- **Every frontend file.** `types.ts`, `apiClient.ts`, `useDashboardState.ts`, `SignalSummary.tsx`, `RankCard.tsx`, `AlertFeed.tsx`, `AlertCard.tsx`, `MarketRadarDrawer.tsx`, `DrawerChartPanel.tsx`, `DemandForecastChart.tsx`, `SeasonalPatternsTab.tsx`, `PurchasingPowerTab.tsx`.
- `stub_forecaster.py` and `gemini_forecaster.py` — the other two engines must keep working unchanged.
- `backend/fastapi-sbert/**` — the existing model endpoints stay as a manual/diagnostic surface. **Do not delete them during this integration** (see §19).
- All Module 1/3/4 code.

---

## 12. Database Changes

**No migration is required.** Verified against the live schema:

| Requirement | Existing support |
|---|---|
| Independent forecast per `(market, category)` | `tbl_forecast_result` has both `target_market` and `category`; `idx_fr_profile_category_market` |
| 12 weekly values | `tbl_forecast_result.weekly_forecasts_json TEXT` (already written for horizon 4) |
| 4-week and 12-week means | two rows distinguished by `forecast_horizon_weeks` |
| Null accuracy metrics | `mape_score`, `mae`, `rmse` are all nullable `double precision` |
| Engine identity | `tbl_forecast_result.source VARCHAR(32)` — `"bilstm"` fits |
| 52 weekly history rows | `tbl_market_signal_record` unique on `(business_profile_id, category, target_market, iso_year, iso_week)` — any number of weeks; the backfill upserts idempotently |

**Existing-row impact:** rows written while `FORECAST_ENGINE=stub` carry `source='stub-v1'` and remain valid history. **No recalculation, deletion, or reseeding is required** — the next pipeline run overwrites forecasts naturally and `persistDemandAlert` now replaces prior alerts per `(profile, category, market)`.

One caveat to verify in staging: profiles ingested before the `weeks=52` change will still hold only 12 weeks. They will correctly fail the bilstm engine's ≥52 guard until a refresh backfills them. That is intended, honest behaviour — see §16.

---

## 13. API Changes

| Endpoint | Current request | Current response | Frontend consumer | Required change | Backward compatible? |
|---|---|---|---|---|---|
| `POST /api/forecasting/analyze` | JWT | `MarketsResponse` | `apiClient.forecast.analyze()` | **none** | ✅ |
| `POST /api/forecasting/ensure` | JWT, `maxAgeHours` | `MarketsResponse` | `useDashboardState.loadDashboard()` | **none** | ✅ |
| `GET /api/forecasting/markets?category=` | JWT | `{markets: MarketDto[]}` | `apiClient.markets.forCategory()` | **none** | ✅ |
| `GET /api/notifications` | JWT | `DemandAlert[]` | `apiClient.notifications.list()` | **none** | ✅ |
| `POST /internal/forecasting/inference-batch` (8001) | `{markets:[SequenceForecastRequest]}` | `{results: {key: ForecastResponse}}` | Spring only | **+1 optional field** `trendHistory` | ✅ (defaulted) |
| `POST /internal/forecasting/forecast{,/series}` (8000) | model-native | `DemandForecastOutputClass` | *none* | **none** — remains manual/diagnostic | ✅ |

**The public API contract does not change.** `mean_demand_4_weeks` is adapted into the existing `predicted_demand` field inside the engine, exactly as the brief prefers, so the frontend never learns the model's raw response shape.

---

## 14. Frontend Mapping

No frontend code changes. Traced end-to-end:

| Component | Source API | Service | Type / field | Meaning | New model field feeding it | Transformation |
|---|---|---|---|---|---|---|
| `DemandForecastChart` (dashed half) | `GET /markets` | `apiClient.markets.forCategory` | `Market.chartData[].forecast` | per-week index | `weekly_forecasts[].google_trends` | sort by `week_ahead`; `weekly_forecasts_json` → `buildChartData()` |
| `DemandForecastChart` (solid half) | same | same | `chartData[].history` | measured index | *(unchanged — `MarketSignalRecord.trendIndex`)* | none |
| `RankCard` / `SignalSummary` | same | same | `Market.matchScore` | 0–100 composite | `mean_demand_4_weeks` via `0.40·demand` | `market_score × 100` |
| `DrawerChartPanel` engine line | same | same | `Market.forecastSource` | engine identity | `source = "bilstm"` | `engineLabel()` → "BiLSTM + Transformer" |
| `DrawerChartPanel` unvalidated banner | same | same | `forecastConfidence`, `lowConfidence` | validation state | `model.status` | `provisional` → `0.5` / `true` |
| MAPE warning | same | same | `mapeAboveThreshold` | accuracy gate | *(null)* | already null-guarded (`ForecastingService.java:1027`) |
| `AlertCard` title/body | `GET /api/notifications` | `apiClient.notifications.list` | `alertMessage`, `category`, `market` | surge text | `mean_demand_4_weeks` → uplift rule | server-rendered string |

**Category identity is explicit at every hop** — `forecast.category` flows `model → adapter → batch key → tbl_forecast_result.category → MarketDto → alert.category`. Nothing infers a category from an array index.

**One pre-existing cosmetic defect worth fixing opportunistically (C10):** `engineLabel()` matches `'stub'` but the stub emits `'stub-v1'`, so the UI currently prints the raw string. Emitting exactly `"bilstm"` avoids inheriting that bug; fixing the `'stub'`/`'stub-v1'` mismatch itself is optional and out of scope.

---

## 15. Alert Impact

Alerts are derived in `ForecastingService.deriveDemandAlert()` from `demand4w > rolling7dAverage × DEMAND_WINDOW_MULTIPLIER (1.2)`, with `CRITICAL` additionally requiring the 2σ spike. `persistDemandAlert()` writes at most one alert per `(profile, category, market)` and now deletes prior ones first.

Because Phase A/C already iterate per `(market, category)` and the adapter returns a **genuinely independent forecast per pair**, an alert titled *"Japan — Accommodation & Staycation"* can only be produced by `JP + accommodation_staycation`'s own `mean_demand_4_weeks` crossing that market/category's own rolling baseline.

**No alert-title, alert-grouping, or frontend-label change is part of this plan.** The accuracy improvement comes entirely from the forecast data being category-specific — which this branch already made true, and which the model integration must preserve rather than undo.

---

## 16. Failure and Fallback Strategy

**Governing rule:** a category failure stays a category failure. Never substitute another category's forecast, another market's forecast, or a fabricated series.

| Condition | Behaviour | Rationale |
|---|---|---|
| < 52 real weeks for a pair | `DependencyUnavailable(MOD22_INSUFFICIENT_HISTORY)` naming market+category+actual count | Padding 40/52 rows is fabrication (C4); this mirrors `MOD22_NO_MARKET_DATA` |
| Space unreachable / Gradio init fails | `DependencyUnavailable(MOD22_BILSTM_UNAVAILABLE, dependency="bilstm")` → 503 | Same shape the engine already declared |
| ZeroGPU quota exhausted (A2) | Same 503, `cause` carrying the upstream quota text verbatim | Diagnosable — this exact failure was hit on the sbert Space this session |
| Timeout | 503 after the client timeout; no retry storm | Batch is user-triggered |
| Malformed JSON / schema mismatch | `DemandForecastOutputClass.model_validate` raises → 503 | Fail loudly |
| `weekly_forecasts` length ≠ 12 | Rejected in the adapter, and again by `requireWeeklyForecasts` (Java:1429) | Two independent guards |
| `null`/`NaN` in a forecast value | Rejected in the adapter | `requireNum` would 502 anyway |
| Value outside 0–100 | Reject rather than clamp | A model outside its own declared bound is a correctness signal, not a rounding issue |
| Unknown market/category | `ValueError` from `normalize_*` → 503 naming the offending value | Never silently default to `KR`/`accommodation_staycation` |
| Missing `model` metadata | Proceed; `confidence` falls back to the conservative low value; log a warning | Metadata is observability, not correctness |
| **One pair fails** | **Whole `@Transactional` run rolls back** (current behaviour) | Preserves today's all-or-nothing semantics; partial-success is a separate design decision, explicitly out of scope |

**Retaining the previous valid forecast** happens naturally: the transaction rolls back and the last good `tbl_forecast_result` rows stay, so `loadMarketsFromDb()` keeps serving them with the existing staleness banner.

---

## 17. Testing Strategy

### Unit — `backend/fastapi-transformer/tests/unit/test_bilstm_forecaster.py` (new)
- 52-row tensor: exactly 52 rows × 3 cols; `trend_scaled` = value/100 for 0, 0.5, 1.0, 50, 100 (locks C6); `sin²+cos² ≈ 1`; oldest-first ordering.
- **Rejects** 12/51 weeks with `MOD22_INSUFFICIENT_HISTORY` — asserts **no padding**.
- Market normalization: `korea→KR`, `japan→JP`, `usa→US`, `"Korea"`, unknown → raises.
- Category normalization: all **7** Title-case → snake_case; unknown → raises.
- Adapter: model JSON → `predicted_demand_4w == mean_demand_4_weeks`; 12 weekly in `week_ahead` order; `mape/mae/rmse is None`; `source == "bilstm"`; `status:"provisional"` → low confidence.
- Malformed: missing `mean_demand_4_weeks`; 11 weekly points; `NaN`; `google_trends = 140`.
- `forecast_batch` keys by `{market}::{category}`; **two categories, same market → two distinct entries** (guards the C2 regression).

### Integration — backend ↔ model
- `KR + accommodation_staycation` and `KR + coastal_island` in one batch → two independent results, different values.
- `GET /healthz/models` reports `engine: "bilstm"`.

### Database
- Two categories, same market, same run → two `tbl_forecast_result` rows with **different** `predicted_demand`, and 4 rows total across both horizons.
- `mape_score` persists as SQL `NULL`.

### API
- `GET /markets?category=Coastal%20%26%20Island` returns the Coastal & Island forecast, not Accommodation's.
- `MarketDto.forecastSource == "bilstm"`.

### Frontend
- `DrawerChartPanel` renders "BiLSTM + Transformer".
- Dashed chart segment matches the 12 returned weekly values.
- Existing Vitest suites pass unchanged (proving contract stability).

### Alert
- Fixture: `JP + accommodation_staycation` high (above `rolling7d × 1.2`), `JP + coastal_island` normal → **only** the Accommodation alert exists. Reverse the values → **only** the Coastal alert exists. This is the single most important behavioural test in the plan.

### Regression — see §18.

---

## 18. Regression Checklist

Run with `FORECAST_ENGINE=stub` first (must be unchanged), then `=bilstm`.

- [ ] Dashboard loads; `ensure` fires; no error panel
- [ ] Unread alerts / Active surges / Top market tiles populate
- [ ] "Top market now" shows a market + `score/100 · category`
- [ ] Alert feed lists alerts; filters All/Unread/Surges correct
- [ ] Selecting an alert re-ranks Top Target Markets for that alert's category
- [ ] Rank cards: score, bar, flight facts, "Surge active" chip
- [ ] Drawer opens; market tabs switch
- [ ] Demand chart: 12 history + 12 forecast; 4WK/12WK toggle
- [ ] "Forecast engine:" line renders
- [ ] Purchasing Power tab: forex/GDP trends, provenance, empty states
- [ ] Seasonal Patterns tab: score, band, YoY, peak months, measured-weeks-only note
- [ ] Stale banner + cause; AI-down banner when transformer is stopped
- [ ] Refresh forecast: spinner → repopulate; **no duplicate alerts**
- [ ] Content Studio target picker still lists surge alerts by category
- [ ] Modules 1/3/4 unaffected (sbert untouched)
- [ ] `./mvnw.cmd test -Dtest="com.ceview.module2.**"` — failure count not worse than the pre-existing baseline (11 known-failing in 5 unrelated files)
- [ ] `pytest` in fastapi-transformer — green
- [ ] `npx vitest run` — green

---

## 19. Rollback Plan

**Primary (seconds, no deploy):** `FORECAST_ENGINE=stub` → restart `fastapi-transformer`. `ACTIVE_ENGINE` resolves once at startup (`forecast_engine.py`), so this is a clean switch. The flag mechanism the brief asks for **already exists** — no new flag is needed.

Rollback points, in order of increasing scope:

| Level | Action | Impact |
|---|---|---|
| 1 | `FORECAST_ENGINE=stub`, restart | Model bypassed; everything else intact |
| 2 | Revert `EnrichedSequenceBuilder` `trendHistory` line | Field stops being sent; optional on the Python side, so nothing breaks |
| 3 | Revert `BACKFILL_WEEKS` 52 → 12 | New ingests return to 12 weeks; existing 52-week rows remain valid and unused |
| 4 | Revert `bilstm_forecaster.py` + `forecast_engine.py` | Back to `BilstmUnavailableEngine` |

**Deployment ordering (important):** Python first (adds the optional `trendHistory` field), Spring second (starts sending it). Reversed, Spring sends a field `extra="forbid"` rejects → 422 across the whole batch. This is the same failure mode already hit once this session with `gdpTrendDirection`/`gdpTrendDelta`.

**Do not delete** `fastapi-sbert`'s demand-forecast endpoints until bilstm has passed a full E2E regression — they are the independent way to test the Space without the Module 2 pipeline.

---

## 20. Implementation Sequence

### Step 0 — Verify the Space is live (resolves A1/A2 before any code)
- **Goal:** prove the model answers and matches the documented contract.
- **Files:** none.
- **Change:** start `fastapi-sbert`; `GET /internal/forecasting/status`; then one `POST /internal/forecasting/forecast/series` with 52 real trend numbers.
- **Safe because:** read-only, no Module 2 code touched.
- **Test:** response contains 12 `weekly_forecasts`, both means, and `model.model_version`.
- **Expected:** 200 with a populated body.
- **Rollback:** n/a. **If this fails, stop — everything below is blocked.**

### Step 1 — Freeze current contracts
- **Goal:** a regression baseline.
- **Files:** none (record only).
- **Change:** capture `GET /markets` + `GET /api/notifications` JSON for the demo profile under `FORECAST_ENGINE=stub`; record the current Java/Python/Vitest failure baseline.
- **Test:** artifacts saved.
- **Rollback:** n/a.

### Step 2 — Deepen ingestion to 52 weeks
- **Goal:** real 52-week history.
- **Files:** `MarketDataIngestionService.java` (line 159).
- **Change:** `"weeks", 12` → `"weeks", BACKFILL_WEEKS` with `private static final int BACKFILL_WEEKS = 52;`.
- **Safe because:** `trend_service` already fetches ~52 points for `weeks<=52` (same SerpApi call, no extra quota); the ISO-week unique constraint makes the upsert idempotent.
- **Test:** refresh a profile; `SELECT count(*) … GROUP BY target_market, category` → 52 per pair; all `EXTRACT(ISODOW …) = 1`.
- **Expected:** 52 rows/pair; existing screens unchanged (`EnrichedSequenceBuilder` still slices 12).
- **Rollback:** revert the constant.

### Step 3 — Add the optional `trendHistory` field (Python side first)
- **Goal:** a channel for >12 weeks without touching the 12-row contract.
- **Files:** `backend/fastapi-transformer/app/routers/forecasting.py`.
- **Change:** optional `trend_history: list[float] = []` on `SequenceForecastRequest` + pass-through in `engine_payload()`.
- **Safe because:** defaulted, so every current caller stays valid; required because `extra="forbid"`.
- **Test:** existing `test_forecasting_contract.py` passes; a payload with and without the field both validate.
- **Expected:** no behaviour change.
- **Rollback:** remove the field.

### Step 4 — Send the real history from Spring
- **Goal:** deliver 52 real weeks.
- **Files:** `EnrichedSequenceBuilder.java`.
- **Change:** `payload.put("trendHistory", …)` from the already-loaded `chronological` list (oldest-first `trendIndex` values). `W`/`MIN_RECORDS` unchanged.
- **Safe because:** additive; ignored by stub/groq.
- **Test:** capture the `/inference-batch` body — `sequence` still 12, `trendHistory` ~52.
- **Expected:** `FORECAST_ENGINE=stub` output byte-identical to Step 1's baseline.
- **Rollback:** remove the line. **Deploy Step 3 before this.**

### Step 5 — Build the model client + adapter
- **Goal:** model output in `ForecastResponse` shape.
- **Files:** `backend/fastapi-transformer/app/services/bilstm_forecaster.py` (new), `requirements.txt`.
- **Change:** port from `demand_forecast_service.py` with **no padding** and **unconditional /100 scaling**; add the adapter and `{market}::{category}` batch keying.
- **Safe because:** not reachable until Step 6 flips the registry.
- **Test:** the full §17 unit suite.
- **Expected:** unit tests green; runtime behaviour unchanged.
- **Rollback:** delete the file.

### Step 6 — Register the engine
- **Goal:** make `FORECAST_ENGINE=bilstm` real.
- **Files:** `forecast_engine.py`.
- **Change:** `BilstmUnavailableEngine` → `BilstmForecastEngine`; real `model_health()` probe.
- **Safe because:** default stays `stub`; only an explicit env change activates it.
- **Test:** with the var unset, `/healthz/models` → `engine: "stub"`; with `=bilstm` → `engine: "bilstm"`.
- **Expected:** no change until opted in.
- **Rollback:** restore the unavailable engine.

### Step 7 — First live E2E under bilstm
- **Goal:** real end-to-end run.
- **Files:** none (config).
- **Change:** `FORECAST_ENGINE=bilstm`, restart, refresh the demo profile.
- **Test:** `tbl_forecast_result.source='bilstm'`; **two categories of the same market have different `predicted_demand`**; drawer shows "BiLSTM + Transformer".
- **Expected:** dashboard populates from the model.
- **Rollback:** `FORECAST_ENGINE=stub`, restart.

### Step 8 — Alert correctness verification
- **Goal:** prove alerts follow the true category.
- **Files:** test fixtures only.
- **Change:** run the §17 alert test both ways.
- **Test:** only the high-demand category alerts, in both directions.
- **Expected:** no cross-category leakage.
- **Rollback:** n/a.

### Step 9 — Full regression
- **Goal:** confirm nothing else moved.
- **Files:** none.
- **Change:** execute §18 under both engines.
- **Expected:** identical behaviour under `stub`; only forecast numbers/engine label differ under `bilstm`.
- **Rollback:** any level in §19.

### Step 10 — Documentation
- **Goal:** the docs match reality.
- **Files:** `TRANSFORMER_MODEL_INTEGRATION.md`, `MODULE_2_E2E_CONTRACT.md`, `RUNNING.md`.
- **Change:** record the engine-registry path, `trendHistory`, 52-week depth, and env vars.
- **Rollback:** n/a.

### Step 11 — Deprecate the duplicate path (only after Step 9 passes)
- **Goal:** remove the second forecasting surface.
- **Files:** `fastapi-sbert` demand-forecast trio.
- **Change:** mark diagnostic-only; **do not delete** until bilstm has run in production for a full refresh cycle. Decide then whether W&B telemetry should move into the transformer engine (it is currently attached only to the orphaned sbert endpoints and will **not** fire on the Module 2 path).
- **Rollback:** n/a — deletion deferred by design.

---

## Open Decisions for the Author

1. **`confidence` value for a model that emits none.** Proposed: `model.status == "provisional"` → `0.5` (below the UI's 0.7 threshold, so the "Unvalidated forecast" banner shows) and `passed = false`. Alternative: compute a real holdout MAPE in the adapter, which needs 12 extra weeks beyond the 52 and doubles the history requirement to 64.
2. **W&B telemetry.** Currently wired only to the orphaned sbert endpoints, so it will record nothing once Module 2 runs through the transformer engine. Port it, or drop it for now?
3. **Partial-category success.** Today one failure rolls back the whole run. With 3 markets × up to 7 categories = 21 model calls, a single flaky call kills the refresh. Out of scope here, but worth scheduling.
