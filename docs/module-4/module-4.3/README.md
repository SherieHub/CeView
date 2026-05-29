# Module 4.3 — AI-Generated Prescriptive Performance Report

Submodule 4.3 is the **AI diagnostics layer** of Module 4. It runs two distinct AI pipelines: a Groq prescriptive report that diagnoses all three funnel transitions with urgency-ranked 1-to-1 recommendations (`POST /report`), and a LangGraph quality-gated deep-analysis agent that analyses a synthetic multi-week KPI time-series (`POST /pes-analysis`). Both auto-fire on component mount. Spring Boot falls back to deterministic rule-based responses for every AI call (FR4.26), so the UI never crashes regardless of FastAPI availability.

| Diagram | File | Scope |
|---|---|---|
| Class | [`class.puml`](class.puml) | React report components, Spring Boot controller + fallback service, FastAPI report router + LangGraph agent (3 nodes), Pydantic output schemas |
| Sequence | [`sequence.puml`](sequence.puml) | Prescriptive report flow (funnel transition ranking → Groq → FR4.26 fallback) and LangGraph quality-gated retry loop summary |
| ERD | [`er.puml`](er.puml) | Transient report structures (FunnelTransition, PrescriptiveReport, FunnelDiagnostic, Recommendation) and LangGraph AgentState + Pydantic output entities |

---

## Request Flows

| Flow | Trigger | Endpoint | AI Calls |
|---|---|---|---|
| **Prescriptive report** | `AIActionPlanReport` mount + weeks toggle | `POST /api/v1/analytics/report` | 1× Groq call via `performance_report()` with pre-ranked funnel transitions |
| **Prescriptive report** (fallback) | FastAPI unavailable | `PrescriptiveReportService.buildRuleBasedReport()` (in-process) | None — lowest-PES-contribution metric identified deterministically |
| **PES deep analysis** | `AIActionPlanReport` mount + weeks toggle | `POST /api/v1/analytics/pes-analysis` | LangGraph agent: 1–3× Groq structured-output calls (generate + evaluate, up to MAX_RETRIES = 3) |
| **PES deep analysis** (fallback) | FastAPI unavailable | `PrescriptiveReportService.buildOfflinePesAnalysisFallback()` (in-process) | None — returns `needs_human_review: true` with empty metric conditions |
| **PDF download** | Future / on-demand | `GET /api/v1/analytics/report/{id}/pdf` | FastAPI `POST /internal/report/pdf` |

---

## Spring Boot Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Controller** | `PrescriptiveReportController` | `com/ceview/module4/report/PrescriptiveReportController.java` | Routes POST /report → enriches payload with `defaultMetrics()` + `computeFunnelTransitions()` then delegates to FastAPI; POST /pes-analysis → builds synthetic time-series then delegates; GET /report/{id}/pdf → binary PDF proxy; FR4.26 try-catch on all three |
| **Service** | `PrescriptiveReportService` | `com/ceview/module4/report/PrescriptiveReportService.java` | `buildRuleBasedReport(MetricsResponse, transitions)` — finds lowest-PES-contribution metric as primary bottleneck; returns three hardcoded-but-contextual diagnostics + recommendations + `"Naver Blog"` platform; `buildOfflinePesAnalysisFallback()` — returns empty metric conditions with `needs_human_review: true` |
| **Service** | `MetricsCalculationService` *(shared from 4.1)* | `com/ceview/module4/engagement/MetricsCalculationService.java` | `computeFunnelTransitions(funnel)` — business-impact ranking: Clicks→Conversions (1) · Conversions→Bookings (2) · Impressions→Clicks (3); `buildTimeSeries(MetricsResponse, weeks)` — linear interpolation; positive metrics baseline at 75%, cost metrics at 130% of current |
| **Gateway** | `AIInferenceGatewayService` | `com/ceview/ai/AIInferenceGatewayService.java` | `generateReport(Map)` → POST `/internal/report/generate`; `generatePesAnalysis(Map)` → POST `/internal/pes-analysis/generate`; `generateReportPdf(Map)` → POST `/internal/report/pdf` |
| **DTO container** | `AnalyticsDtos` | `com/ceview/module4/dto/AnalyticsDtos.java` | `PrescriptiveReport` (executiveSummary, funnelDiagnostics, recommendations, recommendedPlatform), `FunnelDiagnostic` (stage, rank, dropRate, insight, urgency), `RankedRecommendation` (stage, urgency, title, action) |

---

## FastAPI Components (`backend/fastapi-sbert/`)

### Report Generation

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Router** | `report` router | `app/routers/report.py` | `POST /internal/report/generate` — receives metrics + pre-ranked `funnelTransitions` + weeks + market; resolves `recommendedPlatform` before LLM call; instructs Groq to not re-order the ranked transitions |
| **Service** | `gemini_client` | `app/services/gemini_client.py` | `performance_report(metrics, transitions, weeks, market)` → Groq (`llama-3.3-70b-versatile`); returns `{executiveSummary, funnelDiagnostics[3], recommendations[3], recommendedPlatform}`; `_fallback_report()` if Groq offline |

