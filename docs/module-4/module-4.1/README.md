# Module 4.1 — Campaign Engagement Metrics

Submodule 4.1 is the **data-entry and KPI-display** half of Module 4. It accepts the operator's seven raw campaign values through a validated form, computes the five KPI metrics and the four-stage funnel locally on Spring Boot, persists the record to `tbl_campaign_records`, and hands off to Submodule 4.2 (PES Computation) for AI enrichment — all within the single `POST /manual` round-trip. It also serves the dashboard's default demo metrics and the historical weekly snapshots used by the trend charts.

| Diagram | File | Scope |
|---|---|---|
| Class | [`class.puml`](class.puml) | React container + form components, Spring Boot controller / service / entity, shared DTOs |
| Sequence | [`sequence.puml`](sequence.puml) | End-to-end flow for form submission → KPI compute → DB persist → dashboard render + GET /history |
| ERD | [`er.puml`](er.puml) | `tbl_campaign_records` three-stage write lifecycle; KPI derivation rules; funnel stage and snapshot projections |

---

## Request Flows

| Flow | Trigger | Endpoint | AI Calls |
|---|---|---|---|
| **Load demo metrics** | Dashboard mount / 4W-8W toggle | `GET /api/v1/analytics/metrics?weeks=4\|8` | None — deterministic scaled defaults |
| **Manual data ingestion** | "Generate Campaign Analytics" button | `POST /api/v1/analytics/manual` | Delegates PES compute to Submodule 4.2 (FastAPI) after local KPI computation |
| **Load history** | `CustomerJourneyFunnel` mount / weeks change | `GET /api/v1/analytics/history?weeks=4\|8` | None — DB read only |

---

## Spring Boot Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Controller** | `EngagementMetricsController` | `com/ceview/module4/engagement/EngagementMetricsController.java` | Routes GET /metrics → `defaultMetrics(weeks)`; POST /manual → full KPI + PES pipeline; GET /history → chronological snapshots; injects `PESComputationService` for FR4.26 fallback on `/manual` |
| **Service** | `MetricsCalculationService` | `com/ceview/module4/engagement/MetricsCalculationService.java` | `compute()` derives CTR, CPC, CR, ROAS, CAC + four-stage funnel from raw inputs; `defaultMetrics(int weeks)` builds scaled demo defaults; `computeFunnelTransitions()` ranks three transitions by business impact; `buildTimeSeries()` generates synthetic reverse-chronological weekly series for 4.3 |
| **Entity** | `CampaignRecord` | `com/ceview/module4/engagement/CampaignRecord.java` | `tbl_campaign_records` — three-stage lifecycle: (1) raw inputs on insert, (2) `enrichWithKpis()` after `MetricsCalculationService`, (3) `enrichWithPes()` after FastAPI or FR4.26 fallback |
| **Repository** | `CampaignRecordRepository` | `com/ceview/module4/engagement/CampaignRecordRepository.java` | `findAllByOrderByCreatedAtDesc(Pageable)` — newest-first paged query used by GET /history; `findTop10ByOrderByCreatedAtDesc()` and `findByCreatedAtAfterOrderByCreatedAtDesc(Instant)` for dashboard / recent reads |
| **DTO container** | `AnalyticsDtos` | `com/ceview/module4/dto/AnalyticsDtos.java` | Shared record classes: `ManualIngestRequest` (`Integer` impressions/clicks/conversions/bookings/newCustomers, `Double` adSpend/revenue, `String` periodStart/periodEnd), `ManualIngestResponse`, `Metrics`, `MetricCard`, `MetricsResponse`, `FunnelStage`, `CampaignSnapshot`, `CampaignHistoryResponse` |

---

## FastAPI Components

Submodule 4.1 does not own any FastAPI endpoints. The PES enrichment call (`POST /internal/pes-compute/analyze`) that runs inside `POST /manual` belongs to **Submodule 4.2** — see [`../module-4.2/README.md`](../module-4.2/README.md). If FastAPI is unreachable, Spring Boot falls back to `PESComputationService.compute()` (FR4.26) and the response remains fully populated.

---

## Frontend Components

