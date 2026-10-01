package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.MarketEconomicTrend;
import com.ceview.module2.submodule21.MarketEconomicTrendRepository;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EnrichedSequenceBuilderTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void emitsTwelveChronologicalCompleteRowsWithWeeklyMacroValues() {
        MarketSignalRecordRepository signalRepo = mock(MarketSignalRecordRepository.class);
        MarketEconomicTrendRepository macroRepo = mock(MarketEconomicTrendRepository.class);
        UUID profileId = UUID.randomUUID();
        List<MarketSignalRecord> history = descendingWeeklyHistory(LocalDate.of(2026, 2, 16), 12);
        when(signalRepo.findRealByProfileAndMarket(profileId, "japan", "Food")).thenReturn(history);
        when(macroRepo.findTopByMarketOrderByFetchedAtDesc("japan"))
                .thenReturn(Optional.of(macro("[{\"date\":\"2025-12\",\"value\":0.38},{\"date\":\"2026-01\",\"value\":0.39},{\"date\":\"2026-02\",\"value\":0.40}]",
                        "[{\"year\":2025,\"value\":1.1},{\"year\":2026,\"value\":1.4}]")));

        Map<String, Object> payload = builder(signalRepo, macroRepo).buildSequence(profileId, "japan", "Food");

        List<Map<String, Object>> sequence = rows(payload.get("sequence"));
        List<Map<String, Boolean>> mask = masks(payload.get("imputedMask"));
        assertThat(sequence).hasSize(12);
        assertThat(mask).hasSize(12);
        assertThat(sequence.get(0).get("weekStartDate")).isEqualTo("2025-12-01");
        assertThat(sequence.get(11).get("weekStartDate")).isEqualTo("2026-02-16");
        assertThat(sequence.get(8).get("forexRate")).isEqualTo(0.39);
        assertThat(sequence.get(11).get("gdpGrowth")).isEqualTo(1.4);
        assertThat(sequence).allSatisfy(row -> {
            assertThat(row).containsOnlyKeys("isoYear", "isoWeek", "weekStartDate", "trendIndex", "forexRate",
                    "gdpGrowth", "seasonalityScore", "spikeIndicator", "holidayFlag");
            assertThat(row.values()).doesNotContainNull();
        });
        assertThat(mask).allSatisfy(row -> assertThat(row).containsOnlyKeys("trendIndex", "forexRate", "gdpGrowth",
                "seasonalityScore", "spikeIndicator", "holidayFlag"));
        assertThat(payload).containsEntry("category", "Food").containsKeys("profileId", "dataAsOf", "dataStale");
    }

    /**
     * The BiLSTM + Transformer engine reads a 52-week lookback that does not fit the
     * frozen 12-row `sequence`, so the full measured series rides alongside it as
     * `trendHistory`. It must carry every genuinely-measured week — never padded up
     * to the model's window, so an engine with a longer lookback can refuse a short
     * history instead of forecasting from invented weeks.
     */
    @Test
    void carriesTheFullMeasuredHistoryAlongsideTheTwelveRowWindow() {
        MarketSignalRecordRepository signalRepo = mock(MarketSignalRecordRepository.class);
        MarketEconomicTrendRepository macroRepo = mock(MarketEconomicTrendRepository.class);
        UUID profileId = UUID.randomUUID();
        // 20 measured weeks — deliberately more than the 12-row window, fewer than 52.
        List<MarketSignalRecord> history = descendingWeeklyHistory(LocalDate.of(2026, 2, 16), 20);
        when(signalRepo.findRealByProfileAndMarket(profileId, "japan", "Food")).thenReturn(history);
        when(macroRepo.findTopByMarketOrderByFetchedAtDesc("japan")).thenReturn(Optional.empty());

        Map<String, Object> payload = builder(signalRepo, macroRepo).buildSequence(profileId, "japan", "Food");

        assertThat(rows(payload.get("sequence"))).hasSize(12);

        @SuppressWarnings("unchecked")
        List<Double> trendHistory = (List<Double>) payload.get("trendHistory");
        assertThat(trendHistory)
                .as("all 20 measured weeks travel, not just the 12-row window and not padded to 52")
                .hasSize(20)
                .doesNotContainNull();

        // Oldest first, matching the sequence's own ordering.
        List<Double> chronological = history.stream()
                .map(MarketSignalRecord::getTrendIndex)
                .collect(java.util.stream.Collectors.toList());
        java.util.Collections.reverse(chronological);
        assertThat(trendHistory).containsExactlyElementsOf(chronological);
    }

    @Test
    void rejectsShortHistoryWithActualWeeklyCount() {
        MarketSignalRecordRepository signalRepo = mock(MarketSignalRecordRepository.class);
        UUID profileId = UUID.randomUUID();
        when(signalRepo.findRealByProfileAndMarket(profileId, "usa", "Food"))
                .thenReturn(descendingWeeklyHistory(LocalDate.of(2026, 2, 16), 11));

        assertThatThrownBy(() -> builder(signalRepo, mock(MarketEconomicTrendRepository.class))
                .buildSequence(profileId, "usa", "Food"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("enriched_dataset_empty:count=11");
    }

    @Test
    void marksForexCellWhenTheMonthlySeriesIsForwardFilled() {
        MarketSignalRecordRepository signalRepo = mock(MarketSignalRecordRepository.class);
        MarketEconomicTrendRepository macroRepo = mock(MarketEconomicTrendRepository.class);
        UUID profileId = UUID.randomUUID();
        List<MarketSignalRecord> history = descendingWeeklyHistory(LocalDate.of(2026, 2, 16), 12);
        when(signalRepo.findRealByProfileAndMarket(profileId, "korea", "Food")).thenReturn(history);
        when(macroRepo.findTopByMarketOrderByFetchedAtDesc("korea"))
                .thenReturn(Optional.of(macro("[{\"date\":\"2026-01\",\"value\":0.0416}]", "[{\"year\":2026,\"value\":2.0}]")));

        Map<String, Object> payload = builder(signalRepo, macroRepo).buildSequence(profileId, "korea", "Food");
        List<Map<String, Object>> sequence = rows(payload.get("sequence"));
        List<Map<String, Boolean>> mask = masks(payload.get("imputedMask"));
        int februaryRow = 11;
        assertThat(sequence.get(februaryRow).get("forexRate")).isEqualTo(0.0416);
        assertThat(mask.get(februaryRow).get("forexRate")).isTrue();
    }

    @Test
    void calendarFlagsRequiredHolidayWeeksForEveryMarket() {
        MarketHolidayCalendar calendar = new MarketHolidayCalendar(objectMapper);
        assertThat(calendar.isHoliday("korea", isoYear("2026-02-17"), isoWeek("2026-02-17"))).isTrue();
        assertThat(calendar.isHoliday("japan", isoYear("2026-05-03"), isoWeek("2026-05-03"))).isTrue();
        assertThat(calendar.isHoliday("usa", isoYear("2026-11-26"), isoWeek("2026-11-26"))).isTrue();
    }

    private EnrichedSequenceBuilder builder(MarketSignalRecordRepository signalRepo,
                                            MarketEconomicTrendRepository macroRepo) {
        return new EnrichedSequenceBuilder(signalRepo, macroRepo,
                new MarketHolidayCalendar(objectMapper), objectMapper);
    }

    private static MarketEconomicTrend macro(String forex, String gdp) {
        MarketEconomicTrend trend = new MarketEconomicTrend();
        trend.setForexTrendJson(forex);
        trend.setGdpTrendJson(gdp);
        return trend;
    }

    /** Repository returns newest first; each row represents its Monday UTC week. */
    private static List<MarketSignalRecord> descendingWeeklyHistory(LocalDate newestMonday, int count) {
        List<MarketSignalRecord> records = new ArrayList<>();
        for (int weeksAgo = 0; weeksAgo < count; weeksAgo++) {
            LocalDate weekStart = newestMonday.minusWeeks(weeksAgo);
            MarketSignalRecord row = new MarketSignalRecord();
            row.setWeekStartDate(weekStart);
            row.setIsoYear((short) weekStart.get(WeekFields.ISO.weekBasedYear()));
            row.setIsoWeek((short) weekStart.get(WeekFields.ISO.weekOfWeekBasedYear()));
            row.setAggregatedAt(OffsetDateTime.of(weekStart.atStartOfDay(), ZoneOffset.UTC));
            row.setTrendIndex(40.0 + weeksAgo);
            row.setForexRate(0.041);
            row.setGdpGrowth(2.0);
            row.setSeasonalityScore(0.5);
            row.setSpikeIndicator(false);
            row.setSource("pytrends");
            records.add(row);
        }
        return records;
    }

    private static int isoYear(String date) { return LocalDate.parse(date).get(WeekFields.ISO.weekBasedYear()); }
    private static int isoWeek(String date) { return LocalDate.parse(date).get(WeekFields.ISO.weekOfWeekBasedYear()); }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(Object value) { return (List<Map<String, Object>>) value; }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Boolean>> masks(Object value) { return (List<Map<String, Boolean>>) value; }
}
