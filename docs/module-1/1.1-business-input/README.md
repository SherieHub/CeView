# 1.1 Business Input and Categorization

Transaction 1.1 is the onboarding entry point for Module 1. It collects the operator's unstructured business profile (name, description, UVP, core services), submits it to the SBERT-backed classifier to obtain a ranked allocation across the seven Cebu tourism categories, persists the confirmed profile, and supports two profile-anchored side flows (SEO keyword generation and identity edit).

Companion diagrams:

| File | Contents |
|---|---|
| [`sequence.mmd`](sequence.mmd) | Five-step flow: profile load · analyze · confirm & save · keywords · edit save |
| [`class.mmd`](class.mmd) | Backend entities, DTOs, controllers, gateway service |
| [`er.mmd`](er.mmd) | `tbl_msme_operator`, `tbl_business_profile`, `tbl_business_category`, `tbl_classification_logs` |

---

## User Interface Design

The Business Input experience spans two surfaces. The **Uniqueness Calibration** page presents a single-column form (`UniquenessCalibrationForm`) collecting business name, description, unique value proposition, and a dynamic list of core services; a `ValidationBanner` enforces all four fields before the **Analyze Business Profile** action becomes enabled. On a successful analyze response, the page swaps in an `InferredCategoryBoard` of numeric sliders whose total must equal 100% before the operator may proceed to Transaction 1.2. The **Business Profile** dashboard exposes the persisted identity card, an edit-modal with optimistic save, and an AI-driven SEO keyword recalibration panel.

## Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| `App` | Holds shared `ProfileData` state; hydrates it from the backend on mount and routes between the two views. | React functional component |
| `BusinessProfile` | Executive profile dashboard — identity card, uniqueness badge, keyword generation, edit modal, OAuth hub. | React view component |
| `UniquenessCalibrationForm` | Collects `businessName`, `description`, `coreServices`, `uvp`; validates all four; triggers Analyze. | React module component |
| `InferredCategoryBoard` | Renders AI-inferred category allocations as numeric inputs; validates the total equals 100%. | React module component |
| `AdjustableCategoryItem` | Single category row — label + numeric input clamped 0–100; navy active state. | React composite |
| `DynamicListManager` | Editable tag list for `coreServices` — Enter or "Add" appends, ✕ removes. | React composite |
| `TextField` | Labelled single-line text input. | React composite |
| `TextAreaField` | Labelled multi-line textarea with optional guide text. | React composite |
| `ValidationBanner` | Gold warning strip rendered when any required field is empty. | React composite |
| `ActionTag` | Toggleable pill tag with optional remove (✕) button. | React base component |
| `apiClient` | Methods `loadProfile`, `saveProfile`, `classifyAnalyze`, `generateKeywords`. | Fetch wrapper service |
| `identity` | Exports `OPERATOR_ID` from `VITE_OPERATOR_ID` (or seeded dev UUID). | Service module |

## Back-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| `BusinessProfileController` | `GET /api/v1/business-profile` (load by operator), `PUT /api/v1/business-profile` (upsert), `POST /api/v1/business-profile/keywords`. | Spring `@RestController` |
| `ClassificationController` | `POST /api/v1/classification/analyze` — routes the analyze request to the AI gateway. | Spring `@RestController` |
| `AIInferenceGatewayService` | Reactive WebClient bridge to the FastAPI microservice; methods `classifyCategories`, `generateKeywords`. | Spring `@Service` |
| `BusinessProfile` (entity) | JPA entity for `tbl_business_profile`; comma-joined `coreServices` and `categories`; `@PrePersist`/`@PreUpdate` hooks. | JPA entity |
| `BusinessProfileRepository` | `JpaRepository<BusinessProfile, UUID>` with custom `findFirstByUserId(UUID)`. | Spring Data repository |
| `BusinessProfileDto` | 8-field Java record mirroring frontend `ProfileData`. | Java record |
| `AnalyzeRequest` / `AnalyzeResponse` / `CategoryAllocationRecord` | DTO records for the analyze contract. | Java records |
| `KeywordRequest` | DTO record for the keyword generation contract. | Java record |
| `V1__init_schema.sql` | Initial schema for all Module 1 tables. | Flyway migration |
| `V2__module1_profile_multi_category.sql` | Drops `business_type`; renames `finalized_category` → `categories (TEXT)`; reseeds category vocabulary; inserts dev operator row. | Flyway migration |

### REST endpoint summary

| Method | Path | Controller method | Frontend caller |
|---|---|---|---|
| `GET` | `/api/v1/business-profile` | `BusinessProfileController.get` | `apiClient.loadProfile` (App mount) |
| `PUT` | `/api/v1/business-profile` | `BusinessProfileController.save` | `apiClient.saveProfile` (Confirm + Edit save) |
| `POST` | `/api/v1/business-profile/keywords` | `BusinessProfileController.keywords` | `apiClient.generateKeywords` (BusinessProfile) |
| `POST` | `/api/v1/classification/analyze` | `ClassificationController.analyze` | `apiClient.classifyAnalyze` (Calibration Phase 1) |

## Processing Logic

1. On `App` mount, `apiClient.loadProfile(OPERATOR_ID)` is invoked; the controller's `findFirstByUserId` returns an existing `BusinessProfileDto` or an empty stub, and all `ProfileData` setters are hydrated.
2. The operator opens the Calibration view and fills the `UniquenessCalibrationForm`. The form validator enforces non-empty `businessName`, `description`, `uvp`, and at least one `coreService` before enabling the Analyze button.
3. On Analyze, the frontend POSTs the payload to `/api/v1/classification/analyze`. The controller hands the map to `AIInferenceGatewayService.classifyCategories`, which forwards to the FastAPI SBERT pipeline and returns `{categories:[{name, percentage}]}`.
4. The view merges the returned allocations with `BASE_CATEGORIES`, sets local `categories[]`, and renders the `InferredCategoryBoard` for manual override.
5. When the operator clicks "Confirm & Register Profile", `apiClient.saveProfile` is called with the full profile snapshot; `BusinessProfileController.save` upserts the entity via `setCategoriesList` / `setCoreServicesList` and returns the persisted DTO (including its assigned `businessProfileId`).
6. The view propagates the persisted `businessProfileId` and other fields back through `ProfileSetters` and navigates to the `profile` tab.
7. On the Business Profile dashboard, "Recalibrate" triggers `apiClient.generateKeywords`, which routes through `BusinessProfileController.keywords` → `AIInferenceGatewayService.generateKeywords` → FastAPI; the returned list rerenders the keyword chip list.
8. The Edit Identity modal performs an optimistic local update, closes immediately, and issues a background `saveProfile`; on failure, a "Changes saved locally. Backend sync failed." banner is displayed.
