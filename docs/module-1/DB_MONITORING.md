# Module 1 — PostgreSQL Database Monitoring

Module 1 owns four tables in the `ceview` database.  
All schema changes are managed by **Flyway** and applied automatically on Spring Boot startup.

| Table | Purpose |
|---|---|
| `tbl_msme_operator` | Registered operator accounts |
| `tbl_business_profile` | Business identity, description, categories, scores |
| `tbl_business_embedding` | 384-dim pgvector embeddings for similarity search |
| `tbl_business_category` | Canonical Cebu tourism category reference (7 rows) |
| `tbl_business_categories_score` | Per-profile category scores from AI classification |
| `tbl_classification_logs` | Audit trail for each classification inference call |

---

## Prerequisites

- Docker Desktop running
- Stack started with `docker compose up` from `backend/`
- PostgreSQL container is named `ceview-postgres` (see `docker-compose.yml`)

---

## 1. Connect via psql (no extra tools needed)

Open an interactive psql session inside the running container:

```bash
docker exec -it ceview-postgres psql -U ceview -d ceview
```

Exit psql at any time with `\q`.

### Useful meta-commands

| Command | What it shows |
|---|---|
| `\dt tbl_*` | List all Module 1 tables |
| `\d tbl_business_profile` | Column types, constraints, indexes |
| `\di idx_*` | All indexes in the database |
| `\x` | Toggle expanded (vertical) output |
| `\timing` | Show query execution time |

---

## 2. Connect via pgAdmin (GUI)

1. Open pgAdmin 4 (install from [pgadmin.org](https://www.pgadmin.org) if needed).
2. **Register Server**:
   - Host: `localhost`
   - Port: `5432`
   - Database: `ceview`
   - Username: `ceview`
   - Password: `ceview`
3. Navigate to **Databases → ceview → Schemas → public → Tables**.

---

## 3. Check Flyway migration status

Flyway records applied migrations in `flyway_schema_history`.

```sql
SELECT version, description, script, success, installed_on
FROM flyway_schema_history
ORDER BY installed_rank;
```

Expected output after a clean startup:

```
 version | description                         | success
---------+-------------------------------------+---------
 1       | init schema                         | t
 2       | module1 profile multi category      | t
 3       | module1 indexes                     | t
```

If any row shows `success = f`, the migration failed — check Spring Boot logs (`docker logs ceview-spring`) for the Flyway error.

---

## 4. Module 1 health queries

Run these inside psql or pgAdmin to verify the data layer is working correctly.

### 4.1 Operator and profile counts

```sql
SELECT
    (SELECT COUNT(*) FROM tbl_msme_operator)       AS total_operators,
    (SELECT COUNT(*) FROM tbl_business_profile)    AS total_profiles,
    (SELECT COUNT(*) FROM tbl_business_profile
     WHERE uniqueness_score IS NOT NULL)            AS profiles_with_score;
```

### 4.2 Profile completeness check

Profiles that are missing key fields (indicates an incomplete save):

```sql
SELECT business_profile_id, business_name, uniqueness_score, updated_at
FROM tbl_business_profile
WHERE business_description IS NULL
   OR uvp IS NULL
   OR categories IS NULL
ORDER BY updated_at DESC;
```

### 4.3 Category reference data

Confirms the seven canonical Cebu categories are seeded:

```sql
SELECT category_name, category_description
FROM tbl_business_category
ORDER BY category_name;
```

Expected: 7 rows — Accommodation & Staycation, Adventure & Nature, Coastal & Island, Cultural & Heritage, Culinary & Gastronomy, Theme Parks / Entertainment, Urban & City.

### 4.4 Category score coverage

Shows how many profiles have AI-derived scores and their spread:

```sql
SELECT
    COUNT(*)                                            AS scored_profiles,
    ROUND(AVG(coastal_island)::NUMERIC, 2)             AS avg_coastal,
    ROUND(AVG(adventure)::NUMERIC, 2)                  AS avg_adventure,
    ROUND(AVG(cultural)::NUMERIC, 2)                   AS avg_cultural,
    ROUND(AVG(culinary)::NUMERIC, 2)                   AS avg_culinary
FROM tbl_business_categories_score;
```

### 4.5 Embedding coverage

Profiles that have a stored vector embedding vs. those that do not:

```sql
SELECT
    p.business_profile_id,
    p.business_name,
    CASE WHEN e.embedding_id IS NULL THEN 'missing' ELSE 'present' END AS embedding_status
FROM tbl_business_profile p
LEFT JOIN tbl_business_embedding e USING (business_profile_id)
ORDER BY p.updated_at DESC;
```

### 4.6 Classification log health

Recent inference calls with their outcome:

```sql
SELECT
    l.log_id,
    p.business_name,
    l.inference_status,
    l.confidence_score,
    l.execution_time,
    l.error_message
FROM tbl_classification_logs l
JOIN tbl_business_profile p USING (business_profile_id)
ORDER BY l.execution_time DESC
LIMIT 20;
```

`inference_status` values to watch for:
- `SUCCESS` — normal
- `FALLBACK` — AI was disabled, hardcoded result used
- `ERROR` — Gemini or gateway failure; `error_message` has the detail

### 4.7 Recent profile activity

Last 10 updated profiles (useful after a test run):

```sql
SELECT business_profile_id, business_name, uniqueness_score, updated_at
FROM tbl_business_profile
ORDER BY updated_at DESC
LIMIT 10;
```

---

## 5. Index verification

Confirm all Module 1 indexes were applied by V3:

```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

Expected indexes:

| Index | Table |
|---|---|
| `idx_bpro_user_id` | `tbl_business_profile` |
| `idx_bpro_updated_at` | `tbl_business_profile` |
| `idx_bemb_profile_id` | `tbl_business_embedding` |
| `idx_bcat_score_profile_id` | `tbl_business_categories_score` |
| `idx_clf_log_profile_id` | `tbl_classification_logs` |
| `idx_clf_log_status` | `tbl_classification_logs` |

---

## 6. pgvector — check the extension

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

One row should be returned. If empty, the `pgvector/pgvector:pg16` image was not used and `CREATE EXTENSION vector` in V1 silently failed — the container image must be changed.

To inspect a stored embedding (first 5 dimensions):

```sql
SELECT
    business_profile_id,
    embedding_model_version,
    (embedding_vector::text)::varchar(80) AS vector_preview,
    generated_at
FROM tbl_business_embedding
LIMIT 5;
```

---

## 7. Reset dev data (development only)

To wipe all profiles while keeping operators and reference data:

```sql
-- Cascades to embedding, scores, logs automatically
DELETE FROM tbl_business_profile
WHERE user_id != '00000000-0000-0000-0000-000000000001';
```

To reset everything and re-run from scratch:

```bash
# Stop the stack, drop the named volume, restart — Flyway re-runs all migrations
docker compose down -v
docker compose up
```

> **Warning:** `-v` deletes all persisted data. Only use in development.

---

## 8. Live tail — Spring Boot DB logs

When `ddl-auto: validate` is active, Hibernate logs a `SchemaManagementException` on mismatch between the entity and the live table.  
To watch for these:

```bash
docker logs -f ceview-spring 2>&1 | grep -iE "schema|flyway|hibernate|error"
```

To watch only Flyway output during startup:

```bash
docker logs ceview-spring 2>&1 | grep -i flyway
```
