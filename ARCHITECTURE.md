# CeView — Frontend ↔ Backend Sequence Diagrams

How a request travels through CeView today, one diagram per user-facing flow. Every participant
names the real source file, so you can jump straight to it. Paths are relative to `frontend/`,
`backend/spring-boot/src/main/java/com/ceview/`, `backend/fastapi-sbert/` or
`backend/fastapi-transformer/`.

## Social publishing

The October 2026 implementation connects Settings to `module3.social` and persists encrypted publishing grants in `tbl_publishing_account`. Meta shares the Module 4 login; TikTok creator login is separate from TikTok Ads. Public OAuth callbacks only redirect to the SPA. Authenticated completion burns state and binds the exchange to the calling profile.

Content Studio uploads through `module3.media`, then calls `PublishingController` with approved per-platform captions and a tenant-owned ready media ID. `PublishingService` validates the request and writes one durable row per destination. A tenant/request/platform key deduplicates submissions. It claims work in a short transaction and calls the platform outside it; remote identifiers are checkpointed before advancing. The dispatcher uses Postgres `FOR UPDATE SKIP LOCKED` and claims one due row at a time.

Facebook schedules natively. Instagram containers and videos are polled asynchronously; TikTok inbox uploads are confirmed before showing a draft handoff. Meta ads create PAUSED campaign, ad set, media, creative and ad, with a tenant-owned attribution URL from `AdUrlBuilder`. Changing the Page or ad account prevents a partial chain from resuming against a different account. Definite rate limits retry; ambiguous remote writes require operator inspection. Rotating TikTok refresh tokens use a short distributed lease without retaining a database transaction during HTTP.

