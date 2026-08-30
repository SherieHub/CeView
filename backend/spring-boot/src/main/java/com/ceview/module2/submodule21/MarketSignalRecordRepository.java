package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface MarketSignalRecordRepository extends JpaRepository<MarketSignalRecord, UUID> {

    List<MarketSignalRecord> findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(
            UUID businessProfileId, String targetMarket);

    /**
     * Category-scoped variant (Task 1a.2). Once ingestion writes one record per
     * (category, market) pair, rolling-average / seasonality / spike-detection
     * math must be computed within a single category's history — mixing
     * categories would silently blend unrelated series. Use this finder
     * anywhere history is reloaded to feed those stats.
     */
    List<MarketSignalRecord> findByBusinessProfileIdAndTargetMarketAndCategoryOrderByAggregatedAtDesc(
            UUID businessProfileId, String targetMarket, String category);

    List<MarketSignalRecord> findByBusinessProfileIdOrderByAggregatedAtDesc(UUID businessProfileId);

    boolean existsByBusinessProfileIdAndTargetMarketAndAggregatedAtAfter(
            UUID businessProfileId, String targetMarket, OffsetDateTime cutoff);
}
