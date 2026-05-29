# Module 4 — Component Tables

---

## 4.1 Campaign Data Ingestion & KPI Computation

### Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| CampaignAnalyticsView | Root container for all of Module 4. Manages the toggle between the DataIngestionForm and the analytics dashboard. On successful form submission receives ManualIngestResponse and activates the dashboard with metrics, funnel, and PES data. Owns the 4W/8W weeks state passed to all child panels. | React view component |
| DataIngestionForm | Campaign data entry form collecting 7 raw inputs (impressions, clicks, adSpend, revenue, conversions, bookings, newCustomers). On submit calls `api.analyticsManual()` and returns the ManualIngestResponse upward via `onDataReady`. Validates all fields as required non-negative numbers. | React module component |
| DataInputField | Reusable labelled input wrapper with consistent styling. Used inside DataIngestionForm for each of the 7 raw campaign metric fields. | React base component |
| EngagementMetricsBoard | Displays the 5 computed KPI cards (CTR, CPC, ROAS, Conversion Rate, CAC). Includes a 4W/8W binary toggle that fires `onWeeksChange` upward. Receives a stateless Metrics object; delegates rendering to KpiMetricCard for each metric. | React module component |
| KpiMetricCard | Individual KPI card showing metric title, icon, value + unit, trend indicator arrow, and a hoverable tooltip with an explanation. Accepts an `inverseLogic` flag to flip the positive/negative direction for cost metrics (CPC, CAC) where lower is better. | React composite |
| TrendIndicator | Stateless sub-component of KpiMetricCard. Renders an up/down chevron icon alongside the trend value, coloured green for positive and red for negative. | React base component |
| CustomerJourneyFunnel | Dual Recharts LineChart panel showing historical campaign performance over the selected weeks window. Left chart plots efficiency metrics (ROAS, CTR, CR); right chart plots cost metrics (CPC, CAC in ₱). On mount and on weeks change calls `api.analyticsHistory(weeks)` to fetch CampaignSnapshot history. | React module component |
| PESComputationBoard | Performance Efficiency Score panel. Left side: ScoreGauge (circular SVG gauge) and QualitativeLabel for the current submission's PES. Right side: Recharts LineChart showing PES trend over history with Excellent/Good/Fair reference bands at 0.80/0.60/0.40. Calls `api.analyticsHistory(weeks)` for the PES trend series. Displays the hardcoded PES formula: `ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05`. | React module component |
| ScoreGauge | SVG circular progress gauge with animated gradient fill. Renders the PES score (0–1) as a coloured arc with the numeric value centred inside. | React composite |
| QualitativeLabel | Pill badge displaying the PES qualitative label (Excellent / Good / Fair / Poor Performance) with colour-coded background matching the score tier. | React base component |

### Back-End Components — Spring Boot

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| AnalyticsController | Exposes `POST /api/v1/analytics/manual` — ingests raw campaign inputs, computes KPIs via MetricsCalculationService, persists CampaignRecord, calls FastAPI for PES enrichment (falls back to PESComputationService on failure), returns ManualIngestResponse. Also exposes `GET /api/v1/analytics/metrics?weeks=` (demo defaults) and `GET /api/v1/analytics/history?weeks=` (N most recent snapshots). `GET /api/v1/analytics/pes/{campaignId}?weeks=` computes PES for a specific campaign. | Spring @RestController |
| MetricsCalculationService | Computes five KPIs from raw inputs: CTR = clicks/impressions × 100, CPC = adSpend/clicks, ROAS = revenue/adSpend, ConvRate = conversions/clicks × 100, CAC = adSpend/newCustomers. Builds a 4-stage FunnelStage list (Impressions → Clicks → Conversions → Bookings) with drop-off percentages. | Spring @Service |
| PESComputationService | FR4.26 rule-based fallback PES calculator. Applies Min-Max normalisation per metric using Cebu MSME hospitality calibration bounds (e.g., CTR: 0–10%, ROAS: 0×–8×, CAC: ₱1–₱5,000), inverts cost metrics (CPC, CAC), recalibrates weights when metrics are flagged as zero, and computes weighted PES score in [0, 1] with qualitative label. | Spring @Service |
| CampaignRecord | JPA entity for `tbl_campaign_records`. Stores all 7 raw inputs (impressions, clicks, adSpend, revenue, conversions, bookings, newCustomers), 5 derived KPIs (ctr, cpc, convRate, roas, cac), pesScore, pesLabel, analysisWeeks, periodStart, periodEnd, createdAt, updatedAt. Factory method `from(ManualIngestRequest)` and enrichment methods `enrichWithKpis()` and `enrichWithPes()`. | JPA entity |
| CampaignRecordRepository | `JpaRepository<CampaignRecord, UUID>` — provides `findByCreatedAtAfterOrderByCreatedAtDesc(Instant after)`, `findTop10ByOrderByCreatedAtDesc()`, and `findAllByOrderByCreatedAtDesc(Pageable)` for history queries. | Spring Data repository |
| AIInferenceGatewayService | Reactive WebClient bridge to fastapi-sbert (port 8000). Module 4.1 method: `computePesFromRaw(Map payload)` — POST to `/internal/pes-compute/analyze`. Returns full PES result map including score, label, breakdown, and ai_report. | Spring @Service |
| AnalyticsDtos | Container for all Module 4.1 Java records: ManualIngestRequest (7 raw fields), ManualIngestResponse (metrics + funnel + pes), MetricCard (value, unit, trend, isPositive), Metrics (5 MetricCard fields), FunnelStage (stage, value, dropoff), MetricsResponse (metrics + funnel), PesBreakdownItem (metric, weight%, contribution), PesResponse (overallScore, label, breakdown), CampaignSnapshot (periodStart/End, pesScore, pesLabel, 5 KPI nullables), CampaignHistoryResponse (snapshots list). | Java records |