`module4.postmetrics` reads available post insights daily into `tbl_post_metric`. The shared post view serves Content Studio, Calendar and Performance. Null metrics and daily history gaps remain unavailable. The complete contracts supersede the earlier prototype surfaces below: [backend/CONTRACT.md](backend/CONTRACT.md#social-publishing-endpoints).

Scoring formulas live in [`ARCHITECTURE_SPEC.md`](ARCHITECTURE_SPEC.md); the REST contract in
[`backend/CONTRACT.md`](backend/CONTRACT.md).

---

## 1. System overview

```mermaid
flowchart LR
    subgraph Browser["Browser"]
        UI["React 19 SPA (frontend/)<br/>Vite dev server :3001"]
    end

    subgraph SpringBoot["Spring Boot 3.3 — :8080"]
        Filters["JwtAuthenticationFilter →<br/>ProfileCompletionFilter"]
        Ctrl["Controllers<br/>module1…module4, auth"]
        Svc["Domain services<br/>Forecasting, MetricsCalculation…"]
        AIGW["AIInferenceGatewayService<br/>(sole bridge to Python)"]
        Jobs["Scheduled jobs<br/>00:00 / 00:15 UTC"]
        JPA[("JPA repositories")]
    end

    subgraph Sbert["fastapi-sbert — :8000"]
        SR["/internal/* routers<br/>classification, generation, creative,<br/>omcs, report, pes-compute, pes-analysis"]
        E5["E5 encoder<br/>(multilingual-e5-base)"]
        Agents["LangGraph agents<br/>caption, OMCS, PES report"]
    end

    subgraph Trans["fastapi-transformer — :8001"]
        TR["/internal/forecasting, /internal/market-data,<br/>/api/trends routers"]
        Eng["Forecast engine: stub | groq | bilstm<br/>(FORECAST_ENGINE)"]
        XGB["XGBoost / linear scorer"]
    end

    PG[("Postgres 16 + pgvector<br/>:5433 on host")]

    Groq[("Groq API<br/>gpt-oss-120b, qwen vision")]
    HF[("Hugging Face Spaces<br/>classifier, BiLSTM model")]
    Serp[("SerpApi<br/>Google Trends")]
    Macro[("World Bank GDP,<br/>currency-api forex")]
    Ads[("Meta / TikTok<br/>ads APIs")]

    UI -- "fetch /api/* + Bearer JWT" --> Filters --> Ctrl
    Ctrl --> Svc --> AIGW
    Ctrl <--> JPA <--> PG
    Jobs --> Svc
    AIGW -- "POST /internal/*" --> SR
    AIGW -- "POST /internal/* , /api/trends" --> TR
    SR --> E5
    SR --> Agents --> Groq
    SR -- "embedding corpus" --> PG
    SR --> HF
    TR --> Eng --> Groq
    Eng --> HF
    TR --> XGB
    TR --> Serp
    Svc --> Macro
    Ctrl --> Ads
```

Ground rules that every flow below follows:

- **Every `/api/*` route is JWT-gated** (`config/SecurityConfig.java`, `anyRequest().authenticated()`);
  only `/api/auth/**`, `/actuator/**`, the ad-platform OAuth callbacks and public attribution
  redirects are open. `ProfileCompletionFilter` additionally blocks operators who haven't finished
  their profile.
- **Tenant scoping comes from the token, never the body.** Controllers call
  `auth/CurrentBusinessProfile.resolveProfileId()` (409 if the operator has no profile yet).
- **No synthetic fallbacks.** An AI dependency that can't answer raises `DependencyUnavailable`
  (`fastapi-*/app/unavailable.py`): 503 when a dependency is down, 424 when a required input is
  missing. Spring re-emits the body verbatim (§8).

---

## 2. Sign-in

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant A as auth provider<br/>[services/auth.tsx]
    participant API as apiClient.auth<br/>[services/apiClient.ts]
    participant AC as AuthController<br/>[auth/AuthController.java]
    participant JWT as JwtService<br/>[auth/JwtService.java]

    U->>A: email + password (or Google via Firebase)
    A->>API: auth.login(email, password)<br/>(or auth.google(idToken, intent))
    API->>AC: POST /api/auth/login (or /google)
    AC->>JWT: issue(operatorId, email)
    AC-->>API: 200 { token, operatorId, profileCompleted }
    API-->>A: session (token stored via authStorage)
    Note over A: Every later request carries<br/>Authorization: Bearer {token}
    alt profileCompleted = false
        A-->>U: complete-profile screen<br/>(PATCH /api/auth/profile)
    else
        A-->>U: app shell
    end
```

---

## 3. Module 1 — Onboarding: classify, score uniqueness, save

The onboarding wizard's analysis step calls two endpoints; saving the profile also refreshes the
operator's embedding in the uniqueness corpus.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant S as AnalysisStep<br/>[components/module-1/onboarding/steps/AnalysisStep.tsx]
    participant W as OnboardingWizard<br/>[components/module-1/onboarding/OnboardingWizard.tsx]
    participant SB as Spring<br/>[module1/businessinput, module1/uniquenessscoring]
    participant FS as sbert classification router<br/>[app/routers/classification.py]
    participant HF as HF Space classifier<br/>[app/services/hf_space_classifier.py]
    participant E5 as E5 encoder<br/>[app/services/ml_classifier.py]
    participant VS as pgvector corpus<br/>[app/services/embedding_store.py]

    U->>S: reach "Analysis" step
    S->>SB: POST /api/classification/analyze<br/>(ClassificationAnalyzeController)
    SB->>FS: POST /internal/classification/analyze
    FS->>HF: predict_categories(description, uvp, services)
    HF-->>FS: category confidences
    FS-->>S: { categories: [{ name, percentage }] }

    S->>SB: POST /api/classification/uniqueness<br/>(UniquenessScoringController)
    SB->>FS: POST /internal/classification/uniqueness
    FS->>E5: embed_business(services, description, uvp)
    FS->>VS: fetch_others(cohort sharing a category)
    FS->>E5: compute_semantic_uniqueness(candidate, cohort)<br/>(percentile rank vs cohort)
    FS->>VS: fetch_cohort_stats(...)
    FS-->>S: { overallScore, cohortSize, categoryDensity, … }
    S-->>U: category split + uniqueness score

    U->>W: finish wizard
    W->>SB: PUT /api/business-profile (BusinessProfileController)
    SB->>SB: save tbl_business_profile
    SB->>FS: POST /internal/classification/embed
    FS->>VS: upsert_embedding(profileId, vector)
    SB-->>W: 200 BusinessProfileDto
```

---

## 4. Module 2 — Dashboard: fresh forecast, ranked markets, alerts

`useDashboardState` makes sure the operator has a recent forecast, then reads ranked markets and
alerts from the database. Inference runs only when the stored forecast is stale.

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant D as useDashboardState<br/>[components/module-2/2.1-dashboard/useDashboardState.ts]
    participant FC as ForecastingController<br/>[module2/ForecastingController.java]
    participant FSv as ForecastingService<br/>[module2/submodule22/ForecastingService.java]
    participant ESB as EnrichedSequenceBuilder<br/>[module2/submodule22/EnrichedSequenceBuilder.java]
    participant FT as transformer forecasting router<br/>[app/routers/forecasting.py]
    participant NC as NotificationController<br/>[module2/NotificationController.java]

    U->>D: open Dashboard
    D->>FC: POST /api/forecasting/ensure?maxAgeHours=12
    FC->>FSv: ensureFreshForecast(profileId)
    alt stored forecast younger than maxAgeHours
        FSv-->>FC: cached rows (no inference)
    else stale or missing
        FSv->>ESB: 12-week sequences per (market, category)<br/>from tbl_market_signal_record
        FSv->>FT: POST /internal/forecasting/inference-batch
        Note over FT: ACTIVE_ENGINE = stub | groq | bilstm<br/>(app/services/forecast_engine.py)
        FT-->>FSv: { "market::category": forecast }
        FSv->>FT: POST /internal/forecasting/score (XGBoost or linear)
        FT-->>FSv: economic viability + market score
        FSv->>FSv: persist ForecastResult, MarketScore,<br/>DemandAlert (+ attribution link)
    end
    FC-->>D: 200
    D->>FC: GET /api/forecasting/markets?category=…
    FC-->>D: ranked markets + chartData (DB read)
    D->>NC: GET /api/notifications
    NC-->>D: demand alerts (DB read)
    D-->>U: ranked market cards, chart, alert feed
    Note over D: "Refresh forecast" button →<br/>POST /api/forecasting/analyze (forces a rerun)
```

### 4.1 Daily background jobs (no user action)

```mermaid
sequenceDiagram
    autonumber
    participant J as MarketDataIngestionJob<br/>[module2/submodule21/MarketDataIngestionJob.java]
    participant IS as MarketDataIngestionService
    participant EX as ExternalMarketDataClient<br/>[module2/submodule21/ExternalMarketDataClient.java]
    participant TM as transformer market-data router<br/>[app/routers/market_data.py]
    participant FSv as ForecastingService
    participant K as KeywordTrendAlertScheduler<br/>[module2/submodule22/KeywordTrendAlertScheduler.java]
    participant TT as transformer trends router<br/>[app/api/trends_router.py]

    Note over J: 00:00 UTC, every non-reference profile
    J->>IS: ingestForProfile(profile)
    IS->>TM: POST /internal/market-data/trends (+ /trends/history on first run)
    Note over TM: SerpApi Google Trends<br/>(app/services/trend_service.py)
    IS->>EX: GDP (World Bank) + forex (currency-api),<br/>last-known-good fallback, else fail
    IS->>TM: POST /internal/market-data/seasonality
    IS->>IS: upsert weekly tbl_market_signal_record
    J->>FSv: refresh forecasts for ingested profiles (bounded concurrency)
    Note over K: 00:15 UTC
    K->>TT: POST /api/trends/rank-markets (missing weekly alerts only)
```

---

## 5. Module 3 — Content Studio: captions, creative direction, compliance audit

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant CS as ContentStudioView<br/>[components/module-3/3.1-content-studio/ContentStudioView.tsx]
    participant CP as CompliancePanel<br/>[components/module-3/3.1-content-studio/CompliancePanel.tsx]
    participant SB as Spring module3<br/>[ContentController → submodule31/ContentGenerationService,<br/>CreativeDirectionController, ComplianceController]
    participant CAP as caption agent<br/>[app/routers/caption_generation.py,<br/>app/agents/creative_director_agent/]
    participant CR as creative router<br/>[app/routers/creative.py → app/services/gemini_client.py]
    participant OM as OMCS agent<br/>[app/routers/omcs_analysis.py,<br/>app/agents/omcs_agent/]

    U->>CS: pick target market
    CS->>SB: POST /api/content/generate
    Note over SB: profile, uniqueness and Module 2<br/>forecast context loaded from DB
    SB->>CAP: POST /internal/generation/caption
    Note over CAP: cultural research for the market (SerpApi,<br/>curated templates if unconfigured), then<br/>LangGraph: analyze_services →<br/>generate_platform_captions (Groq)
    CAP-->>SB: 3 platforms × 3 archetype captions + visual guides
    SB-->>CS: ContentResponse

    CS->>SB: POST /api/creative-direction/generate?market=…
    SB->>CR: POST /internal/creative/generate (Groq JSON)
    CR-->>CS: visualGuide, shots, moodboard, platformRecommendations

    U->>CP: upload image, run audit
    Note over CP: needs generated captions — sends the staged option's<br/>metadata + the platform visual guide as recommendations
    CP->>SB: POST /api/compliance/omcs-analyze<br/>{ caption, imageUrl, recommendations }
    Note over SB: business_profile built from the<br/>operator's saved profile (never the body)
    SB->>OM: POST /internal/omcs/analyze
    Note over OM: profile_alignment (E5 cosine, calibrated) →<br/>rubric (vision LLM) → consistency (vision LLM) →<br/>OMCS = 0.35·profile + 0.45·rubric + 0.20·consistency<br/>→ feedback node only on Fail (< 70)
    Note over OM: no recommendations → 424 MOD33_RECOMMENDATIONS_MISSING
    OM-->>CP: scores, status, feedback
    CP-->>U: gauge, sub-scores, rubric table
```

---

## 6. Module 4 — Campaign analytics: ingest a period, then report

```mermaid
sequenceDiagram
    autonumber
    actor U as MSME Operator
    participant IF as IngestionForm<br/>[components/module-4/4.1-campaign-analytics/IngestionForm.tsx]
    participant CA as CampaignAnalyticsView<br/>[components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx]
    participant AD as AdConnectionController<br/>[module4/adconnections/AdConnectionController.java]
    participant EM as EngagementMetricsController<br/>[module4/engagement/EngagementMetricsController.java]
    participant PR as PrescriptiveReportController<br/>[module4/report/PrescriptiveReportController.java]
    participant PC as pes-compute router<br/>[app/routers/pes_compute.py]
    participant RP as report router<br/>[app/routers/report.py → app/services/report_llm.py]

    opt ad accounts connected
        IF->>AD: GET /api/ad-connections/insights?periodStart…&providers=…
        Note over AD: Meta Graph / TikTok Business APIs
        AD-->>IF: synced impressions, clicks, spend…
    end
    U->>IF: submit period
    IF->>EM: POST /api/analytics/manual
    EM->>EM: save CampaignRecord
    EM->>PC: POST /internal/pes-compute/analyze
    Note over PC: base metrics → normalise → PES<br/>+ Groq insights (rule-based if Groq offline)
    PC-->>EM: PES score, breakdown, ai_report
    EM-->>IF: metrics + PES (record enriched)

    CA->>EM: GET /api/analytics/history?weeks=4|8
    CA->>PR: POST /api/analytics/report
    Note over PR: no saved CampaignRecords → 424 MOD4_REPORT_NO_CAMPAIGN_DATA<br/>(no AI call). Otherwise metrics aggregate from the records<br/>and 3 ranked funnel transitions are sent
    PR->>RP: POST /internal/report/generate
    Note over RP: < 3 transitions → 424 MOD4_REPORT_NO_FUNNEL<br/>Groq offline → 503 MOD4_REPORT_UNAVAILABLE
    RP-->>CA: executiveSummary, funnelDiagnostics,<br/>recommendations, recommendedPlatform
```

---

## 7. Error path — an AI dependency can't answer

```mermaid
sequenceDiagram
    autonumber
    participant UI as Component<br/>(e.g. AnalysisStep, Dashboard)
    participant API as apiClient.request<br/>[services/apiClient.ts]
    participant GW as AIInferenceGatewayService<br/>[ai/AIInferenceGatewayService.java]
    participant H as AiDependencyExceptionHandler<br/>[ai/AiDependencyExceptionHandler.java]
    participant PY as FastAPI service

    UI->>API: call
    API->>GW: (via controller)
    GW->>PY: POST /internal/...
    PY-->>GW: 503 / 424 { code, message, dependency, cause, stage }
    Note over PY: raised as DependencyUnavailable<br/>[app/unavailable.py]
    GW->>H: AiDependencyException (body preserved)
    H-->>API: same status, same body
    API-->>UI: throw ApiError { status, body }
    UI-->>UI: ApiErrorPanel shows code + cause<br/>[components/shared/ApiErrorPanel.tsx]
```

There is no silent mock fallback in the running app. Fixture data is used only when the frontend is
built with `VITE_USE_FIXTURES=true`, and a production build with that flag fails on load.

---

## 8. Features with no backend yet

These screens exist but have no server routes. Spring answers 404 (pinned by
`UnbuiltFeatureRoutesTest`), and the frontend turns that into a plain "isn't available yet" state
(`isNotAvailable` in `services/apiError.ts`) instead of faking success. In fixture mode
(`VITE_USE_FIXTURES=true`) they still run on sample data.

| Feature | Frontend | Behaviour without a backend |
|---|---|---|
| Workspace members and invites | `components/settings/WorkspaceSettings.tsx` | notice shown, invite disabled; "Invite sent" only after the server accepts |
| Social platform connections | `services/connectionsStore.tsx`, `PlatformsSettings.tsx` | notice shown, Connect disabled; Publish modal explains publishing is off |
| Published posts | `ContentStudioView.tsx` | board starts empty (no fixture posts outside fixture mode) |

---

## Quick legend

- **Solid arrow** — synchronous HTTP call awaited by the caller
- **Dashed arrow** — response
- **`alt` / `opt`** — conditional branches
- File paths in `[brackets]` point at the real source for each participant
