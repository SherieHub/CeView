# Classification run history

`tbl_classification_run` stores one row for each successful hosted classification returned through Spring Boot. A fresh request creates a fresh `run_id`; previous predictions are never overwritten. Flyway V57 creates the table in PostgreSQL and the local H2 schema.

## Stored evidence

- Authenticated `operator_id`, optional `business_profile_id`, `created_at`, and `run_purpose` (`ANALYZE` or `UNIQUENESS`). Unsaved onboarding drafts have an operator but no profile yet.
- Exact submitted `input_description`, `input_uvp`, and JSON services array, preserving ordering and whitespace. The hosted request joins services with `, `.
- Highest raw score (`top_category`, `top_confidence`), the hosted model's predicted category names and raw scores (`predicted_categories`), and all seven raw scores plus `OUT_OF_SCOPE` when supplied (`category_scores`). These are independent probabilities, not a distribution normalized to sum to one.
- `recommended_categories`: the initially selected onboarding categories, currently the two highest positive display allocations. This is separate from the hosted model's predictions because the adapter and UI apply selection rules.
- `model_version`, configured with `MODEL_VERSION`, defaulting to `JamJamzz/ceview_sbert:v1.0.0`. Update the identifier whenever the deployed checkpoint, classifier head, or preprocessing changes. This operator-managed label does not automatically detect a remote Space revision.
- `inference_latency_ms`: elapsed time around hosted client creation and prediction, including networking and queueing. It does not claim to measure model-only compute time.
- Nullable `final_categories`, `confirmed_at`, and `is_overridden`. User selections are feedback, not independently verified ground truth.

## Request lifecycle

1. FastAPI returns existing display allocations plus internal `inference` metadata, preserving raw precision. Missing full scores or invalid probabilities fail explicitly rather than fabricating missing values.
2. Spring Boot resolves the operator from authentication, persists the run, and returns `{ categories, runId }` from `POST /api/classification/analyze`. A persistence failure fails the request; tracking is not a background best-effort write.
3. Onboarding holds the run ID with its draft and sends `classificationRunId` to `PUT /api/business-profile` when the operator finishes.
4. Spring Boot locks that operator's run, checks the exact description, UVP, services and profile association, and commits profile and confirmation atomically. A different operator gets 404; changed inputs or changed previously confirmed feedback get 409. Identical confirmation retries preserve the original timestamp.
5. `is_overridden` compares sets: any change from the initially selected category set is an override. Before confirmation it remains NULL, never false. Later edits without a run ID do not rewrite historical feedback. Older clients may omit the ID, but their saves cannot be attributed to a prediction.

The uniqueness endpoint also calls the classifier for its category score. Spring Boot records that separate run with purpose `UNIQUENESS`; it remains unconfirmed because the operator reviewed the original `ANALYZE` run. Empty selected categories skip that classifier call and create no run. The local E5 embedding itself is not a category prediction and is not logged in this table.

Only successful responses reaching Spring Boot are recorded. Failed, cancelled, or transport-lost attempts are not durable inference audit records. An abandoned successful analysis remains stored without confirmation.

## Deployment and inspection

Deploy FastAPI and Spring Boot together, then the frontend. Both Compose configurations pass `MODEL_VERSION` to FastAPI. Restart the service after changing it. Spring Boot applies the new migration on startup; no existing profile table columns change.

Use operator-scoped queries when inspecting inputs and feedback. For example, bind the authenticated operator UUID as `:operator_id`:

```sql
SELECT run_id, created_at, model_version, top_category, top_confidence,
       inference_latency_ms, final_categories, is_overridden
FROM tbl_classification_run
WHERE operator_id = :operator_id AND run_purpose = 'ANALYZE'
ORDER BY created_at DESC;
```

Calculate override rates using confirmed `ANALYZE` rows only. Do not count NULL feedback as acceptance or report user agreement as independently validated model accuracy. See the [administrator performance endpoint](model-performance.md) for protected aggregate reporting.
