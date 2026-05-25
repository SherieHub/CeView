# Module 1 — Business Profile & Uniqueness Calibration

Reference index for every frontend and backend component in Module 1. Companion diagrams:

| File | Contents |
|---|---|
| [`sequence.mmd`](sequence.mmd) | End-to-end user-flow sequence across all five API interactions |
| [`class.mmd`](class.mmd) | Frontend interfaces + backend classes and their relationships |
| [`er.mmd`](er.mmd) | Database entity-relation diagram for all Module 1 tables |

---

## Frontend Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **View** | `BusinessProfile` | [`ceview/components/views/module-1/BusinessProfile.tsx`](../../ceview/components/views/module-1/BusinessProfile.tsx) | Executive Profile dashboard — identity card, uniqueness-score badge, keyword generation, edit modal (optimistic save), OAuth social hub |
| **View** | `UniquenessCalibrationView` | [`ceview/components/views/module-1/UniquenessCalibrationView.tsx`](../../ceview/components/views/module-1/UniquenessCalibrationView.tsx) | Orchestrates the two-phase calibration flow: Analyze → adjust categories → Compute → Confirm & persist |
| **Module** | `UniquenessCalibrationForm` | [`ceview/components/modules/module-1/UniquenessCalibrationForm.tsx`](../../ceview/components/modules/module-1/UniquenessCalibrationForm.tsx) | Collects `businessName`, `description`, `coreServices`, `uvp`; validates all four present; triggers Analyze |
| **Module** | `InferredCategoryBoard` | [`ceview/components/modules/module-1/InferredCategoryBoard.tsx`](../../ceview/components/modules/module-1/InferredCategoryBoard.tsx) | Renders AI-inferred category allocations as adjustable numeric inputs; validates total = 100 % |
| **Module** | `CalibrationResultsDashboard` | [`ceview/components/modules/module-1/CalibrationResultsDashboard.tsx`](../../ceview/components/modules/module-1/CalibrationResultsDashboard.tsx) | Displays `overallScore`, `semanticsScore`, `categoryScore` and two AI feedback strings; hosts the Confirm button |
| **Composite** | `AdjustableCategoryItem` | [`ceview/components/composites/module-1/AdjustableCategoryItem.tsx`](../../ceview/components/composites/module-1/AdjustableCategoryItem.tsx) | Single category row — label + numeric input clamped 0–100; active state styled navy |
| **Composite** | `ActionableScoreCard` | [`ceview/components/composites/module-1/ActionableScoreCard.tsx`](../../ceview/components/composites/module-1/ActionableScoreCard.tsx) | Score tile with title, `StatTypography` value, description text, and AI feedback string |
| **Composite** | `OverallScoreCard` | [`ceview/components/composites/module-1/OverallScoreCard.tsx`](../../ceview/components/composites/module-1/OverallScoreCard.tsx) | Larger overall-score tile (navy border), renders `StatTypography` |
| **Composite** | `ComputeUniquenessButton` | [`ceview/components/composites/module-1/ComputeUniquenessButton.tsx`](../../ceview/components/composites/module-1/ComputeUniquenessButton.tsx) | Submit CTA; wraps `PrimaryButton` with a Sparkles icon |
| **Composite** | `DynamicListManager` | [`ceview/components/composites/module-1/DynamicListManager.tsx`](../../ceview/components/composites/module-1/DynamicListManager.tsx) | Editable tag list for `coreServices` — Enter or Add button appends; ✕ removes |
| **Composite** | `TextField` | [`ceview/components/composites/module-1/TextField.tsx`](../../ceview/components/composites/module-1/TextField.tsx) | Labelled single-line text input |
| **Composite** | `TextAreaField` | [`ceview/components/composites/module-1/TextAreaField.tsx`](../../ceview/components/composites/module-1/TextAreaField.tsx) | Labelled multi-line textarea with optional guide text |
| **Composite** | `ValidationBanner` | [`ceview/components/composites/module-1/ValidationBanner.tsx`](../../ceview/components/composites/module-1/ValidationBanner.tsx) | Gold warning strip rendered when any required field is empty |
| **Base** | `ActionTag` | [`ceview/components/base/module-1/ActionTag.tsx`](../../ceview/components/base/module-1/ActionTag.tsx) | Toggleable pill tag with optional remove (✕) button |
| **Base** | `PrimaryButton` | [`ceview/components/base/module-1/PrimaryButton.tsx`](../../ceview/components/base/module-1/PrimaryButton.tsx) | Navy CTA button with `Loader2` spinner during loading state |
| **Base** | `StatTypography` | [`ceview/components/base/module-1/StatTypography.tsx`](../../ceview/components/base/module-1/StatTypography.tsx) | Large `XX /100` display with configurable colour and size |
| **Service** | `apiClient` | [`ceview/services/apiClient.ts`](../../ceview/services/apiClient.ts) | Thin fetch wrapper; Module 1 methods: `loadProfile`, `saveProfile`, `classifyAnalyze`, `classifyUniqueness`, `generateKeywords` |
| **Service** | `identity` | [`ceview/services/identity.ts`](../../ceview/services/identity.ts) | Exports `OPERATOR_ID` (reads `VITE_OPERATOR_ID` env; defaults to seeded dev UUID) |
| **State** | `ProfileData` / `ProfileSetters` | [`ceview/App.tsx`](../../ceview/App.tsx) | Global shared state hydrated from backend on mount via `useEffect`; propagated to both views as props |

