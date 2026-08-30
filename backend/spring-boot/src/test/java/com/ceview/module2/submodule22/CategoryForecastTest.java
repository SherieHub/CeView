package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Task 1a.2b — forecasting reads must be scoped to the same category the
 * forecast is being built for, and ForecastResult/MarketScore must persist
 * the category + yoyRatio that were previously computed at ingestion but
 * never carried downstream.
 */
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

    @Test
    void marketScoreCarriesYoyRatio() {
        MarketScore ms = new MarketScore();
        ms.setYoyRatio(1.07);
        assertThat(ms.getYoyRatio()).isEqualTo(1.07);
    }

    /**
     * Proves EnrichedSequenceBuilder actually calls the category-scoped finder
     * (not the category-agnostic one) when scoped history exists — this is the
     * fix for the crux bug: seasonality/spike/GDP/forex context fed to Gemini
     * must come from the same category as the forecast being built, not an
     * arbitrary blended record.
     */
    @Test
    void buildSequenceUsesCategoryScopedFinderWhenScopedHistoryExists() {
        MarketSignalRecordRepository repo = mock(MarketSignalRecordRepository.class);
        UUID profileId = UUID.randomUUID();
        String market = "korea";
        String category = "Coastal & Island";

        List<MarketSignalRecord> scopedHistory = fourWeeksOfRecords(category);
        when(repo.findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, market, category)).thenReturn(scopedHistory);

        EnrichedSequenceBuilder builder = new EnrichedSequenceBuilder(repo);
        Map<String, Object> sequence = builder.buildSequence(profileId, market, category);

        assertThat(sequence.get("market")).isEqualTo(market);
        assertThat(sequence.get("category")).isEqualTo(category);

        verify(repo).findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, market, category);
        // The scoped read had enough records, so the blended/legacy finder must
        // never be consulted — otherwise category attribution would be moot.
        verify(repo, never()).findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(
                eq(profileId), eq(market));
    }

    /**
     * Pre-V20 fallback: rows written before the category column existed have
     * category = null, so the scoped finder returns nothing for a named
     * category. buildSequence must fall back to the category-agnostic finder
     * instead of throwing "enriched_dataset_empty" for a profile that actually
     * has history.
     */
    @Test
    void buildSequenceFallsBackToLegacyFinderWhenScopedHistoryIsEmpty() {
        MarketSignalRecordRepository repo = mock(MarketSignalRecordRepository.class);
        UUID profileId = UUID.randomUUID();
        String market = "japan";
        String category = "Culinary & Gastronomy";

        when(repo.findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, market, category)).thenReturn(List.of());
        when(repo.findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market))
                .thenReturn(fourWeeksOfRecords(null));

        EnrichedSequenceBuilder builder = new EnrichedSequenceBuilder(repo);
        Map<String, Object> sequence = builder.buildSequence(profileId, market, category);

        assertThat(sequence).isNotNull();
        verify(repo).findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, market, category);
        verify(repo).findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);
    }

    private List<MarketSignalRecord> fourWeeksOfRecords(String category) {
        return List.of(
                signalRecord(category, 3),
                signalRecord(category, 2),
                signalRecord(category, 1),
                signalRecord(category, 0));
    }

    private MarketSignalRecord signalRecord(String category, int weeksAgo) {
        MarketSignalRecord r = new MarketSignalRecord();
        r.setTargetMarket("korea");
        r.setCategory(category);
        r.setTrendIndex(50.0 + weeksAgo);
        r.setRollingAverage7d(50.0);
        r.setRollingAverage30d(48.0);
        r.setRollingStdDev(3.0);
        r.setSpikeIndicator(false);
        r.setSeasonalityScore(0.6);
        r.setForexRate(23.5);
        r.setGdpGrowth(2.2);
        r.setYoyRatio(1.05);
        r.setAggregatedAt(OffsetDateTime.now().minusWeeks(weeksAgo));
        return r;
    }
}
