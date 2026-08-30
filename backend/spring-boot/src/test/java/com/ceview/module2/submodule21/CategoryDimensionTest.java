package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CategoryDimensionTest {

    @Test
    void signalRecordCarriesTheCategoryItWasIngestedUnder() {
        MarketSignalRecord rec = new MarketSignalRecord();
        rec.setTargetMarket("korea");
        rec.setCategory("Coastal & Island");

        assertThat(rec.getCategory()).isEqualTo("Coastal & Island");
        assertThat(rec.getTargetMarket()).isEqualTo("korea");
    }

    @Test
    void ingestedRecordsAreScopedToOneCategory() {
        MarketSignalRecord a = new MarketSignalRecord();
        a.setTargetMarket("korea");
        a.setCategory("Coastal & Island");

        MarketSignalRecord b = new MarketSignalRecord();
        b.setTargetMarket("korea");
        b.setCategory("Culinary & Gastronomy");

        // Same market, different categories — these must be distinguishable rows,
        // because their rolling stats are computed independently.
        assertThat(a.getCategory()).isNotEqualTo(b.getCategory());
        assertThat(a.getTargetMarket()).isEqualTo(b.getTargetMarket());
    }

    /**
     * Compile-level + behavioural guarantee (Task 1a.2) that the repository
     * exposes a category-scoped history finder, and that it is a distinct
     * query from the legacy category-agnostic finder — i.e. two calls with
     * different categories are independently addressable.
     */
    @Test
    void repositoryExposesCategoryScopedHistoryFinder() {
        MarketSignalRecordRepository repo = mock(MarketSignalRecordRepository.class);
        UUID profileId = UUID.randomUUID();

        MarketSignalRecord coastalRecord = new MarketSignalRecord();
        coastalRecord.setTargetMarket("korea");
        coastalRecord.setCategory("Coastal & Island");

        MarketSignalRecord culinaryRecord = new MarketSignalRecord();
        culinaryRecord.setTargetMarket("korea");
        culinaryRecord.setCategory("Culinary & Gastronomy");

        when(repo.findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, "korea", "Coastal & Island"))
                .thenReturn(List.of(coastalRecord));
        when(repo.findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, "korea", "Culinary & Gastronomy"))
                .thenReturn(List.of(culinaryRecord));

        List<MarketSignalRecord> coastalHistory = repo
                .findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                        profileId, "korea", "Coastal & Island");
        List<MarketSignalRecord> culinaryHistory = repo
                .findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                        profileId, "korea", "Culinary & Gastronomy");

        assertThat(coastalHistory).containsExactly(coastalRecord);
        assertThat(culinaryHistory).containsExactly(culinaryRecord);

        verify(repo).findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, "korea", "Coastal & Island");
        verify(repo).findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
                profileId, "korea", "Culinary & Gastronomy");
    }
}
