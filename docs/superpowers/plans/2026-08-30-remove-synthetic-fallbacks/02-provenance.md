# Phase 1 — Tier C: Provenance and Last-Known-Good (Tasks 8–16)

External data stops being invented. Every persisted signal record declares where it
came from; readers trust only real ones; a failed fetch surfaces staleness or an
explicit unavailability rather than a synthetic series.

**Prerequisite:** Phase 0 complete (Tasks 1–7).

> **Late finding, folded into Task 12.** `EnrichedSequenceBuilder` currently
> substitutes `50.0` for a missing trend index, `50.0` for missing rolling averages,
> `0.5` for missing seasonality and `1.0` for missing forex — invented numbers passed
> into the forecast prompt as if measured. These are Tier C synthetic data by the
> spec's definition and are removed alongside the stub series.

---

### Task 8: `V22` — signal-record provenance columns

**Files:**
- Create: `backend/spring-boot/src/main/resources/db/migration/V22__module2_signal_provenance.sql`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecord.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module2/submodule21/SignalProvenanceTest.java`

- [ ] **Step 1: Write the migration**

```sql
-- V22 — Persist where each market signal actually came from.
--
-- tbl_trend_fetch_job.source already records 'pytrends' or 'stub', but that
-- distinction was lost at aggregation: once a stub trend index became a
-- tbl_market_signal_record row, nothing downstream could tell it from a real
-- measurement. Last-known-good reads (Task 12) are impossible without this —
-- they would faithfully resurrect the very stub data Phase 1 removes.
--
-- 'unknown' is the backfill value for pre-V22 rows. Readers treat it as
-- untrusted, the same as 'stub' — see V23, which purges what it can trace.

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'unknown';

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS source_fetched_at TIMESTAMPTZ;

-- Task 12's hot path: "the newest genuinely-measured rows for this
-- profile+category+market".
CREATE INDEX IF NOT EXISTS idx_msr_source_recency
    ON tbl_market_signal_record (business_profile_id, target_market, source, aggregated_at DESC);

COMMENT ON COLUMN tbl_market_signal_record.source IS
    'pytrends = genuinely measured; stub = synthetic (pre-V23 only); unknown = pre-V22, untrusted';
```

- [ ] **Step 2: Add the entity fields**

In `MarketSignalRecord.java`, after the `aggregatedAt` field at :38:

```java
    /**
     * Where this row's trend index came from. Only {@code "pytrends"} is trusted
     * by readers — see EnrichedSequenceBuilder. Never write {@code "stub"}: the
     * synthetic path was deleted in Task 11.
     */
    @Column(name = "source")             private String source;
    @Column(name = "source_fetched_at")  private OffsetDateTime sourceFetchedAt;
```

Add matching getters and setters following the file's existing style.

- [ ] **Step 3: Write the failing test**

Create `backend/spring-boot/src/test/java/com/ceview/module2/submodule21/SignalProvenanceTest.java`:

```java
package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** V22's columns must round-trip through the entity. */
class SignalProvenanceTest {

    @Test
    void carriesSourceAndFetchTimestamp() {
        OffsetDateTime fetchedAt = OffsetDateTime.parse("2026-08-24T03:00:00Z");

        MarketSignalRecord record = new MarketSignalRecord();
        record.setSource("pytrends");
        record.setSourceFetchedAt(fetchedAt);

        assertThat(record.getSource()).isEqualTo("pytrends");
        assertThat(record.getSourceFetchedAt()).isEqualTo(fetchedAt);
    }
}
```

- [ ] **Step 4: Run the test**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=SignalProvenanceTest
```

Expected: PASS

- [ ] **Step 5: Verify the migration applies**

```bash
cd backend && docker compose up -d postgres && docker compose up -d --no-deps spring-boot
docker compose logs spring-boot | grep -i "Migrating schema\|Successfully applied"
```

Expected: a line naming `V22__module2_signal_provenance`. Then confirm the column
exists:

```bash
docker compose exec -T postgres psql -U ceview -d ceview -c "\d tbl_market_signal_record" | grep source
```

