# Module 3 — Architecture Diagrams

> Scope: Backend only (Spring Boot + FastAPI-SBERT + FastAPI-Compliance).
> Designed for OOP — covers database schema, business logic, and AI data models.

---

## 3.1 AI Caption Generation

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class GenerateRequest {
        <<Record>>
        +String market
        +String businessName
        +String description
        +List~String~ categories
        +String trend
    }

    class ContentResponseDto {
        <<Record>>
        +MarketHeaderDto market
        +String framework
        +CaptionsDto captions
        +String source
    }

    class PlatformContentDto {
        <<Record>>
        +List~String~ options
        +List~String~ optionNames
        +List~Map~ optionMetadata
        +List~String~ guide
    }

    %% ── Entities ──────────────────────────────────────────────────────────────

    class LocalizedPromotionalContent {
        <<Entity>>
        -UUID contentId
        -UUID businessProfileId
        -String selectedMarket
        -String platform
        -String generatedCaption
        -String contentDirection
        -String hashtags
        -String framework
        -String source
        -Boolean approvalStatus
        -OffsetDateTime generatedAt
        -OffsetDateTime approvedAt
    }

    class ContentGenerationLog {
        <<Entity>>
        -UUID contentLogId
        -UUID businessProfileId
        -String generationStatus
        -String diagnostics
        -OffsetDateTime loggedAt
    }

    %% ── Repositories ──────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class LocalizedPromotionalContentRepository {
        <<Interface>>
        +findByBusinessProfileIdAndSelectedMarket(UUID, String) List~LocalizedPromotionalContent~
        +findByBusinessProfileIdAndSelectedMarketAndPlatform(UUID, String, String) Optional~LocalizedPromotionalContent~
    }

    class ContentGenerationLogRepository {
        <<Interface>>
        +save(ContentGenerationLog) ContentGenerationLog
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class ContentController {
        <<RestController>>
        -ContentGenerationService generationService
        -ContentApprovalService approvalService
        +generate(GenerateRequest req) ContentResponseDto
        +approve(String market) Map
    }

    %% ── Spring Services ───────────────────────────────────────────────────────

    class ContentGenerationService {
        <<Service>>
        -AIInferenceGatewayService ai
        -BusinessProfileRepository profileRepo
        -ForecastResultRepository forecastRepo
        -LocalizedPromotionalContentRepository contentRepo
        -ContentGenerationLogRepository logRepo
        +generate(UUID profileId, String market, String name, String desc, List~String~ categories, String trend) ContentResponseDto
    }

    class ContentApprovalService {
        <<Service>>
        -LocalizedPromotionalContentRepository contentRepo
        +approveForMarket(UUID profileId, String market) List~UUID~
        +getApprovedCaptions(UUID profileId, String market) List~String~
        +hasApprovedContent(UUID profileId, String market) boolean
    }

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient sbertClient
        -Duration timeout
        +generateCaption(Map payload) Map
    }

    %% ── FastAPI: Router ───────────────────────────────────────────────────────

    class ContentRouter {
        <<FastAPI Router – content.py>>
        +generate(req ContentGenerateRequest) ContentResponse
    }

    %% ── FastAPI: Services ─────────────────────────────────────────────────────

    class CaptionGenerationService {
        <<Service – caption_generation.py>>
        +caption_generation_service(input CaptionInputClass) dict
    }

    class CaptionGenerationAgent {
        <<LangGraph Workflow – graph.py>>
        +analyze_services(state) SocialAgentState
        +generate_platform_captions(state) SocialAgentState
        +ainvoke(input dict) SocialAgentState
    }

    class AgentLLMModel {
        <<Singleton – AgentLLMModel.py>>
        -ChatGroq _model
        +get_model() ChatGroq
    }

    class CaptionInputClass {
        <<Pydantic Model>>
        +str business_name
        +str business_description
        +str business_uvp
        +list business_services
        +str market_category
        +str target_market
        +str forecast_context
        +str research_context
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. LocalizedPromotionalContentRepository : implements
    JpaRepository <|.. ContentGenerationLogRepository : implements

    ContentController --> ContentGenerationService : generate
    ContentController --> ContentApprovalService : approve
    ContentController ..> ContentResponseDto : returns

    ContentGenerationService --> AIInferenceGatewayService : generateCaption
    ContentGenerationService --> LocalizedPromotionalContentRepository : persists
    ContentGenerationService --> ContentGenerationLogRepository : audit log
    ContentGenerationService ..> GenerateRequest : accepts
    ContentGenerationService ..> ContentResponseDto : returns

    ContentApprovalService --> LocalizedPromotionalContentRepository : reads/updates

    LocalizedPromotionalContentRepository --> LocalizedPromotionalContent : manages

    ContentResponseDto *-- PlatformContentDto : contains

    AIInferenceGatewayService ..> ContentRouter : HTTP POST /generate

    ContentRouter --> CaptionGenerationService : invokes
    CaptionGenerationService --> CaptionGenerationAgent : ainvoke
    CaptionGenerationAgent --> AgentLLMModel : uses
    CaptionGenerationAgent ..> CaptionInputClass : accepts
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant CC as ContentController
    participant CGS as ContentGenerationService
    participant CAS as ContentApprovalService
    participant GW as AIInferenceGatewayService
    participant SBERT as FastAPI-SBERT
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-3.1a — Generate Localised Captions
        Client->>CC: POST /api/v1/content/generate (GenerateRequest + profileId)
        CC->>CGS: generate(profileId, market, name, desc, categories, trend)
        CGS->>DB: SELECT tbl_business_profile WHERE profile_id = ?
        DB-->>CGS: BusinessProfile (name, categories, uniquenessScore)
        CGS->>DB: SELECT tbl_forecast_result + tbl_market_score for forecast context (FR3.4)
        DB-->>CGS: ForecastResult + MarketScore rows
        CGS->>CGS: build enriched payload (forecast context, cultural context)
        CGS->>GW: generateCaption(payload Map)
        GW->>SBERT: POST /generate (ContentGenerateRequest)
        SBERT->>SBERT: cultural_research.research_market(market)
        SBERT->>SBERT: build CaptionInputClass → caption_generation_service()
        SBERT->>SBERT: LangGraph: analyze_services → generate_platform_captions (Groq llama-3.3-70b)
        SBERT->>SBERT: transform final_captions → ContentResponse (options, optionNames, optionMetadata, guide)
        SBERT-->>GW: ContentResponse JSON
        GW-->>CGS: Map response
        CGS->>CGS: deserialize to ContentResponseDto
        loop 4 platforms (instagram, tiktok, facebook, naver)
            CGS->>DB: INSERT tbl_localized_promotional_content
        end
        CGS->>DB: INSERT tbl_content_generation_log
        CGS-->>CC: ContentResponseDto
        CC-->>Client: 200 ContentResponseDto
    end

    rect rgb(255, 248, 230)
        Note over Client,DB: UC-3.1b — Approve Caption for Market
        Client->>CC: POST /api/v1/content/approve?market={market} (profileId in context)
        CC->>CAS: approveForMarket(profileId, market)
        CAS->>DB: UPDATE tbl_localized_promotional_content SET approval_status=true, approved_at=NOW()
        DB-->>CAS: updated count
        CAS-->>CC: List~UUID~ approvedIds
        CC-->>Client: 200 {approvedIds, market, count}
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_business_profile {
        UUID business_profile_id PK
        UUID user_id FK
        VARCHAR business_name
        TEXT categories
        FLOAT uniqueness_score
    }

    tbl_forecast_result {
        UUID forecast_result_id PK
        UUID business_profile_id FK
        VARCHAR target_market
        DOUBLE predicted_demand
        DOUBLE forecast_confidence
    }

    tbl_localized_promotional_content {
        UUID content_id PK
        UUID business_profile_id FK
        VARCHAR selected_market
        VARCHAR platform
        TEXT generated_caption
        TEXT content_direction
        TEXT hashtags
        TEXT cta
        TEXT tone_suggestion
        VARCHAR framework
        VARCHAR source
        BOOLEAN approval_status
        TIMESTAMPTZ generated_at
        TIMESTAMPTZ approved_at
    }

    tbl_content_generation_log {
        UUID content_log_id PK
        UUID business_profile_id FK
        VARCHAR generation_status
        TEXT diagnostics
        TIMESTAMPTZ logged_at
    }

    tbl_business_profile ||--o{ tbl_localized_promotional_content : "generates content"
    tbl_business_profile ||--o{ tbl_content_generation_log : "has generation logs"
    tbl_forecast_result }o--|| tbl_business_profile : "enriches generation"
```

---
---

## 3.2 Creative Direction

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class CreativeDirectionDto {
        <<Record>>
        +List~String~ visualGuide
        +List~ShotDto~ shots
        +MoodboardDto moodboard
    }

    class ShotDto {
        <<Record>>
        +String label
        +String description
        +String lighting
    }

    class MoodboardDto {
        <<Record>>
        +String palette
        +List~String~ references
    }

    %% ── Entities ──────────────────────────────────────────────────────────────

    class CreativeDirectionOutput {
        <<Entity>>
        -UUID creativeDirectionId
        -UUID businessProfileId
        -String selectedMarket
        -String shotListRecommendations
        -String visualRecommendations
        -String lightingSuggestions
        -String moodboardReferences
        -String platformRecommendations
        -String visualTone
        -Boolean approvalStatus
        -OffsetDateTime generatedAt
        -OffsetDateTime approvedAt
    }

    class CreativeDirectionLog {
        <<Entity>>
        -UUID creativeLogId
        -UUID businessProfileId
        -String generationStatus
        -String diagnostics
        -OffsetDateTime loggedAt
    }

    %% ── Repositories ──────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class CreativeDirectionOutputRepository {
        <<Interface>>
        +findTopByBusinessProfileIdAndSelectedMarketOrderByGeneratedAtDesc(UUID, String) Optional~CreativeDirectionOutput~
    }

    class CreativeDirectionLogRepository {
        <<Interface>>
        +save(CreativeDirectionLog) CreativeDirectionLog
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class CreativeDirectionController {
        <<RestController>>
        -CreativeDirectionService generationService
        -CreativeApprovalService approvalService
        +generate(UUID profileId, String market) CreativeDirectionDto
        +approve(UUID profileId, String market) Map
    }

    %% ── Spring Services ───────────────────────────────────────────────────────

    class CreativeDirectionService {
        <<Service>>
        -ContentApprovalService contentApproval
        -AIInferenceGatewayService ai
        -BusinessProfileRepository profileRepo
        -ForecastResultRepository forecastRepo
        -CreativeDirectionOutputRepository outputRepo
        -CreativeDirectionLogRepository logRepo
        +generate(UUID profileId, String market) CreativeDirectionDto
    }

    class CreativeApprovalService {
        <<Service>>
        -CreativeDirectionOutputRepository outputRepo
        +approveLatest(UUID profileId, String market) Optional~UUID~
    }

    class ContentApprovalService {
        <<Service>>
        +hasApprovedContent(UUID profileId, String market) boolean
        +getApprovedCaptions(UUID profileId, String market) List~String~
    }

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient sbertClient
        -Duration timeout
        +generateCreative(Map payload) Map
    }

    %% ── FastAPI: Router ───────────────────────────────────────────────────────

    class CreativeRouter {
        <<FastAPI Router – creative.py>>
        +generate(req CreativeGenerateRequest) CreativeDirectionResponse
    }

    class GeminiClient {
        <<Service – gemini_client.py>>
        +generate_creative_direction(market, businessName, categories, approvedCaptions, uniquenessScore, forecastContext) dict
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. CreativeDirectionOutputRepository : implements
    JpaRepository <|.. CreativeDirectionLogRepository : implements

    CreativeDirectionController --> CreativeDirectionService : generate
    CreativeDirectionController --> CreativeApprovalService : approve
    CreativeDirectionController ..> CreativeDirectionDto : returns

    CreativeDirectionService --> ContentApprovalService : dependency guard
    CreativeDirectionService --> AIInferenceGatewayService : generateCreative
    CreativeDirectionService --> CreativeDirectionOutputRepository : persists
    CreativeDirectionService --> CreativeDirectionLogRepository : audit log
    CreativeDirectionService ..> CreativeDirectionDto : returns

    CreativeApprovalService --> CreativeDirectionOutputRepository : updates

    CreativeDirectionOutputRepository --> CreativeDirectionOutput : manages

    CreativeDirectionDto *-- ShotDto : contains
    CreativeDirectionDto *-- MoodboardDto : contains

    AIInferenceGatewayService ..> CreativeRouter : HTTP POST /generate

    CreativeRouter --> GeminiClient : generate_creative_direction
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant CDC as CreativeDirectionController
    participant CDS as CreativeDirectionService
    participant CAS as ContentApprovalService
    participant GW as AIInferenceGatewayService
    participant SBERT as FastAPI-SBERT
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-3.2a — Generate Creative Direction
        Client->>CDC: POST /api/v1/creative-direction/generate/{profileId}?market={market}
        CDC->>CDS: generate(profileId, market)

        CDS->>CAS: hasApprovedContent(profileId, market)
        CAS->>DB: SELECT COUNT FROM tbl_localized_promotional_content WHERE approval_status=true
        DB-->>CAS: count
        alt count == 0
            CDS-->>CDC: throw "missing_dependency" (FR3.11)
            CDC-->>Client: 400 MOD32_CREATIVE_MISSING_DEPENDENCY
        end

        CDS->>CAS: getApprovedCaptions(profileId, market)
        CAS->>DB: SELECT generated_caption WHERE approval_status=true
        DB-->>CAS: approved caption texts
        CDS->>DB: SELECT tbl_business_profile
        DB-->>CDS: BusinessProfile
        CDS->>DB: SELECT tbl_forecast_result for forecast context
        DB-->>CDS: ForecastResult
        CDS->>CDS: build creative payload (approvedCaptions, businessName, categories, forecastContext)
        CDS->>GW: generateCreative(payload Map)
        GW->>SBERT: POST /generate (CreativeGenerateRequest)
        SBERT->>SBERT: gemini_client.generate_creative_direction()
        SBERT->>SBERT: construct Gemini prompt from approved captions as creative brief
        SBERT-->>GW: CreativeDirectionResponse (visualGuide, shots, moodboard)
        GW-->>CDS: Map response
        CDS->>CDS: deserialize to CreativeDirectionDto
        CDS->>DB: INSERT tbl_creative_direction_output
        CDS->>DB: INSERT tbl_creative_direction_log
        CDS-->>CDC: CreativeDirectionDto
        CDC-->>Client: 200 CreativeDirectionDto
    end

    rect rgb(255, 248, 230)
        Note over Client,DB: UC-3.2b — Approve Creative Direction Output
        Client->>CDC: POST /api/v1/creative-direction/approve/{profileId}?market={market}
        CDC->>CDS: approveLatest(profileId, market) via CreativeApprovalService
        CDS->>DB: SELECT TOP 1 tbl_creative_direction_output ORDER BY generated_at DESC
        DB-->>CDS: CreativeDirectionOutput row
        CDS->>DB: UPDATE SET approval_status=true, approved_at=NOW()
        DB-->>CDS: updated row
        CDS-->>CDC: Optional~UUID~ approvedId
        CDC-->>Client: 200 {approvedId, market}
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_business_profile {
        UUID business_profile_id PK
        UUID user_id FK
        VARCHAR business_name
        TEXT categories
    }

    tbl_localized_promotional_content {
        UUID content_id PK
        UUID business_profile_id FK
        VARCHAR selected_market
        VARCHAR platform
        TEXT generated_caption
        BOOLEAN approval_status
        TIMESTAMPTZ approved_at
    }

    tbl_creative_direction_output {
        UUID creative_direction_id PK
        UUID business_profile_id FK
        VARCHAR selected_market
        TEXT shot_list_recommendations
        TEXT visual_recommendations
        TEXT lighting_suggestions
        TEXT moodboard_references
        TEXT visual_tone
        BOOLEAN approval_status
        TIMESTAMPTZ generated_at
        TIMESTAMPTZ approved_at
    }

    tbl_creative_direction_log {
        UUID creative_log_id PK
        UUID business_profile_id FK
        VARCHAR generation_status
        TEXT diagnostics
        TIMESTAMPTZ logged_at
    }

    tbl_business_profile ||--o{ tbl_creative_direction_output : "generates direction"
    tbl_business_profile ||--o{ tbl_creative_direction_log : "has direction logs"
    tbl_localized_promotional_content }o--|| tbl_business_profile : "dependency guard"
```

---
---

## 3.3 OMCS Compliance Evaluation

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class EvaluateFullRequest {
        <<Record>>
        +String caption
        +String market
        +String mediaName
        +Long mediaSize
        +List~String~ approvedCaptions
        +List~String~ categories
        +String visualTone
        +String shotListContext
    }

    class ComplianceResultDto {
        <<Record>>
        +int score
        +List~String~ aligned
        +List~String~ gaps
        +String source
        +Double casScore
        +Double vasScore
        +Double hcsScore
        +Double omcsScore
        +String interpretation
        +List~String~ mismatches
    }

    %% ── Entities ──────────────────────────────────────────────────────────────

    class ComplianceEvaluationResult {
        <<Entity>>
        -UUID evaluationId
        -UUID businessProfileId
        -String selectedMarket
        -String caption
        -Double casScore
        -Double vasScore
        -Double hcsScore
        -Double omcsScore
        -Integer score
        -String complianceThreshold
        -String alignedItems
        -String gapItems
        -String mismatches
        -String source
        -Integer revisionNumber
        -Boolean approvalStatus
        -OffsetDateTime evaluatedAt
    }

    class ComplianceRevisionHistory {
        <<Entity>>
        -UUID revisionId
        -UUID businessProfileId
        -UUID originalEvalId
        -String selectedMarket
        -Integer revisionNumber
        -String submittedCaption
        -Double casScore
        -Double omcsScore
        -String complianceThreshold
        -OffsetDateTime submittedAt
    }

    %% ── Repositories ──────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class ComplianceEvaluationResultRepository {
        <<Interface>>
        +findTopByBusinessProfileIdAndSelectedMarketOrderByEvaluatedAtDesc(UUID, String) Optional~ComplianceEvaluationResult~
    }

    class ComplianceRevisionHistoryRepository {
        <<Interface>>
        +save(ComplianceRevisionHistory) ComplianceRevisionHistory
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class ComplianceController {
        <<RestController>>
        -ComplianceAnalysisService analysisService
        -AIInferenceGatewayService ai
        +evaluateJson(EvaluateRequest req) ComplianceResultDto
        +evaluateFullJson(EvaluateFullRequest req, UUID profileId) ComplianceResultDto
    }

    %% ── Spring Services ───────────────────────────────────────────────────────

    class ComplianceAnalysisService {
        <<Service>>
        -ContentApprovalService contentApproval
        -CreativeDirectionOutputRepository creativeRepo
        -ComplianceEvaluationResultRepository evalRepo
        -ComplianceRevisionHistoryRepository revisionRepo
        -AIInferenceGatewayService ai
        +analyze(UUID profileId, String caption, String market, String mediaName, Long mediaSize) ComplianceResultDto
        -persistResult(ComplianceResultDto, UUID, String, String) void
    }

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient sbertClient
        -WebClient complianceClient
        -Duration timeout
        +evaluateCompliance(Map payload) Map
        +evaluateComplianceFull(Map payload) Map
        +evaluateOmcs(Map payload) Map
    }

    %% ── FastAPI-SBERT: Router + Services ──────────────────────────────────────

    class SbertComplianceRouter {
        <<FastAPI Router – compliance.py (fastapi-sbert)>>
        +POST_evaluate(req EvaluateRequest) ComplianceResponse
        +POST_evaluate_full(req EvaluateFullRequest) ComplianceResponse
    }

    class SentenceBertScorer {
        <<Service – sentence_bert_scorer.py>>
        +compute_cas(submitted str, approved list) float
        +compute_hcs(caption, market, categories, approved, visual_tone, media_name) float
        +interpret_omcs(score float) str
    }

    class SbertGeminiClient {
        <<Service – gemini_client.py (fastapi-sbert)>>
        +evaluate_compliance(caption, market) dict
        +evaluate_compliance_multimodal(caption, approved, visual_tone, market) dict
    }

    %% ── FastAPI-Compliance: Router + Services ─────────────────────────────────

    class OmcsComplianceRouter {
        <<FastAPI Router – compliance.py (fastapi-compliance)>>
        +POST_evaluate_omcs(req OmcsEvalRequest) OmcsEvalResponse
    }

    class OmcsService {
        <<Service – omcs_service.py>>
        +compute_ss(submission str, recommendation str) float
        +compute_hc(submission str, rules list) float
        +extract_failing_tokens(submission str, recommendation str) list
    }

    class GroqClient {
        <<Service – groq_client.py>>
        +evaluate_ma(ai_recommendation, submission_text, media_name, media_size) tuple
        +generate_failure_feedback(ai_recommendation, submission_text, failing_tokens, visual_mismatches, rules, market) dict
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. ComplianceEvaluationResultRepository : implements
    JpaRepository <|.. ComplianceRevisionHistoryRepository : implements

    ComplianceController --> ComplianceAnalysisService : delegates
    ComplianceController --> AIInferenceGatewayService : basic path
    ComplianceController ..> ComplianceResultDto : returns
    ComplianceController ..> EvaluateFullRequest : accepts

    ComplianceAnalysisService --> AIInferenceGatewayService : evaluate OMCS / full / basic
    ComplianceAnalysisService --> ComplianceEvaluationResultRepository : persists
    ComplianceAnalysisService --> ComplianceRevisionHistoryRepository : appends revision
    ComplianceAnalysisService ..> ComplianceResultDto : returns

    ComplianceEvaluationResultRepository --> ComplianceEvaluationResult : manages
    ComplianceRevisionHistoryRepository --> ComplianceRevisionHistory : manages
    ComplianceRevisionHistory ..> ComplianceEvaluationResult : FK originalEvalId

    AIInferenceGatewayService ..> SbertComplianceRouter : HTTP POST /evaluate-full
    AIInferenceGatewayService ..> OmcsComplianceRouter : HTTP POST /evaluate-omcs

    SbertComplianceRouter --> SentenceBertScorer : compute CAS + HCS
    SbertComplianceRouter --> SbertGeminiClient : compute VAS

    OmcsComplianceRouter --> OmcsService : compute Ss + Hc
    OmcsComplianceRouter --> GroqClient : compute Ma
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant CCC as ComplianceController
    participant CAS as ComplianceAnalysisService
    participant GW as AIInferenceGatewayService
    participant SBERT as FastAPI-SBERT
    participant OMCS as FastAPI-Compliance
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-3.3a — Full OMCS Compliance Evaluation
        Client->>CCC: POST /api/v1/compliance/evaluate-full-json (caption, market, profileId)
        CCC->>CAS: analyze(profileId, caption, market, mediaName, mediaSize)

        Note over CAS,DB: FR3.21 — Enrich from DB context
        CAS->>DB: SELECT generated_caption FROM tbl_localized_promotional_content WHERE approval_status=true
        DB-->>CAS: approved captions list
        CAS->>DB: SELECT visual_tone FROM tbl_creative_direction_output WHERE approval_status=true
        DB-->>CAS: visualTone, shotListContext
        CAS->>DB: SELECT categories FROM tbl_business_profile
        DB-->>CAS: categories list
        CAS->>CAS: assemble EvaluateFullRequest (FR3.22)

        Note over CAS,OMCS: Attempt 1 — OMCS path (fastapi-compliance)
        CAS->>GW: evaluateOmcs(omcsPayload)
        GW->>OMCS: POST /api/v1/compliance/evaluate-omcs
        OMCS->>OMCS: OmcsService.compute_ss() — SBERT cosine similarity Ss
        OMCS->>OMCS: GroqClient.evaluate_ma() — Groq multimodal Ma
        OMCS->>OMCS: OmcsService.compute_hc() — keyword-match Hc
        OMCS->>OMCS: OMCS = 0.35×Ss + 0.45×Ma + 0.20×Hc
        alt OMCS >= 0.80
            OMCS-->>GW: OmcsEvalResponse (status=success, feedback=null)
        else OMCS < 0.80
            OMCS->>OMCS: extract_failing_tokens + generate_failure_feedback
            OMCS-->>GW: OmcsEvalResponse (status=failure, feedback populated)
        end
        GW-->>CAS: Map result

        alt OMCS path fails (503/timeout)
            Note over CAS,SBERT: Attempt 2 — Full CAS+VAS+HCS path (fastapi-sbert)
            CAS->>GW: evaluateComplianceFull(sbertPayload)
            GW->>SBERT: POST /evaluate-full
            SBERT->>SBERT: SentenceBertScorer.compute_cas() → CAS (E5 cosine)
            SBERT->>SBERT: GeminiClient.evaluate_compliance_multimodal() → VAS
            SBERT->>SBERT: SentenceBertScorer.compute_hcs() → HCS (6-rule checker)
            SBERT->>SBERT: OMCS = 0.35×CAS + 0.45×VAS + 0.20×HCS
            SBERT->>SBERT: interpret_omcs() → Excellent/High/Moderate/Significant
            SBERT-->>GW: ComplianceResponse with sub-scores
            GW-->>CAS: Map result
        end

        Note over CAS,DB: FR3.28/29 — Persist result and revision
        CAS->>DB: UPSERT tbl_compliance_evaluation_result (increment revision_number)
        CAS->>DB: INSERT tbl_compliance_revision_history
        CAS->>CAS: map to ComplianceResultDto (casScore, vasScore, hcsScore, omcsScore, interpretation)
        CAS-->>CCC: ComplianceResultDto
        CCC-->>Client: 200 ComplianceResultDto
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_business_profile {
        UUID business_profile_id PK
        UUID user_id FK
        VARCHAR business_name
        TEXT categories
    }

    tbl_localized_promotional_content {
        UUID content_id PK
        UUID business_profile_id FK
        VARCHAR selected_market
        VARCHAR platform
        TEXT generated_caption
        BOOLEAN approval_status
    }

    tbl_creative_direction_output {
        UUID creative_direction_id PK
        UUID business_profile_id FK
        VARCHAR selected_market
        TEXT visual_tone
        TEXT shot_list_recommendations
        BOOLEAN approval_status
    }

    tbl_compliance_evaluation_result {
        UUID evaluation_id PK
        UUID business_profile_id FK
        VARCHAR selected_market
        TEXT caption
        DOUBLE cas_score
        DOUBLE vas_score
        DOUBLE hcs_score
        DOUBLE omcs_score
        INT score
        VARCHAR compliance_threshold
        TEXT aligned_items
        TEXT gap_items
        TEXT mismatches
        VARCHAR source
        INT revision_number
        BOOLEAN approval_status
        TIMESTAMPTZ evaluated_at
    }

    tbl_compliance_revision_history {
        UUID revision_id PK
        UUID business_profile_id FK
        UUID original_eval_id FK
        VARCHAR selected_market
        INT revision_number
        TEXT submitted_caption
        DOUBLE cas_score
        DOUBLE omcs_score
        VARCHAR compliance_threshold
        TIMESTAMPTZ submitted_at
    }

    tbl_business_profile ||--o{ tbl_compliance_evaluation_result : "has evaluations"
    tbl_business_profile ||--o{ tbl_compliance_revision_history : "tracks revisions"
    tbl_localized_promotional_content }o--|| tbl_business_profile : "provides approved captions"
    tbl_creative_direction_output }o--|| tbl_business_profile : "provides visual context"
    tbl_compliance_evaluation_result ||--o{ tbl_compliance_revision_history : "has revision history"
```
