# CeView — Frontend ↔ Backend Sequence Diagrams

Status as of the current integration pass. Six React→Spring Boot→FastAPI flows are wired end-to-end; the remaining views still render local mock data. Every diagram below traces a real code path — file references in brackets.

---

## 1. System overview

```mermaid
flowchart LR
    subgraph Browser["Browser (localhost:3000)"]
        UI[React 19 SPA<br/>Vite dev server]
    end

    subgraph SpringBoot["Spring Boot 3.3 — :8080"]
        Ctrl[Controllers<br/>module1/2/3/4]
        Svc[Domain services<br/>MetricsCalc, PES…]
        AIGW[AIInferenceGatewayService<br/>WebClient]
        JPA[(JPA Repositories)]
    end

    subgraph FastAPI["FastAPI — :8000"]
        Router[Routers<br/>/internal/*]
        Gemini[gemini_client.py]
        Stubs[ml_stubs.py<br/>deterministic mocks]
    end

    subgraph PG["Postgres + pgvector — :5432"]
        Tables[(22 tables<br/>tbl_business_profile,<br/>campaign_data, …)]
    end

    External[("Gemini API<br/>(optional,<br/>ENABLE_GEMINI=true)")]

    UI -- "fetch /api/*<br/>CORS http://localhost:3000" --> Ctrl
    Ctrl --> Svc
    Ctrl --> AIGW
    Ctrl <--> JPA
    JPA <--> Tables
    AIGW -- "POST /internal/*<br/>WebClient, 30s timeout" --> Router
    Router --> Gemini
    Router --> Stubs
    Gemini -. "if enabled" .-> External
```

---

## 2. Page load: Home → notifications