Expected: two rows — `source` and `source_fetched_at`.

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/resources/db/migration/V22__module2_signal_provenance.sql backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecord.java backend/spring-boot/src/test/java/com/ceview/module2/submodule21/SignalProvenanceTest.java
git commit -m "feat(module-2): persist signal-record provenance"
```

---

### Task 9: `V23` — purge synthetic signal records

**Files:**
- Create: `backend/spring-boot/src/main/resources/db/migration/V23__module2_purge_synthetic_signals.sql`

- [ ] **Step 1: Inspect what will be deleted before writing the migration**

```bash
cd backend && docker compose exec -T postgres psql -U ceview -d ceview -c \
  "SELECT source, COUNT(*) FROM tbl_trend_fetch_job GROUP BY source;"
```

Record the counts. If `stub` is 0, the migration is a no-op on this database but
still required for any environment where it is not.

- [ ] **Step 2: Write the migration**

```sql
-- V23 — Remove signal records derived from synthetic trend data.
--
-- Task 12 makes forecasts read the newest *real* signal record when a live fetch
-- fails. Without this purge, that last-known-good read would faithfully resurrect
-- stub data — the exact failure mode Phase 1 exists to eliminate.
--
-- Three passes, innermost dependency first, so no orphaned forecast survives:
--   1. Mark signal records traceable to a stub fetch job
--   2. Delete forecast results and market scores derived from them
--   3. Delete the signal records themselves
--
-- Rows with no traceable job keep source='unknown' from V22 and are simply never
-- trusted by readers. They are NOT deleted: they may well be real, and deleting
-- unclassifiable history is a worse default than declining to rely on it.

-- 1 — attribute what we can trace. A signal record matches a job when the
--     profile's category and market and the aggregation week line up.
UPDATE tbl_market_signal_record msr
   SET source = j.source,
       source_fetched_at = j.completed_at
  FROM tbl_trend_fetch_job j
 WHERE msr.source = 'unknown'
   AND msr.target_market = j.market
   AND msr.category IS NOT DISTINCT FROM j.category
   AND to_char(msr.aggregated_at, 'IYYY-"W"IW') = j.week_of
   AND j.source IS NOT NULL;

-- 2 — drop derived forecasts. tbl_market_score hangs off tbl_forecast_result,
--     so it goes first.
DELETE FROM tbl_market_score
 WHERE forecast_result_id IN (
       SELECT fr.forecast_result_id
         FROM tbl_forecast_result fr
        WHERE EXISTS (
              SELECT 1 FROM tbl_market_signal_record msr
               WHERE msr.source = 'stub'
                 AND msr.business_profile_id = fr.business_profile_id
                 AND msr.target_market       = fr.target_market
                 AND msr.category IS NOT DISTINCT FROM fr.category));

DELETE FROM tbl_forecast_result fr
 WHERE EXISTS (
       SELECT 1 FROM tbl_market_signal_record msr
        WHERE msr.source = 'stub'
          AND msr.business_profile_id = fr.business_profile_id
          AND msr.target_market       = fr.target_market
          AND msr.category IS NOT DISTINCT FROM fr.category);

-- 3 — and the synthetic signals themselves.
DELETE FROM tbl_market_signal_record WHERE source = 'stub';

-- Leave a trace in the Flyway log of how much was fabricated.
DO $$
DECLARE remaining_unknown INT;
BEGIN
    SELECT COUNT(*) INTO remaining_unknown
      FROM tbl_market_signal_record WHERE source = 'unknown';
    RAISE NOTICE 'V23: purged synthetic signals; % rows remain unattributed (source=unknown)',
        remaining_unknown;
END $$;
```

- [ ] **Step 3: Apply and verify**

```bash
cd backend && docker compose restart spring-boot && sleep 30
docker compose logs spring-boot | grep -i "V23\|purged synthetic"
docker compose exec -T postgres psql -U ceview -d ceview -c \
  "SELECT source, COUNT(*) FROM tbl_market_signal_record GROUP BY source;"
```

Expected: no `stub` rows remain. `pytrends` and/or `unknown` may remain.

- [ ] **Step 4: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/resources/db/migration/V23__module2_purge_synthetic_signals.sql
git commit -m "feat(module-2): purge synthetic signal records and their forecasts"
```

---

### Task 10: Scheduler persists `source`, writes nothing on failure

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchSchedulerService.java:242-252`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module2/submodule21/NoRecordOnFetchFailureTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A failed or synthetic fetch must leave no signal record behind. Writing one
 * "so the dashboard has something" is how fabricated data entered the system in
 * the first place.
 */
class NoRecordOnFetchFailureTest {

    @Test
    void aStubSourcedResultIsRejected() {
        assertThat(TrendFetchSchedulerService.isTrustworthy(Map.of("source", "stub"))).isFalse();
    }

    @Test
    void aPytrendsSourcedResultIsAccepted() {
        assertThat(TrendFetchSchedulerService.isTrustworthy(Map.of("source", "pytrends"))).isTrue();
    }

    @Test
    void aResultWithNoSourceIsRejected() {
        assertThat(TrendFetchSchedulerService.isTrustworthy(Map.of())).isFalse();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=NoRecordOnFetchFailureTest
```

