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
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The backfill trigger must count the same rows the forecaster counts.
 *
 * <p>Ingestion decides whether to backfill a profile's weekly history; every
 * downstream consumer of that history ({@link MarketSignalRecordRepository#findRealByProfileAndMarket},
 * and through it {@code EnrichedSequenceBuilder}) reads only genuinely-measured
 * rows — {@code source IN ('pytrends', 'serpapi')}. When the trigger counted
 * every row regardless of source, the two disagreed: a profile carrying
 * non-real rows (a seeded demo operator's {@code seed_demo_v40} series) looked
 * "already backfilled" to ingestion while looking empty to the forecaster.
 * Ingestion then wrote only the current week, forever, and
 * {@code /api/forecasting/analyze} kept failing with MOD22_NO_MARKET_DATA
 * ("insufficient real weekly history (count=1)") no matter how many times it ran.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class BackfillTriggerRealHistoryTest {

    private static final String CATEGORY = "Accommodation & Staycation";
    private static final String MARKET = "korea";
    /** The seed migrations' source label — deliberately NOT a real-data source. */
    private static final String SEED_SOURCE = "seed_demo_v40";

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
        profile.setBusinessName("Backfill Trigger Test");
        profile.setCategoriesList(List.of(CATEGORY));
        profileRepo.save(profile);

        when(externalClient.fetchGdpGrowth(anyString()))
                .thenReturn(new ExternalMarketDataClient.GdpDataDto("KR", 2.1, 2025));
        when(externalClient.fetchForexRate(anyString()))
                .thenReturn(new ExternalMarketDataClient.ForexDataDto("KRW", 0.042, "2026-09-09"));
        when(ai.computeSeasonality(anyMap())).thenReturn(Map.of(
                "seasonality_score", 0.5, "rolling_7d_avg", 50.0, "rolling_30d_avg", 50.0,
                "rolling_7d_std", 3.0, "spike_indicator", false));
        when(ai.fetchTrends(anyMap())).thenReturn(Map.of("source", "serpapi", "trend_index", 60.0));
    }

    /**
     * A {@code weeks + 1}-point series ending at the current week, matching what
     * SerpApi actually returns. backfillHistory persists every point EXCEPT the
     * last and hands the last back as the current week's trend index, so this
     * yields exactly {@code weeks} backfilled rows plus one current-week row.
     */
    private void stubTrendHistory(int weeks) {
        List<Map<String, Object>> series = new ArrayList<>();
        for (int weeksAgo = weeks; weeksAgo >= 0; weeksAgo--) {
            series.add(Map.of(
                    "date", LocalDate.now(ZoneOffset.UTC).minusWeeks(weeksAgo).toString(),
                    "trend_index", 40.0 + weeksAgo));
        }
        when(ai.fetchTrendHistory(anyMap()))
                .thenReturn(Map.of("source", "serpapi", "weekly_series", series));
    }

    private void seedNonRealWeeks(int weeks) {
        for (int weeksAgo = 1; weeksAgo <= weeks; weeksAgo++) {
            LocalDate weekStart = LocalDate.now(ZoneOffset.UTC)
                    .minusWeeks(weeksAgo).with(WeekFields.ISO.dayOfWeek(), 1L);
            MarketSignalRecord row = new MarketSignalRecord();
            row.setBusinessProfileId(profile.getBusinessProfileId());
            row.setTargetMarket(MARKET);
            row.setCategory(CATEGORY);
            row.setTrendIndex(50.0);
            row.setSource(SEED_SOURCE);
            row.setWeekStartDate(weekStart);
            row.setIsoYear((short) weekStart.get(WeekFields.ISO.weekBasedYear()));
            row.setIsoWeek((short) weekStart.get(WeekFields.ISO.weekOfWeekBasedYear()));
            row.setAggregatedAt(OffsetDateTime.of(weekStart.atStartOfDay(), ZoneOffset.UTC));
            signalRepo.save(row);
        }
    }

    private List<MarketSignalRecord> realRows() {
        return signalRepo.findRealByProfileAndMarket(
                profile.getBusinessProfileId(), MARKET, CATEGORY);
    }

    @Test
    void seededNonRealHistoryStillTriggersTheBackfill() {
        seedNonRealWeeks(12);
        assertThat(realRows()).as("precondition: the seeded rows are not real data").isEmpty();
        stubTrendHistory(20);

        ingestion.ingestForProfile(profile);

        // 20 backfilled weeks + the current week, all measured.
        assertThat(realRows())
                .as("the backfill ran despite 12 pre-existing non-real rows")
                .hasSize(21);
    }

    @Test
    void backfilledWeeksOverwriteTheNonRealRowsTheyOverlapRatherThanDuplicating() {
        seedNonRealWeeks(12);
        stubTrendHistory(12);

        ingestion.ingestForProfile(profile);

        List<MarketSignalRecord> all = signalRepo.findByProfileMarketCategoryOrderByWeekDesc(
                profile.getBusinessProfileId(), MARKET, CATEGORY);
        assertThat(all)
                .as("the 12 overlapping ISO weeks were upserted, not duplicated")
                .hasSize(13);   // 12 overlapping weeks + the current week
        assertThat(all).noneMatch(row -> SEED_SOURCE.equals(row.getSource()));
    }

    @Test
    void aProfileThatAlreadyHasRealHistoryDoesNotBackfillAgain() {
        stubTrendHistory(12);
        ingestion.ingestForProfile(profile);
        int afterFirst = realRows().size();

        // The first run's backfills (one per market) are expected; only the
        // second run's behaviour is under test here.
        clearInvocations(ai);
        ingestion.ingestForProfile(profile);

        assertThat(realRows())
                .as("the second run took the current-week branch")
                .hasSize(afterFirst);
        verify(ai, never()).fetchTrendHistory(anyMap());
    }

    @Test
    void aProfileWithNoRowsAtAllStillBackfills() {
        stubTrendHistory(52);

        ingestion.ingestForProfile(profile);

        assertThat(realRows()).hasSize(53);
    }
}
