# Slice 1a — Module 2: Restore the (category, market) Dimension

**Depends on:** [`01-foundation.md`](01-foundation.md) Tasks 1–6.
**Blocks:** [`02-module-2.md`](02-module-2.md) Tasks 7, 11, 12.

## Why this file exists

It was added mid-execution, after validating the live backend against the plan's
assumptions. The original Slice 1 assumed demand alerts carried a `category`. They do not,
and `useDashboardState` filters the feed with `profile.categories.includes(a.category)` —
so against real data the dashboard would render **an empty feed**.

## The actual finding

`ARCHITECTURE_SPEC.md` describes Module 2 as a `(category, market)` signal grid. The
schema half-implements it:

| Table | Key | Category? |
|---|---|---|
| `tbl_trend_fetch_job` | `(category, market, week_of)` | **yes** |
| `tbl_market_signal_record` | `(business_profile_id, target_market)` | **no — collapsed here** |
| `tbl_forecast_result` | `(business_profile_id, target_market)` | no |
| `tbl_market_score` | FK → `forecast_result_id` | no |
| `tbl_demand_alert` | FK → `market_score_id` | no |

> **Corrected during execution (Task 1a.1 finding).** An earlier draft of this file claimed
> the dimension "exists at ingestion and is collapsed at aggregation." That is wrong in
> mechanism. There are **two disconnected pipelines**:
>
> - `TrendFetchSchedulerService` populates `tbl_trend_fetch_job` per `(category, market)`
>   — 21 combinations weekly.
> - `MarketDataIngestionService.ingestMarket(profile, market)` separately calls
>   `ai.fetchTrends(Map.of("market", market, "categories", <ALL of the profile's
>   categories>))` in **one** request, yielding a `trend_index` already blended across
>   every category, and persists one `MarketSignalRecord` per `(profile, market)`.
>
> `MarketSignalRecord` never reads `tbl_trend_fetch_job`. So there is no collapse to stop —
> the per-category data is collected weekly and consumed by nothing.
>
> **Decision:** fetch trends per category (Task 1a.2 below), rather than rewiring ingestion
> to consume `tbl_trend_fetch_job`. This produces genuine per-category values at the cost of
> multiplying `fetchTrends` and downstream forecast calls by the profile's category count.

## Bonus finding: `yoyRatio`

`tbl_trend_fetch_job.yoy_ratio` and `tbl_market_signal_record.yoy_ratio` both exist, and
`yoyRatio` is passed into `GeminiForecastRequest` as an input — it is simply never
persisted onto `tbl_forecast_result`/`tbl_market_score` and never surfaced in `MarketDto`.

This supersedes [`00-index.md`](00-index.md) §Open decisions 2 and spec §Risks 1, both of
which recorded `yoyRatio` as having no producer. **It has one.** Task 1a.2 persists it, and
[`02-module-2.md`](02-module-2.md) Task 10 should surface it as a real `Double` rather than
always-null.

---

## Task 1a.1: Carry category into `tbl_market_signal_record`

**Files:**
- Create: `src/main/resources/db/migration/V20__module2_category_dimension.sql`
- Modify: `src/main/java/com/ceview/module2/submodule21/MarketSignalRecord.java`
- Modify: `src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java`
- Test: `src/test/java/com/ceview/module2/submodule21/CategoryDimensionTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CategoryDimensionTest {

    @Test
    void signalRecordCarriesTheCategoryItWasIngestedUnder() {
        MarketSignalRecord rec = new MarketSignalRecord();
        rec.setTargetMarket("korea");
        rec.setCategory("Coastal & Island");

        assertThat(rec.getCategory()).isEqualTo("Coastal & Island");
        assertThat(rec.getTargetMarket()).isEqualTo("korea");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=CategoryDimensionTest
```

Expected: compilation failure — no `setCategory`.

- [ ] **Step 3: Write the migration**

Create `V20__module2_category_dimension.sql`:

