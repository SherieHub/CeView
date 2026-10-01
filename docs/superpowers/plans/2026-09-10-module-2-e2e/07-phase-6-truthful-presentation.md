# Phase 6 — Truthful presentation

Implements plan decisions **P-4** (narrative stays template-based but truthful) and
**P-5** (flight / price / peak-month data is reference *data*, not code) — audit
items **C-15, C-16** plus the presentation hardcodes **H-14, H-16, H-19, H-20/T-06,
H-21 / M2-UI-088**.

> Precedence unchanged: `MODULE_2_E2E_CONTRACT.md` wins over this file. The contract
> does not constrain route/fare/peak presentation, so P-5 governs here.

---

## Step 15 of 20 — Replace the remaining backend constants ✅

Delivered as four checkpoints on `feat/module-2-e2e`.

### 15a — one market-id configuration source (C-16)

New `com.ceview.module2.MarketCatalog`: `IDS` (the `korea/japan/usa` list),
`displayName()`, `city()`, `currencyCode()`. Removed the independent copies from
`ForecastingService` (`MARKETS`), `MarketDataIngestionService` (`MARKETS`),
`TrendFetchSchedulerService` (`MARKETS`), `NotificationService` (`MARKET_NAMES`)
and `ExternalMarketDataClient` (`CURRENCY_CODE`). `MarketFlags` (ISO-3166 codes,
still used by the World Bank lookup) delegates its doc pointer here. Pure
value-preserving refactor.

### 15b — route reference as data, with provenance (H-14, H-16)

`ExternalMarketDataClient.getFlightReference()` now reads
`tbl_market_route_reference` (repo wired in) and falls back to the canonical
`MarketRouteReferenceData` when the row is absent (H2 tests — Flyway is disabled
there, so the V31 seed never runs). The static `FLIGHT_REFS` map and
`ForecastingService.MARKET_META` are deleted.

- **H-14** — `accessibilityScore` is computed by
  `ForecastingService.computeAccessibility()`:
  `round(clamp(1..10, base + 2·freqNorm + 2·hoursNorm))`, `base` 6.0 direct /
  3.0 stopover, `freqNorm = min(1, weeklyFrequency/14)`,
  `hoursNorm = 1 − min(1, blockHours/18)` (`blockHours` parsed from the
  `flightHours` label). Today's reference data → Korea 10, Japan 9, USA 4.
- **H-16** — `MarketDto.avgFlightPrice` (a hardcoded string) is replaced by
  `fareMinPhp` / `fareMaxPhp` (ints, from `avg_fare_min_php` / `avg_fare_max_php`)
  plus `fareSource` (`source`) and `fareAsOf` (`valid_from`). The drawer's Route &
  Carriers panel shows the source + valid-from line; the Purchasing Power tile
  formats the range and shows the reference date.

### 15c — peak months from history, with a source tag (H-19)

- **V37** adds `tbl_market_route_reference.peak_months_json`, seeded from the old
  `ForecastingService.PEAK_MONTHS` constant (which is deleted). No H2 mirror —
  `db/h2/` has no `tbl_market_route_reference` at all (V31 was never mirrored);
  see "Known gaps".
- `ForecastingService.derivePeakMonths(history)` groups the market's weekly
  `MarketSignalRecord`s by calendar month, ranks by mean `seasonalityScore`, and
  returns the top 4 (calendar order) **only** when there are ≥52 weekly rows AND
  data in ≥8 distinct months; otherwise it returns empty and the caller uses the
  route table's reference list.
- `MarketDto.peakMonthsSource` (`"seasonal_history"` | `"reference"`) is rendered
  as a caption under the drawer's Peak Months grid.

> With the signal series still mixed daily/weekly cadence (Phase 1, audit §1.7),
> the ≥52-week gate will not pass in practice yet, so every market currently
> reports `"reference"`. The derivation path is exercised by unit tests and will
> activate once Phase 1's one-row-per-ISO-week work lands.

### 15d — delete dead presentation fields (T-06) + per-carrier direct (H-21)

- **T-06** — removed `AirlineDto.tier` (a `matchScore >= 85` restatement never
  rendered) and its computation; removed `AirlineDto.duration`, `MarketDto.flag`
  (`MarketFlags` stays — still used for the World Bank ISO lookup), and
  `ChartDataPointDto.forex` / `.gdp`. Confirmed zero render references first
  (frontend components, `frontend/tests/`, `e2e/`): the drawer reads
  `MarketDto.gdpValue` / `forexValue` / `gdpTrend` / `forexTrend`, never per-chart-point
  forex/gdp. `MarketDto.flag` had no consumer at all.
- **H-21 / M2-UI-088** — `direct` is now per carrier: parsed from each
  `airlines_json` entry's `direct` field (falling back to the route-level flag
  when a carrier row omits it), instead of stamping every carrier with the
  route-level value. The frontend `Airline.direct` field and the Route & Carriers
  per-row Direct / Via-Manila chip already existed and now reflect real per-carrier
  data.

---

## Surviving constants after Step 15

`ForecastingService`:

| Constant | Why it is legitimately static |
|---|---|
| `MAPE_THRESHOLD = 15.0` | FR2.12 acceptance threshold — a fixed product rule, not data. |
| `DEMAND_WINDOW_MULTIPLIER = 1.2` | The frozen demand-window rule (contract §6): "20% above the rolling baseline". A rule constant. |
| `MONTH_ABBR[]` | The Gregorian calendar. |
| `PEAK_MONTHS_MIN_WEEKS = 52` / `PEAK_MONTHS_MIN_COVERAGE = 8` | H-19 confidence gate thresholds — tuning knobs for a rule, deliberately not per-market. |
| `FOREX_LABEL_FORMAT = "PHP per 1 %s"` | Contract §1.3 — the single canonical axis-label template. |
| `MARKET_META` / `PEAK_MONTHS` | **deleted** this step. |

`ExternalMarketDataClient`:

| Constant | Why it is legitimately static |
|---|---|
| `TIMEOUT` / `TREND_TIMEOUT` (10s / 30s) | HTTP client timeouts — infra config. |
| `CURRENCY_CDN_BASE` / `CURRENCY_CDN_SUFFIX` | The fawazahmed0 currency-API URL shape — a third-party API contract. |
| `LIST_TYPE` / `MAP_TYPE` | Jackson `ParameterizedTypeReference` singletons — deserialisation plumbing. |
| `FLIGHT_REFS` / `CURRENCY_CODE` | **deleted** this step (moved to `tbl_market_route_reference` / `MarketCatalog`). |

`MarketRouteReferenceData.SOURCE` / `VALID_FROM` are the test-fallback mirror of the
V31/V37 seed, not a runtime default — production always reads the DB row.

---

## Known gaps (carried forward)

- **`db/h2/` mirror** is ~15 migrations behind and has no
  `tbl_market_route_reference` (V31 unmirrored); V37 is likewise unmirrored. The
  native-H2 dev path would need V31–V37 backfilled as a separate cleanup. Spring
  tests are unaffected (they build the schema from JPA entities).
- **C-15 / P-4** (truthful template narrative: directive, economy insight,
  seasonality insight) is **not** part of Step 15 and remains open in this phase.
- The 8 pre-existing `feat/module-2-e2e` test failures (`MacroInputProvenanceTest`
  ×3 network-dependent, `DemandAlertRulesTest` float precision,
  `EconomyInsightForexTest` ×3, `ChartDataVisualTest` AI-scorer mock) are
  unchanged by Step 15 and tracked elsewhere.
