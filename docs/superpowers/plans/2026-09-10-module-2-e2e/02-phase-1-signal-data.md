# Phase 1 — Signal data: canonical forex unit and one row per ISO week

**Goal:** `tbl_market_signal_record` holds exactly one honest row per (profile, category, market, ISO
week); forex is PHP per 1 foreign unit everywhere; GDP/forex never fall back to invented constants;
new profiles are backfilled with 64 weeks of real, statistically-annotated history.

**Implements:** contract §1 (forex), §2 (cadence). **Audit:** C-03, C-04, C-05, C-06, H-18, H-31 (week
number), H-33. **Depends on:** Phase 0.

**Out of scope here (later phases):** the `2.0` / `1.0` GDP/forex defaults in
`ForecastingService.java:581–586` are removed in Phase 3 together with the forecast defaults at
`550–562`; synthetic chart pads (`buildChartData`) are removed in Phase 9.

**Files:**
- Create: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/IsoWeek.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/EconomicDataUnavailableException.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/ExternalMarketDataClient.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecord.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketSignalRecordRepository.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/MarketDataIngestionService.java`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule21/TrendFetchSchedulerService.java:291-296`
- Modify: `backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java` (after line 113)
- Modify: `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java:832, 959-984`
- Modify: `backend/spring-boot/src/main/resources/application.yml` (forex block), `src/test/resources/application.properties`
- Modify: `backend/fastapi-transformer/app/services/seasonal_shift_detector.py`, `app/services/trend_service.py:274-342`, `app/routers/market_data.py`
- Modify: `frontend/components/module-2/2.2-market-radar/PurchasingPowerTab.tsx`, `frontend/services/fixtures/markets.ts`, `frontend/components/module-2/2.2-market-radar/RadarPanels.test.tsx`
- Create: `backend/spring-boot/src/main/resources/db/migration/V27__module2_signal_week_key_and_forex_unit.sql`
- Tests (create, Spring `src/test/java/com/ceview/module2/`): `submodule21/IsoWeekTest.java`,
  `submodule21/ForexUnitTest.java`, `submodule21/NoInventedEconomicsTest.java`,
  `submodule21/ForexMeanTest.java`, `submodule21/WeeklyUpsertIngestionTest.java`,
  `submodule21/BackfillTest.java`, `submodule22/EconomyInsightTest.java`
- Tests (create, FastAPI): `tests/unit/test_seasonality_series.py`, `tests/unit/test_trend_history_backfill.py`

---

### Task 1.1: ISO-week helper (contract §2.1)

- [ ] **Step 1: Failing test** — `submodule21/IsoWeekTest.java`

```java
package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class IsoWeekTest {

    @Test
    void weekStartsMondayMidnightUtc() {
        assertThat(IsoWeek.startOf(OffsetDateTime.parse("2026-09-09T15:00:00Z")))
                .isEqualTo(OffsetDateTime.parse("2026-09-07T00:00:00Z"));
    }

    @Test
    void sundayBelongsToTheWeekThatStartedTheMondayBefore() {
        assertThat(IsoWeek.startOf(OffsetDateTime.parse("2026-09-13T23:30:00Z")))
                .isEqualTo(OffsetDateTime.parse("2026-09-07T00:00:00Z"));
    }

    @Test
    void offsetsAreConvertedToUtcFirst() {
        // Monday 01:00 in Manila is still Sunday in UTC.
        assertThat(IsoWeek.startOf(OffsetDateTime.parse("2026-09-14T01:00:00+08:00")))
                .isEqualTo(OffsetDateTime.parse("2026-09-07T00:00:00Z"));
    }

    @Test
    void weekBasedYearDiffersFromCalendarYearAtTheBoundary() {
        // 2027-01-01 is a Friday: ISO week 53 of week-based year 2026.
        OffsetDateTime t = OffsetDateTime.parse("2027-01-01T12:00:00Z");
        assertThat(IsoWeek.weekYear(t)).isEqualTo(2026);
        assertThat(IsoWeek.number(t)).isEqualTo(53);
    }

    @Test
    void labelUsesTheTrendFetchJobFormat() {
        assertThat(IsoWeek.label(OffsetDateTime.parse("2026-09-09T00:00:00Z"))).isEqualTo("2026-W37");
    }
}
```

- [ ] **Step 2: Run** — `./mvnw -B test -Dtest=IsoWeekTest` → FAIL (`cannot find symbol: class IsoWeek`).

- [ ] **Step 3: Implement** — `submodule21/IsoWeek.java`

```java
package com.ceview.module2.submodule21;

import java.time.DayOfWeek;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;

/** ISO-8601 week arithmetic in UTC (contract §2.1): weeks start Monday 00:00:00 UTC. */
public final class IsoWeek {

    private IsoWeek() {}

    public static OffsetDateTime startOf(OffsetDateTime t) {
        return t.withOffsetSameInstant(ZoneOffset.UTC)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .truncatedTo(ChronoUnit.DAYS);
    }

    public static int weekYear(OffsetDateTime t) {
        return t.withOffsetSameInstant(ZoneOffset.UTC).get(IsoFields.WEEK_BASED_YEAR);
    }

    public static int number(OffsetDateTime t) {
        return t.withOffsetSameInstant(ZoneOffset.UTC).get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    }

    /** "YYYY-Www" — the TrendFetchJob.week_of format and the feature-row `week` key (contract §3.3). */
    public static String label(OffsetDateTime t) {
        return String.format("%d-W%02d", weekYear(t), number(t));
    }
}
```

In `TrendFetchSchedulerService.java`, replace the body of `computeWeekOf()` (lines 291–296) with
`return IsoWeek.label(OffsetDateTime.now(ZoneOffset.UTC));` and add `import java.time.ZoneOffset;`
(remove the now-unused `LocalDate` and `IsoFields` imports).

- [ ] **Step 4: Run** — `./mvnw -B test -Dtest=IsoWeekTest+NoRecordOnFetchFailureTest` → PASS.
- [ ] **Step 5: Checkpoint** — Suggested: `feat(module-2): add a UTC ISO-week helper`

---

### Task 1.2: Canonical forex unit; no invented GDP/forex (contract §1.2, §1.4)

- [ ] **Step 1: Failing tests**

`submodule21/ForexUnitTest.java`:

```java
package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Contract §1.4: the PHP-based CDN quotes foreign units per 1 PHP; canonical = 1 / quote. */
class ForexUnitTest {

    @Test
    void invertsTheCdnQuoteIntoPhpPerForeignUnit() {
        Map<String, Object> cdn = Map.of("date", "2026-09-09",
                "php", Map.of("krw", 24.0, "jpy", 2.5, "usd", 0.02));
        assertThat(ExternalMarketDataClient.phpPerUnit(cdn, "krw")).isCloseTo(0.041667, within(1e-6));
        assertThat(ExternalMarketDataClient.phpPerUnit(cdn, "jpy")).isCloseTo(0.4, within(1e-9));
        assertThat(ExternalMarketDataClient.phpPerUnit(cdn, "usd")).isCloseTo(50.0, within(1e-9));
    }

    @Test
    void missingZeroOrNegativeQuotesAreAbsentNotInvented() {
        assertThat(ExternalMarketDataClient.phpPerUnit(Map.of("php", Map.of("krw", 0)), "krw")).isNull();
        assertThat(ExternalMarketDataClient.phpPerUnit(Map.of("php", Map.of("krw", -1)), "krw")).isNull();
        assertThat(ExternalMarketDataClient.phpPerUnit(Map.of("php", Map.of()), "krw")).isNull();
        assertThat(ExternalMarketDataClient.phpPerUnit(Map.of(), "krw")).isNull();
    }
}
```

`submodule21/NoInventedEconomicsTest.java`:

