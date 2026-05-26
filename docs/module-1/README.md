# Module 1 — Business Classification & Uniqueness Scoring

Module 1 is the onboarding intelligence layer of CeView. It accepts an unstructured tourism business profile from a Cebu MSME operator, classifies it into the seven canonical tourism categories using a fine-tuned SBERT pipeline, computes a uniqueness score against the localized MSME cohort, and persists the validated profile for downstream forecasting and content modules.

Following the structure of the CeView SDD, Module 1 is decoupled into two per-transaction submodules. Each folder is self-contained — UI design, frontend/backend component tables, processing logic, and the three Mermaid diagrams (class, sequence, ER).

| Transaction | Folder | Scope |
|---|---|---|
| **1.1 Business Input and Categorization** | [`1.1-business-input/`](1.1-business-input/) | Form capture, SBERT category classification, profile persistence, SEO keyword generation, identity edit |
| **1.2 Uniqueness Scoring Dashboard** | [`1.2-uniqueness-scoring/`](1.2-uniqueness-scoring/) | Overall / semantics / category score computation and the results dashboard |

---

## Category vocabulary

All Module 1 components share the single canonical list from [`ceview/constants.ts`](../../ceview/constants.ts) `BUSINESS_CATEGORIES`:

```
Coastal & Island · Adventure & Nature · Cultural & Heritage
Theme Parks / Entertainment · Urban & City · Culinary & Gastronomy · Accommodation & Staycation
```

## REST endpoint summary (all transactions)

| Method | Path | Transaction | Frontend caller |
|---|---|---|---|
| `GET` | `/api/v1/business-profile` | 1.1 | `apiClient.loadProfile` |
| `PUT` | `/api/v1/business-profile` | 1.1 | `apiClient.saveProfile` |
| `POST` | `/api/v1/business-profile/keywords` | 1.1 | `apiClient.generateKeywords` |
| `POST` | `/api/v1/classification/analyze` | 1.1 | `apiClient.classifyAnalyze` |
| `POST` | `/api/v1/classification/uniqueness` | 1.2 | `apiClient.classifyUniqueness` |

## Shared backend artefacts

These components are referenced by both transactions and are documented in detail inside the submodule that owns each call site:

- **`AIInferenceGatewayService`** — single reactive WebClient bridge to the FastAPI microservice; exposes `classifyCategories`, `computeUniqueness`, `generateKeywords`.
- **`BusinessProfile` entity + `BusinessProfileRepository`** — persistence target for the confirmed profile, including the `uniqueness_score` column written when Transaction 1.2 results are confirmed via Transaction 1.1's save flow.
- **Flyway migrations `V1__init_schema.sql` and `V2__module1_profile_multi_category.sql`** — initial schema and the multi-category refactor.