### Category vocabulary

All components share the single canonical list from [`ceview/constants.ts`](../../ceview/constants.ts) `BUSINESS_CATEGORIES`:

```
Coastal & Island · Adventure & Nature · Cultural & Heritage
Theme Parks / Entertainment · Urban & City · Culinary & Gastronomy · Accommodation & Staycation
```

---

## Backend Components

| Layer | Component | File | Responsibility |
|---|---|---|---|
| **Entity** | `BusinessProfile` | [`backend/.../module1/BusinessProfile.java`](../../backend/spring-boot/src/main/java/com/ceview/module1/BusinessProfile.java) | JPA entity mapped to `tbl_business_profile`; comma-joined `coreServices` and `categories` columns; `@PrePersist`/`@PreUpdate` lifecycle hooks for UUID and timestamps |
| **Repository** | `BusinessProfileRepository` | [`backend/.../module1/BusinessProfileRepository.java`](../../backend/spring-boot/src/main/java/com/ceview/module1/BusinessProfileRepository.java) | `JpaRepository<BusinessProfile, UUID>`; custom method `findFirstByUserId(UUID)` |
| **DTO** | `BusinessProfileDto` | [`backend/.../module1/dto/BusinessProfileDto.java`](../../backend/spring-boot/src/main/java/com/ceview/module1/dto/BusinessProfileDto.java) | Java record; 8 fields mirroring frontend `ProfileData`: `businessProfileId`, `businessName`, `categories`, `coreServices`, `description`, `uvp`, `imagePreview`, `uniquenessScore` |
| **DTO** | `ClassificationDtos` | [`backend/.../module1/dto/ClassificationDtos.java`](../../backend/spring-boot/src/main/java/com/ceview/module1/dto/ClassificationDtos.java) | Nested records: `AnalyzeRequest`, `AnalyzeResponse`, `CategoryAllocation`, `UniquenessRequest`, `UniquenessResponse`, `KeywordRequest` |
| **Controller** | `BusinessProfileController` | [`backend/.../module1/BusinessProfileController.java`](../../backend/spring-boot/src/main/java/com/ceview/module1/BusinessProfileController.java) | `GET /api/v1/business-profile` (load by operatorId), `PUT /api/v1/business-profile` (upsert), `POST /api/v1/business-profile/keywords` |
| **Controller** | `ClassificationController` | [`backend/.../module1/ClassificationController.java`](../../backend/spring-boot/src/main/java/com/ceview/module1/ClassificationController.java) | `POST /api/v1/classification/analyze`, `POST /api/v1/classification/uniqueness` |
| **Service** | `AIInferenceGatewayService` | [`backend/.../ai/AIInferenceGatewayService.java`](../../backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java) | Reactive WebClient bridge to FastAPI microservice; Module 1 methods: `classifyCategories`, `computeUniqueness`, `generateKeywords` |
| **Migration** | `V1__init_schema.sql` | [`backend/.../resources/db/migration/`](../../backend/spring-boot/src/main/resources/db/migration/V1__init_schema.sql) | Full initial schema — all tables for all modules |
| **Migration** | `V2__module1_profile_multi_category.sql` | [`backend/.../resources/db/migration/`](../../backend/spring-boot/src/main/resources/db/migration/V2__module1_profile_multi_category.sql) | Drops `business_type`; renames `finalized_category` → `categories (TEXT)`; reseeds Cebu-tourism category vocabulary; inserts dev operator row for pre-auth FK satisfaction |

### REST endpoint summary

| Method | Path | Controller | Frontend caller |
|---|---|---|---|
| `GET` | `/api/v1/business-profile` | `BusinessProfileController.get` | `apiClient.loadProfile` (App mount) |
| `PUT` | `/api/v1/business-profile` | `BusinessProfileController.save` | `apiClient.saveProfile` (Confirm + Edit save) |
| `POST` | `/api/v1/business-profile/keywords` | `BusinessProfileController.keywords` | `apiClient.generateKeywords` (BusinessProfile) |
| `POST` | `/api/v1/classification/analyze` | `ClassificationController.analyze` | `apiClient.classifyAnalyze` (Calibration Phase 1) |
| `POST` | `/api/v1/classification/uniqueness` | `ClassificationController.uniqueness` | `apiClient.classifyUniqueness` (Calibration Phase 2) |