```sql
-- V20 — Restore the (category, market) dimension through the Module 2 chain.
--
-- tbl_trend_fetch_job already fetches per (category, market); the dimension was
-- being collapsed at aggregation into tbl_market_signal_record. These columns
-- stop that collapse so demand alerts can be attributed to the category whose
-- signal produced them (ARCHITECTURE_SPEC §Module 2 signal grid).
--
-- Nullable, because pre-V20 rows have no category and must keep resolving.
-- Readers treat NULL as "applies to all of the profile's categories".

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- yoy_ratio is computed during ingestion and passed to the forecaster as an
-- input, but was never persisted downstream — so MarketDto could not surface it.
ALTER TABLE tbl_forecast_result
    ADD COLUMN IF NOT EXISTS yoy_ratio DOUBLE PRECISION;

ALTER TABLE tbl_market_score
    ADD COLUMN IF NOT EXISTS yoy_ratio DOUBLE PRECISION;

-- The grid's natural lookup: "this profile's signal for this category+market".
CREATE INDEX IF NOT EXISTS idx_msr_profile_category_market
    ON tbl_market_signal_record (business_profile_id, category, target_market);

CREATE INDEX IF NOT EXISTS idx_fr_profile_category_market
    ON tbl_forecast_result (business_profile_id, category, target_market);
```

**Do not** add an H2 mirror — `db/h2/` is explicitly out of scope and unmaintained
(spec §Environment).

- [ ] **Step 4: Add the entity fields**

In `MarketSignalRecord.java`:

```java
@Column(name = "category") private String category;
```

Plus getter and setter, matching the file's existing accessor style.

In `submodule22/ForecastResult.java`:

```java
@Column(name = "category")  private String category;
@Column(name = "yoy_ratio") private Double yoyRatio;
```

In `submodule22/MarketScore.java`:

```java
@Column(name = "yoy_ratio") private Double yoyRatio;
```

- [ ] **Step 5: Stop collapsing category during ingestion**

In `MarketDataIngestionService`, at both sites that call `setTargetMarket` (around lines
178 and 227), also set the category from the `tbl_trend_fetch_job` row being aggregated.

Read the surrounding method first — if a site aggregates *across* categories for one
market, that call site must either iterate categories (producing one record per
`(category, market)`) or leave `category` null. **Do not invent a category by picking the
first one.** If the correct behaviour is unclear at a given call site, stop and report it.

- [ ] **Step 6: Verify**

```bash
./mvnw test -Dtest=CategoryDimensionTest && ./mvnw test
docker compose -f ../docker-compose.yml up -d --no-deps --build spring-boot
docker compose -f ../docker-compose.yml logs spring-boot --tail 40 | grep -i flyway
```

Expected: tests pass; Flyway reports V20 applied with no validation error.

```bash
docker compose exec -T postgres psql -U ceview -d ceview \
  -c "\d tbl_market_signal_record" | grep category
```

Expected: the column exists.

- [ ] **Step 7: Commit** (operator runs it — agents must not)

```bash
git add backend/spring-boot/src/main/resources/db/migration/V20__module2_category_dimension.sql \
        backend/spring-boot/src/main/java/com/ceview/module2 \
        backend/spring-boot/src/test/java/com/ceview/module2
git commit -m "feat(backend): carry category through the module 2 signal chain"
```

---

## Task 1a.2: Forecast per (category, market) and persist yoyRatio

**Depends on:** Task 1a.1.

**Files:**
- Modify: `src/main/java/com/ceview/module2/submodule22/ForecastingService.java`
- Test: `src/test/java/com/ceview/module2/submodule22/CategoryForecastTest.java`

- [ ] **Step 1: Read before you change**

`ForecastingService` currently validates that the profile has categories (around line 118)
but forecasts per `(profile, market)`. Read `forecastForProfile` end to end before editing —
it is the largest method in Module 2 and this task changes its iteration shape.

- [ ] **Step 2: Write the failing test**