```java
package com.ceview.module2.submodule21;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Contract §1.4: an outage yields the last stored reading or an error — never a constant. */
class NoInventedEconomicsTest {

    // Port 9 (discard) refuses connections: a real, fast outage for every endpoint.
    private static final String DEAD = "http://localhost:9";

    private ExternalMarketDataClient client(MarketEconomicTrendRepository repo) {
        return new ExternalMarketDataClient(DEAD, DEAD, DEAD + "/cdn@", repo, new ObjectMapper());
    }

    @Test
    void theConstantDefaultTablesAreGone() {
        assertThat(Arrays.stream(ExternalMarketDataClient.class.getDeclaredFields())
                .map(java.lang.reflect.Field::getName))
                .doesNotContain("GDP_DEFAULTS", "FOREX_DEFAULTS");
    }

    @Test
    void anOutageReusesTheLastStoredReading() {
        MarketEconomicTrendRepository repo = mock(MarketEconomicTrendRepository.class);
        MarketEconomicTrend last = new MarketEconomicTrend();
        last.setMarket("korea");
        last.setGdpLatest(2.1);
        last.setForexLatest(0.0416);
        last.setFetchedAt(OffsetDateTime.parse("2026-08-30T00:00:00Z"));
        when(repo.findTopByMarketOrderByFetchedAtDesc("korea")).thenReturn(Optional.of(last));

        assertThat(client(repo).fetchGdpGrowth("korea").gdpGrowth()).isEqualTo(2.1);
        assertThat(client(repo).fetchForexRate("korea").rateVsPhp()).isEqualTo(0.0416);
    }

    @Test
    void anOutageWithNoStoredReadingIsAnError() {
        MarketEconomicTrendRepository repo = mock(MarketEconomicTrendRepository.class);
        when(repo.findTopByMarketOrderByFetchedAtDesc("korea")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> client(repo).fetchGdpGrowth("korea"))
                .isInstanceOf(EconomicDataUnavailableException.class).hasMessageContaining("GDP");
        assertThatThrownBy(() -> client(repo).fetchForexRate("korea"))
                .isInstanceOf(EconomicDataUnavailableException.class).hasMessageContaining("forex");
    }
}
```

(`setMarket`, `setGdpLatest`, `setForexLatest`, `setFetchedAt` are the Lombok accessors of the
`MarketEconomicTrend` fields `market`, `gdpLatest`, `forexLatest`, `fetchedAt`.)

- [ ] **Step 2: Run** — `./mvnw -B test -Dtest=ForexUnitTest+NoInventedEconomicsTest` → FAIL (no `phpPerUnit`, no 5-arg constructor, no exception class).

- [ ] **Step 3: Implement**

`submodule21/EconomicDataUnavailableException.java`:

```java
package com.ceview.module2.submodule21;

/** No live and no stored reading exists; the ingestion pair is skipped, never faked (contract §1.4). */
public class EconomicDataUnavailableException extends RuntimeException {
    public EconomicDataUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

`ExternalMarketDataClient.java`:

1. Delete the fields `GDP_DEFAULTS`, `FOREX_DEFAULTS` and `CURRENCY_CDN_BASE`. Keep `CURRENCY_CDN_SUFFIX`.
   Add `private final String currencyCdnBase;`.
2. Replace the constructor:

```java
    public ExternalMarketDataClient(
            @Value("${ceview.external.worldbank.base-url}") String worldBankUrl,
            @Value("${ceview.external.forex.base-url}") String forexUrl,
            @Value("${ceview.external.forex.cdn-base}") String currencyCdnBase,
            MarketEconomicTrendRepository economicTrendRepo,
            ObjectMapper objectMapper) {
        this.worldBankClient   = WebClient.builder().baseUrl(worldBankUrl).build();
        this.forexClient       = WebClient.builder().baseUrl(forexUrl).build();
        this.forexBaseUrl      = forexUrl.replaceAll("/$", "");
        this.currencyCdnBase   = currencyCdnBase;
        this.economicTrendRepo = economicTrendRepo;
        this.objectMapper      = objectMapper;
    }
```

3. Add:

```java
    /**
     * Contract §1: PHP per 1 unit of the foreign currency. The CDN (base PHP) quotes the
     * inverse, so invert it. Null when the quote is missing, zero or negative.
     */
    @SuppressWarnings("unchecked")
    static Double phpPerUnit(Map<String, Object> cdnResponse, String currencyLower) {
        Object php = cdnResponse.get("php");
        if (!(php instanceof Map<?, ?> rates)) return null;
        Object quote = ((Map<String, Object>) rates).get(currencyLower);
        if (!(quote instanceof Number n) || n.doubleValue() <= 0) return null;
        return 1.0 / n.doubleValue();
    }
```

4. In `fetchGdpGrowth`, replace the final `return new GdpDataDto(countryCode, GDP_DEFAULTS.getOrDefault(countryCode, 2.0), 0);` with:

```java
        return economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(marketId)
                .filter(t -> t.getGdpLatest() != null)
                .map(t -> new GdpDataDto(countryCode, t.getGdpLatest(), 0))
                .orElseThrow(() -> new EconomicDataUnavailableException(
                        "GDP growth unavailable for " + marketId + " and no stored reading exists", null));
```

5. Replace the whole `fetchForexRate` method:

```java
    public ForexDataDto fetchForexRate(String marketId) {
        String currencyCode  = CURRENCY_CODE.getOrDefault(marketId, "USD");
        String currencyLower = currencyCode.toLowerCase();
        Exception failure = null;
        try {
            java.net.URI uri = java.net.URI.create(currencyCdnBase + "latest" + CURRENCY_CDN_SUFFIX);
            Map<String, Object> response = forexClient.get().uri(uri).retrieve()
                    .bodyToMono(MAP_TYPE).block(TIMEOUT);
            Double rate = response == null ? null : phpPerUnit(response, currencyLower);
            if (rate != null) {
                return new ForexDataDto(currencyCode, rate, response.getOrDefault("date", "").toString());
            }
        } catch (Exception e) {
            failure = e;
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("Forex fetch failed for {} — reusing last stored reading: {}", currencyCode, e.getMessage());
            MDC.remove("code");
        }
        final Exception cause = failure;
        return economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(marketId)
                .filter(t -> t.getForexLatest() != null)
                .map(t -> new ForexDataDto(currencyCode, t.getForexLatest(), ""))
                .orElseThrow(() -> new EconomicDataUnavailableException(
                        "forex rate unavailable for " + marketId + " and no stored reading exists", cause));
    }
```

6. In `fetchForexTrend`, replace `CURRENCY_CDN_BASE + dateStr + CURRENCY_CDN_SUFFIX` with
   `currencyCdnBase + dateStr + CURRENCY_CDN_SUFFIX`, and replace the `.flatMap(resp -> { … })` lambda with:

```java
                        .flatMap(resp -> {
                            Double rate = phpPerUnit(resp, currencyLower);
                            return rate == null ? Mono.empty()                         // omit, never invent
                                                : Mono.just(new ForexTrendPoint(monthKey, rate));
                        })