### PES Deep-Analysis Agent (LangGraph)

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Router** | `pes_analysis` router | `app/routers/pes_analysis.py` | `POST /internal/pes-analysis/generate` — receives `metrics_data` (reverse-chron time-series dict) + `weeks`; invokes `PesReportAgent`; returns `final_ui_payload` |
| **Agent graph** | `PesReportAgent` | `app/agents/pes_report_agent/graph.py` | LangGraph `StateGraph`; nodes: `generate_report → evaluate_report → [route_action] → finalize_response`; retries up to `MAX_RETRIES = 3` when evaluator score < 85 |
| **Nodes** | `generate_report`, `evaluate_report`, `finalize_response` | `app/agents/pes_report_agent/nodes.py` | **generate**: `AgentLLMModel().get_model().with_structured_output(ReportOutput)` — injects evaluator feedback on retry; **evaluate**: `with_structured_output(EvaluationResult)` — scores 0–100 against 5 criteria; **finalize**: packages `final_ui_payload`; sets `needs_human_review = true` if iterations ≥ 3 and score < 85 |
| **State** | `AgentState` | `app/agents/pes_report_agent/state.py` | TypedDict shared across all nodes: `metrics_data`, `report`, `evaluation`, `iterations`, `final_ui_payload`; Pydantic schemas: `ReportOutput`, `MetricCondition`, `RankedWeakness`, `CrossMetricLogic`, `EvaluationResult` |
| **Prompts** | `generation_prompt`, `evaluation_prompt` | `app/agents/pes_report_agent/prompt.py` | `generation_prompt` — Cebu MSME Senior Analyst role; instructs concrete number references + platform-specific recommendations; `evaluation_prompt` — 5 quality criteria: data coverage, trend accuracy, Cebu tourism specificity, cross-metric logic, ranking & actionability |
| **LLM singleton** | `AgentLLMModel` | `app/core/AgentLLMModel.py` | Thread-safe `ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7)`; shared with Module 3 caption agent; returns `None` on init failure so nodes degrade gracefully |

---

## Frontend Components

| Component | File | Renders From | What It Displays |
|---|---|---|---|
| `AIActionPlanReport` | `components/AIActionPlanReport.tsx` | `weeks`, `reportData: PrescriptiveReport`, `loading` | Auto-fires POST /report on mount and on weeks change; full-panel spinner "Analyzing your campaign funnel…"; executive summary + recommended platform chip + stage analysis panel + three `PriorityFixCard` instances |
| `PriorityFixCard` | `components/PriorityFixCard.tsx` | `FunnelDiagnostic` + matching `Recommendation` | Rank badge (Weakest red / Moderate amber / Alright green) + drop-rate pill + AI insight sentence + urgency-tagged title + action step |
| `RecommendationItem` | `components/RecommendationItem.tsx` | `RankedRecommendation` (urgency, title, action) | Urgency row in the left-column stage-analysis panel: Most Urgent (red) · Urgent (amber) · Not Very Urgent (green) |
| `ReportActionBtn` | `components/ReportActionBtn.tsx` | `onClick`, `label` | CTA button rendered inside the report panel |

---

## API Response → Frontend Mapping

| Response Field | Component | Effect |
|---|---|---|
| `executiveSummary` | `AIActionPlanReport` | 2–3 sentence overall assessment at top of report |
| `recommendedPlatform` | `AIActionPlanReport` | Teal chip badge (e.g. "Naver Blog") |
| `funnelDiagnostics[0].rank = "Weakest"` | `PriorityFixCard` | Red `AlertTriangle` badge; rendered first |
| `funnelDiagnostics[1].rank = "Moderate"` | `PriorityFixCard` | Amber `TrendingDown` badge; rendered second |
| `funnelDiagnostics[2].rank = "Alright"` | `PriorityFixCard` | Green `CheckCircle2` badge; rendered third |
| `funnelDiagnostics[i].dropRate` | `PriorityFixCard` | Absolute % pill (e.g. "88.1%") |
| `funnelDiagnostics[i].insight` | `PriorityFixCard` | One-sentence root-cause diagnosis |
| `recommendations[i].urgency` | `RecommendationItem` | Row colour + label in stage-analysis panel |
| `recommendations[i].title` | `RecommendationItem` | Bold action title (≤ 8 words) |
| `recommendations[i].action` | `PriorityFixCard` | Concrete implementation step beneath insight |
| `report_data.metric_conditions[]` | `AIActionPlanReport` (PES analysis tab) | Per-metric trend + current status descriptions |
| `report_data.ranked_weaknesses[0]` | `AIActionPlanReport` | Rank-1 weakness with recommendation highlighted |
| `metadata.needs_human_review` | `AIActionPlanReport` | Warning banner when `true` (agent quality threshold not met) |
| `metadata.final_score` | `AIActionPlanReport` (debug / tooltip) | Evaluator quality score (0–100) |

---

## FR4.26 Fallback Behaviour

| Endpoint | FastAPI call | Spring Boot fallback | Frontend impact |
|---|---|---|---|
| `POST /report` | `generateReport()` | `buildRuleBasedReport()` — three hardcoded contextual diagnostics; lowest-PES metric as bottleneck | Report renders normally; copy is deterministic not AI-generated |
| `POST /pes-analysis` | `generatePesAnalysis()` | `buildOfflinePesAnalysisFallback()` — empty `metric_conditions`, `needs_human_review: true` | Warning banner displayed; rest of dashboard unaffected |
