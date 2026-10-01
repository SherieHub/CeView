# CeView — Business Rules Derived from the Schema

This document is generated **from the Flyway migrations alone**
(`backend/spring-boot/src/main/resources/db/migration/V1`–`V25`), not from
application code, DTOs, or frontend types. Anything asserted here is a rule
the database itself encodes — via a `CHECK`, `UNIQUE`/`PK` constraint,
`FOREIGN KEY`, `NOT NULL`, `DEFAULT`, or a migration comment describing why a
column exists. Rules that only live in Java/Python (validation, canned
enums, request-time checks) are out of scope; where the schema *contradicts*
what current code apparently assumes, that's flagged as a note, not fixed
here.

Table/column names are exactly as they appear in SQL.

---

## 1. Tenancy & Identity

- **`tbl_msme_operator`** is the tenant root. `operator_id` is the PK;
  `email` is globally `UNIQUE`. `password_hash` and `contact_number` are
  nullable — an operator can exist without a password (Google-only login,
  see below) or without a phone number.
- **Google sign-in** (V19): `google_uid` is nullable but carries a
  `UNIQUE` index (`ux_msme_operator_google_uid`) — at most one operator per
  Google account, and an operator may have no linked Google account at all
  (email/password-only signup remains valid).
- The migration comment on V19 states a deliberate rule: **profile
  completeness and auth provider are not stored as separate flags** — they
  must always be *derived* (`contact_number IS NOT NULL` /
  `google_uid IS NOT NULL`) so they can't drift from the columns they
  describe. Any future column that duplicates that state would violate this
  rule.
- Almost every domain table hangs off **`tbl_business_profile`** via
  `business_profile_id UUID REFERENCES ... ON DELETE CASCADE`. **Deleting a
  business profile deletes essentially all of that operator's data** —
  embeddings, category scores, classification logs, market signals,
  forecasts, market scores, demand alerts, content, creative direction,
  promotional assets, and campaign records all cascade. `tbl_msme_operator`
  → `tbl_business_profile` is likewise `ON DELETE CASCADE`: deleting an
  operator deletes their business profile(s) and, transitively, everything
  above.
- `tbl_market_score` → `tbl_demand_alert` is also cascade: deleting a market
  score deletes its alerts. `tbl_forecast_result` → `tbl_market_score` is
  cascade too, so deleting a forecast deletes its scores and, transitively,
  its alerts.
- The one exception to hard-cascade is
  `tbl_compliance_revision_history.original_eval_id`, which was
  `ON DELETE SET NULL` (V6) — a revision record was designed to survive the
  deletion of the evaluation it revised. (Both compliance tables were later
  dropped entirely in V16 — see §6.)

## 2. Module 1 — Business Profile & Uniqueness

- A business profile has **at most one embedding row** in
  `tbl_business_embedding`: V12 adds
  `UNIQUE (business_profile_id)` (`uq_biz_emb_profile`) specifically so the
  upsert path has something to conflict on. Embeddings are 768-dimensional
  vectors (resized up from 384 in V12 to match the `multilingual-e5-base`
  encoder) with an HNSW cosine-distance index for nearest-neighbor search —
  this is the backing store for the "uniqueness vs. cohort" comparison.
- **`categories`** on `tbl_business_profile` (renamed from
  `finalized_category` in V2, widened to `TEXT`) is documented as
  comma-joined — the schema supports multiple categories per business, and
  V21's backfill logic (`split_part(categories, ',', 1)`) treats the first
  entry as primary when only one category is needed.
- `business_type` was **dropped outright** in V2 — it's not part of the
  business-profile shape at all going forward.
- `tbl_business_category` is a **catalog table**: `category_name` is
  `UNIQUE`. V2 fully replaced the original 6-category seed with a 7-category
  Cebu-tourism vocabulary (Coastal & Island, Adventure & Nature, Cultural &
  Heritage, Theme Parks / Entertainment, Urban & City, Culinary &
  Gastronomy, Accommodation & Staycation) — this is the closed vocabulary
  the classification model and frontend are expected to share.
- `tbl_business_categories_score` carries exactly the 7 category columns
  above as fixed, named `NUMERIC` fields (not a generic key/value table) —
  the schema assumes classification always scores against this fixed set of
  7 categories, not an open list.
- `tbl_classification_logs.inference_status` and
  `tbl_classification_logs.confidence_score` are free-form
  (`VARCHAR`/`FLOAT`, no `CHECK`) — the schema does not itself constrain
  status values (e.g. to `SUCCESS`/`FAILED`); that vocabulary is only
  evidenced by the seed data (`'SUCCESS'`) and enforced, if at all, in code.

## 3. Module 2 — Market Signals & Forecasting

