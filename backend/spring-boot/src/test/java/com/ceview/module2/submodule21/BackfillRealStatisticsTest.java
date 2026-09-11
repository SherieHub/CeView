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
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Module 2 E2E, Step 5 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-04, H-33).
 *
 * MarketDataIngestionService.backfillHistory used to write the literal triple
 * seasonality=0.5 / spike=false / rolling_std=0.0 for EVERY backfilled row,
 * regardless of what the real series looked like. These tests prove that
 * triple is gone: real, varying per-week values are persisted on success, and
 * NULL (never a placeholder) is persisted when the per-week statistics
 * service is unreachable.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class BackfillRealStatisticsTest {

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
        profile.setBusinessName("Backfill Statistics Test");
        profile.setCategoriesList(List.of(CATEGORY));
        profileRepo.save(profile);

        when(externalClient.fetchGdpGrowth(anyString()))
                .thenReturn(new ExternalMarketDataClient.GdpDataDto("KR", 2.1, 2025));
        when(externalClient.fetchForexRate(anyString()))
                .thenReturn(new ExternalMarketDataClient.ForexDataDto("KRW", 0.042, "2026-09-09"));
        when(ai.computeSeasonality(anyMap())).thenReturn(Map.of(
                "seasonality_score", 0.5, "rolling_7d_avg", 50.0, "rolling_30d_avg", 50.0,
                "rolling_7d_std", 3.0, "spike_indicator", false));

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        // 5 points: 4 historical (backfilled) + 1 "today" (handled by the normal path).
        List<Map<String, Object>> series = List.of(
                Map.of("date", today.minusWeeks(4).toString(), "trend_index", 30.0),
                Map.of("date", today.minusWeeks(3).toString(), "trend_index", 45.0),
                Map.of("date", today.minusWeeks(2).toString(), "trend_index", 60.0),
                Map.of("date", today.minusWeeks(1).toString(), "trend_index", 90.0),
                Map.of("date", today.toString(),                "trend_index", 50.0));
        when(ai.fetchTrendHistory(anyMap())).thenReturn(Map.of("source", "pytrends", "weekly_series", series));
    }

    private List<MarketSignalRecord> koreaRowsOldestFirst() {
        List<MarketSignalRecord> rows = new java.util.ArrayList<>(
                signalRepo.findByProfileMarketCategoryOrderByWeekDesc(
                        profile.getBusinessProfileId(), MARKET, CATEGORY));
        java.util.Collections.reverse(rows);
        return rows;
    }

    /** One distinct, non-placeholder point per backfilled index — real varying data. */
    private static Map<String, Object> point(double seasonality, double std, boolean spike, int windowWeeks) {
        Map<String, Object> p = new HashMap<>();
        p.put("seasonality_score", seasonality);
        p.put("rolling_7d_avg", 55.0);
        p.put("rolling_30d_avg", 52.0);
        p.put("rolling_7d_std", std);
        p.put("spike_indicator", spike);
        p.put("yoy_ratio", null);
        p.put("stats_window_weeks", windowWeeks);
        return p;
    }

    @Test
    void noBackfilledRowCarriesTheOldPlaceholderTriple() {
        // None of these four points is (0.5, false, 0.0) — the exact triple the
        // old hardcoded block wrote for every single row.
        when(ai.computeSeasonalitySeries(anyMap())).thenReturn(Map.of("points", List.of(
                point(0.30, 2.5, false, 1),
                point(0.62, 4.1, false, 2),
                point(0.81, 6.0, true, 3),
                point(0.45, 3.3, false, 4))));

        ingestion.ingestForProfile(profile);

        List<MarketSignalRecord> backfilled = koreaRowsOldestFirst().subList(0, 4);
        assertThat(backfilled).allSatisfy(r -> assertThat(
                r.getSeasonalityScore() != null && r.getSeasonalityScore() == 0.5
                && Boolean.FALSE.equals(r.getSpikeIndicator())
                && r.getRollingStdDev() != null && r.getRollingStdDev() == 0.0)
                .as("row %s must not carry the old placeholder triple", r.getSignalRecordId())
                .isFalse());
    }

    @Test
    void backfilledRowsPersistTheRealPerWeekValuesTheyWereGiven() {
        when(ai.computeSeasonalitySeries(anyMap())).thenReturn(Map.of("points", List.of(
                point(0.30, 2.5, false, 1),
                point(0.62, 4.1, false, 2),
                point(0.81, 6.0, true, 3),
                point(0.45, 3.3, false, 4))));

        ingestion.ingestForProfile(profile);

        List<MarketSignalRecord> backfilled = koreaRowsOldestFirst().subList(0, 4);
        assertThat(backfilled.get(0).getSeasonalityScore()).isEqualTo(0.30);
        assertThat(backfilled.get(1).getSeasonalityScore()).isEqualTo(0.62);
        assertThat(backfilled.get(2).getSeasonalityScore()).isEqualTo(0.81);
        assertThat(backfilled.get(2).getSpikeIndicator()).isTrue();
        assertThat(backfilled.get(3).getSeasonalityScore()).isEqualTo(0.45);

        // Rolling std varies per row — never the constant 0.0.
        assertThat(backfilled).extracting(MarketSignalRecord::getRollingStdDev)
                .containsExactly(2.5, 4.1, 6.0, 3.3);

        // stats_window_weeks records the truncated early-series window (Step 5).
        assertThat(backfilled).extracting(MarketSignalRecord::getStatsWindowWeeks)
                .containsExactly(1, 2, 3, 4);

        // rolling_average (legacy column) mirrors rolling_7d_avg, not the raw trend value.
        assertThat(backfilled.get(0).getRollingAverage()).isEqualTo(55.0);
    }

    @Test
    void whenTheStatisticsServiceIsUnreachableEveryBackfilledRowIsNullNeverAPlaceholder() {
        when(ai.computeSeasonalitySeries(anyMap())).thenThrow(new IllegalStateException("unreachable"));

        ingestion.ingestForProfile(profile);

        List<MarketSignalRecord> backfilled = koreaRowsOldestFirst().subList(0, 4);
        assertThat(backfilled).allSatisfy(r -> {
            assertThat(r.getSeasonalityScore()).isNull();
            assertThat(r.getRollingAverage7d()).isNull();
            assertThat(r.getRollingAverage30d()).isNull();
            assertThat(r.getRollingStdDev()).isNull();
            assertThat(r.getSpikeIndicator()).isNull();
            assertThat(r.getYoyRatio()).isNull();
            assertThat(r.getStatsWindowWeeks()).isNull();
            // trend_index / forex / gdp are unaffected by the statistics failure —
            // a partial, honest result beats discarding data that WAS fetched.
            assertThat(r.getTrendIndex()).isNotNull();
            assertThat(r.getForexRate()).isNotNull();
        });
    }

    @Test
    void aShortSeriesReportsATrulyTruncatedWindowNotTwelve() {
        when(ai.computeSeasonalitySeries(anyMap())).thenReturn(Map.of("points", List.of(
                point(0.30, 2.5, false, 1),
                point(0.62, 4.1, false, 2),
                point(0.81, 6.0, true, 3),
                point(0.45, 3.3, false, 4))));

        ingestion.ingestForProfile(profile);

        MarketSignalRecord firstBackfilledWeek = koreaRowsOldestFirst().get(0);
        assertThat(firstBackfilledWeek.getStatsWindowWeeks()).isEqualTo(1);   // not 7, not 12
    }
}
