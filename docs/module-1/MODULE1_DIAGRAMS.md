# Module 1 — Architecture Diagrams

---

## 1.1 Business Input and Categorization

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── Frontend (React / TypeScript) ──────────────────────────────────────────
    class BusinessProfile {
        <<React Component>>
        +ProfileData profile
        +ProfileSetters setters
        -bool isEditModalOpen
        -string tempBusinessName
        -string[] tempCategories
        -string[] tempCoreServices
        -string tempDescription
        -string tempUvp
        -string tempImagePreview
        +handleSave() void
        +openEditModal() void
        +handleImageUpload(file File) void
    }

    class UniquenessCalibrationForm {
        <<React Component>>
        +UniquenessPayloadDTO payload
        +CategoryAllocation[] categories
        +bool isAnalyzing
        +bool hasAnalyzed
        +string[] selectedCategories
        +onAnalyzeRequest() void
        +onPayloadChange(dto UniquenessPayloadDTO) void
        +onToggleCategory(name string) void
    }

    class InferredCategoryBoard {
        <<React Component>>
        +CategoryAllocation[] categories
        +string[] selectedCategories
        +number minSelected
        +onToggle(name string) void
    }

    class AdjustableCategoryItem {
        <<React Component>>
        +string name
        +number percentage
        +bool isSelected
        +onAdd() void
        +onRemove() void
    }

    class DynamicListManager {
        <<React Component>>
        +string[] items
        +string draft
        +onAdd(item string) void
        +onRemove(idx number) void
    }

    class TextField {
        <<React Component>>
        +string label
        +string value
        +string placeholder
        +onChange(val string) void
    }

    class TextAreaField {
        <<React Component>>
        +string label
        +string value
        +number minWords
        +onChange(val string) void
    }

    class ValidationBanner {
        <<React Component>>
        +string[] errors
    }

    class ActionTag {
        <<React Component>>
        +string label
        +bool isActive
        +onRemove() void
    }

    class apiClient {
        <<TypeScript Service>>
        +loadProfile(operatorId string) BusinessProfileDTO
        +saveProfile(operatorId string, dto BusinessProfileDTO) BusinessProfileDTO
        +classifyAnalyze(body object) CategoryAllocation[]
    }

    %% ── Spring Boot ──────────────────────────────────────────────────────────
    class BusinessProfileController {
        <<RestController>>
        -BusinessProfileRepository repo
        -AIInferenceGatewayService ai
        +get(operatorId UUID) BusinessProfileDto
        +save(body BusinessProfileDto, operatorId UUID) BusinessProfileDto
    }

    class ClassificationAnalyzeController {
        <<RestController>>
        -AIInferenceGatewayService ai
        +analyze(req AnalyzeRequest) AnalyzeResponse
    }

    class BusinessProfileEntity {
        <<Entity – tbl_business_profile>>
        UUID businessProfileId
        UUID userId
        String businessName
        String businessDescription
        String uvp
        String coreServices
        String categories
        String imageUrl
        Float confidenceScore
        Float uniquenessScore
        OffsetDateTime createdAt
        OffsetDateTime updatedAt
        +coreServicesList() List~String~
        +categoriesList() List~String~
        +setCoreServicesList(List~String~) void
        +setCategoriesList(List~String~) void
    }

    class BusinessProfileRepository {
        <<JpaRepository>>
        +findFirstByUserId(userId UUID) Optional~BusinessProfileEntity~
        +save(entity BusinessProfileEntity) BusinessProfileEntity
        +findById(id UUID) Optional~BusinessProfileEntity~
    }

    class BusinessProfileDto {
        <<Record>>
        UUID businessProfileId
        String businessName
        List~String~ categories
        List~String~ coreServices
        String description
        String uvp
        String imagePreview
        Float uniquenessScore
    }

    class AnalyzeRequest {
        <<Record>>
        String businessName
        List~String~ coreServices
        String description
        String uvp
    }

    class CategoryAllocation {
        <<Record>>
        String name
        int percentage
    }

    class AnalyzeResponse {
        <<Record>>
        List~CategoryAllocation~ categories
    }

    class AIInferenceGatewayService {
        <<Spring Service>>
        -WebClient sbertClient
        -Duration timeout
        +classifyCategories(payload Map) Map
        +embedBusinessProfile(payload Map) void
    }

    %% ── FastAPI – fastapi-sbert ──────────────────────────────────────────────
    class ClassificationRouter {
        <<FastAPI Router – classification.py>>
        +POST_analyze(req AnalyzeRequest) dict
        +POST_embed(req EmbedRequest) dict
    }

    class MlClassifier {
        <<ML Service – ml_classifier.py>>
        +predict_all(name str, services list, desc str, uvp str) list
        +predict_top3(name str, services list, desc str, uvp str) list
        +embed_business(services list, desc str, uvp str) list~float~
        -_build_text(services list, uvp str, desc str) str
        -_predict_probs(text str) ndarray
    }

    class BertModel {
        <<Singleton – BertModel.py>>
        -SentenceTransformer encoder
        -KerasModel classifier
        +get() BertModel
    }

    class EmbeddingStore {
        <<DB Service – embedding_store.py>>
        +upsert_embedding(profileId str, vector list) None
    }

    %% ── Relationships ────────────────────────────────────────────────────────
    BusinessProfile *-- UniquenessCalibrationForm : contains
    BusinessProfile --> DynamicListManager : uses
    BusinessProfile --> TextField : uses
    BusinessProfile --> TextAreaField : uses
    BusinessProfile --> ValidationBanner : uses
    BusinessProfile --> ActionTag : uses
    UniquenessCalibrationForm *-- InferredCategoryBoard : renders
    InferredCategoryBoard *-- AdjustableCategoryItem : renders per category

    BusinessProfile ..> apiClient : loadProfile · saveProfile
    UniquenessCalibrationForm ..> apiClient : classifyAnalyze

    BusinessProfileController --> BusinessProfileRepository : uses
    BusinessProfileController ..> AIInferenceGatewayService : async embedBusinessProfile
    ClassificationAnalyzeController --> AIInferenceGatewayService : classifyCategories
    BusinessProfileRepository --> BusinessProfileEntity : manages
    BusinessProfileController ..> BusinessProfileDto : returns
    ClassificationAnalyzeController ..> AnalyzeRequest : accepts
    ClassificationAnalyzeController ..> AnalyzeResponse : returns
    AnalyzeResponse *-- CategoryAllocation : contains

    AIInferenceGatewayService ..> ClassificationRouter : HTTP POST /analyze · /embed
    ClassificationRouter --> MlClassifier : invokes
    MlClassifier --> BertModel : uses singleton
    ClassificationRouter --> EmbeddingStore : upserts on /embed
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant BP as BusinessProfile
    participant UCF as UniquenessCalibrationForm
    participant ICB as InferredCategoryBoard
    participant API as apiClient
    participant BPC as BusinessProfileController
    participant CAC as ClassificationAnalyzeController
    participant REPO as BusinessProfileRepository
    participant GW as AIInferenceGatewayService
    participant CR as classification.py
    participant ML as ml_classifier
    participant ES as embedding_store
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over BP,DB: Flow A — Load Saved Profile on App Mount
        BP->>API: loadProfile(OPERATOR_ID)
        API->>BPC: GET /api/v1/business-profile?operatorId=…
        BPC->>REPO: findFirstByUserId(operatorId)
        REPO->>DB: SELECT * FROM tbl_business_profile WHERE user_id = ?
        DB-->>REPO: row or empty
        REPO-->>BPC: Optional~BusinessProfileEntity~
        BPC-->>API: BusinessProfileDto (JSON)
        API-->>BP: hydrate shared profile state in App.tsx
    end

    rect rgb(255, 248, 230)
        Note over BP,DB: Flow B — Save Business Profile
        User->>BP: fills edit modal fields → clicks Save
        BP->>API: saveProfile(OPERATOR_ID, BusinessProfileDto)
        API->>BPC: PUT /api/v1/business-profile?operatorId=…
        BPC->>REPO: save(BusinessProfileEntity)
        REPO->>DB: UPSERT tbl_business_profile
        DB-->>REPO: persisted entity
        Note over BPC,DB: Async fire-and-forget — non-blocking for the UI
        BPC->>GW: embedBusinessProfile(payload)
        GW->>CR: POST /internal/classification/embed
        CR->>ML: embed_business(coreServices, description, uvp)
        ML->>ML: _build_text() → E5 encode → L2-normalised 768-dim vector
        ML-->>CR: float[768]
        CR->>ES: upsert_embedding(businessProfileId, vector)
        ES->>DB: INSERT … ON CONFLICT DO UPDATE tbl_business_embedding
        BPC-->>API: BusinessProfileDto
        API-->>BP: isSaved = true
    end

    rect rgb(235, 255, 242)
        Note over UCF,DB: Flow C — Analyze Business Profile for Category Inference
        User->>UCF: fills businessName, description, coreServices, uvp → clicks Analyze
        UCF->>API: classifyAnalyze({businessName, coreServices, description, uvp})
        API->>CAC: POST /api/v1/classification/analyze
        CAC->>GW: classifyCategories(payload Map)
        GW->>CR: POST /internal/classification/analyze
        CR->>ML: predict_all(name, services, desc, uvp)
        ML->>ML: _build_text() → E5 encode 768-dim → Keras Dense(256→128→7) sigmoid
        ML->>ML: argsort() → normalize probabilities to 100%
        ML-->>CR: list of 7 CategoryAllocation items sorted by confidence
        CR-->>GW: {categories: [{name, percentage}, …]}
        GW-->>CAC: Map response
        CAC-->>API: AnalyzeResponse (JSON)
        API-->>UCF: CategoryAllocation[]
        UCF->>ICB: render InferredCategoryBoard with inferred allocations
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_msme_operator {
        UUID operator_id PK
        VARCHAR email
        VARCHAR password_hash
        TIMESTAMPTZ created_at
    }

    tbl_business_profile {
        UUID business_profile_id PK
        UUID user_id FK
        VARCHAR business_name
        TEXT business_description
        TEXT uvp
        TEXT core_services
        TEXT categories
        TEXT image_url
        FLOAT confidence_score
        FLOAT uniqueness_score
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    tbl_business_embedding {
        UUID embedding_id PK
        UUID business_profile_id FK
        VECTOR embedding_vector
        VARCHAR embedding_model_version
        TIMESTAMPTZ generated_at
    }

    tbl_msme_operator ||--o{ tbl_business_profile : "operator owns"
    tbl_business_profile ||--o| tbl_business_embedding : "has embedding"
```

---
---

## 1.2 Uniqueness Scoring Dashboard

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── Frontend (React / TypeScript) ──────────────────────────────────────────
    class UniquenessCalibrationView {
        <<React Component>>
        +ProfileData profile
        +ProfileSetters setters
        -UniquenessPayloadDTO payload
        -bool isAnalyzing
        -bool hasAnalyzed
        -CategoryAllocation[] categories
        -string[] selectedCategories
        -bool isComputing
        -DetailedCalibrationResultDTO calibrationResult
        +handleAnalyzeRequest() void
        +handleComputeRequest() void
        +toggleCategory(name string) void
    }

    class UniquenessCalibrationForm {
        <<React Component – shared from 1.1>>
        +UniquenessPayloadDTO payload
        +CategoryAllocation[] categories
        +bool isAnalyzing
        +bool hasAnalyzed
        +string[] selectedCategories
        +onAnalyzeRequest() void
        +onPayloadChange(dto UniquenessPayloadDTO) void
        +onToggleCategory(name string) void
    }

    class InferredCategoryBoard {
        <<React Component – shared from 1.1>>
        +CategoryAllocation[] categories
        +string[] selectedCategories
        +onToggle(name string) void
    }

    class CalibrationResultsDashboard {
        <<React Component>>
        +DetailedCalibrationResultDTO result
        +bool isComputing
        +onConfirm() void
    }

    class DetailedCalibrationResultDTO {
        <<TypeScript Interface>>
        +number overallScore
        +number semanticsScore
        +number categoryScore
        +string descriptionFeedback
        +string categoryFeedback
    }

    class OverallScoreCard {
        <<React Component>>
        +number score
    }

    class ActionableScoreCard {
        <<React Component>>
        +string title
        +number score
        +string description
        +string color
    }

    class StatTypography {
        <<React Component>>
        +number value
    }

    class ComputeUniquenessButton {
        <<React Component>>
        +bool isLoading
        +bool disabled
        +onClick() void
    }

    class apiClient {
        <<TypeScript Service>>
        +classifyAnalyze(body object) CategoryAllocation[]
        +classifyUniqueness(body object) UniquenessResultDTO
        +saveProfile(operatorId string, dto BusinessProfileDTO) BusinessProfileDTO
    }

    %% ── Spring Boot ──────────────────────────────────────────────────────────
    class UniquenessScoringController {
        <<RestController>>
        -AIInferenceGatewayService ai
        +uniqueness(req UniquenessRequest) UniquenessResponse
    }

    class UniquenessRequest {
        <<Record>>
        String businessProfileId
        String businessName
        List~String~ categories
        List~String~ coreServices
        String description
        String uvp
    }

    class UniquenessResponse {
        <<Record>>
        int overallScore
        int semanticsScore
        int categoryScore
        String descriptionFeedback
        String categoryFeedback
    }

    class AIInferenceGatewayService {
        <<Spring Service>>
        -WebClient sbertClient
        -Duration timeout
        +computeUniqueness(payload Map) Map
    }

    class BusinessProfileController {
        <<RestController – shared from 1.1>>
        -BusinessProfileRepository repo
        -AIInferenceGatewayService ai
        +save(body BusinessProfileDto, operatorId UUID) BusinessProfileDto
    }

    class BusinessProfileRepository {
        <<JpaRepository – shared from 1.1>>
        +save(entity BusinessProfileEntity) BusinessProfileEntity
    }

    %% ── FastAPI – fastapi-sbert ──────────────────────────────────────────────
    class ClassificationRouter {
        <<FastAPI Router – classification.py>>
        +POST_uniqueness(req UniquenessRequest) dict
    }

    class MlClassifier {
        <<ML Service – ml_classifier.py>>
        +compute_semantic_uniqueness(services list, desc str, uvp str, corpus list) float
        +compute_category_score(name str, services list, desc str, uvp str, selected list) float
        -_build_text(services list, uvp str, desc str) str
        -_predict_probs(text str) ndarray
    }

    class BertModel {
        <<Singleton – BertModel.py>>
        -SentenceTransformer encoder
        -KerasModel classifier
        +get() BertModel
    }

    class EmbeddingStore {
        <<DB Service – embedding_store.py>>
        +fetch_others(excludeProfileId str) list~list~
    }

    %% ── Relationships ────────────────────────────────────────────────────────
    UniquenessCalibrationView *-- UniquenessCalibrationForm : renders
    UniquenessCalibrationView *-- CalibrationResultsDashboard : renders
    UniquenessCalibrationView --> ComputeUniquenessButton : uses
    UniquenessCalibrationForm *-- InferredCategoryBoard : renders
    CalibrationResultsDashboard *-- OverallScoreCard : renders
    CalibrationResultsDashboard *-- ActionableScoreCard : renders 2x
    CalibrationResultsDashboard ..> DetailedCalibrationResultDTO : receives
    OverallScoreCard --> StatTypography : uses
    ActionableScoreCard --> StatTypography : uses

    UniquenessCalibrationView ..> apiClient : classifyAnalyze · classifyUniqueness · saveProfile

    UniquenessScoringController --> AIInferenceGatewayService : computeUniqueness
    UniquenessScoringController ..> UniquenessRequest : accepts
    UniquenessScoringController ..> UniquenessResponse : returns
    BusinessProfileController --> BusinessProfileRepository : uses

    AIInferenceGatewayService ..> ClassificationRouter : HTTP POST /uniqueness
    ClassificationRouter --> EmbeddingStore : fetch_others
    ClassificationRouter --> MlClassifier : compute_semantic_uniqueness · compute_category_score
    MlClassifier --> BertModel : uses singleton
    EmbeddingStore ..> MlClassifier : provides corpus vectors
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UCV as UniquenessCalibrationView
    participant UCF as UniquenessCalibrationForm
    participant ICB as InferredCategoryBoard
    participant CRD as CalibrationResultsDashboard
    participant API as apiClient
    participant CAC as ClassificationAnalyzeController
    participant USC as UniquenessScoringController
    participant BPC as BusinessProfileController
    participant GW as AIInferenceGatewayService
    participant CR as classification.py
    participant ML as ml_classifier
    participant ES as embedding_store
    participant REPO as BusinessProfileRepository
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over UCV,DB: Flow A — Analyze Business Profile for Category Selection
        User->>UCF: fills businessName, description, coreServices, uvp → clicks Analyze
        UCF->>API: classifyAnalyze({businessName, coreServices, description, uvp})
        API->>CAC: POST /api/v1/classification/analyze
        CAC->>GW: classifyCategories(payload Map)
        GW->>CR: POST /internal/classification/analyze
        CR->>ML: predict_all(name, services, desc, uvp)
        ML->>ML: E5 encode → Keras forward pass → 7 category probabilities
        ML-->>CR: list of 7 CategoryAllocation items
        CR-->>GW: {categories: […]}
        GW-->>CAC: Map
        CAC-->>API: AnalyzeResponse (JSON)
        API-->>UCF: CategoryAllocation[]
        UCF->>ICB: render InferredCategoryBoard with AI-inferred allocations
        User->>ICB: toggles category selections (min 1 required)
    end

    rect rgb(255, 235, 235)
        Note over UCV,DB: Flow B — Compute Uniqueness Score
        User->>UCV: clicks Compute Uniqueness
        UCV->>API: classifyUniqueness({profileId, businessName, selectedCategories, coreServices, description, uvp})
        API->>USC: POST /api/v1/classification/uniqueness
        USC->>GW: computeUniqueness(payload Map)
        GW->>CR: POST /internal/classification/uniqueness

        CR->>ES: fetch_others(excludeProfileId)
        ES->>DB: SELECT embedding_vector FROM tbl_business_embedding WHERE profile_id != ?
        DB-->>ES: N rows of 768-dim vectors (corpus)
        ES-->>CR: list of float[768] corpus embeddings

        CR->>ML: compute_semantic_uniqueness(services, desc, uvp, corpus)
        ML->>ML: E5 encode current profile → cosine distance vs each corpus vector
        ML->>ML: mean_distance / 0.5 × 100  (capped at 100)
        ML-->>CR: semanticsScore (float 0–100)

        CR->>ML: compute_category_score(name, services, desc, uvp, selectedCategories)
        ML->>ML: Keras forward pass → selected category indices probability sum
        ML->>ML: normalize by max_possible → scale 0–100
        ML-->>CR: categoryScore (float 0–100)

        CR->>CR: overallScore = (semanticsScore + categoryScore) / 2
        CR-->>GW: {overallScore, semanticsScore, categoryScore}
        GW-->>USC: Map
        USC-->>API: UniquenessResponse (JSON)
        API-->>UCV: UniquenessResultDTO
        UCV->>CRD: render score cards (overall, semantics, category)
    end

    rect rgb(235, 255, 242)
        Note over UCV,DB: Flow C — Confirm and Register Profile
        User->>CRD: reviews scores → clicks Confirm & Register Profile
        CRD->>API: saveProfile(OPERATOR_ID, {…profile, uniquenessScore})
        API->>BPC: PUT /api/v1/business-profile?operatorId=…
        BPC->>REPO: save(entity with uniquenessScore set)
        REPO->>DB: UPSERT tbl_business_profile SET uniqueness_score = ?
        DB-->>REPO: persisted entity
        REPO-->>BPC: BusinessProfileEntity
        BPC-->>API: BusinessProfileDto
        API-->>UCV: profile saved → navigate to profile tab
    end
```

---

### Entity Relationship Diagram

```mermaid
erDiagram
    tbl_msme_operator {
        UUID operator_id PK
        VARCHAR email
        VARCHAR password_hash
        TIMESTAMPTZ created_at
    }

    tbl_business_profile {
        UUID business_profile_id PK
        UUID user_id FK
        VARCHAR business_name
        TEXT business_description
        TEXT uvp
        TEXT core_services
        TEXT categories
        TEXT image_url
        FLOAT confidence_score
        FLOAT uniqueness_score
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    tbl_business_embedding {
        UUID embedding_id PK
        UUID business_profile_id FK
        VECTOR embedding_vector
        VARCHAR embedding_model_version
        TIMESTAMPTZ generated_at
    }

    tbl_msme_operator ||--o{ tbl_business_profile : "operator owns"
    tbl_business_profile ||--o| tbl_business_embedding : "corpus entry for scoring"
```