User clicks the **Home** sidebar tab. `HomeView` mounts and pulls the alert list.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant H as HomeView<br/>[ceview/components/views/module-2/HomeView.tsx]
    participant API as apiClient.ts<br/>[ceview/services/apiClient.ts]
    participant SC as NotificationController<br/>[com.ceview.module2]
    participant GW as AIInferenceGatewayService<br/>[com.ceview.ai]
    participant FR as FastAPI router<br/>[app/routers/forecasting.py]
    participant MS as ml_stubs.notifications()<br/>[app/services/ml_stubs.py]

    U->>H: click "Home"
    activate H
    Note over H: useEffect on mount
    H->>API: api.listNotifications()
    activate API
    API->>SC: GET /api/notifications<br/>Origin: http://localhost:3000
    activate SC
    Note over SC: CORS preflight passes<br/>(SecurityConfig permitAll /api/**)
    SC->>GW: ai.listNotifications()
    activate GW
    GW->>FR: POST http://fastapi:8000/internal/forecasting/notifications<br/>body: {}
    activate FR
    FR->>MS: notifications()
    activate MS
    MS-->>FR: [{ id, title, market, trend, details, … }]
    deactivate MS
    FR-->>GW: 200 { "notifications": [...] }
    deactivate FR
    GW-->>SC: Map { notifications: [...] }
    deactivate GW
    SC-->>API: 200 { notifications: [...] }
    deactivate SC
    API-->>H: { notifications: Notification[] }
    deactivate API
    Note over H: if length > 0 → setNotifications(…)<br/>else keep MOCK_NOTIFICATIONS fallback
    H-->>U: TrendAlertCard list renders
    deactivate H
```

---

## 3. Page load: Market Radar → forecast

User clicks **Market Radar**. The view hydrates three market cards (Korea/Japan/USA) plus a demand chart.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant M as MarketRadarView<br/>[ceview/components/views/module-2/MarketRadarView.tsx]
    participant API as apiClient.ts
    participant SC as ForecastingController<br/>[com.ceview.module2]
    participant GW as AIInferenceGatewayService
    participant FR as FastAPI router<br/>[app/routers/forecasting.py]
    participant MS as ml_stubs.forecast_markets()<br/>[app/services/ml_stubs.py]

    U->>M: click "Market Radar"
    activate M
    Note over M: initial state = MOCK_MARKETS (instant render)
    Note over M: useEffect on mount
    M->>API: api.listMarkets()
    activate API
    API->>SC: GET /api/forecasting/markets
    activate SC
    SC->>GW: ai.forecastMarkets({ profileId: "" })
    activate GW
    GW->>FR: POST /internal/forecasting/analyze<br/>body: { profileId: "" }
    activate FR
    FR->>MS: forecast_markets()
    activate MS
    MS-->>FR: 3 Market objects with chartData<br/>(history + forecast points)
    deactivate MS
    FR-->>GW: 200 { "markets": [...] }
    deactivate FR
    GW-->>SC: Map
    deactivate GW
    SC-->>API: 200 { markets: Market[] }
    deactivate SC
    API-->>M: { markets: Market[] }
    deactivate API
    Note over M: setMarkets(r.markets)<br/>→ React re-renders MarketRankCard + DemandForecastChart
    M-->>U: Ranked market cards + chart
    deactivate M
```

---

## 4. Uniqueness Score → "Analyze Business Profile" button

User fills the form and clicks **Analyze**. Categories get auto-allocated by the backend stub.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant V as UniquenessCalibrationView<br/>[ceview/components/views/module-1/UniquenessCalibrationView.tsx]
    participant API as apiClient.ts
    participant SC as ClassificationController<br/>[com.ceview.module1]
    participant GW as AIInferenceGatewayService
    participant FR as FastAPI router<br/>[app/routers/classification.py]
    participant MS as ml_stubs.classify_categories()<br/>[app/services/ml_stubs.py]

    U->>V: fill 5 fields →<br/>click "Analyze Business Profile"
    activate V
    V->>V: setIsAnalyzing(true)
    V->>API: api.classifyAnalyze({<br/>  businessName, coreServices,<br/>  description, uvp<br/>})
    activate API
    API->>SC: POST /api/classification/analyze<br/>Content-Type: application/json
    activate SC
    SC->>GW: ai.classifyCategories(payload)
    activate GW
    GW->>FR: POST /internal/classification/analyze<br/>body: AnalyzeRequest
    activate FR
    FR->>MS: classify_categories(description, coreServices)
    activate MS
    Note over MS: hash(input) → deterministic<br/>percentage split across 7 buckets
    MS-->>FR: [{ name, percentage }, …]
    deactivate MS
    FR-->>GW: 200 { "categories": [...] }
    deactivate FR
    GW-->>SC: Map
    deactivate GW
    SC-->>API: 200 AnalyzeResponse
    deactivate SC
    API-->>V: { categories: CategoryAllocation[] }
    deactivate API
    Note over V: merge with BASE_CATEGORIES<br/>(preserve order, fill 0 for missing)<br/>setCategories(…)<br/>setHasAnalyzed(true)
    V-->>U: InferredCategoryBoard renders bars
    deactivate V
```

---

## 5. Uniqueness Score → "Compute Uniqueness" button

After analyzing, user clicks **Compute Uniqueness**. This is the only flow that combines a Gemini call with an ML stub.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant V as UniquenessCalibrationView
    participant API as apiClient.ts
    participant SC as ClassificationController
    participant GW as AIInferenceGatewayService
    participant FR as FastAPI router<br/>[app/routers/classification.py]
    participant GC as gemini_client.uniqueness()<br/>[app/services/gemini_client.py]
    participant MS as ml_stubs.cosine_uniqueness()<br/>[app/services/ml_stubs.py]
    participant G as Gemini API
    Note right of G: only if ENABLE_GEMINI=true

    U->>V: click "Compute Uniqueness"
    activate V
    V->>V: setIsComputing(true)
    V->>API: api.classifyUniqueness({<br/>  businessName, categories,<br/>  coreServices, description, uvp<br/>})
    activate API
    API->>SC: POST /api/classification/uniqueness
    activate SC
    SC->>GW: ai.computeUniqueness(payload)
    activate GW
    GW->>FR: POST /internal/classification/uniqueness
    activate FR

    par Gemini qualitative
        FR->>GC: uniqueness(name, cats, services, desc, uvp)
        activate GC
        alt ENABLE_GEMINI=true
            GC->>G: generate_content(<br/>  model=gemini-2.5-flash,<br/>  JSON schema<br/>)
            G-->>GC: { descriptionScore, categoryScore,<br/>  descriptionReasoning, categoryReasoning }
        else disabled (default)
            Note over GC: return hard-coded reasoning strings
        end
        GC-->>FR: Gemini result map
        deactivate GC
    and ML cosine numeric
        FR->>MS: cosine_uniqueness(description, categories)
        activate MS
        Note over MS: hash → reproducible<br/>desc + category 0-100
        MS-->>FR: { descriptionScore, categoryScore, overallScore }
        deactivate MS
    end

    Note over FR: merge: prefer Gemini text,<br/>cosine numbers as fallback
    FR-->>GW: 200 { overallScore, semanticsScore,<br/>  categoryScore, descriptionFeedback,<br/>  categoryFeedback }
    deactivate FR
    GW-->>SC: Map
    deactivate GW
    SC-->>API: 200 UniquenessResponse
    deactivate SC
    API-->>V: DetailedCalibrationResultDTO
    deactivate API
    Note over V: setCalibrationResult(result)
    V-->>U: ScoreGauge + ActionableScoreCard render
    deactivate V
```

---

## 6. Business Profile → "Recalibrate" keywords

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant BP as BusinessProfile<br/>[ceview/components/views/module-1/BusinessProfile.tsx]
    participant API as apiClient.ts
    participant SC as BusinessProfileController<br/>[com.ceview.module1]
    participant GW as AIInferenceGatewayService
    participant FR as FastAPI router<br/>[app/routers/classification.py]
    participant GC as gemini_client.keywords()
    participant G as Gemini API

    U->>BP: click "Recalibrate"<br/>(SEO Keywords card)
    activate BP
    BP->>BP: setIsLoading(true)
    BP->>API: api.generateKeywords({<br/>  businessName, description,<br/>  category: categories.join(", ")<br/>})
    activate API
    API->>SC: POST /api/business-profile/keywords
    activate SC
    SC->>GW: ai.generateKeywords(payload)
    activate GW
    GW->>FR: POST /internal/classification/keywords
    activate FR
    FR->>GC: keywords(businessName, description, category)
    activate GC
    alt ENABLE_GEMINI=true
        GC->>G: generate_content with JSON schema
        G-->>GC: { "keywords": [...] }
    else disabled
        Note over GC: returns 5 hand-crafted seed keywords
    end
    GC-->>FR: list[str]
    deactivate GC
    FR-->>GW: 200 { "keywords": [...] }
    deactivate FR
    GW-->>SC: List<String> (extracted from envelope)
    deactivate GW
    SC-->>API: 200 String[]
    deactivate SC
    API-->>BP: string[]
    deactivate API
    Note over BP: setKeywords(generated)<br/>setIsLoading(false)
    BP-->>U: keyword chips render
    deactivate BP
```

---

## 7. Campaign Analytics → "Generate AI Report"

End-to-end with the heaviest payload. Spring computes metrics locally and only delegates the *narrative* to FastAPI.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant R as AIActionPlanReport<br/>[ceview/components/modules/module-4/AIActionPlanReport.tsx]
    participant API as apiClient.ts
    participant AC as AnalyticsController<br/>[com.ceview.module4]
    participant MC as MetricsCalculationService<br/>[com.ceview.module4]
    participant GW as AIInferenceGatewayService
    participant FR as FastAPI router<br/>[app/routers/report.py]
    participant GC as gemini_client.performance_report()
    participant G as Gemini API

    U->>R: click "Generate AI Report"
    activate R
    R->>R: setIsGenerating(true)
    R->>API: api.prescriptiveReport()
    activate API
    API->>AC: POST /api/analytics/report<br/>body: {}
    activate AC
    Note over AC: payload empty → fill with defaults
    AC->>MC: metrics(null, null)
    activate MC
    Note over MC: compute CTR, CPC, ROAS,<br/>convRate, CAC from default<br/>impressions/clicks/spend
    MC-->>AC: MetricsResponse { metrics, funnel }
    deactivate MC
    AC->>GW: ai.generateReport({ metrics, … })
    activate GW
    GW->>FR: POST /internal/report/generate
    activate FR
    FR->>GC: performance_report(metrics)
    activate GC
    alt ENABLE_GEMINI=true
        GC->>G: generate_content with structured schema
        G-->>GC: { executiveSummary, lowestMetric,<br/>  lowestMetricMeaning, recommendations,<br/>  otherAreasImprove, weakestStage,<br/>  secondaryLeaks }
    else disabled
        Note over GC: return hand-crafted SDD-§4.3 shape
    end
    GC-->>FR: dict matching frontend shape
    deactivate GC
    FR-->>GW: 200 PrescriptiveReport
    deactivate FR
    GW-->>AC: Map
    deactivate GW
    AC-->>API: 200 JSON
    deactivate AC
    API-->>R: { executiveSummary, recommendations, weakestStage, … }
    deactivate API
    Note over R: split recommendation strings by "—" or ":"<br/>into { title, explanation } shape<br/>setReportData(…)
    R-->>U: ExecutiveSummaryCard +<br/>RankedRecommendationsList +<br/>PriorityFixCard render
    deactivate R
```

---

## 8. Error path — backend unavailable

What happens when Docker is stopped or the request fails.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant H as HomeView
    participant API as apiClient.ts
    participant SC as Spring Boot

    U->>H: click "Home"
    activate H
    Note over H: initial state already MOCK_NOTIFICATIONS<br/>(view renders immediately)
    H-->>U: alert cards render from mocks
    H->>API: api.listNotifications()  (in useEffect)
    activate API
    API->>SC: GET /api/notifications
    Note over SC: container down /<br/>connection refused
    API-->>H: throw Error
    deactivate API
    Note over H: catch → console.warn(<br/>  'listNotifications failed, using mock')<br/>setNotifications NOT called
    Note over H: mock data stays visible
    deactivate H
```

The same fallback applies to `MarketRadarView`. Form-driven flows (Uniqueness, Keywords, Report) do *not* have silent fallback — failures log to console and the UI stays in its loading-cleared state.

---

## 9. Persistence — Business Profile save (currently invokable only via direct API call)

The frontend's `BusinessProfile` view exposes a Save modal but doesn't yet PUT to the backend. The endpoint exists and persists end-to-end:

```mermaid
sequenceDiagram
    autonumber
    participant Client as Any HTTP client
    participant BPC as BusinessProfileController<br/>[com.ceview.module1]
    participant Repo as BusinessProfileRepository<br/>[Spring Data JPA]
    participant PG as Postgres<br/>tbl_business_profile

    Client->>BPC: PUT /api/business-profile<br/>?operatorId={uuid}<br/>body: BusinessProfileDto
    activate BPC
    BPC->>Repo: findById(profileId) OR new BusinessProfile()
    activate Repo
    Repo->>PG: SELECT … FROM tbl_business_profile<br/>WHERE business_profile_id = $1
    PG-->>Repo: row or empty
    Repo-->>BPC: Optional<BusinessProfile>
    deactivate Repo
    Note over BPC: setBusinessName, setBusinessDescription,<br/>setUvp, setCoreServicesList(…),<br/>setImageUrl, setFinalizedCategory
    BPC->>Repo: save(p)
    activate Repo
    Repo->>PG: INSERT … ON CONFLICT DO UPDATE<br/>(@PrePersist sets UUID + created_at,<br/>@PreUpdate touches updated_at)
    PG-->>Repo: persisted row
    Repo-->>BPC: BusinessProfile
    deactivate Repo
    BPC-->>Client: 200 BusinessProfileDto<br/>(reflects coreServicesList(),<br/>finalizedCategory, uniquenessScore)
    deactivate BPC
```

To wire this to the React Save button: add `api.saveProfile(...)` to `apiClient.ts` and call it from `BusinessProfile.handleSaveProfile()`.

---

## 10. What is NOT yet wired

These flows still render from frontend mocks. The endpoints exist and have been verified with curl — they're waiting for a follow-up wiring pass.

| Frontend view | Endpoint sitting unused |
|---|---|
| `ContentStudioView` (Module 3) | `POST /api/content/generate` |
| `CreativeDirectionBoard` | `POST /api/creative-direction/generate/{profileId}` |
| `SmartOptimizationBoard` | `POST /api/compliance/evaluate-json` |
| `EngagementMetricsBoard` (funnel cards) | `GET /api/analytics/metrics` |
| `PESComputationBoard` (gauge + breakdown) | `GET /api/analytics/pes/{campaignId}` |
| PDF download button | `GET /api/analytics/report/{id}/pdf` |
| Auth screen (doesn't exist yet) | `POST /api/auth/{register,login}` |

---

## Quick legend

- **Solid arrow** = synchronous HTTP call awaited
- **Dashed arrow** = response
- **Dotted line to Gemini** = optional, only when `ENABLE_GEMINI=true`
- **`par … and …`** block (diagram §5) = parallel composition inside the same FastAPI request handler
- File paths in `[brackets]` reference the actual source so you can jump to any participant