All HTTP calls go through `ceview/services/apiClient.ts` (`analyticsManual`, `analyticsHistory`, and `analyticsMetrics` — the latter is defined but not currently called by the UI). Shared DTO types live in `ceview/types.ts`.

| Component | File | Renders From | What It Displays |
|---|---|---|---|
| `CampaignAnalyticsView` | `4.1-campaign-analytics/CampaignAnalyticsView.tsx` | `dashboardActive: boolean`, `weeks: 4\|8`, `metricsData: ManualIngestResponse \| null` | Top-level container; shows `DataIngestionForm` when no data; switches to full dashboard on success |
| `DataIngestionForm` | `components/DataIngestionForm.tsx` | `onDataReady(data)` callback; local `formData`, `submitting`, `formError` | Seven numeric fields; validates non-negative; calls `api.analyticsManual`; spinner + "Computing Analytics…" on submit; red error banner on failure |
| `DataInputField` | `components/DataInputField.tsx` | `label`, `name`, `type`, `placeholder`, `onChange` | Single controlled numeric input with label — reused for all 7 raw input fields |
| `EngagementMetricsBoard` | `components/EngagementMetricsBoard.tsx` | `metrics: Metrics`, `weeks`, `onWeeksChange(w)`, `isRefreshing` | Five `KpiMetricCard` instances in a row; 4W/8W toggle calls `onWeeksChange` to update `weeks` in parent |
| `KpiMetricCard` | `components/KpiMetricCard.tsx` | `title`, `data: MetricCard`, `icon`, `tooltip`, `inverseLogic?` (`MetricCard` = value/unit/trend/isPositive) | KPI value + unit chip + `TrendIndicator`; green up-arrow for CPC/CAC when value decreases (inverseLogic) |
| `TrendIndicator` | `components/TrendIndicator.tsx` | `trend: number`, `unit: string`, `isPositive: boolean` | Directional arrow with colour driven by `isPositive` (the parent `KpiMetricCard` applies the cost-metric inversion) |
| `DropOffBadge` | `components/DropOffBadge.tsx` | `dropoff: string` | Signed percentage pill (e.g. "-95.2%"). **Defined, currently unused** — not imported by any Module 4 view today |
| `CustomerJourneyFunnel` | `components/CustomerJourneyFunnel.tsx` | `weeks: 4\|8` (fetches history itself via `api.analyticsHistory(weeks)`; local `data`/`loading`/`error`) | Two side-by-side Recharts `LineChart` panels — Efficiency (ROAS navy, CTR gold, CR emerald) and Cost (CPC amber, CAC red-orange) |

---

## API Response → Frontend Mapping

| Response Field | Component | Effect |
|---|---|---|
| `metrics.ctr` | `KpiMetricCard` | Value: "X.X%" — ad creative relevance |
| `metrics.cpc` | `KpiMetricCard` | Value: "₱X.XX" — inverseLogic; green when CPC drops |
| `metrics.roas` | `KpiMetricCard` | Value: "X.Xx" — campaign profitability multiple |
| `metrics.convRate` | `KpiMetricCard` | Value: "X.X%" — booking conversion rate |
| `metrics.cac` | `KpiMetricCard` | Value: "₱X.XX" — inverseLogic; green when CAC drops |
| `metrics.*.trend` | `TrendIndicator` | Arrow direction + colour (respects inverseLogic) |
| `funnel[].stage` / `funnel[].dropoff` | — | Present in the `/manual` response but **not currently rendered** (`DropOffBadge` is defined but unused; the trend charts read `/history` snapshots instead) |
| `pes` (full block) | `PESComputationBoard` (4.2) | Gauge score + breakdown — passed to Submodule 4.2 components |
| `snapshots[].ctr/roas/convRate` | `CustomerJourneyFunnel` | Efficiency chart series data (GET /history) |
| `snapshots[].cpc/cac` | `CustomerJourneyFunnel` | Cost chart series data (GET /history) |
| `snapshots[].pesScore` | `PESComputationBoard` (4.2) | PES trend line data point |
| `snapshots[].pesLabel` | `QualitativeLabel` (4.2) | Tier label on trend chart tooltip |