Expected: FAIL — `isTrustworthy` does not exist

- [ ] **Step 3: Add the guard**

In `TrendFetchSchedulerService.java`, add a static method beside `applyResult`:

```java
    /**
     * Only a genuinely-measured fetch may become a signal record.
     *
     * <p>Task 11 deletes the synthetic path in fastapi-transformer, so
     * {@code source = "stub"} should no longer be producible. This guard stays
     * anyway: it is one line, and it means a regression in the Python service
     * cannot silently repopulate the database with fabricated trend indices.
     */
    public static boolean isTrustworthy(Map<String, Object> result) {
        return "pytrends".equals(result == null ? null : result.get("source"));
    }
```

Then, at the call site that persists a successful fetch (immediately after
`applyResult(job, result)`), guard the downstream aggregation:

```java
        if (!isTrustworthy(result)) {
            markFailed(job, "untrusted source: " + result.get("source"));
            log.warn("Trend fetch for category={} market={} returned an untrusted source ({}); "
                     + "no signal record written", job.getCategory(), job.getMarket(),
                     result.get("source"));
            return;
        }
```

- [ ] **Step 4: Carry `source` into the signal record**

In `MarketDataIngestionService.java`, where a `MarketSignalRecord` is constructed
and populated from the fetch job, add:

```java
        record.setSource(job.getSource());
        record.setSourceFetchedAt(job.getCompletedAt());
```

- [ ] **Step 5: Run the tests**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=NoRecordOnFetchFailureTest
cd backend/spring-boot && ./mvnw test
```

Expected: PASS both

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/submodule21/ backend/spring-boot/src/test/java/com/ceview/module2/submodule21/NoRecordOnFetchFailureTest.java
git commit -m "feat(module-2): never persist a signal record from an untrusted fetch"
```

---

### Task 11: `trend_service` raises instead of returning stubs

**Files:**
- Modify: `backend/fastapi-transformer/app/services/trend_service.py:35-160`
- Delete: `backend/fastapi-transformer/app/services/ml_stubs.py`
- Test: `backend/fastapi-transformer/tests/unit/test_trend_service_no_stub.py`

- [ ] **Step 1: Confirm `ml_stubs.py` really has no importers**

```bash
cd backend/fastapi-transformer && grep -rn "ml_stubs" --include=*.py . ; echo "exit=$?"
```

Expected: no output, `exit=1`. If anything imports it, stop and report — the
deletion in Step 6 is only safe because nothing does.

- [ ] **Step 2: Write the failing test**

Create `backend/fastapi-transformer/tests/unit/test_trend_service_no_stub.py`:

```python
"""trend_service must raise, never fabricate.

Before this change, an unavailable pytrends produced a curated 52-week series that
flowed into real forecasts indistinguishably from measured data.

Run with: pytest tests/unit/test_trend_service_no_stub.py -v
"""
import pytest

from app.services import trend_service
from app.unavailable import DependencyUnavailable


def test_raises_when_pytrends_is_not_installed(monkeypatch):
    monkeypatch.setattr(trend_service, "_TrendReq", None)
    monkeypatch.setattr(trend_service, "_IMPORT_ERROR", "No module named 'pytrends'")

    with pytest.raises(DependencyUnavailable) as excinfo:
        trend_service.fetch_current_index("korea", "Coastal & Island")

    assert excinfo.value.dependency == "pytrends"
    assert "No module named" in excinfo.value.cause
    assert excinfo.value.status_code == 503


def test_raises_with_the_upstream_reason_on_a_fetch_failure(monkeypatch):
    class _Boom:
        def __init__(self, *_args, **_kwargs):
            raise RuntimeError("429 Too Many Requests")

    monkeypatch.setattr(trend_service, "_TrendReq", _Boom)

    with pytest.raises(DependencyUnavailable) as excinfo:
        trend_service.fetch_current_index("korea", "Coastal & Island")

    assert "429" in excinfo.value.cause


def test_no_stub_symbols_survive():
    assert not hasattr(trend_service, "_STUB_BASE")
    assert not hasattr(trend_service, "_STUB_SERIES")
    assert not hasattr(trend_service, "_stub_result")
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend/fastapi-transformer && pytest tests/unit/test_trend_service_no_stub.py -v
```

