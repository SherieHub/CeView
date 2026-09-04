package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface MarketSignalRecordRepository extends JpaRepository<MarketSignalRecord, UUID> {

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
