# Module 1 — Component Tables

---

## 1.1 Business Input and Categorization

The operator is presented with the BusinessProfile dashboard — a verified identity card displaying the business name, a uniqueness score badge, and a row of platform OAuth connection hubs; clicking the edit icon opens a full-screen modal containing labelled input fields for business name, description, core services, UVP, and a cover image uploader. After saving, the UniquenessCalibrationForm appears below the dashboard with a multi-field form and an "Analyze Profile" button that, once clicked, reveals the InferredCategoryBoard — a scrollable panel of AdjustableCategoryItem rows each showing a category name and an AI-inferred confidence percentage bar. The operator toggles categories on or off using the add/remove icon buttons on each row, and a gold ValidationBanner appears at the top of the form if any required field is still empty before they can proceed.

### Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| BusinessProfile | Main profile dashboard — displays the verified business identity card, uniqueness score badge, and platform OAuth connection hubs. Manages an edit modal that collects business name, categories, core services, description, UVP, and cover image. Routes to UniquenessCalibrationView on "Analyze" action. | React view component |
| UniquenessCalibrationForm | Two-stage analysis form embedded inside BusinessProfile. Collects businessName, description, coreServices, and UVP; triggers (1) classifyAnalyze to infer categories, then (2) classifyUniqueness to compute scores. Shows skeleton loaders during API calls. | React module component |
| InferredCategoryBoard | Renders AI-inferred category allocations with confidence percentages sorted by prediction strength. Separates selected categories from addable ones; enforces a minimum of 1 selected category before the user may proceed. | React module component |
| AdjustableCategoryItem | Single category row — label plus percentage display; toggles between selected and addable states via add/remove icon buttons. Navy active state. | React composite |
| DynamicListManager | Editable tag list for coreServices — Enter key or "Add" button appends a new item; × button removes an item. | React composite |
| TextField | Labelled single-line text input with consistent styling. | React composite |
| TextAreaField | Labelled multi-line textarea with word-count validation feedback. Renders in red below the minimum word threshold; turns green when the requirement is met. | React composite |
| ValidationBanner | Gold warning strip rendered when any required form field is empty. Accepts a custom error message array or falls back to a default "all fields required" message. | React composite |
| ActionTag | Toggleable pill tag with an optional remove (×) button. Used to display selected service items and category pills throughout the profile editor. | React base component |

### Back-End Components — Spring Boot

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| BusinessProfileController | Exposes `GET /api/v1/business-profile` to retrieve the operator's saved profile and `PUT /api/v1/business-profile` to upsert it. On save, calls AIInferenceGatewayService.embedBusinessProfile() fire-and-forget to keep the uniqueness corpus current. | Spring @RestController |
| ClassificationAnalyzeController | Exposes `POST /api/v1/classification/analyze` — builds the classify payload from the request body, delegates to AIInferenceGatewayService.classifyCategories(), and returns an AnalyzeResponse containing the full list of CategoryAllocation records. | Spring @RestController |
| BusinessProfile | JPA entity for `tbl_business_profile`. Stores businessName, businessDescription, uvp, imageUrl, coreServices (comma-joined string), categories (comma-joined string), confidenceScore, and uniquenessScore. Provides coreServicesList() and categoriesList() convenience methods. | JPA entity |
| BusinessProfileRepository | `JpaRepository<BusinessProfile, UUID>` with custom `findFirstByUserId(UUID)` to retrieve an operator's profile record. | Spring Data repository |
| BusinessProfileDto | 8-field Java record mirroring frontend ProfileData: businessProfileId, businessName, categories, coreServices, description, uvp, imagePreview, uniquenessScore. Used for round-trip serialization. | Java record |
| AnalyzeDtos | Container class for three nested records: AnalyzeRequest (businessName, coreServices, description, uvp), CategoryAllocation (name, percentage), and AnalyzeResponse (categories: List\<CategoryAllocation\>). | Java records |
| AIInferenceGatewayService | Reactive WebClient bridge to fastapi-sbert (port 8000) and fastapi-transformer (port 8001). Module 1.1 methods: classifyCategories() — POST to `/internal/classification/analyze`; embedBusinessProfile() — POST to `/internal/classification/embed` (async, fire-and-forget). | Spring @Service |