### Back-End Components — FastAPI (fastapi-sbert)

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| pes_compute.py | FastAPI router at `/internal/pes-compute`. Exposes `POST /analyze` — accepts 7 raw campaign inputs, delegates to pes_compute_service to compute base metrics, Min-Max normalisation, and PES formula, then returns full response with base_metrics, normalized_metrics, pes_score (0–1), pes_label, breakdown per metric, flagged_metrics (zero denominators), and effective_weights (recalibrated). Calls Gemini for ai_report or returns rule-based fallback. | FastAPI router |
| pes_compute_service.py | Core PES computation engine. Defines METRIC_BOUNDS (calibrated per Cebu MSME hospitality), BASE_WEIGHTS (ROAS: 0.35, CR: 0.30, CAC: 0.15, CTR: 0.15, CPC: 0.05), and COST_METRICS (CPC, CAC — inverted). Functions: `compute_base_metrics()` — derives CTR/CPC/CR/ROAS/CAC with zero-denominator flagging; `normalize_and_invert()` — Min-Max + inversion + weight recalibration; `compute_pes()` — weighted sum → PesResult (score, label, breakdown). | Python service |

---

## 4.2 AI Prescriptive Report Generation

### Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| AIActionPlanReport | Main report panel. On mount and on weeks change calls `api.prescriptiveReport(weeks)` to fetch the AI-generated PrescriptiveReport. Displays executive summary text block, recommended platform badge, an urgency summary list, and a PriorityFixCard with all 3 funnel stage diagnostics and paired recommendations. Shows skeleton/loading state while generating. | React module component |
| PriorityFixCard | Paired funnel diagnostics and recommendations display. Builds a `stage → recommendation` lookup map and renders each FunnelDiagnostic alongside its matched RankedRecommendation. Urgency is colour-coded: Most Urgent = red, Urgent = orange, Not Very Urgent = green. | React composite |
| DropOffBadge | Visual indicator for funnel stage drop-off percentage. Renders a vertical connecting line with a coloured percentage pill, used in the funnel stage transitions within PriorityFixCard. | React base component |
| RecommendationItem | Single numbered recommendation row inside the urgency summary list. Renders the recommendation index, title in bold, and the concrete action description. | React base component |
| ReportActionBtn | Styled button with optional icon. Used for report download (PDF) and any future report actions. Supports `primary` and `danger` variants. | React base component |