```java
package com.ceview.module2.submodule22;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CategoryForecastTest {

    @Test
    void forecastResultRecordsItsCategoryAndYoyRatio() {
        ForecastResult fr = new ForecastResult();
        fr.setTargetMarket("korea");
        fr.setCategory("Coastal & Island");
        fr.setYoyRatio(1.07);

        assertThat(fr.getCategory()).isEqualTo("Coastal & Island");
        assertThat(fr.getYoyRatio()).isEqualTo(1.07);
    }
}
```

Add an integration-style assertion once the iteration change lands: a profile with two
categories and one market must produce **two** `ForecastResult` rows with distinct
categories, not one.

- [ ] **Step 3: Iterate categories**

Change the forecast loop from `for (market : markets)` to
`for (category : profile.categoriesList()) for (market : markets)`, selecting the
`MarketSignalRecord` matching `(profileId, category, market)`. Persist `category` and
`yoyRatio` on each `ForecastResult`.

**Cost warning to respect:** this multiplies Gemini calls by the category count. Check
whether `forecastForProfile` already batches (there is an `/inference-batch` endpoint on the
transformer) and prefer the batch path. If adding the loop would make an unbatched call per
`(category, market)`, stop and report before proceeding — the row count and API cost
implications need a human decision.

- [ ] **Step 4: Verify**

```bash
./mvnw test -Dtest=CategoryForecastTest && ./mvnw test
```

- [ ] **Step 5: Commit** (operator)

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/submodule22 \
        backend/spring-boot/src/test/java/com/ceview/module2/submodule22
git commit -m "feat(backend): forecast per (category, market) and persist yoyRatio"
```

---

## Task 1a.3: Expose category, alertLevel and alertMessage on NotificationDto

**Depends on:** Task 1a.2.

`tbl_demand_alert` already has `alert_level` and `alert_message` columns — they are simply
absent from `NotificationDto`. `category` now reaches the alert via
`alert → market_score → forecast_result.category`.

**Files:**
- Modify: `src/main/java/com/ceview/module2/dto/NotificationDtos.java`
- Modify: `src/main/java/com/ceview/module2/submodule22/NotificationService.java`
- Modify: `src/main/java/com/ceview/module2/submodule22/CategoryRankNotificationService.java`
- Test: `src/test/java/com/ceview/module2/NotificationDtoFieldsTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module2;

import com.ceview.module2.dto.NotificationDtos.NotificationDto;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class NotificationDtoFieldsTest {

    @Test
    void notificationCarriesCategoryAndAlertFields() {
        NotificationDto dto = new NotificationDto(
                "80000000-0000-0000-0000-000000000001",
                "Jul 27, 2026",
                "Demand Surge Detected — South Korea",
                "South Korea", "korea",
                "Rising demand window",
                false,
                null,
                "Coastal & Island",
                "WARNING",
                "Demand spike active — immediate action recommended");

        assertThat(dto.category()).isEqualTo("Coastal & Island");
        assertThat(dto.alertLevel()).isEqualTo("WARNING");
        assertThat(dto.alertMessage()).contains("immediate action");
    }
}
```

- [ ] **Step 2: Extend the record**

Append to `NotificationDto` after `details`:

```java
        /** The signal-grid category this alert came from; null for pre-V20 rows. */
        String category,
        /** tbl_demand_alert.alert_level — "INFO" or "WARNING". Drives the surge filter. */
        String alertLevel,
        /** tbl_demand_alert.alert_message — the operator-facing directive. */
        String alertMessage