Expected: FAIL — `test_no_stub_symbols_survive` fails; the raise tests fail because
stubs are returned instead.

- [ ] **Step 4: Replace the optional-import block**

In `trend_service.py`, replace the `try/except` at :39-49 with:

```python
# ── pytrends import (reason retained, not swallowed) ─────────────────────────
_TrendReq = None
_IMPORT_ERROR: str | None = None

try:
    from pytrends.request import TrendReq as _TrendReqClass
    _TrendReq = _TrendReqClass
    logger.info("pytrends loaded successfully")
except Exception as _exc:  # noqa: BLE001
    # Recording the reason, not just the fact, is the whole point: Task 12 shows
    # it to the developer as the `cause` of a 503 rather than a bare
    # "trends unavailable".
    _IMPORT_ERROR = str(_exc)
    logger.warning("pytrends unavailable — trend fetches will fail loudly: %s", _exc)
```

- [ ] **Step 5: Delete the stub constants and helper**

Delete `_STUB_BASE` (:59-63), `_STUB_SERIES` (:65-71 plus its data), and the entire
`_stub_result` function. Replace every `return _stub_result(...)` with:

```python
        raise DependencyUnavailable(
            code="MOD21_TRENDS_UNAVAILABLE",
            message="Google Trends data is unavailable.",
            dependency="pytrends",
            cause=_IMPORT_ERROR or str(exc),
            stage="fastapi-transformer/trend_service",
        )
```

At the top of the file, add:

```python
from app.unavailable import DependencyUnavailable
```

For the "no keyword mapping" branch at :145, keep the generic-keyword behaviour —
that is a lookup default for a *query term*, not a fabricated measurement — but log
it at `info` rather than `warning` so it stops reading like a failure.

- [ ] **Step 6: Delete `ml_stubs.py`**

```bash
cd backend/fastapi-transformer && rm app/services/ml_stubs.py
```

- [ ] **Step 7: Run the tests**

```bash
cd backend/fastapi-transformer && pytest tests/ -v
```

Expected: PASS. Any existing test asserting `source == "stub"` must be rewritten to
assert the raise — it was pinning the behaviour being removed.

- [ ] **Step 8: Commit** *(operator runs this)*

```bash
git add backend/fastapi-transformer/app/services/trend_service.py backend/fastapi-transformer/tests/unit/test_trend_service_no_stub.py
git rm backend/fastapi-transformer/app/services/ml_stubs.py
git commit -m "feat(module-2): trend_service raises instead of returning stub series"
```

---

### Task 12: `EnrichedSequenceBuilder` filters to real rows, reports staleness

This task also removes the invented numeric defaults noted at the top of this file.

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/EnrichedSequenceBuilder.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecordRepository.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module2/submodule22/RealDataOnlyTest.java`

- [ ] **Step 1: Add the repository finder**

In `MarketSignalRecordRepository.java`:

```java
    /**
     * The newest genuinely-measured records for a profile+market, optionally
     * scoped to a category. Only {@code source = 'pytrends'} qualifies — 'stub'
     * is purged by V23 and 'unknown' (pre-V22) is untrusted by policy.
     */
    @Query("""
           SELECT r FROM MarketSignalRecord r
            WHERE r.businessProfileId = :profileId
              AND r.targetMarket = :market
              AND (:category IS NULL OR r.category = :category)
              AND r.source = 'pytrends'
            ORDER BY r.aggregatedAt DESC
           """)
    List<MarketSignalRecord> findRealByProfileAndMarket(
            @Param("profileId") UUID profileId,
            @Param("market") String market,
            @Param("category") String category);
```

Add the `org.springframework.data.jpa.repository.Query` and
`org.springframework.data.repository.query.Param` imports if absent.

- [ ] **Step 2: Write the failing test**

```java
package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.MarketSignalRecord;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The forecast prompt must contain measurements, not placeholders.
 *
 * The 50.0 / 0.5 / 1.0 defaults this replaces were invented numbers passed to the
 * forecaster as if observed — synthetic data one layer below the stub series.
 */
class RealDataOnlyTest {

