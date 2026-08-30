# `UniquenessScoringController`

**Package:** `com.ceview.module1.uniquenessscoring` · **File:**
[`backend/spring-boot/src/main/java/com/ceview/module1/uniquenessscoring/UniquenessScoringController.java`](../../../backend/spring-boot/src/main/java/com/ceview/module1/uniquenessscoring/UniquenessScoringController.java)

## Responsibility

Computes the three uniqueness metrics (overall, semantics, category) against the Cebu MSME
embedding corpus. Backs [Onboarding step 5's "computing" sub-phase](../screens/onboarding-wizard.md#5--analysis-stepsanalysissteptsx).

## Endpoint

| Method | Path | Called by |
|---|---|---|
| `POST` | `/api/classification/uniqueness` | `apiClient.classifyUniqueness` |

## Request / response

`UniquenessRequest` (business payload + operator-confirmed category allocations, `percentage > 0`
entries only) → `UniquenessResponse { overallScore, semanticsScore, categoryScore,
descriptionFeedback, categoryFeedback }`.

## Collaborators

`AIInferenceGatewayService.computeUniqueness` — reactive WebClient bridge to `fastapi-sbert`.

## Persistence

Result is not persisted by this controller — the wizard's finish step writes `uniquenessScore` /
`semanticsScore` / `categoryScore` back through `BusinessProfileController`'s `PUT` (see
[`schema-delta.md`](schema-delta.md) — these three columns exist today, unlike the wizard's other
new fields). See the known gap noted in
[settings-business-profile.md](../screens/settings-business-profile.md) about scores not being
recomputed after a post-onboarding edit.
