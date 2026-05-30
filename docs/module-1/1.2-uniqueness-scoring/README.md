# 1.2 Uniqueness Scoring Dashboard

Transaction 1.2 consumes the validated category allocations produced by Transaction 1.1 and computes the three uniqueness metrics (overall, semantics, category) that quantify how differentiated the MSME's positioning is against the Cebu tourism cohort. The results are rendered in a dedicated dashboard with AI-generated feedback strings and gated behind a "Confirm & Register Profile" action that persists the final score back through Transaction 1.1's save flow.

Companion diagrams:

| File | Contents |
|---|---|
| [`sequence.puml`](sequence.puml) | Compute Uniqueness Score interaction |
| [`class.puml`](class.puml) | Backend DTOs, controller method, gateway service |
| [`er.puml`](er.puml) | `tbl_business_profile` (parent), `tbl_business_embedding` (vector(768) + HNSW), `tbl_business_categories_score` |

---

## User Interface Design

The Uniqueness Scoring Dashboard renders inside the same Calibration view as Transaction 1.1, replacing the analyze panel once the operator clicks **Compute Final Uniqueness Score**. The layout is a three-card grid: a large `OverallScoreCard` (navy border, 0–100) on the left, paired with two `ActionableScoreCard` tiles for the Semantics and Category sub-scores. Each sub-score card hosts the AI-generated feedback string explaining the result. A single `ComputeUniquenessButton` at the top doubles as the action trigger and the loading indicator, and a "Confirm & Register Profile" CTA at the bottom hands control back to Transaction 1.1's persistence flow.

## Front-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| `UniquenessCalibrationView` | Orchestrates the two-phase calibration flow; on this transaction owns the Compute call and `calibrationResult` state. | React view component |
| `CalibrationResultsDashboard` | Displays `overallScore`, `semanticsScore`, `categoryScore` and the two AI feedback strings; hosts the Confirm button. | React module component |
| `OverallScoreCard` | Large overall-score tile (navy border) wrapping `StatTypography`. | React composite |
| `ActionableScoreCard` | Score tile with title, `StatTypography` value, description text, and AI feedback string. | React composite |
| `ComputeUniquenessButton` | Submit CTA; wraps `PrimaryButton` with a Sparkles icon. | React composite |
| `PrimaryButton` | Navy CTA button with `Loader2` spinner during loading state. | React base component |
| `StatTypography` | Large `XX /100` display with configurable colour and size. | React base component |
| `apiClient` | Method `classifyUniqueness`. | Fetch wrapper service |

## Back-End Components

| Component Name | Description & Purpose | Type / Format |
|---|---|---|
| `UniquenessScoringController` | `POST /api/v1/classification/uniqueness` — routes the uniqueness request to the AI gateway and returns the score package. | Spring `@RestController` |
| `AIInferenceGatewayService` | Reactive WebClient bridge to the FastAPI microservice; method `computeUniqueness`. | Spring `@Service` |
| `UniquenessRequest` | DTO record carrying the business payload plus the operator-confirmed category allocations. | Java record |
| `UniquenessResponse` | DTO record carrying `overallScore`, `semanticsScore`, `categoryScore`, `descriptionFeedback`, `categoryFeedback`. | Java record |

### REST endpoint summary

| Method | Path | Controller method | Frontend caller |
|---|---|---|---|
| `POST` | `/api/v1/classification/uniqueness` | `UniquenessScoringController.uniqueness` | `apiClient.classifyUniqueness` (Calibration Phase 2) |

## Processing Logic

1. The operator adjusts the `InferredCategoryBoard` sliders (from Transaction 1.1) until the total reaches 100% and clicks **Compute Final Uniqueness Score**.
2. `UniquenessCalibrationView` invokes `apiClient.classifyUniqueness` with the business payload plus the active categories (only entries where `percentage > 0` are forwarded).
3. The frontend POSTs to `/api/v1/classification/uniqueness`; the controller wraps the map in a `UniquenessRequest` and delegates to `AIInferenceGatewayService.computeUniqueness`.
4. The gateway forwards the request to the FastAPI uniqueness pipeline, which produces `overallScore`, `semanticsScore`, `categoryScore`, and the two AI-generated feedback strings.
5. The controller marshals the result into a `UniquenessResponse` and returns it; `apiClient` exposes it to the view as a `UniquenessResultDTO`.
6. `UniquenessCalibrationView.setCalibrationResult(result)` triggers a re-render of `CalibrationResultsDashboard`, which fans the data out across the `OverallScoreCard` and the two `ActionableScoreCard` tiles.
7. The persisted `uniquenessScore` is written back to `tbl_business_profile.uniqueness_score` when the operator confirms — that persistence step is owned by Transaction 1.1's `saveProfile` call.
