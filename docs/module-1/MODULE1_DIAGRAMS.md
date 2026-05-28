# Module 1 — Architecture Diagrams

> Scope: Backend only (Spring Boot + FastAPI-SBERT).
> Designed for OOP — covers database schema, business logic, and AI data models.

---

## 1.1 Business Input and Categorization

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class BusinessProfileDto {
        <<Record>>
        +UUID businessProfileId
        +String businessName
        +List~String~ categories
        +List~String~ coreServices
        +String description
        +String uvp
        +String imagePreview
        +Float uniquenessScore
    }

    class AnalyzeRequest {
        <<Record>>
        +String businessName
        +List~String~ coreServices
        +String description
        +String uvp
    }

    class CategoryAllocation {
        <<Record>>
        +String name
        +int percentage
    }

    class AnalyzeResponse {
        <<Record>>
        +List~CategoryAllocation~ categories
    }

    %% ── Entity ────────────────────────────────────────────────────────────────

    class BusinessProfile {
        <<Entity>>
        -UUID businessProfileId
        -UUID userId
        -String businessName
        -String businessDescription
        -String uvp
        -String coreServices
        -String categories
        -String imageUrl
        -Float confidenceScore
        -Float uniquenessScore
        -OffsetDateTime createdAt
        -OffsetDateTime updatedAt
        +coreServicesList() List~String~
        +categoriesList() List~String~
        +setCoreServicesList(List~String~) void
        +setCategoriesList(List~String~) void
    }

    %% ── Repository ────────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class BusinessProfileRepository {
        <<Interface>>
        +findFirstByUserId(UUID) Optional~BusinessProfile~
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class BusinessProfileController {
        <<RestController>>
        -BusinessProfileRepository repo
        -AIInferenceGatewayService ai
        +get(UUID operatorId) ResponseEntity~BusinessProfileDto~
        +save(BusinessProfileDto body, UUID operatorId) BusinessProfileDto
        -toDto(BusinessProfile) BusinessProfileDto
    }

    class ClassificationAnalyzeController {
        <<RestController>>
        -AIInferenceGatewayService ai
        +analyze(AnalyzeRequest req) AnalyzeResponse
    }

    %% ── AI Gateway Service ────────────────────────────────────────────────────

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient sbertClient
        -Duration timeout
        +classifyCategories(Map payload) Map
        +embedBusinessProfile(Map payload) void
    }

    %% ── FastAPI: Router ───────────────────────────────────────────────────────

    class ClassificationRouter {
        <<FastAPI Router>>
        +analyze(AnalyzeRequest req) dict
        +embed(EmbedRequest req) dict
    }

    %% ── FastAPI: ML Services ──────────────────────────────────────────────────

    class MlClassifier {
        <<Service>>
        +predict_all(str, list, str, str) list~dict~
        +predict_top3(str, list, str, str) list~dict~
        +embed_business(list, str, str) list~float~
        -_build_text(list, str, str) str
        -_predict_probs(str) ndarray
    }

    class _BertModel {
        <<Singleton>>
        -_instance _BertModel
        -SentenceTransformer _encoder
        -KerasModel _classifier
        +get() _BertModel
    }

    class EmbeddingStore {
        <<Service>>
        +upsert_embedding(str profileId, list vector) None
        -_connect() Connection
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. BusinessProfileRepository : implements

    BusinessProfileController --> BusinessProfileRepository : uses
    BusinessProfileController --> AIInferenceGatewayService : async embed
    BusinessProfileController ..> BusinessProfileDto : returns

    ClassificationAnalyzeController --> AIInferenceGatewayService : delegates
    ClassificationAnalyzeController ..> AnalyzeRequest : accepts
    ClassificationAnalyzeController ..> AnalyzeResponse : returns

    BusinessProfileRepository --> BusinessProfile : manages

    AnalyzeResponse *-- CategoryAllocation : contains

    AIInferenceGatewayService ..> ClassificationRouter : HTTP POST /analyze / /embed

    ClassificationRouter --> MlClassifier : invokes
    ClassificationRouter --> EmbeddingStore : persists on /embed

    MlClassifier --> _BertModel : uses singleton

```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant BPC as BusinessProfileController
    participant CAC as ClassificationAnalyzeController
    participant REPO as BusinessProfileRepository
    participant GW as AIInferenceGatewayService
    participant CR as ClassificationRouter
    participant ML as MlClassifier
    participant ES as EmbeddingStore
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-1.1a — Load Business Profile
        Client->>BPC: GET /api/v1/business-profile?operatorId={id}
        BPC->>REPO: findFirstByUserId(operatorId)
        REPO->>DB: SELECT * FROM tbl_business_profile WHERE user_id = ?
        DB-->>REPO: Optional~BusinessProfile~
        REPO-->>BPC: entity or empty
        BPC->>BPC: toDto(BusinessProfile)
        BPC-->>Client: 200 BusinessProfileDto
    end

    rect rgb(255, 248, 230)
        Note over Client,DB: UC-1.1b — Save Business Profile + Embed
        Client->>BPC: PUT /api/v1/business-profile (BusinessProfileDto)
        BPC->>REPO: save(BusinessProfile entity)
        REPO->>DB: UPSERT tbl_business_profile
        DB-->>REPO: persisted entity
        Note over BPC,DB: Fire-and-forget — non-blocking
        BPC--)GW: embedBusinessProfile(Map payload)
        GW->>CR: POST /internal/classification/embed
        CR->>ML: embed_business(coreServices, description, uvp)
        ML->>ML: _build_text() → encoder.encode() → 768-dim vector
        ML-->>CR: float[768]
        CR->>ES: upsert_embedding(profileId, vector)
        ES->>DB: INSERT … ON CONFLICT DO UPDATE tbl_business_embedding
        BPC-->>Client: 200 BusinessProfileDto
    end

    rect rgb(235, 255, 242)
        Note over Client,DB: UC-1.1c — Classify Business Categories
        Client->>CAC: POST /api/v1/classification/analyze (AnalyzeRequest)
        CAC->>GW: classifyCategories(Map payload)
        GW->>CR: POST /internal/classification/analyze
        CR->>ML: predict_all(businessName, coreServices, description, uvp)
        ML->>ML: _build_text() → encoder.encode() [768-dim]
        ML->>ML: classifier.predict() → Dense(256→128→7) sigmoid
        ML->>ML: argsort() → normalize to 100%
        ML-->>CR: List~CategoryAllocation~ (7 items)
        CR-->>GW: {categories: [...]}
        GW-->>CAC: Map response
        CAC->>CAC: map to AnalyzeResponse
        CAC-->>Client: 200 AnalyzeResponse
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

    tbl_msme_operator ||--o{ tbl_business_profile : "owns"
    tbl_business_profile ||--o| tbl_business_embedding : "has embedding"
```

---
---

## 1.2 Uniqueness Scoring Dashboard

### Class Diagram

```mermaid
classDiagram
    direction TB

    %% ── DTOs ──────────────────────────────────────────────────────────────────

    class BusinessProfileDto {
        <<Record>>
        +UUID businessProfileId
        +String businessName
        +List~String~ categories
        +List~String~ coreServices
        +String description
        +String uvp
        +Float uniquenessScore
    }

    class UniquenessRequest {
        <<Record>>
        +String businessProfileId
        +String businessName
        +List~String~ categories
        +List~String~ coreServices
        +String description
        +String uvp
    }

    class UniquenessResponse {
        <<Record>>
        +int overallScore
        +int semanticsScore
        +int categoryScore
        +String descriptionFeedback
        +String categoryFeedback
    }

    %% ── Entity ────────────────────────────────────────────────────────────────

    class BusinessProfile {
        <<Entity>>
        -UUID businessProfileId
        -UUID userId
        -String businessName
        -String businessDescription
        -String uvp
        -String coreServices
        -String categories
        -Float uniquenessScore
        -OffsetDateTime updatedAt
        +coreServicesList() List~String~
        +categoriesList() List~String~
    }

    %% ── Repository ────────────────────────────────────────────────────────────

    class JpaRepository {
        <<Interface>>
        +save(T entity) T
        +findById(ID id) Optional~T~
    }

    class BusinessProfileRepository {
        <<Interface>>
        +findFirstByUserId(UUID) Optional~BusinessProfile~
    }

    %% ── Controllers ───────────────────────────────────────────────────────────

    class UniquenessScoringController {
        <<RestController>>
        -AIInferenceGatewayService ai
        +uniqueness(UniquenessRequest req) UniquenessResponse
    }

    class BusinessProfileController {
        <<RestController>>
        -BusinessProfileRepository repo
        -AIInferenceGatewayService ai
        +save(BusinessProfileDto body, UUID operatorId) BusinessProfileDto
        -toDto(BusinessProfile) BusinessProfileDto
    }

    %% ── AI Gateway Service ────────────────────────────────────────────────────

    class AIInferenceGatewayService {
        <<Service>>
        -WebClient sbertClient
        -Duration timeout
        +computeUniqueness(Map payload) Map
        +embedBusinessProfile(Map payload) void
    }

    %% ── FastAPI: Router ───────────────────────────────────────────────────────

    class ClassificationRouter {
        <<FastAPI Router>>
        +uniqueness(UniquenessRequest req) dict
    }

    %% ── FastAPI: ML Services ──────────────────────────────────────────────────

    class MlClassifier {
        <<Service>>
        +compute_semantic_uniqueness(list, str, str, list) float
        +compute_category_score(str, list, str, str, list) float
        +embed_business(list, str, str) list~float~
        -_build_text(list, str, str) str
        -_predict_probs(str) ndarray
    }

    class _BertModel {
        <<Singleton>>
        -_instance _BertModel
        -SentenceTransformer _encoder
        -KerasModel _classifier
        +get() _BertModel
    }

    class EmbeddingStore {
        <<Service>>
        +fetch_others(str excludeProfileId) list~list~
        -_connect() Connection
    }

    %% ── Relationships ─────────────────────────────────────────────────────────

    JpaRepository <|.. BusinessProfileRepository : implements

    UniquenessScoringController --> AIInferenceGatewayService : delegates
    UniquenessScoringController ..> UniquenessRequest : accepts
    UniquenessScoringController ..> UniquenessResponse : returns

    BusinessProfileController --> BusinessProfileRepository : uses
    BusinessProfileController --> AIInferenceGatewayService : async embed
    BusinessProfileController ..> BusinessProfileDto : returns

    BusinessProfileRepository --> BusinessProfile : manages

    AIInferenceGatewayService ..> ClassificationRouter : HTTP POST /uniqueness

    ClassificationRouter --> EmbeddingStore : fetch corpus
    ClassificationRouter --> MlClassifier : compute scores

    MlClassifier --> _BertModel : uses singleton
    EmbeddingStore ..> MlClassifier : supplies corpus vectors
```

---

### Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant USC as UniquenessScoringController
    participant BPC as BusinessProfileController
    participant REPO as BusinessProfileRepository
    participant GW as AIInferenceGatewayService
    participant CR as ClassificationRouter
    participant ML as MlClassifier
    participant ES as EmbeddingStore
    participant DB as PostgreSQL

    rect rgb(235, 242, 255)
        Note over Client,DB: UC-1.2a — Compute Uniqueness Score
        Client->>USC: POST /api/v1/classification/uniqueness (UniquenessRequest)
        USC->>GW: computeUniqueness(Map payload)
        GW->>CR: POST /internal/classification/uniqueness

        CR->>ES: fetch_others(businessProfileId)
        ES->>DB: SELECT embedding_vector FROM tbl_business_embedding WHERE profile_id != ?
        DB-->>ES: N rows → float[768] corpus
        ES-->>CR: list~list~float~~

        CR->>ML: compute_semantic_uniqueness(coreServices, description, uvp, corpus)
        ML->>ML: _build_text() → encoder.encode() → 768-dim unit vector
        ML->>ML: cosine_distance vs corpus → mean_dist / 0.5 × 100
        ML-->>CR: semanticsScore (float 0–100)

        CR->>ML: compute_category_score(name, coreServices, description, uvp, categories)
        ML->>ML: classifier.predict() → selected category confidence → scale 0–100
        ML-->>CR: categoryScore (float 0–100)

        CR->>CR: overallScore = avg(semanticsScore, categoryScore)
        CR-->>GW: {overallScore, semanticsScore, categoryScore}
        GW-->>USC: Map response
        USC->>USC: map to UniquenessResponse
        USC-->>Client: 200 UniquenessResponse
    end

    rect rgb(255, 248, 230)
        Note over Client,DB: UC-1.2b — Confirm and Persist Uniqueness Score
        Client->>BPC: PUT /api/v1/business-profile (BusinessProfileDto with uniquenessScore)
        BPC->>REPO: save(BusinessProfile entity)
        REPO->>DB: UPSERT tbl_business_profile SET uniqueness_score = ?
        DB-->>REPO: persisted entity
        Note over BPC,DB: Fire-and-forget — refreshes embedding corpus
        BPC--)GW: embedBusinessProfile(Map payload)
        GW->>CR: POST /internal/classification/embed
        CR->>ML: embed_business(coreServices, description, uvp)
        ML->>ML: _build_text() → encoder.encode() → 768-dim vector
        ML-->>CR: float[768]
        CR->>ES: upsert_embedding(profileId, vector)
        ES->>DB: INSERT … ON CONFLICT DO UPDATE tbl_business_embedding
        BPC-->>Client: 200 BusinessProfileDto
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

    tbl_msme_operator ||--o{ tbl_business_profile : "owns"
    tbl_business_profile ||--o| tbl_business_embedding : "corpus for scoring"
```
