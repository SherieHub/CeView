# Module 1: System Documentation

---

## User Flows & Interaction (The Frontend)

As of the UI/UX overhaul, Module 1's frontend flow is a first-run **Onboarding Wizard**
(`/onboarding`, five gated steps ending in this module's analyze → uniqueness round-trip) followed by
a permanent **Settings → Business Profile** edit surface. Full screen-level detail — layout, state
shape, validation gates, and API call sequencing — lives in:

- [`screens/onboarding-wizard.md`](screens/onboarding-wizard.md)
- [`screens/settings-business-profile.md`](screens/settings-business-profile.md)

The request lifecycles, algorithms, and API contracts below are unchanged by the overhaul — only the
screens that call them moved. `BusinessProfile.tsx` and `UniquenessCalibrationView.tsx` (described in
prior revisions of this document) are retired as standalone routes; their behavior is redistributed
into the two screens above, and their sub-components are reused unchanged.

---

## System Workflow & Sequence (The Bridge)

All Module 1 requests flow from the React frontend through the Spring Boot orchestrator (port `8080`) which delegates AI inference to the FastAPI SBERT microservice (port `8000`). Spring Boot is the sole writer to PostgreSQL for profile data; FastAPI has direct DB access only for embedding persistence via `psycopg2`.

---

### Request Lifecycle 1 — Load Profile on App Boot

1. React `useEffect` fires `GET /api/v1/business-profile?operatorId={UUID}`.
2. `BusinessProfileController.get()` calls `repo.findFirstByUserId(operatorId)` (JPA query on `tbl_business_profile WHERE user_id = ?`).
3. If found: entity mapped to `BusinessProfileDto` via `toDto()`, returned `200 OK`. If not found: `emptyDto()` returned (null score, empty strings, empty lists) — no `404`.
4. React distributes all fields to global state setters — every module now has profile context.

---

### Request Lifecycle 2 — Save Profile (`PUT /api/v1/business-profile`)

1. Frontend sends `BusinessProfileDto` JSON body with `operatorId` as query param.
2. `JwtAuthenticationFilter` inspects `Authorization: Bearer <token>`. Currently all `/api/v1/**` routes are `permitAll()` (scaffolding pass), so anonymous requests pass through with an anonymous security context.
3. `TraceIdFilter` generates or propagates an `X-Trace-Id` UUID into `MDC` for log correlation across all three services.
4. `BusinessProfileController.save()`:
   - If `businessProfileId` is present: attempts `repo.findById()` to load the existing entity.
   - If not found or null: creates `new BusinessProfile()` — `@PrePersist` auto-assigns a UUID.
   - Sets all scalar fields; serializes `categories` and `coreServices` as comma-joined `TEXT` strings via helper methods (`setCategoriesList`, `setCoreServicesList`).
   - `repo.save(p)` persists to `tbl_business_profile`; `@PreUpdate` stamps `updated_at`.
5. **Fire-and-forget embed**: Spring Boot immediately invokes `ai.embedBusinessProfile(payload)` → FastAPI `POST /internal/classification/embed`. Wrapped in `try/catch` — a warning is logged if FastAPI is unavailable but the main HTTP response is **not** blocked.
6. Returns the saved `BusinessProfileDto` (includes server-generated `businessProfileId` on first save).

---

### Request Lifecycle 3 — Classification Analyze (`POST /api/v1/classification/analyze`)

1. Frontend posts `{ businessName, coreServices[], description, uvp }`.
2. `ClassificationAnalyzeController.analyze()` wraps fields in a `HashMap<String, Object>`.
3. `AIInferenceGatewayService.classifyCategories()` → `postSbert("/internal/classification/analyze", payload)`.
4. Spring `WebClient` posts synchronously (blocking with `block(timeout)`, 30 s limit), forwarding the `X-Trace-Id` header.
5. FastAPI runs the SBERT + Keras pipeline, returns `{ "categories": [{name, percentage}, …] }`.
6. Spring unpacks the `List<Map<String, Object>>` raw response, maps to `CategoryAllocation` records.
7. `AnalyzeResponse(List<CategoryAllocation>)` returned as `200 OK`.

---

### Request Lifecycle 4 — Uniqueness Compute (`POST /api/v1/classification/uniqueness`)

1. Frontend posts `{ businessProfileId, businessName, categories[], coreServices[], description, uvp }`.
2. `UniquenessScoringController.uniqueness()` packages all fields into a `HashMap` and calls `ai.computeUniqueness()`.
3. FastAPI `/internal/classification/uniqueness` runs two AI computations in sequence (see Engine section).
4. FastAPI returns `{ overallScore, semanticsScore, categoryScore }`.
5. Spring extracts integer scores + feedback strings → `UniquenessResponse` returned.

---

### Error Propagation Pattern

If FastAPI returns `4xx`/`5xx`, `AIInferenceGatewayService.post()` reads the raw response body as a `String` (to tolerate both `application/json` and `text/plain`), extracts `"code"` and `"message"` fields via substring search, then throws a `ResponseStatusException` with the same HTTP status. Spring's `ApiExceptionHandler` wraps this into the standardised `{ code, message, traceId }` JSON shape, which the frontend `ApiError` class reads and surfaces to `<ServerErrorBanner>`.

---

## Background Processing & Algorithmic Logic (The Engine)

### Model Loading & Startup

FastAPI's `lifespan` context manager eagerly loads both models before `/healthz` can return `200 OK`, preventing cold-start `503` errors on the first real request.

The `_BertModel` singleton (`app/core/BertModel.py`) uses a class-level `_instance` guard:

- **Encoder**: `intfloat/multilingual-e5-base` loaded via `SentenceTransformer` — produces **768-dimensional embeddings**; multilingual to handle Filipino-English mixed descriptions.
- **Classifier Head**: `complete_classifier_head.keras` loaded via `tf.keras.models.load_model` — a `Dense(256) → Dense(128) → Dense(7, activation='sigmoid')` network trained on top of frozen E5 features; each output neuron corresponds to one of the 7 tourism categories.
- **Thread limiters** (`OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `TF_NUM_INTEROP_THREADS=1`, `TF_NUM_INTRAOP_THREADS=1`) are declared **before any import** of `sentence_transformers` or `tensorflow` to prevent PyTorch and TensorFlow from deadlocking when co-loaded in the same process.
- If either model fails to load, `_instance` is set to `None` — all three public inference functions automatically fall back to `ml_stubs.py`.

---

### Algorithm A — `predict_all()` — Category Classification

Called by `POST /internal/classification/analyze`. Implements the PDF §"AI Business Classification Model" and §"Normalization Process":

```
Input text construction (training-time format):
  text = "services: {comma-joined services}\nuvp: {uvp_text}\ndescription: {description_text}"

Step 1 — Embed:
  vector (1, 768) = encoder.encode([text])

Step 2 — Classify:
  raw_probs (7,) = keras_classifier.predict(vector, verbose=0)[0]
  # sigmoid activations, each in [0.0, 1.0]

Step 3 — Normalize (PDF §"Normalization Process"):
  sort indices by probability descending
  total = sum(all 7 probabilities)   → ensures percentages sum to exactly 100

  for rank, (idx, prob) in enumerate(sorted pairs):
    if rank < 6:
      pct = round(prob / total × 100)
    else:
      pct = max(0, remainder)        → last category absorbs rounding error

Output:
  [{"name": CATEGORY_LABELS[idx], "percentage": pct}, ...] × 7
  # All 7 returned in descending confidence order
```

The 7 labels in `CATEGORY_LABELS` exactly match `BUSINESS_CATEGORIES` in `ceview/constants.ts`, ensuring the frontend can render every response without remapping.

---

### Algorithm B — `compute_semantic_uniqueness()` — Semantic Score

Implements PDF §"Semantic Uniqueness Score" via cosine distance in embedding space:

```
Step 1 — Fetch corpus from DB:
  other_embeddings = embedding_store.fetch_others(businessProfileId)
  → SQL: SELECT embedding_vector::text
         FROM tbl_business_embedding
         WHERE embedding_vector IS NOT NULL
           AND business_profile_id != <exclude_id>::uuid

Step 2 — Corpus size guard:
  IF len(other_embeddings) < 3:
    return None                         → caller assigns score = 100.0
    # Fewer than 3 businesses in DB → trivially unique; no meaningful comparison possible

Step 3 — Encode current business:
  current_emb (768,) = encoder.encode([text], normalize_embeddings=True)
  # normalize_embeddings=True → L2 unit vector; dot product == cosine similarity

Step 4 — Re-normalise corpus and compute similarities:
  other_matrix (n, 768)  = array of stored vectors
  # Re-normalise for safety (stored as normalised but precision may drift)
  other_matrix           = other_matrix / ||other_matrix||  (row-wise L2 norm)
  similarities (n,)      = other_matrix @ current_emb       → values in [-1.0, 1.0]
  similarities           = clamp(similarities, -1.0, 1.0)

Step 5 — Convert to distance:
  distances (n,) = 1.0 − similarities                       → values in [0.0, 2.0]
  mean_dist      = mean(distances)

Step 6 — Score (domain-calibrated for Philippine tourism):
  score = min(mean_dist / 0.5, 1.0) × 100
  # Threshold 0.5: a mean distance ≥ 0.5 maps to maximum score 100
  # Calibrated for Cebu tourism text, where shared vocabulary (beach, resort,
  # tropical, eco) compresses typical distances into the 0.10–0.40 range.
```

> **Implementation Note vs. PDF**: The PDF §"Categorical Uniqueness Score" additionally describes a market-average comparison step — `weight = |CategoryOutput − 100|` per category, multiplied by the database average for that category, summed across all 7. This step is **not yet implemented** in the current codebase. It is a planned enhancement, likely awaiting a `market_average` data table to be populated from production usage.

---

### Algorithm C — `compute_category_score()` — Category Confidence Score

```
Step 1 — Predict all 7 sigmoid probabilities (identical pipeline to predict_all)

Step 2 — Isolate selected categories:
  selected_indices = [i for i, label in enumerate(CATEGORY_LABELS)
                      if label in user_selected_categories]

Step 3 — Compute proportional model confidence:
  selected_sum  = sum(raw_probs[selected_indices])
  max_possible  = min(len(selected_categories), 7) / 7.0
  score         = clamp(selected_sum / max(max_possible, 0.01) × 100, 0, 100)

# High score = the model independently predicts the same categories the operator chose.
# Low score = the operator's self-identification diverges from the AI's reading.
```

---

### Algorithm D — Overall Uniqueness Composition

```
overall = round((category_score + semantic_score) / 2)
```

> **Design vs. Implementation Divergence**: The PDF §"Final Overall Uniqueness Score" specifies `OverallScore = (0.4 × Semantic) + (0.6 × Categorical)`, intentionally weighting categorical uniqueness higher because tourism classification is central to CeView's market positioning. The current code uses a **50 % / 50 % average**. The weighted formula represents the target state once the market-average categorical computation (Algorithm B note above) is implemented.

---

### Algorithm E — `embed_business()` + Corpus Maintenance

Triggered asynchronously by Spring Boot after every successful profile save:

```
Step 1 — Encode:
  text   = _build_text(core_services, uvp, description)
  vector (768,) = encoder.encode([text], normalize_embeddings=True)
  → Returns list[float] of 768 values (L2-normalised unit vector)

Step 2 — Persist via embedding_store.upsert_embedding():
  vec_str = "[f1.00000000, f2.00000000, ..., f768.00000000]"   # 8-decimal precision string

  INSERT INTO tbl_business_embedding
    (embedding_id, business_profile_id, embedding_vector, embedding_model_version)
  VALUES (uuid, profile_id, '<vec_str>'::vector, 'intfloat/multilingual-e5-base')
  ON CONFLICT (business_profile_id)
  DO UPDATE SET
    embedding_vector        = EXCLUDED.embedding_vector,
    embedding_model_version = EXCLUDED.embedding_model_version,
    generated_at            = NOW()
```

The `ON CONFLICT … DO UPDATE` clause uses the `uq_biz_emb_profile` unique constraint (added in migration `V12`) so re-saving an existing profile refreshes the vector in place rather than creating a duplicate. The HNSW index (`idx_biz_emb_cosine`, `vector_cosine_ops`) on `embedding_vector` enables sub-linear approximate nearest-neighbour searches as the corpus scales.

---

### Stub Fallback Behaviour (`ml_stubs.py`)

When `_BertModel.get()` returns `None` (model files absent or load failure), every inference function silently falls back to `ml_stubs.py`. The stub uses `hashlib.md5` of the concatenated input to produce a **deterministic pseudo-random** distribution — the frontend receives stable, reproducible values across reloads without requiring the actual models in local development environments.

---

## API & Integration Contracts

### Spring Boot Public Endpoints (consumed by React frontend)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/business-profile` | `permitAll` | Load operator profile by `operatorId` |
| `PUT` | `/api/v1/business-profile` | `permitAll` | Upsert operator profile; triggers embed |
| `POST` | `/api/v1/classification/analyze` | `permitAll` | AI category classification (all 7) |
| `POST` | `/api/v1/classification/uniqueness` | `permitAll` | Uniqueness score computation |

> All routes are currently `permitAll()` as a scaffolding pass. JWT enforcement against `tbl_msme_operator` is the planned next state. The `operatorId` query parameter is a placeholder for the claim that will come from the JWT subject.

---

#### `GET /api/v1/business-profile?operatorId={UUID}`

**Response** `200 OK`:
```json
{
  "businessProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "businessName": "Sunset Cove Beach Resort",
  "categories": ["Coastal & Island", "Adventure & Nature"],
  "coreServices": ["Scuba Diving", "Island Hopping", "Spa"],
  "description": "A serene beachfront property in Moalboal...",
  "uvp": "The only eco-resort in the area with a certified marine biologist...",
  "imagePreview": "data:image/jpeg;base64,...",
  "uniquenessScore": 74.0
}
```
Returns the same shape with empty strings and `null` scores when no profile exists for the given `operatorId` — no `404` is thrown.

---

#### `PUT /api/v1/business-profile?operatorId={UUID}`

**Request body** (mirrors `BusinessProfileDto`):
```json
{
  "businessProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "businessName": "Sunset Cove Beach Resort",
  "categories": ["Coastal & Island"],
  "coreServices": ["Scuba Diving", "Snorkeling"],
  "description": "Full description text (minimum 50 words enforced by UI)...",
  "uvp": "Value proposition text (minimum 30 words enforced by UI)...",
  "imagePreview": null,
  "uniquenessScore": 74.0
}
```

**Response** `200 OK`: Same `BusinessProfileDto` shape with server-generated `businessProfileId` (UUID auto-assigned by `@PrePersist` on first save).

**Side effect**: Spring Boot fires `POST /internal/classification/embed` to FastAPI (non-blocking, failure non-fatal — a `WARN` log is emitted with `MOD1_EMBED_STORE_FAIL` code).

---

#### `POST /api/v1/classification/analyze`

**Request**:
```json
{
  "businessName": "Sunset Cove Beach Resort",
  "coreServices": ["Scuba Diving", "Island Hopping"],
  "description": "A serene beachfront property in Moalboal offering direct access to the sardine run...",
  "uvp": "We are the only eco-resort in the area with a certified on-site marine biologist..."
}
```

**Response** `200 OK`:
```json
{
  "categories": [
    { "name": "Coastal & Island",            "percentage": 42 },
    { "name": "Adventure & Nature",          "percentage": 28 },
    { "name": "Accommodation & Staycation",  "percentage": 12 },
    { "name": "Culinary & Gastronomy",       "percentage": 8  },
    { "name": "Cultural & Heritage",         "percentage": 5  },
    { "name": "Urban & City",                "percentage": 3  },
    { "name": "Theme Parks / Entertainment", "percentage": 2  }
  ]
}
```
Always returns all 7 categories. Percentages sum to exactly 100 (last category absorbs rounding remainder).

---

#### `POST /api/v1/classification/uniqueness`

**Request**:
```json
{
  "businessProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "businessName": "Sunset Cove Beach Resort",
  "categories": ["Coastal & Island", "Adventure & Nature"],
  "coreServices": ["Scuba Diving", "Island Hopping"],
  "description": "A serene beachfront property...",
  "uvp": "We are the only eco-resort..."
}
```
The `businessProfileId` is passed so FastAPI can exclude the caller's own stored embedding from the corpus — preventing a business from being compared against itself and artificially lowering its score.

**Response** `200 OK`:
```json
{
  "overallScore": 74,
  "semanticsScore": 81,
  "categoryScore": 67,
  "descriptionFeedback": "",
  "categoryFeedback": ""
}
```
`semanticsScore` returns `100` when the corpus holds fewer than 3 stored profiles (trivially unique — no meaningful comparison set).

---

### FastAPI SBERT Internal Endpoints (consumed by Spring Boot only)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/internal/classification/analyze` | SBERT + Keras category prediction |
| `POST` | `/internal/classification/uniqueness` | Semantic + category uniqueness computation |
| `POST` | `/internal/classification/embed` | Generate + persist 768-dim E5 vector |
| `GET` | `/healthz` | Liveness probe (blocks until models are loaded) |

**`POST /internal/classification/embed`**:
```json
// Request
{
  "businessProfileId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "coreServices": ["Scuba Diving"],
  "description": "...",
  "uvp": "..."
}

// Response
{ "stored": true }    // or { "stored": false } when E5 model unavailable
```

---

### Unified Error Contract

Spring Boot normalises all upstream errors into:
```json
{
  "code": "FASTAPI_ERROR",
  "message": "Human-readable reason from FastAPI body",
  "traceId": "a1b2c3d4-e5f6-..."
}
```
The frontend `ApiError` class (`ceview/services/apiClient.ts`) reads `code` and `traceId`, surfacing them in `<ServerErrorBanner>`. The `X-Trace-Id` UUID is propagated through every hop — React → Spring Boot → FastAPI — via `TraceIdFilter` (Spring) and `TraceIdMiddleware` (FastAPI), enabling end-to-end log correlation by a single ID.

---

### Database Schema — Module 1 Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `tbl_msme_operator` | `operator_id UUID PK`, `email UNIQUE` | Auth / operator identity; FK target for `user_id` |
| `tbl_business_profile` | `business_profile_id UUID PK`, `user_id FK`, `categories TEXT`, `core_services TEXT`, `uniqueness_score FLOAT` | Core profile store; `categories` and `core_services` are comma-joined strings (portable across H2 + Postgres) |
| `tbl_business_embedding` | `embedding_id UUID PK`, `business_profile_id FK UNIQUE`, `embedding_vector vector(768)`, `embedding_model_version VARCHAR(60)` | Vector corpus for semantic uniqueness comparison; `UNIQUE (business_profile_id)` ensures upsert safety |
| `tbl_business_category` | `category_id UUID PK`, `category_name VARCHAR UNIQUE` | Seed reference for the 7 canonical Cebu tourism categories |
| `tbl_business_categories_score` | `business_profile_id FK`, `coastal_island NUMERIC`, … ×7 | Per-category score storage (one column per category) |
| `tbl_classification_logs` | `log_id UUID PK`, `inference_status`, `confidence_score`, `error_message` | Inference audit trail |

**Key migration milestones:**
- **V1** `init_schema.sql` — creates all tables; initial `embedding_vector vector(384)`.
- **V2** `module1_profile_multi_category.sql` — renames `finalized_category → categories`; seeds the 7 Cebu-tourism categories; inserts dev operator placeholder `00000000-...-0001`.
- **V3** `module1_indexes.sql` — adds query-path indexes.
- **V12** `module1_embedding_768.sql` — drops 384-dim column, adds `vector(768)`; creates HNSW index `idx_biz_emb_cosine` (`vector_cosine_ops`); adds `UNIQUE (business_profile_id)` constraint for upsert semantics.

---

## Technology Stack & Infrastructure

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend framework** | React 18 + TypeScript, Vite | Component-based SPA with strict type safety; Vite's HMR accelerates development iteration |
| **Styling** | Tailwind CSS utility classes + `COLORS` token object from `constants.ts` | Centralised brand palette prevents design drift; all module components reference the same token set |
| **Icon system** | Lucide React | Consistent SVG icon library with tree-shaking; zero runtime dependency |
| **HTTP client (frontend)** | Native `fetch` + thin `apiClient.ts` wrapper | Zero-dependency; `ApiError` class surfaces structured `code` + `traceId` for UX-level error messaging |
| **Spring Boot** | Java 21, Spring Boot 3.x | Type-safe ORM + DI, Flyway schema management, unified security filter chain, production-grade ecosystem |
| **Security** | Spring Security + `JwtAuthenticationFilter` | Stateless JWT architecture compatible with the microservice topology; currently `permitAll()` for scaffolding — `operatorId` will migrate to JWT subject claim |
| **ORM + migrations** | Spring Data JPA + Hibernate, Flyway | JPA reduces boilerplate; Flyway makes schema evolution auditable and reversible |
| **Reactive HTTP client** | Spring WebFlux `WebClient` | Non-blocking I/O toward FastAPI; configurable per-endpoint timeouts (30 s default); correct error body deserialization for both `application/json` and `text/plain` FastAPI responses |
| **FastAPI** | Python 3.12+, Pydantic v2, Uvicorn | High-throughput ASGI inference server; Pydantic v2 enforces strict type validation at the service boundary |
| **ML embedding** | `intfloat/multilingual-e5-base` via `sentence-transformers` | 768-dim multilingual model handles Filipino-English mixed business descriptions; instruction-tuned for semantic retrieval tasks; same embedding space used for both classification and corpus comparison |
| **ML classifier** | TensorFlow-CPU / Keras (`complete_classifier_head.keras`) | Lightweight `Dense(256→128→7, sigmoid)` head trained atop frozen E5 features; CPU-only eliminates GPU dependency in Docker deployment |
| **Numerical computation** | NumPy | Vectorised cosine similarity matrix operations (`other_matrix @ current_emb`) for uniqueness corpus comparison; `np.clip` and `np.linalg.norm` ensure numerical stability |
| **Database** | PostgreSQL 16 + `pgvector` extension | Native `vector(768)` column type; HNSW index (`vector_cosine_ops`) enables sub-linear ANN search as the business corpus grows |
| **Embedding persistence** | `psycopg2-binary` (direct DB from FastAPI) | FastAPI writes embeddings directly to `tbl_business_embedding` without routing through Spring Boot — avoids an unnecessary internal HTTP hop for a write-only operation |
| **Schema migrations** | Flyway (`classpath:db/migration`) | V1–V12 versioned chain; V12 is the critical embedding resize migration (384 → 768 dims + HNSW index) |
| **Containerisation** | Docker Compose | `spring-boot` (8080), `fastapi-sbert` (8000), `fastapi-transformer` (8001), `postgres` wired as named services with health checks |
| **Observability** | SLF4J + MDC trace correlation, Logback (`logback-spring.xml`), structured log codes (`MOD1_ML_INFERENCE_FAIL`, `MOD1_EMBED_STORE_FAIL`, etc.) | Every log line from every service carries the same `X-Trace-Id`, enabling single-query end-to-end request reconstruction in any log aggregator |
