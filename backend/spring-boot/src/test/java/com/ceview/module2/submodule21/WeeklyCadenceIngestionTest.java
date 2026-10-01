package com.ceview.module2.submodule21;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Module 2 E2E, Step 4 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-03).
 *
 * Covers the three cases the step asked for:
 *   (a) two ingests in the same ISO week produce one row, and the merge rule
 *       (replace measured values, keep the earliest first_seen_at, refresh
 *       source_fetched_at) holds;
 *   (b) a year-boundary week (ISO week 1 spanning Dec/Jan) is bucketed
 *       correctly during backfill;
 *   (c) the persisted history for a market is exactly N distinct, consecutive
 *       ISO weeks with no duplicates — the precondition ForecastingService's
 *       buildChartData relies on but does not itself need to re-derive.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class WeeklyCadenceIngestionTest {

    private static final String CATEGORY = "Coastal & Island";
    private static final String MARKET = "korea";

    @Autowired MarketDataIngestionService ingestion;
    @Autowired MarketSignalRecordRepository signalRepo;
    @Autowired BusinessProfileRepository profileRepo;
    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;

    private BusinessProfile profile;

    @BeforeEach
    void setUp() {
        signalRepo.deleteAll();
        profileRepo.deleteAll();
        profile = new BusinessProfile();
        profile.setBusinessProfileId(UUID.randomUUID());
        profile.setBusinessName("Weekly Cadence Test");
        profile.setCategoriesList(List.of(CATEGORY));
        profileRepo.save(profile);

        when(externalClient.fetchGdpGrowth(anyString()))
                .thenReturn(new ExternalMarketDataClient.GdpDataDto("KR", 2.1, 2025));
        when(externalClient.fetchForexRate(anyString()))
                .thenReturn(new ExternalMarketDataClient.ForexDataDto("KRW", 0.042, "2026-09-09"));
        when(ai.computeSeasonality(anyMap())).thenReturn(Map.of(
                "seasonality_score", 0.5, "rolling_7d_avg", 50.0, "rolling_30d_avg", 50.0,
                "rolling_7d_std", 3.0, "spike_indicator", false));
    }

    private List<MarketSignalRecord> koreaRows() {
        return signalRepo.findByProfileMarketCategoryOrderByWeekDesc(
                profile.getBusinessProfileId(), MARKET, CATEGORY);
    }

    // ── (a) same-week re-ingest upserts, and the merge rule holds ───────────

    @Test
    void twoIngestsInTheSameIsoWeekProduceOneRowForTheCurrentWeek() {
        // First ingest: empty history -> backfill runs (one older week + today).
        when(ai.fetchTrendHistory(anyMap())).thenReturn(Map.of(
                "source", "pytrends",
                "weekly_series", List.of(
                        Map.of("date", LocalDate.now(ZoneOffset.UTC).minusWeeks(1).toString(), "trend_index", 40.0),
                        Map.of("date", LocalDate.now(ZoneOffset.UTC).toString(), "trend_index", 50.0))));

        ingestion.ingestForProfile(profile);
        assertThat(koreaRows()).hasSize(2);   // 1 backfilled older week + 1 current week

        // Second ingest, same test run (same ISO week): takes the non-backfill
        // branch since history is no longer empty.
        when(ai.fetchTrends(anyMap())).thenReturn(Map.of("source", "pytrends", "trend_index", 75.0));

        ingestion.ingestForProfile(profile);

        List<MarketSignalRecord> rows = koreaRows();
        assertThat(rows).hasSize(2);   // still 2 — the current week was updated, not duplicated
        assertThat(rows.get(0).getTrendIndex()).isEqualTo(75.0);   // newest observation replaces it
    }

    @Test
    void theMergeRuleKeepsTheEarliestFirstSeenAtAndRefreshesTheRest() {
        when(ai.fetchTrendHistory(anyMap())).thenReturn(Map.of(
                "source", "pytrends",
                "weekly_series", List.of(
                        Map.of("date", LocalDate.now(ZoneOffset.UTC).toString(), "trend_index", 50.0))));

        ingestion.ingestForProfile(profile);
        MarketSignalRecord afterFirst = koreaRows().get(0);
        OffsetDateTime firstSeenAt = afterFirst.getFirstSeenAt();
        OffsetDateTime firstSourceFetchedAt = afterFirst.getSourceFetchedAt();
        assertThat(firstSeenAt).isNotNull();

        when(ai.fetchTrends(anyMap())).thenReturn(Map.of("source", "pytrends", "trend_index", 80.0));
        ingestion.ingestForProfile(profile);

        MarketSignalRecord afterSecond = koreaRows().get(0);
        assertThat(afterSecond.getFirstSeenAt()).isEqualTo(firstSeenAt);               // never moves
        assertThat(afterSecond.getSourceFetchedAt()).isAfterOrEqualTo(firstSourceFetchedAt); // refreshed
        assertThat(afterSecond.getTrendIndex()).isEqualTo(80.0);                       // replaced
    }

    // ── (b) a year-boundary ISO week is bucketed correctly ──────────────────

    @Test
    void aDecemberDateThatBelongsToNextYearsIsoWeekOneIsBucketedCorrectly() {
        // 2024-12-30 is a Monday, and — because Jan 1 2025 falls on a Wednesday —
        // it is ISO week 1 of 2025, not week 53 of 2024. dayOfYear/7+1 would get
        // this wrong (day 365 / 7 + 1 = 53); WeekFields.ISO gets it right.
        String boundaryDate = "2024-12-30";
        assertThat(LocalDate.parse(boundaryDate).getDayOfWeek().getValue()).isEqualTo(1); // sanity: a Monday

        when(ai.fetchTrendHistory(anyMap())).thenReturn(Map.of(
                "source", "pytrends",
                "weekly_series", List.of(
                        Map.of("date", boundaryDate, "trend_index", 44.0),
                        Map.of("date", LocalDate.now(ZoneOffset.UTC).toString(), "trend_index", 50.0))));

        ingestion.ingestForProfile(profile);

        MarketSignalRecord boundaryRow = koreaRows().stream()
                .filter(r -> r.getWeekStartDate().equals(LocalDate.of(2024, 12, 30)))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no row for the Dec 30 2024 week"));

        assertThat(boundaryRow.getIsoYear()).isEqualTo((short) 2025);
        assertThat(boundaryRow.getIsoWeek()).isEqualTo((short) 1);
    }

    // ── (c) persisted history is exactly N distinct, consecutive ISO weeks ──

    @Test
    void backfilledHistoryIsDistinctConsecutiveIsoWeeksWithNoDuplicates() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<Map<String, Object>> series = new java.util.ArrayList<>();
        for (int weeksAgo = 13; weeksAgo >= 0; weeksAgo--) {
            series.add(Map.of("date", today.minusWeeks(weeksAgo).toString(), "trend_index", 40.0 + weeksAgo));
        }
        when(ai.fetchTrendHistory(anyMap())).thenReturn(Map.of("source", "pytrends", "weekly_series", series));

        ingestion.ingestForProfile(profile);

        List<MarketSignalRecord> rows = koreaRows();   // ordered by weekStartDate DESC
        assertThat(rows).hasSize(14);

        // No duplicate ISO weeks.
        long distinctWeeks = rows.stream()
                .map(r -> r.getIsoYear() + "-W" + r.getIsoWeek())
                .distinct()
                .count();
        assertThat(distinctWeeks).isEqualTo(rows.size());

        // The 12 most recent are exactly 12 consecutive weeks, 7 days apart, no gaps.
        List<MarketSignalRecord> mostRecent12 = rows.subList(0, 12);
        for (int i = 0; i < mostRecent12.size() - 1; i++) {
            long gap = ChronoUnit.DAYS.between(
                    mostRecent12.get(i + 1).getWeekStartDate(), mostRecent12.get(i).getWeekStartDate());
            assertThat(gap).isEqualTo(7);
        }
    }
}