### Back-End Components — FastAPI (fastapi-sbert)

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| classification.py | FastAPI router mounted at `/internal/classification`. Exposes `POST /analyze` — accepts businessName, coreServices, description, uvp; delegates to ml_classifier.predict_all() and returns all 7 category allocations with percentages. Exposes `POST /embed` — generates a 768-dim E5 embedding for a business profile and persists it via embedding_store. | FastAPI router |
| ml_classifier.py | Core ML classification engine. Uses intfloat/multilingual-e5-base (E5 encoder) and a Keras classifier head (Dense 256 → 128 → 7, sigmoid output) to infer 7 tourism business categories. Public functions: predict_all(), predict_top3(), embed_business(). Falls back to ml_stubs when models are unavailable. | ML service |
| BertModel.py | Singleton managing ML model lifecycle. Loads the E5 SentenceTransformer and Keras classifier head at import time. Applies thread limiters (OMP_NUM_THREADS=1) to prevent PyTorch/TensorFlow deadlock. Returns None gracefully on load failure. | Model singleton |
| embedding_store.py | Thin psycopg2 wrapper for `tbl_business_embedding` (pgvector). Exposes upsert_embedding(profile_id, vector) — INSERT OR UPDATE a 768-dim vector — and fetch_others(exclude_profile_id) — SELECT all corpus vectors except the caller's own. Degrades gracefully when DATABASE_URL is unset. | DB service |

---

## 1.2 Uniqueness Scoring Dashboard

The operator sees the UniquenessCalibrationView, which opens in a two-stage layout: the top half is the UniquenessCalibrationForm (business details + a previously inferred InferredCategoryBoard), and the bottom half shows the CalibrationResultsDashboard in an "Awaiting Calibration" placeholder state with a greyed-out ComputeUniquenessButton. After selecting at least one category and clicking Compute Uniqueness, a loading spinner replaces the button while scores are computed, then the CalibrationResultsDashboard activates — displaying a large OverallScoreCard at the top with a prominent numeric score, and two smaller ActionableScoreCards below it showing the semanticsScore (how distinct the business description is) and the categoryScore (AI confidence on chosen categories), each with a colour-coded accent border. A navy "Confirm & Register Profile" button sits at the bottom of the dashboard, and clicking it saves the uniqueness score to the profile and navigates the operator to the main profile view.

### Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| UniquenessCalibrationView | Container view for the uniqueness scoring workflow. Manages state for form input, API calls to classifyAnalyze and classifyUniqueness, category toggle selections, and calibration results. Orchestrates the two-stage analysis flow and persists the confirmed profile via saveProfile. | React view component |
| CalibrationResultsDashboard | Results panel displayed after uniqueness computation completes. Renders the OverallScoreCard and two ActionableScoreCard instances (semantics, category). Shows an "Awaiting Calibration" placeholder before computation. Contains the "Confirm & Register Profile" button that triggers the final profile save. | React module component |
| OverallScoreCard | Displays the overall uniqueness score (0–100) in a prominent card layout. Delegates the number rendering to StatTypography. | React composite |
| ActionableScoreCard | Generic score card showing a title, a 0–100 score value, a description string, and a customizable accent color for the border and text. Used for semanticsScore and categoryScore breakdowns. | React composite |
| StatTypography | Reusable score display component. Renders a large numeric value alongside a "/100" subscript in a consistent typographic style. | React base component |
| ComputeUniquenessButton | Dedicated trigger button for the uniqueness computation step. Validates required form state before calling the API and shows an inline loading spinner during the request. | React base component |

### Back-End Components — Spring Boot

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| UniquenessScoringController | Exposes `POST /api/v1/classification/uniqueness` — accepts UniquenessRequest, builds the payload map, delegates to AIInferenceGatewayService.computeUniqueness(), and returns a UniquenessResponse containing overallScore, semanticsScore, categoryScore, and optional descriptionFeedback and categoryFeedback strings. | Spring @RestController |
| UniquenessDtos | Container class for two nested records: UniquenessRequest (businessProfileId, businessName, categories, coreServices, description, uvp) and UniquenessResponse (overallScore, semanticsScore, categoryScore, descriptionFeedback, categoryFeedback). | Java records |
| AIInferenceGatewayService | Reactive WebClient bridge to fastapi-sbert (port 8000). Module 1.2 method: computeUniqueness() — POST to `/internal/classification/uniqueness` with the full business profile payload. | Spring @Service |

### Back-End Components — FastAPI (fastapi-sbert)

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| classification.py | FastAPI router. Exposes `POST /uniqueness` — computes (1) semanticsScore via E5 cosine distance against all stored business corpus embeddings (returns 100 when corpus has fewer than 3 entries), (2) categoryScore via model confidence on the operator's chosen categories, and (3) overallScore as the average of both components. | FastAPI router |
| ml_classifier.py | Exposes compute_semantic_uniqueness() — scores business uniqueness by computing E5 cosine distance against the stored corpus — and compute_category_score() — scores classifier confidence on the operator's explicitly selected categories. | ML service |
| embedding_store.py | psycopg2 wrapper for `tbl_business_embedding` (pgvector). Exposes fetch_others(exclude_profile_id) to retrieve all stored corpus embeddings used in semantic uniqueness comparison. | DB service |
