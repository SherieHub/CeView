# Module 1 — Business Classification & Uniqueness Scoring

Module 1 is CeView's onboarding intelligence layer. It accepts an unstructured tourism business
profile from a Cebu MSME operator, classifies it into the seven canonical tourism categories using a
fine-tuned SBERT pipeline, computes a uniqueness score against the localized MSME cohort, and
persists the validated profile for downstream forecasting and content modules.

## Category vocabulary

All Module 1 components share the single canonical list from
[`ceview/constants.ts`](../../ceview/constants.ts) `BUSINESS_CATEGORIES`:

```
Coastal & Island · Adventure & Nature · Cultural & Heritage
Theme Parks / Entertainment · Urban & City · Culinary & Gastronomy · Accommodation & Staycation
```

## Screens

| Screen | Route | Doc |
|---|---|---|
| Onboarding Wizard | `/onboarding` | [`screens/onboarding-wizard.md`](screens/onboarding-wizard.md) |
| Settings → Business Profile | `/settings/profile` | [`screens/settings-business-profile.md`](screens/settings-business-profile.md) |

## Backend

| Component | Doc |
|---|---|
| `BusinessProfileController` | [`backend/BusinessProfileController.md`](backend/BusinessProfileController.md) |
| `ClassificationAnalyzeController` | [`backend/ClassificationAnalyzeController.md`](backend/ClassificationAnalyzeController.md) |
| `UniquenessScoringController` | [`backend/UniquenessScoringController.md`](backend/UniquenessScoringController.md) |
| Schema delta (fields the new wizard needs) | [`backend/schema-delta.md`](backend/schema-delta.md) |

Shared services, entities, and Flyway migrations (`AIInferenceGatewayService`, `BusinessProfile`
entity/repository, `V1__init_schema.sql`, `V2__module1_profile_multi_category.sql`) are documented in
depth in the transaction subfolders below and referenced from the backend docs above.

## Diagrams and algorithm detail

- [`1.1-business-input/`](1.1-business-input/) — classification transaction diagrams (sequence,
  class, ER) and reusable frontend components (`InferredCategoryBoard`, `DynamicListManager`, etc.)
- [`1.2-uniqueness-scoring/`](1.2-uniqueness-scoring/) — uniqueness scoring transaction diagrams and
  score-display components (`OverallScoreCard`, `ActionableScoreCard`, `StatTypography`)
- [`MODULE1_SYSTEM_DOCUMENTATION.md`](MODULE1_SYSTEM_DOCUMENTATION.md) — cross-cutting narrative:
  embedding pipeline, scoring formulas, failure/fallback behavior
- [`DB_MONITORING.md`](DB_MONITORING.md) — operational monitoring queries

## Changed in the UI/UX overhaul

Source of truth: [`ui-ux-prototype.html`](../../ui-ux-prototype.html). Full rationale and card-by-card
build plan: [`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md).

- `BusinessProfile.tsx` and `UniquenessCalibrationView.tsx` are no longer standalone sidebar screens.
  They are replaced by the [Onboarding Wizard](screens/onboarding-wizard.md) (first run only) and
  [Settings → Business Profile](screens/settings-business-profile.md) (permanent edit surface). Their
  sub-components (`InferredCategoryBoard`, `OverallScoreCard`, etc.) are reused, not rewritten.
- The wizard collects several fields (`slogan`, `industry`, `vibes`, `website`, `logo`, `socials`)
  that don't exist in the schema today — see [`backend/schema-delta.md`](backend/schema-delta.md).
- A known gap carried over from the prototype: Settings → Business Profile's Save does not
  recompute the uniqueness score after an edit. See
  [settings-business-profile.md](screens/settings-business-profile.md) for the two resolution options.