```

- [ ] **Step 3: Populate both notification sources**

In `NotificationService.toNotificationDto(alert, scoreById, forecastById)`, read
`alert.getAlertLevel()`, `alert.getAlertMessage()`, and the category from the joined
`ForecastResult`.

In `CategoryRankNotificationService.toNotificationDto(category, raw, today)`, the category
is already a parameter — pass it through. Use `"INFO"` for `alertLevel` on keyword-trend
notifications; they are not surge alerts.

- [ ] **Step 4: Verify against the live backend**

```bash
T=$(curl -s -X POST http://localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s http://localhost:8080/api/v1/notifications -H "Authorization: Bearer $T" \
  | python -c "import sys,json;print(sorted(json.load(sys.stdin)['notifications'][0].keys()))"
```

Expected: the key list now includes `alertLevel`, `alertMessage`, and `category`.

- [ ] **Step 5: Commit** (operator)

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2 backend/spring-boot/src/test/java/com/ceview/module2
git commit -m "feat(backend): expose category, alertLevel and alertMessage on notifications"
```

---

## Task 1a.4: Backfill the seed data

**Depends on:** Task 1a.3.

`V18__module2_module3_seed_data.sql` inserts signal, forecast, score, and alert rows with
no category. Without a backfill, every seeded alert has `category: null` and the dashboard
filter still shows nothing for existing data.

**Files:**
- Create: `src/main/resources/db/migration/V21__module2_category_backfill.sql`

- [ ] **Step 1: Determine each seeded profile's category**

The 9 seeded operators and their categories are in
[`SEED_CREDENTIALS.md`](../../../../backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md).
`ramon.delacruz@ceview.local` (profile `20000000-…-0001`) is "Coastal & Island".

- [ ] **Step 2: Write the backfill**

```sql
-- V21 — Backfill category onto pre-V20 seeded Module 2 rows so the dashboard's
-- category filter matches existing demo data. Sets each row's category to the
-- FIRST category of its owning business profile; profiles are single-category
-- in the V2 seed, so this is exact for seeded data rather than a guess.

UPDATE tbl_market_signal_record msr
   SET category = bp.categories[1]
  FROM tbl_business_profile bp
 WHERE msr.business_profile_id = bp.business_profile_id
   AND msr.category IS NULL;

UPDATE tbl_forecast_result fr
   SET category = bp.categories[1]
  FROM tbl_business_profile bp
 WHERE fr.business_profile_id = bp.business_profile_id
   AND fr.category IS NULL;
```

**Verify the real column name and type for a profile's categories first** — V2 introduced
multi-category support and the column may be `text[]`, a join table, or JSON:

```bash
docker compose exec -T postgres psql -U ceview -d ceview -c "\d tbl_business_profile"
```

Adapt the SQL to what actually exists. Do not ship the array syntax above unverified.

- [ ] **Step 3: Verify end to end**

Rebuild Spring Boot, then confirm the seeded alert now carries a category matching the
operator's own:

```bash
curl -s http://localhost:8080/api/v1/notifications -H "Authorization: Bearer $T" \
  | python -c "import sys,json;n=json.load(sys.stdin)['notifications'];print([(x['title'],x.get('category')) for x in n])"
```

Expected: `Coastal & Island` for Ramon's alerts, not `None`.

- [ ] **Step 4: Commit** (operator)

```bash
git add backend/spring-boot/src/main/resources/db/migration/V21__module2_category_backfill.sql
git commit -m "feat(backend): backfill category onto seeded module 2 rows"
```

---

## Knock-on changes to `02-module-2.md`

Once this file is complete, three things there change:

1. **Task 7's contract test** may assert `category` and `alertLevel` — it previously
   would have failed, since neither field existed.
2. **Task 10** surfaces `yoyRatio` as a real `Double` from `tbl_market_score.yoy_ratio`
   instead of hardcoding `null`. The `Market.yoyRatio` type stays `number | null`
   (pre-V20 rows are still null), but the "not available" state becomes the exception
   rather than the rule.
3. **Task 11's `filterByCategory`** becomes a genuine DB filter on
   `tbl_forecast_result.category` rather than the unimplementable stub the original task
   described.

## Definition of Done

- [ ] `tbl_market_signal_record` and `tbl_forecast_result` both carry `category`
- [ ] A profile with two categories produces two forecast rows per market, with different
      inputs — verified, not assumed
- [ ] `GET /api/v1/notifications` returns `category`, `alertLevel`, `alertMessage`
- [ ] Seeded alerts carry a category matching their operator's profile
- [ ] `yoy_ratio` is persisted and non-null on newly computed forecasts
- [ ] `./mvnw test` passes