### Back-End Components — Spring Boot

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| AnalyticsController | Exposes `POST /api/v1/analytics/report` — enriches payload with current metrics + business-impact-ranked funnel transitions, calls AIInferenceGatewayService.generateReport() (FastAPI `/internal/report/generate`), falls back to rule-based PrescriptiveReport if FastAPI unavailable. Also exposes `POST /api/v1/analytics/pes-analysis` — builds a synthetic weekly time-series via MetricsCalculationService.buildTimeSeries() and calls AIInferenceGatewayService.generatePesAnalysis() (FastAPI LangGraph agent). | Spring @RestController |
| MetricsCalculationService | Module 4.2 methods: `computeFunnelTransitions(List~FunnelStage~)` — ranks 3 transitions by business impact: Clicks→Conversions (Weakest), Conversions→Bookings (Moderate), Impressions→Clicks (Alright); returns map list with stage and dropRate. `buildTimeSeries(MetricsResponse, int weeks)` — generates synthetic linear-interpolated weekly time-series (index [0] = current week) for the LangGraph PES agent prompt. | Spring @Service |
| AIInferenceGatewayService | Reactive WebClient bridge. Module 4.2 methods: `generateReport(Map payload)` — POST to `/internal/report/generate`; `generatePesAnalysis(Map payload)` — POST to `/internal/pes-analysis/generate`. Applies extended timeout for LangGraph agent calls. | Spring @Service |
| AnalyticsDtos | Container for Module 4.2 Java records: FunnelDiagnostic (stage, rank, dropRate, insight), RankedRecommendation (stage, urgency, title, action), PrescriptiveReport (executiveSummary, funnelDiagnostics, recommendations, recommendedPlatform). | Java records |

### Back-End Components — FastAPI (fastapi-sbert)

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| report.py | FastAPI router at `/internal/report`. Exposes `POST /generate` — accepts metrics payload, pre-ranked funnel transitions, weeks, and market; calls Gemini to generate a PrescriptiveReport (executive summary, 3 FunnelDiagnostics, 3 RankedRecommendations, recommendedPlatform). Rule-based fallback maps rank indices to urgency labels and selects platform via `_PLATFORM_MAP[market]` (e.g., "korea" → "Naver Blog"). Also exposes `POST /pdf` — returns a placeholder 1-page PDF. | FastAPI router |
| pes_analysis.py | FastAPI router at `/internal/pes-analysis`. Exposes `POST /generate` — accepts a metrics_data time-series dict (5 metrics × N weeks, index 0 = current) and weeks hint; invokes `pes_report_agent.app.ainvoke()` (LangGraph workflow); returns report_data (metric conditions, cross-metric logic, ranked weaknesses) and metadata (final_score, total_iterations, needs_human_review). Rule-based fallback returns deterministic payload when LLM is offline or metrics are empty. | FastAPI router |
| pes_scoring_report.py | Service supporting the report and PES analysis pipelines. Provides scoring and ranking utilities for the prescriptive report text generation and the LangGraph evaluation node. | Python service |
| graph.py | LangGraph workflow (`pes_report_agent.app`). Four-node graph: `generate_report` → `evaluate_report` → conditional route (score ≥ 85 or iterations ≥ 3 → `finalize_response`; else retry `generate_report`) → `finalize_response` → END. Targets ≥ 85 evaluation quality score before finalising. | LangGraph workflow |
| nodes.py | LangGraph node implementations. `generate_report(state)` — calls Gemini with generation_prompt, producing ReportOutput (metric_conditions, cross_metric_logic, ranked_weaknesses); injects evaluator feedback on retries. `evaluate_report(state)` — calls Gemini with evaluation_prompt scoring 0–100 and returning EvaluationResult. `finalize_response(state)` — packages final_ui_payload and sets needs_human_review flag if maximum retries reached. `route_action(state)` — conditional edge function. | LangGraph nodes |
| state.py | LangGraph AgentState TypedDict (metrics_data, report, evaluation, iterations, final_metadata, final_ui_payload). Pydantic schemas: MetricCondition (metric_name, current_status, trend, peak_value, low_value), RankedWeakness (metric_name, rank, weakness_meaning, recommendation), CrossMetricLogic (relationships, insights), ReportOutput, EvaluationResult (score, pass_status, issues, missing_elements, accuracy_check, recommendation). | LangGraph state |
| prompt.py | Two ChatPromptTemplate definitions. `generation_prompt`: instructs the LLM to act as CeView Senior Campaign Analyst for Cebu tourism MSME, analyse reverse-chronological weekly metrics, and produce structured metric_conditions + cross_metric_logic + ranked_weaknesses. `evaluation_prompt`: strict quality evaluator scoring data coverage, trend accuracy, Cebu tourism specificity, cross-metric logic, and ranking actionability on a 0–100 scale. | Prompt templates |
