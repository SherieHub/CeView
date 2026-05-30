# Module 4.2 — Promotional Effectiveness Score (PES) Computation

Submodule 4.2 is the **scoring engine** of Module 4. It receives the five raw KPIs computed by Submodule 4.1 and applies Min-Max normalization (calibrated to Cebu MSME hospitality bounds in Philippine Pesos), inverts cost metrics, redistributes weights when metrics are flagged, and computes a weighted-sum PES in [0.0, 1.0]. The FastAPI service also calls Groq to identify the weakest funnel stage and return three ranked recommendations. A Spring Boot rule-based fallback (`PESComputationService`) mirrors the formula exactly so the score is always available even when FastAPI is offline (FR4.26).

| Diagram | File | Scope |
|---|---|---|
| Class | [`class.puml`](class.puml) | Spring Boot PES controller + fallback service, FastAPI normalization / weight / Groq services, shared DTOs |
| Sequence | [`sequence.puml`](sequence.puml) | Full PES pipeline — base-metric computation → normalization → weight recalibration → weighted sum → Groq insights, and the FR4.26 Spring Boot fallback path |
| ERD | [`er.puml`](er.puml) | `tbl_campaign_records` PES columns (Stage 3); MetricBounds, WeightConfig, PES Breakdown, and label-tier lookup entities |

---

## Request Flows

| Flow | Trigger | Endpoint | AI Calls |
|---|---|---|---|
| **PES compute** (primary) | `POST /manual` in Submodule 4.1 | `POST /internal/pes-compute/analyze` (FastAPI, internal) | 1× Groq call via `pes_compute_insights()` for weakest stage + recommendations |
| **PES compute** (fallback) | FastAPI unavailable / timeout > 30 s | Spring Boot `PESComputationService.compute()` (in-process) | None — deterministic rule-based |
| **PES score by ID** | — | `GET /api/v1/analytics/pes/{campaignId}?weeks=4\|8` | None — Spring Boot rule-based only. Client method `analyticsPes` is **defined but not called by the UI**; the controller ignores `campaignId` and computes default metrics for the window |
| **PES trend history** | `PESComputationBoard` mount / weeks change | `GET /api/v1/analytics/history?weeks=4\|8` (owned by 4.1) | None |

---

## Spring Boot Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Controller** | `PesComputationController` | `com/ceview/module4/pes/PesComputationController.java` | Routes GET /pes/{campaignId} → `pesSvc.compute(metricsSvc.defaultMetrics(weeks).metrics())`; Spring-only path, no FastAPI call |
| **Service** | `PESComputationService` | `com/ceview/module4/pes/PESComputationService.java` | FR4.26 rule-based PES: same Min-Max bounds + weighted-sum formula as FastAPI; `compute(Metrics)` → `PesResponse`; `fromFastApiResult(Map, Metrics)` parses FastAPI response and falls back to `compute()` on parse failure |
| **Gateway** | `AIInferenceGatewayService` | `com/ceview/ai/AIInferenceGatewayService.java` | `computePesFromRaw(Map)` → POST `/internal/pes-compute/analyze`; 30 s timeout; called from `EngagementMetricsController.manualIngest()` |
| **DTO container** | `AnalyticsDtos` | `com/ceview/module4/dto/AnalyticsDtos.java` | `PesResponse` (overallScore, label, breakdown), `PesBreakdownItem` (metric, weight, contribution) |

---

## FastAPI Components (`backend/fastapi-sbert/`)

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Router** | `pes_compute` router | `app/routers/pes_compute.py` | `POST /internal/pes-compute/analyze` — receives 7 raw inputs; orchestrates base-metric → normalize → recalibrate → PES → Groq insights pipeline |
| **Service** | `pes_compute_service` | `app/services/pes_compute_service.py` | `compute_base_metrics()` — CTR/CPC/CR/ROAS/CAC with zero-denominator flagging; `normalize_and_invert()` — Min-Max with METRIC_BOUNDS, inverts CPC+CAC; `compute_pes()` — weighted sum; defines `METRIC_BOUNDS`, `BASE_WEIGHTS`, `COST_METRICS` constants |
| **Service** | `gemini_client` | `app/services/gemini_client.py` | `pes_compute_insights(base_metrics, pes_score, label, breakdown, flagged)` → Groq (`llama-3.3-70b-versatile`); returns `{weakest_funnel_stage, recommendations[3], executive_summary, source}`; returns `{}` if Groq unavailable |

**Calibrated bounds (Cebu MSME hospitality, PHP):**

| Metric | Min | Max | Inverted |
|---|---|---|---|
| CTR | 0.0 % | 10.0 % | No |
| CPC | ₱0.01 | ₱500.0 | **Yes** |
| CR | 0.0 % | 15.0 % | No |
| ROAS | 0.0 × | 8.0 × | No |
| CAC | ₱1.0 | ₱5,000.0 | **Yes** |

**PES weights:** ROAS 35% · CR 30% · CAC 15% · CTR 15% · CPC 5% (redistributed proportionally when metrics are flagged)

**Qualitative labels:** `< 0.40` Poor · `≥ 0.40` Fair · `≥ 0.60` Good · `≥ 0.80` Excellent Performance

---

## Frontend Components

| Component | File | Renders From | What It Displays |
|---|---|---|---|
| `PESComputationBoard` | `components/PESComputationBoard.tsx` | `weeks: 4\|8`, `pesData: PesResponse \| null` (fetches history itself via `api.analyticsHistory(weeks)`; local `history`/`loading`/`error`) | Left panel: `ScoreGauge` + `QualitativeLabel`; Right panel: Recharts `LineChart` PES trend with `ReferenceLine` bands (0.40/0.60/0.80); falls back to last history record when no submitted PES |
| `ScoreGauge` | `components/ScoreGauge.tsx` | `score: number` (0–1) | Circular SVG gauge; needle position maps 0–1 to 0°–180° arc |
| `QualitativeLabel` | `components/QualitativeLabel.tsx` | `label: string` | Colour-coded chip derived from the label text: red (Poor) · amber (Fair) · green (Good) · gold (Excellent) |

---

## API Response → Frontend Mapping

| Response Field | Component | Effect |
|---|---|---|
| `pes.overallScore` | `ScoreGauge` | Gauge needle position (passed as the `score` prop) |
| `pes.label` | `QualitativeLabel` | Tier chip text + colour (passed as the `label` prop) |
| `pes.breakdown[].metric` | `PESComputationBoard` | Per-metric label in breakdown list |
| `pes.breakdown[].weight` | `PESComputationBoard` | Weight % shown alongside metric |
| `pes.breakdown[].contribution` | `PESComputationBoard` | Horizontal bar fill width in breakdown |
| `snapshots[].pesScore` | `PESComputationBoard` trend chart | Y-axis data point on PES trend line |
| `snapshots[].pesLabel` | Trend chart tooltip | Colour-coded label in custom tooltip |
| `ai_report.weakest_funnel_stage` | `AIActionPlanReport` (4.3) | Primary bottleneck stage highlighted in executive summary |
| `ai_report.recommendations[]` | `AIActionPlanReport` (4.3) | Seeded as ranked diagnostics when FastAPI provides them at PES-compute time |
| `flagged_metrics[]` | `PESComputationBoard` (tooltip) | Flagged metric names shown as "excluded" in breakdown |