    private static MarketSignalRecord record(Double trendIndex, OffsetDateTime at) {
        MarketSignalRecord r = new MarketSignalRecord();
        r.setTrendIndex(trendIndex);
        r.setAggregatedAt(at);
        r.setSource("pytrends");
        return r;
    }

    @Test
    void aRecordWithNoTrendIndexIsExcludedRatherThanDefaultedTo50() {
        List<MarketSignalRecord> records = List.of(
                record(70.0, OffsetDateTime.parse("2026-08-01T00:00:00Z")),
                record(null, OffsetDateTime.parse("2026-08-08T00:00:00Z")),
                record(72.0, OffsetDateTime.parse("2026-08-15T00:00:00Z")));

        List<Double> series = EnrichedSequenceBuilder.trendSeriesOf(records);

        assertThat(series).containsExactly(70.0, 72.0);
        assertThat(series).doesNotContain(50.0);
    }

    @Test
    void staleIsMeasuredAgainstTheNewestRecord() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-30T00:00:00Z");

        assertThat(EnrichedSequenceBuilder.isStale(
                OffsetDateTime.parse("2026-08-29T00:00:00Z"), now)).isFalse();
        assertThat(EnrichedSequenceBuilder.isStale(
                OffsetDateTime.parse("2026-08-27T00:00:00Z"), now)).isTrue();
    }

    @Test
    void exactlyAtTheThresholdIsNotYetStale() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-30T00:00:00Z");

        assertThat(EnrichedSequenceBuilder.isStale(
                OffsetDateTime.parse("2026-08-28T00:00:00Z"), now)).isFalse();
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=RealDataOnlyTest
```

Expected: FAIL — `trendSeriesOf` and `isStale` do not exist

- [ ] **Step 4: Implement**

In `EnrichedSequenceBuilder.java`, add beside `MIN_RECORDS`:

```java
    /**
     * How old the newest real signal may be before the UI calls it stale.
     * Matches the trend-fetch scheduler's weekly-with-daily-retry cadence with
     * room for one missed run. Defined once, here, so it is not re-derived.
     */
    public static final java.time.Duration STALE_AFTER = java.time.Duration.ofHours(48);

    /**
     * Trend indices, chronological, with unmeasured records dropped.
     *
     * <p>This used to substitute {@code 50.0} for a null index — a fabricated
     * midpoint the forecaster could not distinguish from a real measurement.
     * Omitting the point is honest; the series is shorter and MIN_RECORDS still
     * guards the floor.
     */
    public static List<Double> trendSeriesOf(List<MarketSignalRecord> chronological) {
        return chronological.stream()
                .map(MarketSignalRecord::getTrendIndex)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /** True when the newest real signal is older than {@link #STALE_AFTER}. */
    public static boolean isStale(java.time.OffsetDateTime newest, java.time.OffsetDateTime now) {
        if (newest == null) return true;
        return java.time.Duration.between(newest, now).compareTo(STALE_AFTER) > 0;
    }
```

Then in `buildSequence(UUID, String, String)`:

Replace the two-step read (:74-80) with the real-only finder:

```java
        List<MarketSignalRecord> records =
                signalRepo.findRealByProfileAndMarket(profileId, market, category);
        if (records.isEmpty() && category != null) {
            // Category not yet ingested — fall back to the market's other real
            // records rather than to nothing. Still real-only.
            records = signalRepo.findRealByProfileAndMarket(profileId, market, null);
        }
```

Replace the `trendSeries` construction with:

```java
        List<Double> trendSeries = trendSeriesOf(chronological);
```

Replace each remaining `orDefault(...)` on a *measured* field with the raw nullable
value, so an absent measurement reaches the forecaster as `null` rather than as an
invented number:

```java
        payload.put("rolling7dAvg",     latest.getRollingAverage7d());
        payload.put("rolling30dAvg",    latest.getRollingAverage30d());
        payload.put("rollingStd7d",     latest.getRollingStdDev());
        payload.put("seasonalityScore", latest.getSeasonalityScore());
        payload.put("forexRate",        latest.getForexRate());
```

Add the staleness fields to the payload, after `yoyRatio`:

```java
        payload.put("dataAsOf", latest.getAggregatedAt() == null
                ? null : latest.getAggregatedAt().toString());
        payload.put("dataStale", isStale(latest.getAggregatedAt(), java.time.OffsetDateTime.now()));
```

Delete the now-unused `orDefault` helper if nothing else calls it. Add
`java.util.Objects` to the imports.

- [ ] **Step 5: Run the tests**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=RealDataOnlyTest
cd backend/spring-boot && ./mvnw test
```

Expected: PASS both. `gemini_forecaster.py` already raises `ValueError` on an empty
`trend_series` (its docstring at :83-92 says so explicitly), so a fully-unmeasured
market surfaces as a 503 rather than a silent zero-length forecast.

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/
git commit -m "feat(module-2): forecast only on measured data, and report its age"
```

---

### Task 13: `MOD22_NO_MARKET_DATA` when no real rows exist

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java:500`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module2/submodule22/NoMarketDataTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module2.submodule22;

import com.ceview.ai.AiDependencyException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * "No measured data" is a distinct, actionable state — not a generic 500 and
 * certainly not an empty forecast rendered as if it meant something.
 */
class NoMarketDataTest {

    @Test
    void emptyDatasetBecomesAStructuredUnavailability() {
        assertThatThrownBy(() -> {
            throw ForecastingService.noMarketData("korea", "pytrends returned 429 on 2026-08-29");
        })
                .isInstanceOf(AiDependencyException.class)
                .satisfies(thrown -> {
                    AiDependencyException ex = (AiDependencyException) thrown;
                    assertThat(ex.getCode()).isEqualTo("MOD22_NO_MARKET_DATA");
                    assertThat(ex.getDependency()).isEqualTo("pytrends");
                    assertThat(ex.getCause2()).contains("429");
                    assertThat(ex.getStatus()).isEqualTo(503);
                });
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=NoMarketDataTest
```

Expected: FAIL — `noMarketData` does not exist

- [ ] **Step 3: Implement**

In `ForecastingService.java`:

```java
    /**
     * No genuinely-measured signal exists for this market.
     *
     * <p>Deliberately not an empty forecast: a zeroed market score renders as a
     * real "demand is low" reading. The operator needs to know the difference
     * between "we measured low demand" and "we could not measure".
     */
    public static AiDependencyException noMarketData(String market, String lastIngestionError) {
        return AiDependencyException.fromBody(503, java.util.Map.of(
                "code", "MOD22_NO_MARKET_DATA",
                "message", "No measured demand data exists for " + market + " yet.",
                "dependency", "pytrends",
                "cause", lastIngestionError == null
                        ? "no successful trend fetch has completed for this market"
                        : lastIngestionError,
                "stage", "spring/forecasting"), "forecasting/markets");
    }
```

At the site that currently catches `IllegalStateException("enriched_dataset_empty")`
(near :500), rethrow via `noMarketData(market, lastError)`, reading `lastError` from
the most recent `tbl_trend_fetch_job` row for that market via
`jobRepo.findTopByMarketOrderByLastAttemptedAtDesc(market)`. Add that derived query
to `TrendFetchJobRepository` if absent:

```java
    Optional<TrendFetchJob> findTopByMarketOrderByLastAttemptedAtDesc(String market);
```

- [ ] **Step 4: Run the tests**

```bash
cd backend/spring-boot && ./mvnw test
```

Expected: PASS

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/ backend/spring-boot/src/test/java/com/ceview/module2/submodule22/NoMarketDataTest.java
git commit -m "feat(module-2): MOD22_NO_MARKET_DATA instead of an empty forecast"
```

---

### Task 14: `ExternalMarketDataClient` last-known-good GDP/forex

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/ExternalMarketDataClient.java:68-72,200-300`
- Test: `backend/spring-boot/src/test/java/com/ceview/module2/submodule21/EconomicLastKnownGoodTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A World Bank or currency-API outage must produce the last real reading or
 * nothing — never a straight line invented to fill the chart.
 */
class EconomicLastKnownGoodTest {

    @Test
    void noSyntheticFallbackMethodsSurvive() {
        assertThat(java.util.Arrays.stream(ExternalMarketDataClient.class.getDeclaredMethods())
                .map(java.lang.reflect.Method::getName))
                .doesNotContain("gdpTrendFallback", "forexTrendFallback");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=EconomicLastKnownGoodTest
```

Expected: FAIL — both methods are present

- [ ] **Step 3: Implement**

Delete `gdpTrendFallback()` (:283-293), `forexTrendFallback()` (:294-305) and the
fallback constant maps at :68-72.

At the call sites (:209 and :278), replace the fallback return with a read of the
newest persisted row — the query `V11` at :13 documents as this table's purpose:

```java
        // Last-known-good, not a synthetic curve. tbl_market_economic_trend exists
        // precisely so an outage reuses the last real reading (see V11 header).
        return economicTrendRepo
                .findTopByMarketOrderByFetchedAtDesc(market)
                .map(row -> new GdpTrendDto(row.getGdpTrendJson(), row.getFetchedAt()))
                .orElse(null);
```

and the forex equivalent. Add to `MarketEconomicTrendRepository`:

```java
    Optional<MarketEconomicTrend> findTopByMarketOrderByFetchedAtDesc(String market);
```

Both DTOs gain a `fetchedAt` field so Task 16 can age the reading. A `null` return
means "never fetched" and the market's economic panel renders empty rather than flat.

- [ ] **Step 4: Run the tests**

```bash
cd backend/spring-boot && ./mvnw test
```

Expected: PASS

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/submodule21/ backend/spring-boot/src/test/java/com/ceview/module2/submodule21/EconomicLastKnownGoodTest.java
git commit -m "feat(module-2): last-known-good GDP and forex instead of synthetic curves"
```

---

### Task 15: Remove the inline 2-sigma seasonality fallback

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java:170-180`

- [ ] **Step 1: Read the current block**

```bash
cd backend/spring-boot && sed -n 165,185p src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java
```

- [ ] **Step 2: Replace it**

Delete the inline 2σ computation and leave the spike indicator unset:

```java
        } catch (Exception e) {
            // No local substitute. A guessed spike flag renders identically to a
            // measured one in the dashboard's surge chip, and a false surge is
            // worse than no chip at all. Null means "not determined".
            log.warn("Seasonality service unavailable for market={}; spike_indicator left null: {}",
                     market, e.getMessage());
            record.setSpikeIndicator(null);
        }
```

- [ ] **Step 3: Confirm `spike_indicator` is nullable**

```bash
cd backend && docker compose exec -T postgres psql -U ceview -d ceview -c \
  "SELECT is_nullable FROM information_schema.columns
    WHERE table_name='tbl_market_signal_record' AND column_name='spike_indicator';"
```

Expected: `YES`. (`V1__init_schema.sql:77` declares it without `NOT NULL`, so no
migration is needed.)

- [ ] **Step 4: Make the reader tolerate null**

`EnrichedSequenceBuilder` already uses `Boolean.TRUE.equals(latest.getSpikeIndicator())`,
which handles null correctly. Verify the dashboard's surge chip does the same:

```bash
cd frontend && grep -rn "spikeIndicator" components/module-2/ | grep -v test
```

Any site treating it as a plain boolean must be changed to render the chip only on
an explicit `true`.

- [ ] **Step 5: Run the suites**

```bash
cd backend/spring-boot && ./mvnw test
cd frontend && npm test
```

Expected: PASS both

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java frontend/components/module-2/
git commit -m "feat(module-2): leave spike_indicator null rather than guessing it"
```

---

### Task 16: `dataAsOf` / `dataStale` on `MarketDto` + `<StaleDataBanner>`

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/dto/MarketDtos.java`
- Modify: `frontend/types.ts` (the `Market` interface)
- Create: `frontend/components/shared/StaleDataBanner.tsx`
- Create: `frontend/components/shared/StaleDataBanner.test.tsx`
- Modify: `frontend/components/module-2/2.1-dashboard/DashboardView.tsx`

- [ ] **Step 1: Extend the DTO**

In `MarketDtos.java`, add to the `MarketDto` record:

```java
        /** ISO-8601 timestamp of the newest measured signal behind this market, or null. */
        String dataAsOf,
        /** True when dataAsOf is older than EnrichedSequenceBuilder.STALE_AFTER. */
        boolean dataStale,
```

Populate both from the values `EnrichedSequenceBuilder` now puts on its payload
(Task 12 Step 4) wherever `MarketDto` is constructed.

- [ ] **Step 2: Extend the frontend type**

In `frontend/types.ts`, add to `interface Market`:

```typescript
  /** When the newest measured signal behind this market was aggregated. */
  dataAsOf: string | null;
  /** True when that measurement is older than 48h — real, but old. */
  dataStale: boolean;
```

- [ ] **Step 3: Write the failing test**

Create `frontend/components/shared/StaleDataBanner.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StaleDataBanner } from './StaleDataBanner';

describe('StaleDataBanner', () => {
  it('states the age in whole days', () => {
    render(
      <StaleDataBanner
        dataAsOf="2026-08-24T03:00:00Z"
        now={new Date('2026-08-30T03:00:00Z')}
        cause="429 Too Many Requests"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Data is 6 days old');
  });

  it('shows the last successful fetch date', () => {
    render(
      <StaleDataBanner
        dataAsOf="2026-08-24T03:00:00Z"
        now={new Date('2026-08-30T03:00:00Z')}
        cause="429 Too Many Requests"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('2026-08-24');
  });

  it('names the cause of the failed refresh', () => {
    render(
      <StaleDataBanner
        dataAsOf="2026-08-24T03:00:00Z"
        now={new Date('2026-08-30T03:00:00Z')}
        cause="429 Too Many Requests"
      />,
    );

    expect(screen.getByTestId('stale-cause')).toHaveTextContent('429 Too Many Requests');
  });

  it('renders nothing without a timestamp', () => {
    const { container } = render(<StaleDataBanner dataAsOf={null} now={new Date()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd frontend && npx vitest run components/shared/StaleDataBanner.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 5: Implement**

Create `frontend/components/shared/StaleDataBanner.tsx`:

```tsx
/**
 * "These numbers are real, just old."
 *
 * Deliberately distinct from ApiErrorPanel. That panel means the request failed
 * and nothing below it is trustworthy; this one means the data below is genuine
 * measurement that simply has not refreshed. Styling them alike would train
 * people to dismiss both — see the spec's Section 4.
 *
 * `now` is injected rather than read from the clock so the age is testable.
 */
import { Clock } from 'lucide-react';

interface Props {
  dataAsOf: string | null;
  now: Date;
  /** Why the latest refresh failed, from the backend's unavailability contract. */
  cause?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function StaleDataBanner({ dataAsOf, now, cause }: Props) {
  if (!dataAsOf) return null;

  const asOf = new Date(dataAsOf);
  const days = Math.floor((now.getTime() - asOf.getTime()) / MS_PER_DAY);

  return (
    <div
      role="status"
      className="rounded-[var(--radius-md)] border border-[var(--color-gray-light)] bg-[var(--color-off-white)] p-4"
    >
      <div className="flex items-center gap-2 text-[var(--color-navy-primary)]">
        <Clock size={16} aria-hidden="true" />
        <b>Data is {days} {days === 1 ? 'day' : 'days'} old.</b>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-body)]">
        Last successful fetch: {asOf.toISOString().slice(0, 10)}. The numbers below are
        real measurements — they have simply not refreshed.
      </p>
      {cause && (
        <p data-testid="stale-cause" className="mt-2 font-mono text-xs text-[var(--color-text-muted)]">
          Latest attempt failed — {cause}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd frontend && npx vitest run components/shared/StaleDataBanner.test.tsx
```

Expected: PASS — 4 passed

- [ ] **Step 7: Render it on the dashboard**

In `DashboardView.tsx`, above the market list, add:

```tsx
      {markets.some((m) => m.dataStale) && (
        <StaleDataBanner
          dataAsOf={markets.find((m) => m.dataStale)?.dataAsOf ?? null}
          now={new Date()}
        />
      )}
```

- [ ] **Step 8: Verify against the live stack**

```bash
cd backend && docker compose up -d
cd frontend && npm run test:contract
```

Expected: PASS. Then load the dashboard in a browser as a seeded operator and
confirm markets render with real values and no banner (fresh data) or with the
banner and real values (stale data) — never with a banner and placeholder numbers.

- [ ] **Step 9: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module2/dto/MarketDtos.java frontend/types.ts frontend/components/shared/StaleDataBanner.tsx frontend/components/shared/StaleDataBanner.test.tsx frontend/components/module-2/2.1-dashboard/DashboardView.tsx
git commit -m "feat(module-2): surface data age instead of hiding it"
```

---

## Phase 1 exit criteria

- [ ] `cd backend/spring-boot && ./mvnw test` — all pass
- [ ] `cd backend/fastapi-transformer && pytest tests/ -v` — all pass
- [ ] `cd frontend && npm test` — all pass
- [ ] `SELECT source, COUNT(*) FROM tbl_market_signal_record GROUP BY source;` shows no `stub`
- [ ] `grep -rn "ml_stubs\|_STUB_SERIES\|_stub_result" backend/` returns nothing
- [ ] The dashboard renders real market data, with a staleness banner if the last
      fetch is older than 48h, and `MOD22_NO_MARKET_DATA` if there is none