- **Only three target markets are structurally enforced** anywhere in the
  schema: `tbl_market_economic_trend` has
  `CHECK (market IN ('korea', 'japan', 'usa'))` (V11). No other table with a
  `target_market`/`market` column (`tbl_market_signal_record`,
  `tbl_forecast_result`, `tbl_trend_fetch_job`, …) carries this constraint —
  so the three-market universe is a real rule for economic-trend data, but
  only a convention (not DB-enforced) everywhere else.
- **`tbl_trend_fetch_job`** is a per-(category, market, week) job ledger:
  `UNIQUE (category, market, week_of)` means **at most one fetch job per
  category/market/ISO-week** — retries update the same row rather than
  creating new ones. `status` is constrained to exactly
  `PENDING | IN_PROGRESS | SUCCESS | FAILED` (`chk_trend_fetch_status`), with
  `attempt_count` counted against `max_attempts` (both default-backed:
  `0` and `3`) — the documented lifecycle is
  `PENDING → IN_PROGRESS → SUCCESS`, or `→ FAILED` with the attempt counter
  incremented and retried on a later scheduler run.
- **Signal provenance is tracked and semantically graded** (V22/V23):
  `tbl_market_signal_record.source` is `NOT NULL DEFAULT 'unknown'`, with a
  documented three-way trust ordering:
  - `'pytrends'` = genuinely measured — trustworthy.
  - `'stub'` = synthetic — **purged entirely** by V23 (both the signal rows
    and anything forecast/scored from them were deleted, cascade-first:
    `tbl_market_score` → `tbl_forecast_result` → `tbl_market_signal_record`).
    A `'stub'` row is not a value the current schema expects to still exist;
    any that reappear should be distrusted the same as before the purge.
  - `'unknown'` = pre-V22 backfill value, explicitly **never deleted**
    (V23's comment: "may well be real, and deleting unclassifiable history
    is a worse default than declining to rely on it") but also explicitly
    **never trusted** by readers — it sits in a permanent no-man's-land
    unless something re-attributes it.
- **Category dimension**: `category` on `tbl_market_signal_record` and
  `tbl_forecast_result` (V20) is nullable, and NULL is a defined meaning —
  "applies to all of the profile's categories" — not an unknown/missing
  value. V21 backfilled pre-V20 rows from the profile's first category.
- **Rolling-average duplication is intentional, not redundant**: V8 adds
  `rolling_average_7d` / `rolling_average_30d` / `yoy_ratio` alongside the
  pre-existing `rolling_average`, and the migration comment says to keep the
  legacy column for backward compatibility while steering new code to the
  `_7d` variant — i.e. two overlapping "rolling average" columns coexist by
  design, not by accident.
- **`yoy_ratio`** (year-over-year ratio) is documented as
  `rolling_7d_avg_now / rolling_7d_avg_52_weeks_prior`, and is **NULL by
  rule** whenever fewer than 59 weeks of signal history exist for that
  series — a NULL here does not mean "not computed," it means
  "insufficient history."
- **Uniqueness-per-day for signals is an application rule, not a DB
  constraint** — V7's comment says as much explicitly: "Uniqueness per
  calendar day is enforced at the application layer," and no `UNIQUE`
  constraint exists on `(business_profile_id, target_market, aggregated_at)`
  or similar. The schema permits multiple signal rows per profile/market
  per day even though the app is not supposed to write them.
- **`tbl_demand_alert.window_open_date`** (V7) and `is_read`/`trend` are
  alert-specific fields — `is_read` defaults `FALSE` (unread by default),
  and every alert is generated from a `market_score_id`, never directly from
  a signal or forecast — an alert without a market score cannot exist
  (`NOT NULL`-equivalent via FK cascade chain, since `market_score_id`
  references `tbl_market_score` and cascades on delete).
- **`weekly_forecasts_json`** (V13) is populated **only for `horizon=4`
  rows** — a 12-week array of weekly demand floats keyed to the 4-week
  forecast, not every forecast row; other-horizon rows are expected to leave
  it NULL and callers are expected to fall back to the scalar demand value.

## 4. Module 3 — Content, Creative Direction, Compliance

- **Compliance persistence was removed entirely** (V16): the
  `tbl_compliance_evaluation_result` and `tbl_compliance_revision_history`
  tables from V5/V6/V9 are dropped. The current rule is that compliance
  auditing is **stateless** — nothing about a compliance run is expected to
  be persisted or queryable historically anymore. Any code path that still
  reads/writes these tables is referencing tables that no longer exist.
- **`tbl_localized_promotional_content.platform`** carries **no `CHECK`
  constraint or enum at the schema level** (confirmed explicitly by V25's
  comment) — the set of valid platforms is not a database rule, it's purely
  an application-layer convention. V25 deleted all `platform = 'naver'`
  rows as a one-time data cleanup (because that content was hardcoded, not
  model-generated) but did not, and structurally could not, prevent a future
  `'naver'` row from being inserted again — nothing in the schema blocks it.
- **`source`** columns (on `tbl_localized_promotional_content` and the
  now-dropped compliance table) are plain `VARCHAR(40)`, not enums — the
  schema does not restrict what "source" values are legal. Note: V18's seed
  data populates `source = 'gemini'` for every promotional-content row,
  which is schema-legal but worth flagging as a fact about the data present
  in a freshly-migrated database, independent of whatever the current
  application-layer contract allows.
- **`approval_status`** on `tbl_localized_promotional_content` and
  `tbl_creative_direction_output` defaults `FALSE` — content and creative
  direction are **unapproved by default** and require an explicit action to
  flip.
- `tbl_promotional_asset.asset_type` / `upload_status` are unconstrained
  strings; the seed data's only observed values are `'video'`/`'image'` and
  `'processed'`/`'uploaded'` respectively, but nothing in the schema commits
  to that being the complete set.

## 5. Module 4 — Campaign Analytics

- **`tbl_campaign_records`** raw-input columns
  (`impressions`, `clicks`, `ad_spend`, `revenue`, `conversions`,
  `bookings`, `new_customers`) are all `NOT NULL DEFAULT 0` — a campaign
  record can always be inserted with zeroes and is never left with a null
  count for these fields. Derived KPI columns (`ctr`, `cpc`, `conv_rate`,
  `roas`, `cac`) and the PES result (`pes_score`, `pes_label`) are
  deliberately nullable — the table's own comment documents a **three-stage
  fill lifecycle**: (1) raw insert, (2) KPI computation update, (3) PES
  computation update (FastAPI or a rule-based fallback) — so a row with
  NULL KPIs/PES is a normal, valid mid-lifecycle state, not corrupt data.
- **`pes_label`** is a free-text `VARCHAR(50)`, not an enum, but is
  documented as one of exactly four values:
  `Poor | Fair | Good | Excellent Performance` (note the asymmetric naming
  — three bare words vs. one two-word label — reproduced verbatim from the
  migration comment and matched by the seed data literally).
- `tbl_campaign_records.business_profile_id` (V14.1) is **nullable** —
  added after the base table existed, explicitly not backfilled at
  migration time. A campaign record with no owning operator is a
  structurally valid (if degenerate) row.
- Partial index `idx_campaign_records_pes_score ... WHERE pes_score IS NOT
  NULL` encodes the expectation that dashboard/tier queries only ever care
  about campaigns that have reached PES-computed state — rows still mid
  Stage 1/2 are excluded from that index by design.
- The seed data's inline KPI/PES formulas (V15 comment block) are the only
  place in the schema layer where the actual computation is spelled out:
  - `CTR = clicks / impressions × 100`
  - `CPC = ad_spend / clicks`
  - `conv_rate = bookings / clicks × 100`
  - `roas = revenue / ad_spend`
  - `cac = ad_spend / new_customers`
  - `PES = 0.35·clamp01(roas/8) + 0.30·clamp01(conv_rate/15) + 0.15·(1 − clamp01((cac−1)/4999)) + 0.15·clamp01(ctr/10) + 0.05·(1 − clamp01((cpc−0.01)/499.99))`
  - Label thresholds: `≥0.80` Excellent, `≥0.60` Good, `≥0.40` Fair, else
    Poor.
  These are reproduced here as documented facts about how the seed data was
  derived, not verified against current service code.
- **`prescriptive_reports`** (V1) stores `recommendations` and
  `other_areas_improve` as **newline-joined text**, not normalized rows or
  JSON — the schema commits to a flat multi-line string for these fields.
  (This table predates and is independent of `tbl_campaign_records`/V14; it
  hangs off the older `campaign_metrics` → `campaign_data` chain from V1,
  which V14's per-operator model does not reference.)

## 6. Structural Cleanups Worth Knowing About

- **V1's original Module 4 chain** (`campaign_data` → `campaign_metrics` →
  `prescriptive_reports`) and **V14's `tbl_campaign_records`** are two
  parallel, unrelated schemas for campaign data — nothing links them by FK.
  A reader of the schema alone cannot assume `campaign_data` was superseded
  by `tbl_campaign_records`; both tables still exist independently as of
  V25.
- **Compliance persistence existed for three migrations (V5, V6, V9) before
  being dropped in V16** — the schema's own history shows a real reversal:
  CAS/VAS/HCS sub-scores and a revision-history audit trail were built out
  in detail, then removed when the compliance flow became stateless.
- **Trend-fetch data quality is graded in three explicit tiers**
  (pytrends/stub/unknown, §3) and enforced by *deletion* (V23) rather than
  a constraint — the schema cannot stop a future stub row from being
  written again; it only recorded a one-time purge.
