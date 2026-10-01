# Mock data generator

Fills the local Postgres with synthetic Cebu tourism MSMEs across **every** table, so
Module 1 uniqueness scoring has a real comparison corpus instead of returning its
empty-corpus default.

## Why this exists

`tbl_business_embedding` was empty. `compute_semantic_uniqueness()` returns `None` when
the corpus holds fewer than 3 other profiles, and the caller substitutes `100.0`
([`classification.py:52-58`](../../backend/fastapi-sbert/app/routers/classification.py)).
So onboarding always showed **Description Strength 100** — not a measurement, just the
"nothing to compare against" fallback. Overall uniqueness was then
`round((category + 100) / 2)`, inflating every score.

Nothing writes embeddings except a live `PUT /api/business-profile`, and no seed migration
creates them, so a fresh database could never score uniqueness meaningfully.

## Usage

Requires the Docker stack up (`cd backend && docker-compose up`).

```bash
# 1. Relational rows (runs on the host against localhost:5433)
python scripts/mock-data/seed_mock_data.py --count 120

# 2. Embeddings — MUST run in the container, where the E5 model lives
docker cp scripts/mock-data/generate_embeddings.py ceview-fastapi:/tmp/
docker exec ceview-fastapi python /tmp/generate_embeddings.py
```

Both steps are **idempotent** — re-running inserts nothing new. To start over:

```bash
python scripts/mock-data/seed_mock_data.py --count 120 --purge
```

`--purge` deletes only mock rows (identified by their `uuid5` namespace); the 9 seeded
demo operators from `V2` are untouched.

## Files

| File | Role |
|---|---|
| `corpus.py` | Deterministic synthesis of N businesses from 16 semantic archetypes |
| `seed_mock_data.py` | Inserts all relational rows (host → localhost:5433) |
| `generate_embeddings.py` | Encodes profiles to 768-dim E5 vectors (in-container) |

## What gets created (at `--count 120`)

120 operators + profiles, each with a full downstream footprint across all four modules:
category scores, classification logs, 12 weeks of market signals, forecasts, market
scores, demand alerts, weekly demand values, localized content, creative direction,
assets, 8 weeks of campaign records, and the legacy Module 4 tables. Roughly 6,000 rows.

**Login:** every mock operator uses the password `MoalboalDive2024!` (the BCrypt hash is
lifted verbatim from `V2` so no bcrypt dependency is needed). Emails are
`<first>.<last><NNN>@ceview.mock`.

## Design decisions worth knowing

**Embeddings must be real.** `generate_embeddings.py` imports the application's own
`ml_classifier._build_text` and encoder rather than reimplementing them, so stored vectors
are identical to what a real profile save produces. Random vectors would sit at mean cosine
distance ≈ 1.0 and pin every score at 100 — the exact bug this fixes, with extra steps.

**Two-layer semantic spread.** The corpus is built from 16 archetypes (a lechon house and a
dive shop share no vocabulary) with town/service variation inside each. A corpus of clones
collapses distances to zero; unrelated noise pushes them to 1.0. Neither is testable.

**Campaign KPIs are internally consistent.** `compute_kpis()` and `compute_pes()` mirror
`MetricsCalculationService.compute()` and `PESComputationService.compute()` exactly,
including the intermediate rounding Java applies before PES. Stored `pes_score` /
`pes_label` therefore match what the API recomputes.

**Market signals are marked `source='pytrends'`.** Readers treat `'unknown'` as untrusted
(see `V22`/`V23`), so `'unknown'` rows would be invisible to the last-known-good read path.

**Not a Flyway migration.** This is dev tooling, not schema. 129 × 768 floats is ~1 MB of
vector literals, it needs the E5 model at write time, and the `db/h2` mirror stores vectors
as `VARCHAR(8000)` — a real 768-float literal (~8.4 KB) would overflow it.

## Results

Before: every profile scored `semanticsScore = 100`.

After (129-profile corpus, measured across all profiles):

```
n=129  min=29.0  max=39.0  mean=33.6  median=33.5  stdev=1.9
pinned at 100: 0

lowest:  29.0  Cebu City Street Food Crawl      (generic city food tour)
highest: 39.0  Alegria Falls Adventure Co.      (distinctive canyoneering)
```

Live endpoint check for the seeded Moalboal dive operator:

```json
{"overallScore":43,"semanticsScore":35,"categoryScore":50}
```

### A calibration caveat

Scores cluster in a narrow 29–39 band. That is the scoring function, not the data: the
score is `min(mean_distance / 0.5, 1.0) × 100`, and Cebu tourism text shares so much
vocabulary that real mean cosine distances land around 0.10–0.40 — a fact
[`MODULE1_SYSTEM_DOCUMENTATION.md:164-165`](../../docs/module-1/MODULE1_SYSTEM_DOCUMENTATION.md)
documents explicitly. With a populated corpus, the `0.5` threshold means a genuinely
distinctive business tops out near 40 rather than approaching 100.

The *ranking* is sound — generic city tours sort to the bottom, distinctive operators to the
top, and near-duplicates land adjacent. The absolute values are compressed. If uniqueness is
meant to read as a 0–100 scale to operators, the threshold likely needs recalibrating against
this corpus. That is a product decision, not something this script should silently paper over.