```

7. Javadoc: on `ForexDataDto`, `ForexTrendPoint`, `ForexTrendDto` (and `MarketDtos.ForexTrendPointDto`)
   replace "foreign-currency units per PHP" with "PHP per 1 unit of the foreign currency (contract §1)".
8. Replace the class Javadoc line `All methods fall back to static defaults on any exception.` with
   `On an outage, current-value methods return the last stored reading or throw EconomicDataUnavailableException; trend methods return the last stored series or null.`

`application.yml` — replace the forex block:

```yaml
    forex:
      base-url: ${FOREX_BASE_URL:https://api.frankfurter.dev}
      cdn-base: ${FOREX_CDN_BASE:https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@}
```

`src/test/resources/application.properties` — add `ceview.external.forex.cdn-base=http://localhost:9999/cdn@`.

- [ ] **Step 4: Run** — `./mvnw -B test -Dtest=ForexUnitTest+NoInventedEconomicsTest+EconomicLastKnownGoodTest` → PASS; `./mvnw -B test` → BUILD SUCCESS.
- [ ] **Step 5: Checkpoint** — Suggested: `fix(module-2): store forex as PHP per foreign unit and never invent GDP or forex`

---

### Task 1.3: Forex 30-period mean includes the current observation (contract §1.2)

Today `MarketDataIngestionService.java:140–146` averages only *prior* rows, so the fresh rate is ignored
whenever any history exists.

- [ ] **Step 1: Failing test** — `submodule21/ForexMeanTest.java`

```java
package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ForexMeanTest {

    private static MarketSignalRecord row(Double forex) {
        MarketSignalRecord r = new MarketSignalRecord();
        r.setForexRate(forex);
        return r;
    }

    @Test
    void currentObservationIsPartOfTheMean() {
        List<MarketSignalRecord> priorNewestFirst = List.of(row(0.040), row(0.040));
        assertThat(MarketDataIngestionService.forexMean(priorNewestFirst, 0.043))
                .isCloseTo(0.041, within(1e-9));
    }

    @Test
    void usesAtMostTwentyNinePriorWeeksAndSkipsNulls() {
        List<MarketSignalRecord> prior = new ArrayList<>();
        prior.add(row(null));
        for (int i = 0; i < 29; i++) prior.add(row(1.0));
        for (int i = 0; i < 10; i++) prior.add(row(100.0));   // beyond the 30-period window
        assertThat(MarketDataIngestionService.forexMean(prior, 1.0)).isEqualTo(1.0);
    }

    @Test
    void noHistoryMeansTheCurrentObservation() {
        assertThat(MarketDataIngestionService.forexMean(List.of(), 0.0416)).isEqualTo(0.0416);
    }
}
```

- [ ] **Step 2: Run** — FAIL (`forexMean` not found).

- [ ] **Step 3: Implement** — in `MarketDataIngestionService.java` add:

```java
    /**
     * Contract §1.2 / FR2.4: mean of this week's observed rate and the forex_rate of up to
     * 29 immediately preceding weekly rows (30 weekly periods), PHP per 1 foreign unit.
     */
    static double forexMean(List<MarketSignalRecord> priorNewestFirst, double currentRate) {
        List<Double> window = new ArrayList<>();
        window.add(currentRate);
        priorNewestFirst.stream()
                .map(MarketSignalRecord::getForexRate)
                .filter(Objects::nonNull)
                .limit(FOREX_ROLLING_WINDOW - 1)
                .forEach(window::add);
        return mean(window);
    }
```

and change the existing `private double mean(List<Double> values)` to `private static double mean(List<Double> values)`.
(Task 1.4 replaces the call site at lines 140–146.)

- [ ] **Step 4: Run** — `./mvnw -B test -Dtest=ForexMeanTest` → PASS.
- [ ] **Step 5: Checkpoint** — Suggested: `fix(module-2): include the current forex observation in its 30-week mean`

---

### Task 1.4: Week key on the entity; weekly upsert (contract §2.1, §2.2)

- [ ] **Step 1: Failing test** — `submodule21/WeeklyUpsertIngestionTest.java`

```java
package com.ceview.module2.submodule21;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class WeeklyUpsertIngestionTest {

    private static final String CATEGORY = "Coastal & Island";

    @Autowired MarketDataIngestionService ingestion;
    @Autowired MarketSignalRecordRepository signalRepo;
    @Autowired BusinessProfileRepository profileRepo;
    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;

    private BusinessProfile profile;
    private OffsetDateTime thisWeek;

    @BeforeEach
    void setUp() {
        signalRepo.deleteAll();
        profileRepo.deleteAll();
        profile = new BusinessProfile();
        profile.setBusinessProfileId(UUID.randomUUID());
        profile.setBusinessName("Weekly Upsert Test");
        profile.setCategoriesList(List.of(CATEGORY));
        profileRepo.save(profile);

        thisWeek = IsoWeek.startOf(OffsetDateTime.now(ZoneOffset.UTC));
        for (int weeksAgo = 4; weeksAgo >= 1; weeksAgo--) {
            MarketSignalRecord r = new MarketSignalRecord();
            r.setBusinessProfileId(profile.getBusinessProfileId());
            r.setTargetMarket("korea");
            r.setCategory(CATEGORY);
            r.setTrendIndex(50.0 + weeksAgo);
            r.setForexRate(0.040);
            r.setSource("pytrends");
            r.setAggregatedAt(thisWeek.minusWeeks(weeksAgo).plusDays(2));
            signalRepo.save(r);
        }

        when(externalClient.fetchGdpGrowth(anyString()))
                .thenReturn(new ExternalMarketDataClient.GdpDataDto("KR", 2.1, 2025));
        when(externalClient.fetchForexRate(anyString()))
                .thenReturn(new ExternalMarketDataClient.ForexDataDto("KRW", 0.045, "2026-09-09"));
        when(ai.fetchTrends(anyMap())).thenReturn(Map.of("trend_index", 60.0, "source", "pytrends"));
        when(ai.computeSeasonality(anyMap())).thenReturn(Map.of(
                "seasonality_score", 0.5, "rolling_7d_avg", 53.0, "rolling_30d_avg", 52.0,
                "rolling_7d_std", 3.0, "spike_indicator", false));
    }

    private List<MarketSignalRecord> koreaRows() {
        return signalRepo.findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profile.getBusinessProfileId(), "korea", CATEGORY);
    }

    @Test
    void theEntityDerivesItsWeekKeyFromAggregatedAt() {
        MarketSignalRecord oldest = koreaRows().get(3);
        assertThat(oldest.getWeekYear()).isEqualTo(IsoWeek.weekYear(thisWeek.minusWeeks(4)));
        assertThat(oldest.getWeekNumber()).isEqualTo(IsoWeek.number(thisWeek.minusWeeks(4)));
    }

    @Test
    void ingestingTwiceInOneWeekOverwritesTheSameRow() {
        ingestion.ingestForProfile(profile);
        ingestion.ingestForProfile(profile);

        List<MarketSignalRecord> rows = koreaRows();
        assertThat(rows).hasSize(5);                             // 4 prior weeks + this week, once
        assertThat(rows.get(0).getTrendIndex()).isEqualTo(60.0);
        assertThat(rows.get(0).getWeekNumber()).isEqualTo(IsoWeek.number(thisWeek));
    }

    @Test
    void pastWeeksAreNeverModified() {
        ingestion.ingestForProfile(profile);
        assertThat(koreaRows().subList(1, 5)).extracting(MarketSignalRecord::getTrendIndex)
                .containsExactly(51.0, 52.0, 53.0, 54.0);
    }

    @Test
    void seasonalityRunsOverPriorWeeksPlusTheCurrentObservation() {
        ingestion.ingestForProfile(profile);
        ingestion.ingestForProfile(profile);

        @SuppressWarnings({"unchecked", "rawtypes"})
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass((Class) Map.class);
        verify(ai, atLeastOnce()).computeSeasonality(payload.capture());
        Map<String, Object> last = payload.getAllValues().get(payload.getAllValues().size() - 1);
        assertThat((List<?>) last.get("weekly_history"))
                .containsExactly(54.0, 53.0, 52.0, 51.0, 60.0);           // chronological, no duplicate
    }

    @Test
    void forexIsTheThirtyWeekMeanIncludingThisWeek() {
        ingestion.ingestForProfile(profile);
        // (0.045 + 4 × 0.040) / 5
        assertThat(koreaRows().get(0).getForexRate()).isEqualTo((0.045 + 0.160) / 5);
    }

    @Test
    void existingHistoryMeansNoBackfill() {
        ingestion.ingestForProfile(profile);
        verify(ai, never()).fetchTrendHistory(anyMap());
    }
}
```

- [ ] **Step 2: Run** — `./mvnw -B test -Dtest=WeeklyUpsertIngestionTest` → FAIL (no `getWeekYear`; 6 rows).

- [ ] **Step 3: Implement**

`MarketSignalRecord.java` — add fields after `aggregatedAt`, and extend the lifecycle hooks:

```java
    /** ISO-8601 week-based year of aggregatedAt in UTC (contract §2.1). */
    @Column(name = "week_year")    private Integer weekYear;
    /** ISO-8601 week number (1–53) of aggregatedAt in UTC (contract §2.1). */
    @Column(name = "week_number")  private Integer weekNumber;
```

Replace the existing `onCreate()` with:

```java
    @PrePersist
    void onCreate() {
        if (signalRecordId == null) signalRecordId = UUID.randomUUID();
        if (aggregatedAt == null) aggregatedAt = OffsetDateTime.now();
        // (keep the existing explanatory comment about V22's NOT NULL source here)
        if (source == null) source = "unknown";
        syncWeekKey();
    }

    @PreUpdate
    void onUpdate() {
        syncWeekKey();
    }

    /** The week key always follows aggregatedAt, so it can never drift from it. */
    private void syncWeekKey() {
        if (aggregatedAt != null) {
            weekYear   = IsoWeek.weekYear(aggregatedAt);
            weekNumber = IsoWeek.number(aggregatedAt);
        }
    }
```

`MarketSignalRecordRepository.java` — add (with `import java.util.Optional;`):

```java
    /** The row for one week key — at most one exists (contract §2.1, unique index in V27). */
    Optional<MarketSignalRecord> findByBusinessProfileIdAndCategoryAndTargetMarketAndWeekYearAndWeekNumber(
            UUID businessProfileId, String category, String targetMarket, Integer weekYear, Integer weekNumber);

    /** Contract §2.2 step 2: real rows strictly before the given week, chronological. */
    @Query("""
           SELECT r FROM MarketSignalRecord r
            WHERE r.businessProfileId = :profileId
              AND r.targetMarket = :market
              AND r.category = :category
              AND r.source = 'pytrends'
              AND r.trendIndex IS NOT NULL
              AND (r.weekYear < :weekYear OR (r.weekYear = :weekYear AND r.weekNumber < :weekNumber))
            ORDER BY r.weekYear ASC, r.weekNumber ASC
           """)
    List<MarketSignalRecord> findRealPriorWeeks(@Param("profileId") UUID profileId,
                                                @Param("market") String market,
                                                @Param("category") String category,
                                                @Param("weekYear") int weekYear,
                                                @Param("weekNumber") int weekNumber);
```

`MarketDataIngestionService.java` — replace the whole `ingestMarket` method:

```java
    private void ingestMarket(BusinessProfile profile, String market, String category) {
        UUID profileId = profile.getBusinessProfileId();

        // ── Concurrent external fetches (throw EconomicDataUnavailableException → pair skipped) ──
        CompletableFuture<ExternalMarketDataClient.GdpDataDto> gdpFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchGdpGrowth(market));
        CompletableFuture<ExternalMarketDataClient.ForexDataDto> forexFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchForexRate(market));
        CompletableFuture.allOf(gdpFuture, forexFuture).join();
        ExternalMarketDataClient.GdpDataDto   gdp   = gdpFuture.join();
        ExternalMarketDataClient.ForexDataDto forex = forexFuture.join();

        // ── Contract §2.2 steps 1–3: current key, prior weeks, backfill if none ──
        OffsetDateTime now        = OffsetDateTime.now(ZoneOffset.UTC);
        int            weekYear   = IsoWeek.weekYear(now);
        int            weekNumber = IsoWeek.number(now);
        List<MarketSignalRecord> prior =
                signalRepo.findRealPriorWeeks(profileId, market, category, weekYear, weekNumber);
        if (prior.isEmpty()) {
            backfillHistory(profileId, market, category, IsoWeek.startOf(now));
            prior = signalRepo.findRealPriorWeeks(profileId, market, category, weekYear, weekNumber);
        }

        // ── Step 4: the current observation ─────────────────────────────────────
        Map<String, Object> trendsResult = ai.fetchTrends(
                Map.of("market", market, "categories", List.of(category)));
        String source = str(trendsResult, "source");
        double trendIndex = Math.max(0.0, Math.min(100.0,
                ((Number) trendsResult.getOrDefault("trend_index", 0.0)).doubleValue()));

        // ── Step 5: statistics over prior weeks ⧺ [current observation] ─────────
        List<Double> weeklyHistory = prior.stream()
                .map(MarketSignalRecord::getTrendIndex)
                .collect(Collectors.toList());
        weeklyHistory.add(trendIndex);

        List<MarketSignalRecord> priorNewestFirst = new ArrayList<>(prior);
        Collections.reverse(priorNewestFirst);
        double forexAvg = forexMean(priorNewestFirst, forex.rateVsPhp());

        Double  seasonalityScore = null;
        Double  rolling7d        = null;
        Double  rolling30d       = null;
        Double  rollingStd7d     = null;
        Boolean spike            = null;
        Double  yoyRatio         = null;
        try {
            Map<String, Object> s = ai.computeSeasonality(Map.of(
                    "profile_id",     profileId.toString(),
                    "market",         market,
                    "weekly_history", weeklyHistory));
            seasonalityScore = numOrNull(s, "seasonality_score");
            rolling7d        = numOrNull(s, "rolling_7d_avg");
            rolling30d       = numOrNull(s, "rolling_30d_avg");
            rollingStd7d     = numOrNull(s, "rolling_7d_std");
            spike            = Boolean.TRUE.equals(s.get("spike_indicator"));
            yoyRatio         = numOrNull(s, "yoy_ratio");
        } catch (Exception e) {
            // No local substitute: a guessed statistic renders exactly like a measured one.
            log.warn("Seasonality service unavailable for market={}; statistics left null: {}",
                     market, e.getMessage());
        }

        // ── Step 6: overwrite this week's row in place, or insert it ─────────────
        MarketSignalRecord record = signalRepo
                .findByBusinessProfileIdAndCategoryAndTargetMarketAndWeekYearAndWeekNumber(
                        profileId, category, market, weekYear, weekNumber)
                .orElseGet(MarketSignalRecord::new);
        record.setBusinessProfileId(profileId);
        record.setTargetMarket(market);
        record.setCategory(category);
        record.setTrendIndex(trendIndex);
        record.setForexRate(forexAvg);
        record.setGdpGrowth(gdp.gdpGrowth());
        record.setSeasonalityScore(seasonalityScore);
        record.setRollingAverage(rolling7d);          // legacy column — kept for backward compat
        record.setRollingAverage7d(rolling7d);
        record.setRollingAverage30d(rolling30d);
        record.setRollingStdDev(rollingStd7d);
        record.setSpikeIndicator(spike);
        record.setYoyRatio(yoyRatio);
        record.setSource(source);
        record.setSourceFetchedAt(now);
        record.setAggregatedAt(now);
        signalRepo.save(record);

        log.debug("Upserted week {}-W{} profile={} market={} category={} trend={}",
                weekYear, weekNumber, profileId, market, category, trendIndex);
    }

    private Double numOrNull(Map<String, Object> map, String key) {
        Object v = map == null ? null : map.get(key);
        return v instanceof Number n ? n.doubleValue() : null;
    }
```

Remove the now-unused private `num(Map, String, double)` helper. Add imports `java.time.ZoneOffset`
(already imported), `java.util.ArrayList`, `java.util.Collections` if missing. Leave the existing
`backfillHistory` in place for this task, but change its signature to
`private void backfillHistory(UUID profileId, String market, String category, OffsetDateTime currentWeekStart)`
with body `throw new UnsupportedOperationException("replaced in Task 1.5");` — Task 1.5 replaces it,
and no test in this task reaches it.

- [ ] **Step 4: Run** — `./mvnw -B test -Dtest=WeeklyUpsertIngestionTest+ForexMeanTest+CategoryDimensionTest+SignalProvenanceTest` → PASS.
- [ ] **Step 5: Checkpoint** — Suggested: `fix(module-2): keep one signal row per ISO week`

---

### Task 1.5: 64-week backfill with real per-week statistics (contract §2.3)

- [ ] **Step 1: Failing FastAPI tests**

`tests/unit/test_seasonality_series.py`:

```python
from fastapi.testclient import TestClient

from app.main import app
from app.services.seasonal_shift_detector import compute_series


def test_one_point_per_week():
    points = compute_series([10.0, 20.0, 30.0])
    assert len(points) == 3
    assert points[0]["rolling_7d_avg"] == 10.0
    assert points[2]["rolling_7d_avg"] == 20.0
    assert "computed_at" not in points[0]


def test_no_look_ahead():
    calm = compute_series([10.0, 10.0, 10.0])
    spiked = compute_series([10.0, 10.0, 90.0])
    assert calm[1] == spiked[1]
    assert spiked[2]["spike_indicator"] is True


def test_endpoint_returns_one_point_per_input():
    with TestClient(app) as client:
        res = client.post("/internal/market-data/seasonality/series",
                          json={"market": "korea", "weekly_history": [40.0, 42.0, 44.0]})
    assert res.status_code == 200
    body = res.json()
    assert body["market"] == "korea"
    assert len(body["points"]) == 3
    assert 0.0 <= body["points"][2]["seasonality_score"] <= 1.0
```

`tests/unit/test_trend_history_backfill.py`:

```python
import pandas as pd

from app.services import trend_service


class _FakeTrendReq:
    last_timeframe = None

    def __init__(self, *args, **kwargs):
        pass

    def build_payload(self, kw_list, timeframe, geo):
        _FakeTrendReq.last_timeframe = timeframe

    def interest_over_time(self):
        idx = pd.date_range("2025-01-05", periods=70, freq="W-SUN")
        return pd.DataFrame({"kw": [float(i) for i in range(70)]}, index=idx)


def test_history_uses_five_years_and_keeps_the_last_64_weeks(monkeypatch):
    monkeypatch.setattr(trend_service, "_TrendReq", _FakeTrendReq)
    monkeypatch.setattr(trend_service, "_jitter_sleep", lambda: None)

    result = trend_service.fetch_trend_history("korea", ["Coastal & Island"], weeks=64)

    assert _FakeTrendReq.last_timeframe == "today 5-y"
    assert len(result["weekly_series"]) == 64
    assert result["weekly_series"][0]["trend_index"] == 6.0      # 70 − 64
    assert result["weekly_series"][-1]["trend_index"] == 69.0
    assert result["source"] == "pytrends"


def test_history_endpoint_accepts_64_weeks(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setattr(trend_service, "_TrendReq", _FakeTrendReq)
    monkeypatch.setattr(trend_service, "_jitter_sleep", lambda: None)
    with TestClient(app) as client:
        res = client.post("/internal/market-data/trends/history",
                          json={"market": "korea", "categories": ["Coastal & Island"], "weeks": 64})
    assert res.status_code == 200
    assert len(res.json()["weekly_series"]) == 64
```

- [ ] **Step 2: Run** — `pytest tests/unit/test_seasonality_series.py tests/unit/test_trend_history_backfill.py -v` → FAIL (`compute_series` missing; timeframe `today 64-w`; `weeks` rejected above 52).

- [ ] **Step 3: Implement (FastAPI)**

`seasonal_shift_detector.py` — append:

```python
def compute_series(weekly_series: list[float]) -> list[dict]:
    """compute() at every week using only that week and earlier ones (no look-ahead)."""
    points: list[dict] = []
    for i in range(len(weekly_series)):
        point = compute(weekly_series[: i + 1])
        point.pop("computed_at", None)
        points.append(point)
    return points
```

`trend_service.py` — in `fetch_trend_history`, replace
`pt.build_payload(kw_list=keywords[:5], timeframe=f"today {weeks}-w", geo=geo_code)` with
`pt.build_payload(kw_list=keywords[:5], timeframe=TIMEFRAME, geo=geo_code)` and, immediately after the
`series = [ … ]` list comprehension, add:

```python
        # Contract §2.3: weekly points from the `today 5-y` timeframe, trimmed to the last `weeks`.
        series = series[-weeks:]
```

Update the docstring's `weeks` line to: `weeks: number of trailing weekly points to keep (contract §2.3: 64)`.

`app/routers/market_data.py`:
- In `TrendHistoryRequest`, change `weeks: int = Field(default=12, ge=4, le=52)` to
  `weeks: int = Field(default=64, ge=4, le=64)`.
- Append:

```python
class SeasonalitySeriesRequest(BaseModel):
    market: str
    weekly_history: list[float] = Field(default_factory=list)


class SeasonalityPoint(BaseModel):
    rolling_7d_avg:    float
    rolling_30d_avg:   float
    rolling_7d_std:    float
    spike_indicator:   bool
    yoy_ratio:         float | None
    seasonality_score: float = Field(ge=0.0, le=1.0)


class SeasonalitySeriesResponse(BaseModel):
    market: str
    points: list[SeasonalityPoint]


@router.post("/seasonality/series", response_model=SeasonalitySeriesResponse)
def compute_seasonality_series(body: SeasonalitySeriesRequest) -> SeasonalitySeriesResponse:
    """Per-week seasonal-shift statistics for a backfilled series (contract §2.3)."""
    points = seasonal_shift_detector.compute_series(body.weekly_history)
    return SeasonalitySeriesResponse(market=body.market, points=[SeasonalityPoint(**p) for p in points])
```

- [ ] **Step 4: Run** — `pytest tests/ -v` → PASS.

- [ ] **Step 5: Failing Spring test** — `submodule21/BackfillTest.java`

```java
package com.ceview.module2.submodule21;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class BackfillTest {

    private static final String CATEGORY = "Coastal & Island";

    @Autowired MarketDataIngestionService ingestion;
    @Autowired MarketSignalRecordRepository signalRepo;
    @Autowired BusinessProfileRepository profileRepo;
    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;

    private BusinessProfile profile;
    private OffsetDateTime thisWeek;

    /** The Sunday that starts the PyTrends week whose Monday is `weeksAgo` ISO weeks back. */
    private LocalDate pytrendsSunday(int weeksAgo) {
        return thisWeek.toLocalDate().minusWeeks(weeksAgo).minusDays(1);
    }

    @BeforeEach
    void setUp() {
        signalRepo.deleteAll();
        profileRepo.deleteAll();
        profile = new BusinessProfile();
        profile.setBusinessProfileId(UUID.randomUUID());
        profile.setBusinessName("Backfill Test");
        profile.setCategoriesList(List.of(CATEGORY));
        profileRepo.save(profile);
        thisWeek = IsoWeek.startOf(OffsetDateTime.now(ZoneOffset.UTC));

        // 6 prior weeks + one point that maps onto the CURRENT week (must not be backfilled).
        List<Map<String, Object>> series = new ArrayList<>();
        for (int weeksAgo = 6; weeksAgo >= 0; weeksAgo--) {
            series.add(Map.of("date", pytrendsSunday(weeksAgo).toString(), "trend_index", 40.0 + weeksAgo));
        }
        when(ai.fetchTrendHistory(anyMap())).thenReturn(Map.of("weekly_series", series, "source", "pytrends"));

        List<Map<String, Object>> points = new ArrayList<>();
        for (int i = 0; i < series.size(); i++) {
            Map<String, Object> p = new HashMap<>();
            p.put("rolling_7d_avg", 44.0); p.put("rolling_30d_avg", 43.0); p.put("rolling_7d_std", 2.0);
            p.put("spike_indicator", false); p.put("yoy_ratio", null); p.put("seasonality_score", 0.41);
            points.add(p);
        }
        when(ai.computeSeasonalitySeries(anyMap())).thenReturn(Map.of("points", points));
        when(ai.fetchTrends(anyMap())).thenReturn(Map.of("trend_index", 60.0, "source", "pytrends"));
        when(ai.computeSeasonality(anyMap())).thenReturn(Map.of(
                "seasonality_score", 0.42, "rolling_7d_avg", 44.0, "rolling_30d_avg", 43.0,
                "rolling_7d_std", 2.0, "spike_indicator", false));

        when(externalClient.fetchGdpGrowth(anyString()))
                .thenReturn(new ExternalMarketDataClient.GdpDataDto("KR", 2.1, 2025));
        when(externalClient.fetchForexRate(anyString()))
                .thenReturn(new ExternalMarketDataClient.ForexDataDto("KRW", 0.042, ""));
        // Only the month of the week 1 back has a forex point; only its year has a GDP point.
        OffsetDateTime oneBack = thisWeek.minusWeeks(1);
        when(externalClient.fetchForexTrend(anyString())).thenReturn(new ExternalMarketDataClient.ForexTrendDto(
                "KRW", List.of(new ExternalMarketDataClient.ForexTrendPoint(YearMonth.from(oneBack).toString(), 0.0415)),
                0.0415, OffsetDateTime.now()));
        when(externalClient.fetchGdpTrend(anyString())).thenReturn(new ExternalMarketDataClient.GdpTrendDto(
                "KR", List.of(new ExternalMarketDataClient.GdpTrendPoint(oneBack.getYear(), 1.9)),
                1.9, OffsetDateTime.now()));
    }

    private List<MarketSignalRecord> rowsOldestFirst() {
        List<MarketSignalRecord> rows = new ArrayList<>(signalRepo
                .findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                        profile.getBusinessProfileId(), "korea", CATEGORY));
        java.util.Collections.reverse(rows);
        return rows;
    }

    @Test
    void requestsSixtyFourWeeks() {
        ingestion.ingestForProfile(profile);
        @SuppressWarnings({"unchecked", "rawtypes"})
        ArgumentCaptor<Map<String, Object>> req = ArgumentCaptor.forClass((Class) Map.class);
        verify(ai, org.mockito.Mockito.atLeastOnce()).fetchTrendHistory(req.capture());
        assertThat(req.getValue().get("weeks")).isEqualTo(64);
    }

    @Test
    void backfillsPriorWeeksOnlyAndTheCurrentWeekComesFromTheUpsert() {
        ingestion.ingestForProfile(profile);
        List<MarketSignalRecord> rows = rowsOldestFirst();
        assertThat(rows).hasSize(7);                                   // 6 backfilled + current
        MarketSignalRecord current = rows.get(6);
        assertThat(current.getTrendIndex()).isEqualTo(60.0);
        assertThat(current.getWeekNumber()).isEqualTo(IsoWeek.number(thisWeek));
    }

    @Test
    void backfilledRowsAreKeyedToTheirMondayAndCarryComputedStatistics() {
        ingestion.ingestForProfile(profile);
        List<MarketSignalRecord> backfilled = rowsOldestFirst().subList(0, 6);
        assertThat(backfilled).allSatisfy(r -> {
            assertThat(r.getAggregatedAt().getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
            assertThat(r.getAggregatedAt().getHour()).isZero();
            assertThat(r.getSeasonalityScore()).isEqualTo(0.41);
            assertThat(r.getRollingAverage7d()).isEqualTo(44.0);
            assertThat(r.getSpikeIndicator()).isFalse();
        });
        assertThat(backfilled.get(5).getAggregatedAt()).isEqualTo(thisWeek.minusWeeks(1));
    }

    @Test
    void backfilledEconomicsComeFromThePeriodOrAreNull() {
        ingestion.ingestForProfile(profile);
        List<MarketSignalRecord> backfilled = rowsOldestFirst().subList(0, 6);
        assertThat(backfilled.get(5).getForexRate()).isEqualTo(0.0415);   // its month has a point
        assertThat(backfilled.get(0).getForexRate()).isNull();            // 6 weeks back: other month
        assertThat(backfilled.get(5).getGdpGrowth()).isEqualTo(1.9);
    }

    @Test
    void aStatisticsOutageLeavesTheFieldsNullNeverHalf() {
        when(ai.computeSeasonalitySeries(anyMap())).thenThrow(new IllegalStateException("down"));
        ingestion.ingestForProfile(profile);
        assertThat(rowsOldestFirst().subList(0, 6)).allSatisfy(r -> {
            assertThat(r.getSeasonalityScore()).isNull();
            assertThat(r.getSpikeIndicator()).isNull();
            assertThat(r.getRollingAverage7d()).isNull();
        });
    }
}
```

- [ ] **Step 6: Run** — `./mvnw -B test -Dtest=BackfillTest` → FAIL (`computeSeasonalitySeries` missing; backfill throws `UnsupportedOperationException`).

- [ ] **Step 7: Implement (Spring)**

`AIInferenceGatewayService.java` — after `computeSeasonality`, add:

```java
    /** Per-week seasonal-shift statistics for a whole backfilled series (contract §2.3). */
    public Map<String, Object> computeSeasonalitySeries(Map<String, Object> payload) {
        return postTransformer("/internal/market-data/seasonality/series", payload);
    }
```

`MarketDataIngestionService.java` — add the constant `private static final int BACKFILL_WEEKS = 64;`
and replace the placeholder `backfillHistory` with:

```java
    /**
     * Contract §2.3: 64 weekly points keyed to the ISO week of (point date + 1 day), statistics
     * from compute_series (no look-ahead), per-period GDP/forex or NULL. The point that maps onto
     * the current week is skipped — the upsert writes the current week.
     */
    @SuppressWarnings("unchecked")
    private void backfillHistory(UUID profileId, String market, String category,
                                 OffsetDateTime currentWeekStart) {
        Map<String, Object> historyResult = ai.fetchTrendHistory(
                Map.of("market", market, "categories", List.of(category), "weeks", BACKFILL_WEEKS));
        String source = str(historyResult, "source");
        List<Map<String, Object>> series = (List<Map<String, Object>>) historyResult.get("weekly_series");
        if (series == null || series.isEmpty()) {
            throw new IllegalStateException("trend history returned no weekly series for " + market);
        }

        List<Double> values = series.stream()
                .map(p -> ((Number) p.get("trend_index")).doubleValue())
                .collect(Collectors.toList());
        List<Map<String, Object>> stats = seriesStats(market, values);

        Map<Integer, Double> gdpByYear = new HashMap<>();
        ExternalMarketDataClient.GdpTrendDto gdpTrend = externalClient.fetchGdpTrend(market);
        if (gdpTrend != null) gdpTrend.points().forEach(p -> gdpByYear.put(p.year(), p.value()));
        Map<String, Double> forexByMonth = new HashMap<>();
        ExternalMarketDataClient.ForexTrendDto forexTrend = externalClient.fetchForexTrend(market);
        if (forexTrend != null) forexTrend.points().forEach(p -> forexByMonth.put(p.date(), p.value()));

        Map<String, MarketSignalRecord> byWeek = new LinkedHashMap<>();   // later point wins
        for (int i = 0; i < series.size(); i++) {
            OffsetDateTime monday = IsoWeek.startOf(LocalDate.parse((String) series.get(i).get("date"))
                    .plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC));
            if (!monday.isBefore(currentWeekStart)) continue;              // the current week
            Map<String, Object> s = stats == null ? null : stats.get(i);

            MarketSignalRecord rec = new MarketSignalRecord();
            rec.setBusinessProfileId(profileId);
            rec.setTargetMarket(market);
            rec.setCategory(category);
            rec.setTrendIndex(Math.max(0.0, Math.min(100.0, values.get(i))));
            rec.setGdpGrowth(gdpByYear.get(monday.getYear()));
            rec.setForexRate(forexByMonth.get(YearMonth.from(monday).toString()));
            rec.setSeasonalityScore(numOrNull(s, "seasonality_score"));
            rec.setRollingAverage(numOrNull(s, "rolling_7d_avg"));
            rec.setRollingAverage7d(numOrNull(s, "rolling_7d_avg"));
            rec.setRollingAverage30d(numOrNull(s, "rolling_30d_avg"));
            rec.setRollingStdDev(numOrNull(s, "rolling_7d_std"));
            rec.setSpikeIndicator(s == null ? null : Boolean.TRUE.equals(s.get("spike_indicator")));
            rec.setYoyRatio(numOrNull(s, "yoy_ratio"));
            rec.setSource(source);
            rec.setSourceFetchedAt(OffsetDateTime.now(ZoneOffset.UTC));
            rec.setAggregatedAt(monday);
            byWeek.put(IsoWeek.label(monday), rec);
        }
        signalRepo.saveAll(byWeek.values());
        log.info("Backfilled {} weekly signal records for profile={} market={} category={}",
                byWeek.size(), profileId, market, category);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> seriesStats(String market, List<Double> values) {
        try {
            Map<String, Object> res = ai.computeSeasonalitySeries(
                    Map.of("market", market, "weekly_history", values));
            Object points = res == null ? null : res.get("points");
            return points instanceof List<?> list && list.size() == values.size()
                    ? (List<Map<String, Object>>) list : null;
        } catch (Exception e) {
            log.warn("Seasonality series unavailable for market={}; backfill statistics left null: {}",
                     market, e.getMessage());
            return null;
        }
    }
```

Add imports `java.time.YearMonth`, `java.util.HashMap`, `java.util.LinkedHashMap` (keep `LocalDate`).

- [ ] **Step 8: Run** — `./mvnw -B test -Dtest=BackfillTest+WeeklyUpsertIngestionTest` → PASS; `./mvnw -B test` → BUILD SUCCESS.
- [ ] **Step 9: Checkpoint** — Suggested: `feat(module-2): backfill 64 weeks of history with real per-week statistics`

---

### Task 1.6: Economy insight reads the canonical unit (contract §1, appendix A.1)

`buildEconomyInsight` (`ForecastingService.java:959–984`) classifies forex with thresholds written for
foreign-per-PHP (`> 15.0` "exceptional" …), which are meaningless in PHP per foreign unit, and it
claims "an XGBoost economic viability score was used" even when the linear fallback ran. The
comparable, unit-independent signal is the direction of the rate over its trend window.

- [ ] **Step 1: Failing test** — `submodule22/EconomyInsightTest.java`

```java
package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.ExternalMarketDataClient.ForexTrendDto;
import com.ceview.module2.submodule21.ExternalMarketDataClient.ForexTrendPoint;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class EconomyInsightTest {

    private static ForexTrendDto trend(double... values) {
        List<ForexTrendPoint> pts = new ArrayList<>();
        for (int i = 0; i < values.length; i++) pts.add(new ForexTrendPoint(String.format("2026-%02d", i + 1), values[i]));
        return new ForexTrendDto("KRW", pts, values[values.length - 1], OffsetDateTime.now());
    }

    private static MarketScore score(Double gdp) {
        MarketScore ms = new MarketScore();
        ms.setGdpPerCapitaGrowth(gdp);
        return ms;
    }

    @Test
    void forexChangeIsFirstToLastPercent() {
        assertThat(ForecastingService.forexChangePct(trend(0.040, 0.041, 0.042))).isCloseTo(5.0, within(1e-9));
        assertThat(ForecastingService.forexChangePct(trend(0.042))).isNull();
        assertThat(ForecastingService.forexChangePct(null)).isNull();
    }

    @Test
    void describesGdpAndTheDirectionOfTheCurrency() {
        String text = ForecastingService.buildEconomyInsight(score(2.2), trend(0.040, 0.041, 0.042));
        assertThat(text).isEqualTo("GDP growth is moderate at 2.2% a year. The KRW has gained 5.0% against "
                + "the peso across the last 3 monthly readings, so visitors' purchasing power in Cebu is rising.");
        assertThat(text).doesNotContain("XGBoost");
    }

    @Test
    void saysSoWhenDataIsMissing() {
        String text = ForecastingService.buildEconomyInsight(score(null), trend(0.042));
        assertThat(text).isEqualTo("Latest GDP growth is not available. "
                + "Not enough exchange-rate history to judge visitors' purchasing power yet.");
    }
}
```

- [ ] **Step 2: Run** — `./mvnw -B test -Dtest=EconomyInsightTest` → FAIL.

- [ ] **Step 3: Implement** — in `ForecastingService.java`, replace `buildEconomyInsight` (lines 959–984) with:

```java
    /** % change of PHP per foreign unit across the forex trend window; null with < 2 points. */
    static Double forexChangePct(ForexTrendDto forexTrend) {
        if (forexTrend == null || forexTrend.points().size() < 2) return null;
        double first = forexTrend.points().get(0).value();
        double last  = forexTrend.points().get(forexTrend.points().size() - 1).value();
        return first > 0 ? (last - first) / first * 100.0 : null;
    }

    /** Contract §1: forex is PHP per 1 foreign unit, so read its direction, not its magnitude. */
    static String buildEconomyInsight(MarketScore ms, ForexTrendDto forexTrend) {
        Double gdp = ms.getGdpPerCapitaGrowth();
        String gdpPart = gdp == null
                ? "Latest GDP growth is not available."
                : String.format("GDP growth is %s at %.1f%% a year.",
                        gdp > 3.0 ? "strong" : gdp > 1.5 ? "moderate" : "subdued", gdp);
        Double change = forexChangePct(forexTrend);
        String fxPart = change == null
                ? "Not enough exchange-rate history to judge visitors' purchasing power yet."
                : String.format("The %s has %s %.1f%% against the peso across the last %d monthly readings, "
                                + "so visitors' purchasing power in Cebu is %s.",
                        forexTrend.currencyCode(), change >= 0 ? "gained" : "lost", Math.abs(change),
                        forexTrend.points().size(),
                        change >= 2.0 ? "rising" : change <= -2.0 ? "falling" : "broadly stable");
        return gdpPart + " " + fxPart;
    }
```

and at line 832 replace `buildEconomyInsight(b.ms()),` with `buildEconomyInsight(b.ms(), b.forexTrend()),`.

- [ ] **Step 4: Run** — `./mvnw -B test -Dtest=EconomyInsightTest+MarketDtoMappingTest` → PASS.
- [ ] **Step 5: Checkpoint** — Suggested: `fix(module-2): describe purchasing power from the canonical forex direction`

---

### Task 1.7: Frontend displays the canonical unit (contract §1.3)

- [ ] **Step 1: Update tests first** — in `frontend/components/module-2/2.2-market-radar/RadarPanels.test.tsx`:

Replace the `values` expectation in `'shows the four economic KPIs with the market’s own figures'` with:

```tsx
    expect(values).toEqual([
      korea.forexValue.toPrecision(3),
      `${korea.gdpValue.toFixed(1)}%`,
      korea.avgFlightPrice,
      `${korea.accessibilityScore}/10`,
    ]);
```

Replace the three `trends[1]` expectations with:

```tsx
    expect(trends[1].textContent).toContain(`${gdp.at(-1)!.toFixed(1)}%`);
    expect(trends[1].textContent).toContain(`${Math.min(...gdp).toFixed(1)}%`);
    expect(trends[1].textContent).toContain(`${Math.max(...gdp).toFixed(1)}%`);
```

Add inside `describe('PurchasingPowerTab', …)`:

```tsx
  // Contract §1.3: PHP per 1 foreign unit, 3 significant figures — KRW is ~0.04.
  it('shows forex in PHP per foreign unit to three significant figures', () => {
    const { container } = render(<PurchasingPowerTab market={{ ...korea, forexValue: 0.0416 }} />);
    expect(container.querySelector('.stat-tile .stat-value')?.textContent).toBe('0.0416');
  });

  it('shows GDP to one decimal place', () => {
    const { container } = render(<PurchasingPowerTab market={{ ...korea, gdpValue: 2.0133 }} />);
    expect(container.querySelectorAll('.stat-tile .stat-value')[1].textContent).toBe('2.0%');
  });
```

- [ ] **Step 2: Run** — `npx vitest run components/module-2/2.2-market-radar/RadarPanels.test.tsx` → FAIL (`'0.04'` vs `'0.0416'`).

- [ ] **Step 3: Implement**

`PurchasingPowerTab.tsx` — in `tiles`, change the forex `value` to `market.forexValue.toPrecision(3)` and
the GDP `value` to `` `${market.gdpValue.toFixed(1)}%` ``; change the two `MiniTrend` `format` props to
`format={(v) => v.toPrecision(3)}` (forex) and ``format={(v) => `${v.toFixed(1)}%`}`` (GDP).

`frontend/services/fixtures/markets.ts` — the fixture used foreign-per-PHP for KRW and a wrong scale for
JPY. Change:
- Korea: `forexValue: 23.8` → `forexValue: 0.042`; its `forexTrend` array →
  `[0.0433, 0.0429, 0.0431, 0.0426, 0.0427, 0.0424, 0.0422, 0.0424, 0.0420, 0.0418, 0.0420, 0.0420]`;
  in its `buildChartData({...})` call `forex: 23.8, forexAmp: 0.3` → `forex: 0.042, forexAmp: 0.0005`.
- Japan: `forexValue: 2.1` → `forexValue: 0.379`; its `forexTrend` array →
  `[0.371, 0.372, 0.370, 0.374, 0.373, 0.376, 0.375, 0.377, 0.379, 0.378, 0.380, 0.379]`;
  `forex: 2.1, forexAmp: 0.04` → `forex: 0.379, forexAmp: 0.003`.
- United States: unchanged (57.6 is already PHP per 1 USD).

- [ ] **Step 4: Run** — `npm run test:unit` → PASS; `npm run build` → PASS.
- [ ] **Step 5: Checkpoint** — Suggested: `fix(module-2): display forex as PHP per foreign unit`

---

### Task 1.8: V27 — week key, duplicate collapse, forex conversion (contract §1.4, §2.1)

- [ ] **Step 1: Write** `V27__module2_signal_week_key_and_forex_unit.sql`

```sql
-- V27 — Module 2 E2E, Phase 1 (docs/module-2/MODULE_2_E2E_CONTRACT.md §1.4, §2.1).

-- ── §2.1 week key ───────────────────────────────────────────────────────────
ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS week_year   INTEGER,
    ADD COLUMN IF NOT EXISTS week_number INTEGER;

UPDATE tbl_market_signal_record SET aggregated_at = NOW() WHERE aggregated_at IS NULL;

UPDATE tbl_market_signal_record
   SET week_year   = EXTRACT(ISOYEAR FROM aggregated_at AT TIME ZONE 'UTC')::INTEGER,
       week_number = EXTRACT(WEEK    FROM aggregated_at AT TIME ZONE 'UTC')::INTEGER;

-- Keep the row with the latest aggregated_at per key.
DELETE FROM tbl_market_signal_record msr
 USING (
   SELECT signal_record_id,
          ROW_NUMBER() OVER (
            PARTITION BY business_profile_id, COALESCE(category, ''), target_market, week_year, week_number
            ORDER BY aggregated_at DESC, signal_record_id DESC) AS rn
     FROM tbl_market_signal_record
 ) ranked
 WHERE msr.signal_record_id = ranked.signal_record_id
   AND ranked.rn > 1;

ALTER TABLE tbl_market_signal_record
    ALTER COLUMN week_year   SET NOT NULL,
    ALTER COLUMN week_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_msr_week_key
    ON tbl_market_signal_record
       (business_profile_id, (COALESCE(category, '')), target_market, week_year, week_number);

-- ── §1.4 forex: invert rows stored as foreign units per 1 PHP ───────────────
-- Canonical PHP-per-unit is < 1 for KRW/JPY and > 1 for USD; a value on the wrong
-- side of 1 is an inverted row. V18 seed values pass this test untouched.

UPDATE tbl_market_signal_record
   SET forex_rate = 1.0 / forex_rate
 WHERE forex_rate > 0
   AND ((target_market IN ('korea', 'japan') AND forex_rate > 1.0)
     OR (target_market = 'usa' AND forex_rate < 1.0));

UPDATE tbl_market_score ms
   SET forex_vs_php = 1.0 / ms.forex_vs_php
  FROM tbl_forecast_result fr
 WHERE ms.forecast_result_id = fr.forecast_result_id
   AND ms.forex_vs_php > 0
   AND ((fr.target_market IN ('korea', 'japan') AND ms.forex_vs_php > 1.0)
     OR (fr.target_market = 'usa' AND ms.forex_vs_php < 1.0));

-- Trend JSON first: the test reads forex_latest before it is inverted below.
UPDATE tbl_market_economic_trend t
   SET forex_trend_json = (
         SELECT jsonb_agg(
                  jsonb_build_object('date', e->>'date',
                                     'value', 1.0 / NULLIF((e->>'value')::DOUBLE PRECISION, 0))
                  ORDER BY ord)::TEXT
           FROM jsonb_array_elements(t.forex_trend_json::jsonb) WITH ORDINALITY AS x(e, ord))
 WHERE t.forex_trend_json IS NOT NULL
   AND t.forex_latest > 0
   AND ((t.market IN ('korea', 'japan') AND t.forex_latest > 1.0)
     OR (t.market = 'usa' AND t.forex_latest < 1.0));

UPDATE tbl_market_economic_trend
   SET forex_latest = 1.0 / forex_latest
 WHERE forex_latest > 0
   AND ((market IN ('korea', 'japan') AND forex_latest > 1.0)
     OR (market = 'usa' AND forex_latest < 1.0));
```

- [ ] **Step 2: Verify on the stack** — `cd backend && docker compose up -d --build`; Spring logs show
  `Migrating schema "public" to version "27 - module2 signal week key and forex unit"` and no error.
  In `psql` against the compose Postgres (credentials in `backend/docker-compose.yml`):

```sql
SELECT business_profile_id, COALESCE(category,''), target_market, week_year, week_number, COUNT(*)
  FROM tbl_market_signal_record GROUP BY 1,2,3,4,5 HAVING COUNT(*) > 1;            -- 0 rows
SELECT target_market, MIN(forex_rate), MAX(forex_rate) FROM tbl_market_signal_record GROUP BY 1;
-- korea/japan < 1, usa > 1
SELECT market, forex_latest, LEFT(forex_trend_json, 80) FROM tbl_market_economic_trend;
-- korea ≈ 0.04, japan ≈ 0.38, usa ≈ 58; JSON values on the same scale
```

- [ ] **Step 3: Checkpoint** — Suggested: `fix(module-2): add the weekly signal key and normalise stored forex (V27)`

---

## Phase 1 exit gate (verification)

1. `pytest tests/ -v` (fastapi-transformer), `./mvnw -B test`, `npm run test:unit`, `npm run build` — all green.
2. Stack: log in as `ramon.delacruz@ceview.local` (`MoalboalDive2024!`), click **Refresh forecast** twice, then

```sql
SELECT target_market, week_year, week_number, COUNT(*) FROM tbl_market_signal_record
 WHERE business_profile_id = '20000000-0000-0000-0000-000000000001'
   AND week_year = EXTRACT(ISOYEAR FROM NOW() AT TIME ZONE 'UTC')
   AND week_number = EXTRACT(WEEK FROM NOW() AT TIME ZONE 'UTC')
 GROUP BY 1,2,3;
```
   → exactly one row per market (3 rows, count 1 each).
3. `GET /api/forecasting/markets?category=Coastal%20%26%20Island` → Korea `forexLabel` `PHP per 1 KRW`,
   `forexValue` ≈ 0.04; the drawer's forex tile reads `0.0416`-style values, the GDP tile one decimal.
4. A brand-new operator (register, onboard, Refresh) gets ≥ 12 real weekly rows per (category, market)
   after the first run — the precondition for Phase 2's `MIN_RECORDS = 12`.
