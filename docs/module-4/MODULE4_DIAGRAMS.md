# Module 4 — Architecture Diagrams

> Scope: Backend only (Spring Boot + FastAPI-SBERT).
> Designed for OOP — covers database schema, business logic, and AI data models.

---

## 4.1 Campaign Data Ingestion & KPI Computation

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class ManualIngestRequest {
        <<Record>>
        +Integer impressions
        +Integer clicks
        +Double adSpend
        +Double revenue
        +Integer conversions
        +Integer bookings
        +Integer newCustomers
        +String periodStart
        +String periodEnd
    }

    class MetricCard {
        <<Record>>
        +double value
        +String unit
        +double trend
        +boolean isPositive
    }

    class Metrics {
        <<Record>>
        +MetricCard ctr
        +MetricCard cpc
        +MetricCard roas
        +MetricCard convRate
        +MetricCard cac
    }

    class FunnelStage {
        <<Record>>
        +String stage
        +long value
        +String dropoff
    }

    class PesBreakdownItem {
        <<Record>>
        +String metric
        +String weight
        +double contribution
    }

    class PesResponse {
        <<Record>>
        +double overallScore
        +String label
        +List~PesBreakdownItem~ breakdown
    }

    class CampaignSnapshot {
        <<Record>>
        +String periodStart
        +String periodEnd
        +double pesScore
        +String pesLabel
        +Double ctr
        +Double cpc
        +Double roas
        +Double convRate
        +Double cac
    }

    class ManualIngestResponse {
        <<Record>>
        +Metrics metrics
        +List~FunnelStage~ funnel
        +PesResponse pes
    }

    class CampaignHistoryResponse {
        <<Record>>
        +List~CampaignSnapshot~ snapshots
    }

    %% ── Entity ────────────────────────────────────────────────────────────────

    class CampaignRecord {
        <<Entity>>
        -UUID campaignId
        -Long impressions
        -Long clicks
        -Double adSpend
        -Double revenue
        -Long conversions
        -Long bookings
        -Long newCustomers
        -Double ctr
        -Double cpc
        -Double convRate
        -Double roas
        -Double cac
        -Double pesScore
        -String pesLabel
        -Integer analysisWeeks
        -String periodStart
        -String periodEnd
        -Instant createdAt
        -Instant updatedAt
        +from(ManualIngestRequest) CampaignRecord
        +enrichWithKpis(double, double, double, double, double) void
        +enrichWithPes(double, String) void
    }

    %% ── Repository ────────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class CampaignRecordRepository {
        <<Interface>>
        +findByCreatedAtAfterOrderByCreatedAtDesc(Instant after) List~CampaignRecord~
        +findTop10ByOrderByCreatedAtDesc() List~CampaignRecord~
        +findAllByOrderByCreatedAtDesc(Pageable pageable) List~CampaignRecord~
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class AnalyticsController {
        <<RestController>>
        -MetricsCalculationService metricsService
        -PESComputationService pesService
        -CampaignRecordRepository recordRepo
        -AIInferenceGatewayService ai
        +manual(ManualIngestRequest body) ManualIngestResponse
        +metrics(int weeks) MetricsResponse
        +history(int weeks) CampaignHistoryResponse
        +pes(String campaignId, int weeks) PesResponse
    }

    %% ── Spring Services ───────────────────────────────────────────────────────

    class MetricsCalculationService {
        <<Service>>
        +compute(ManualIngestRequest in) MetricsResponse
    }

    class PESComputationService {
        <<Service>>
        +compute(Metrics m) PesResponse
    }

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient sbertClient
        -Duration timeout
        +computePesFromRaw(Map payload) Map
    }

    %% ── FastAPI: Router + Service ─────────────────────────────────────────────

    class PesComputeRouter {
        <<FastAPI Router – pes_compute.py>>
        +POST_analyze(req CampaignRawRequest) dict
    }

    class PesComputeService {
        <<Service – pes_compute_service.py>>
        +compute_base_metrics(impressions, clicks, adSpend, revenue, conversions, bookings, newCustomers) tuple
        +normalize_and_invert(metrics dict, flagged list) tuple
        +compute_pes(normalized dict, effective_weights dict) PesResult
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. CampaignRecordRepository : implements

    AnalyticsController --> MetricsCalculationService : compute KPIs
    AnalyticsController --> PESComputationService : fallback PES
    AnalyticsController --> CampaignRecordRepository : persist/read
    AnalyticsController --> AIInferenceGatewayService : AI PES enrichment
    AnalyticsController ..> ManualIngestRequest : accepts
    AnalyticsController ..> ManualIngestResponse : returns
    AnalyticsController ..> CampaignHistoryResponse : returns

    CampaignRecordRepository --> CampaignRecord : manages

    ManualIngestResponse *-- Metrics : contains
    ManualIngestResponse *-- FunnelStage : contains
    ManualIngestResponse *-- PesResponse : contains
    Metrics *-- MetricCard : contains 5x
    PesResponse *-- PesBreakdownItem : contains
    CampaignHistoryResponse *-- CampaignSnapshot : contains

    AIInferenceGatewayService ..> PesComputeRouter : HTTP POST /analyze

    PesComputeRouter --> PesComputeService : delegates
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant AC as AnalyticsController
    participant MCS as MetricsCalculationService
    participant PESO as PESComputationService
    participant REPO as CampaignRecordRepository
    participant GW as AIInferenceGatewayService
    participant SBERT as FastAPI-SBERT
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-4.1a — Manual Campaign Data Ingestion
        Client->>AC: POST /api/v1/analytics/manual (ManualIngestRequest)
        AC->>MCS: compute(ManualIngestRequest)
        MCS->>MCS: CTR = clicks / impressions × 100
        MCS->>MCS: CPC = adSpend / clicks
        MCS->>MCS: ROAS = revenue / adSpend
        MCS->>MCS: ConvRate = conversions / clicks × 100
        MCS->>MCS: CAC = adSpend / newCustomers
        MCS->>MCS: build 4-stage FunnelStage list with drop-off %
        MCS-->>AC: MetricsResponse (Metrics + funnel)

        AC->>REPO: save(CampaignRecord.from(request))
        REPO->>DB: INSERT tbl_campaign_records (raw inputs)
        DB-->>REPO: persisted entity

        AC->>REPO: enrichWithKpis(ctr, cpc, convRate, roas, cac)
        REPO->>DB: UPDATE tbl_campaign_records SET kpi fields

        Note over AC,SBERT: AI PES enrichment — FR4.26 fallback if unavailable
        AC->>GW: computePesFromRaw(rawPayload Map)
        GW->>SBERT: POST /internal/pes-compute/analyze
        SBERT->>SBERT: compute_base_metrics() → CTR/CPC/CR/ROAS/CAC
        SBERT->>SBERT: normalize_and_invert() → Min-Max + cost inversion + weight recalibration
        SBERT->>SBERT: compute_pes() → weighted sum → PesResult
        SBERT-->>GW: {pes_score, pes_label, breakdown, effective_weights}
        GW-->>AC: Map result
        AC->>REPO: enrichWithPes(pesScore, pesLabel)
        REPO->>DB: UPDATE tbl_campaign_records SET pes_score, pes_label

        alt FastAPI unavailable (FR4.26 Fallback)
            AC->>PESO: compute(metrics)
            PESO->>PESO: Min-Max normalise using Cebu MSME bounds
            PESO->>PESO: invert CPC, CAC → weighted PES sum
            PESO-->>AC: PesResponse (local)
        end

        AC-->>Client: 200 ManualIngestResponse (metrics, funnel, pes)
    end

    rect rgb(255, 248, 230)
        Note over Client,DB: UC-4.1b — Load Campaign History
        Client->>AC: GET /api/v1/analytics/history?weeks=4
        AC->>REPO: findAllByOrderByCreatedAtDesc(Pageable.ofSize(4))
        REPO->>DB: SELECT TOP 4 FROM tbl_campaign_records ORDER BY created_at DESC
        DB-->>REPO: CampaignRecord rows
        AC->>AC: map each row → CampaignSnapshot
        AC-->>Client: 200 CampaignHistoryResponse {snapshots[]}
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_campaign_records {
        UUID campaign_id PK
        BIGINT impressions
        BIGINT clicks
        DOUBLE ad_spend
        DOUBLE revenue
        BIGINT conversions
        BIGINT bookings
        BIGINT new_customers
        DOUBLE ctr
        DOUBLE cpc
        DOUBLE conv_rate
        DOUBLE roas
        DOUBLE cac
        DOUBLE pes_score
        VARCHAR pes_label
        INT analysis_weeks
        VARCHAR period_start
        VARCHAR period_end
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
```

---
---

## 4.2 AI Prescriptive Report Generation

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class FunnelDiagnostic {
        <<Record>>
        +String stage
        +String rank
        +String dropRate
        +String insight
    }

    class RankedRecommendation {
        <<Record>>
        +String stage
        +String urgency
        +String title
        +String action
    }

    class PrescriptiveReport {
        <<Record>>
        +String executiveSummary
        +List~FunnelDiagnostic~ funnelDiagnostics
        +List~RankedRecommendation~ recommendations
        +String recommendedPlatform
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class AnalyticsController {
        <<RestController>>
        -MetricsCalculationService metricsService
        -AIInferenceGatewayService ai
        +report(Map body) PrescriptiveReport
        +pesAnalysis(Map body) Map
    }

    %% ── Spring Services ───────────────────────────────────────────────────────

    class MetricsCalculationService {
        <<Service>>
        +computeFunnelTransitions(List~FunnelStage~ funnel) List~Map~
        +buildTimeSeries(MetricsResponse current, int weeks) Map
    }

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient sbertClient
        -Duration timeout
        +generateReport(Map payload) Map
        +generatePesAnalysis(Map payload) Map
    }

    %% ── FastAPI: Routers ──────────────────────────────────────────────────────

    class ReportRouter {
        <<FastAPI Router – report.py>>
        +POST_generate(req ReportRequest) PrescriptiveReport
        +POST_pdf(req) bytes
    }

    class PesAnalysisRouter {
        <<FastAPI Router – pes_analysis.py>>
        +POST_generate(req PesAnalysisRequest) dict
    }

    %% ── LangGraph Agent ───────────────────────────────────────────────────────

    class PesReportAgent {
        <<LangGraph Workflow – graph.py>>
        +generate_report(state AgentState) dict
        +evaluate_report(state AgentState) dict
        +finalize_response(state AgentState) dict
        +route_action(state AgentState) str
        +ainvoke(input dict) AgentState
    }

    class AgentState {
        <<TypedDict – state.py>>
        +str metrics_data
        +dict report
        +dict evaluation
        +int iterations
        +dict final_metadata
        +dict final_ui_payload
    }

    class ReportOutput {
        <<Pydantic Model>>
        +List~MetricCondition~ metric_conditions
        +CrossMetricLogic cross_metric_logic
        +List~RankedWeakness~ ranked_weaknesses
    }

    class MetricCondition {
        <<Pydantic Model>>
        +str metric_name
        +str current_status
        +str trend
        +float peak_value
        +float low_value
    }

    class RankedWeakness {
        <<Pydantic Model>>
        +str metric_name
        +int rank
        +str weakness_meaning
        +str recommendation
    }

    class EvaluationResult {
        <<Pydantic Model>>
        +int score
        +bool pass_status
        +List~str~ issues
        +List~str~ missing_elements
        +str accuracy_check
        +str recommendation
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    AnalyticsController --> MetricsCalculationService : rank funnel + build series
    AnalyticsController --> AIInferenceGatewayService : generateReport / generatePesAnalysis
    AnalyticsController ..> PrescriptiveReport : returns

    PrescriptiveReport *-- FunnelDiagnostic : composed of 3x
    PrescriptiveReport *-- RankedRecommendation : composed of 3x

    AIInferenceGatewayService ..> ReportRouter : HTTP POST /generate
    AIInferenceGatewayService ..> PesAnalysisRouter : HTTP POST /generate

    ReportRouter ..> PrescriptiveReport : returns
    PesAnalysisRouter --> PesReportAgent : ainvoke

    PesReportAgent --> AgentState : reads/writes
    PesReportAgent --> ReportOutput : generates
    PesReportAgent --> EvaluationResult : evaluates

    ReportOutput *-- MetricCondition : contains
    ReportOutput *-- RankedWeakness : contains
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant AC as AnalyticsController
    participant MCS as MetricsCalculationService
    participant GW as AIInferenceGatewayService
    participant RR as ReportRouter
    participant PAR as PesAnalysisRouter
    participant PRA as PesReportAgent
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-4.2a — Generate Prescriptive Report
        Client->>AC: POST /api/v1/analytics/report (optional {weeks})
        AC->>DB: SELECT recent CampaignRecord rows
        DB-->>AC: CampaignRecord list
        AC->>MCS: computeFunnelTransitions(funnel)
        MCS->>MCS: rank transitions by business impact
        MCS->>MCS: Clicks→Conversions (Weakest), Conversions→Bookings (Moderate), Impressions→Clicks (Alright)
        MCS-->>AC: List~Map~ ranked funnel transitions

        AC->>GW: generateReport(payload: metrics + transitions + weeks + market)
        GW->>RR: POST /internal/report/generate (ReportRequest)
        RR->>RR: map rank index 0/1/2 → Most Urgent/Urgent/Not Very Urgent
        RR->>RR: call Gemini for AI insights per stage
        RR->>RR: select recommendedPlatform via _PLATFORM_MAP[market]
        RR-->>GW: PrescriptiveReport JSON

        alt FastAPI unavailable (FR4.26 Fallback)
            AC->>AC: identify weakest funnel metric from ranking
            AC->>AC: return hardcoded Cebu-specific recommendations
        end

        GW-->>AC: Map result
        AC->>AC: map to PrescriptiveReport
        AC-->>Client: 200 PrescriptiveReport (executiveSummary, diagnostics, recommendations, platform)
    end

    rect rgb(255, 235, 235)
        Note over Client,PRA: UC-4.2b — PES Deep Analysis via LangGraph Agent
        Client->>AC: POST /api/v1/analytics/pes-analysis (optional {weeks})
        AC->>DB: SELECT recent CampaignRecord for current metrics
        DB-->>AC: CampaignRecord
        AC->>MCS: buildTimeSeries(metricsResponse, weeks)
        MCS->>MCS: linear interpolation: index [0] = current, index [N] = 75–78% baseline
        MCS->>MCS: cost metrics (CPC, CAC) baseline = 130% of current
        MCS-->>AC: time-series Map {CTR:[...], CPC:[...], ROAS:[...], CR:[...], CAC:[...]}

        AC->>GW: generatePesAnalysis({metrics_data, weeks})
        GW->>PAR: POST /internal/pes-analysis/generate

        PAR->>PRA: ainvoke({metrics_data, iterations: 0})
        loop until score ≥ 85 or iterations ≥ 3
            PRA->>PRA: generate_report(state) → Gemini → ReportOutput
            PRA->>PRA: evaluate_report(state) → Gemini → EvaluationResult (score 0–100)
            PRA->>PRA: route_action: score < 85 AND iterations < 3 → retry with feedback
        end
        PRA->>PRA: finalize_response → final_ui_payload + metadata
        PRA-->>PAR: AgentState (final_ui_payload, final_score, needs_human_review)
        PAR-->>GW: {report_data: {metric_conditions, cross_metric_logic, ranked_weaknesses}, metadata}
        GW-->>AC: Map result
        AC-->>Client: 200 PES analysis report
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_campaign_records {
        UUID campaign_id PK
        BIGINT impressions
        BIGINT clicks
        DOUBLE ad_spend
        DOUBLE revenue
        BIGINT conversions
        BIGINT bookings
        BIGINT new_customers
        DOUBLE ctr
        DOUBLE cpc
        DOUBLE conv_rate
        DOUBLE roas
        DOUBLE cac
        DOUBLE pes_score
        VARCHAR pes_label
        INT analysis_weeks
        VARCHAR period_start
        VARCHAR period_end
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
```
