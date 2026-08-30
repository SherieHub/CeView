# `ClassificationAnalyzeController`

**Package:** `com.ceview.module1.businessinput` · **File:**
[`backend/spring-boot/src/main/java/com/ceview/module1/businessinput/ClassificationAnalyzeController.java`](../../../backend/spring-boot/src/main/java/com/ceview/module1/businessinput/ClassificationAnalyzeController.java)

## Responsibility

Routes the operator's description + UVP + core services to the SBERT classifier and returns a
percentage allocation across the seven tourism categories. Backs
[Onboarding step 5's "analyzing" sub-phase](../screens/onboarding-wizard.md#5--analysis-stepsanalysissteptsx).

## Endpoint

| Method | Path | Called by |
|---|---|---|
| `POST` | `/api/classification/analyze` | `apiClient.classifyAnalyze` |

## Request / response

`AnalyzeRequest` (business payload) → `AnalyzeResponse { categories: CategoryAllocation[] }`, one
allocation per category with a `percentage` summing to 100.

## Collaborators

`AIInferenceGatewayService.classifyCategories` — reactive WebClient bridge to `fastapi-sbert`.

## Failure modes

See [`MODULE1_SYSTEM_DOCUMENTATION.md`](../MODULE1_SYSTEM_DOCUMENTATION.md) for the FastAPI-side
classifier failure/fallback behavior.
