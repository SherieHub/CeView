package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MarketSignalRecordRepository extends JpaRepository<MarketSignalRecord, UUID> {

    /**
     * The newest genuinely-measured records for a profile+market, optionally
     * scoped to a category. Only {@code source IN ('pytrends', 'serpapi')}
     * qualifies — 'stub' is purged by V23 and 'unknown' (pre-V22) is untrusted
     * by policy. Both real-data source labels are trusted: 'pytrends' rows
     * predate the switch to SerpApi's Google Trends engine (see
     * fastapi-transformer/app/services/trend_service.py) and remain valid
     * historical observations; 'serpapi' is what ingestion writes now.
     *
     * <p>Step 4 (contract §2): ordered by {@code weekStartDate}, not
     * {@code aggregatedAt}. Since ingestion now upserts one row per ISO week,
     * {@code aggregatedAt} is a write/refresh timestamp that can legitimately
     * move independently of which week a row represents (a same-week re-ingest
     * refreshes it without changing the week); {@code weekStartDate} is what
     * actually orders observations by calendar week. {@code NULLS LAST} is a
     * safety net for any row a future migration adds without backfilling it —
     * every row written by this codebase always has one.
     */
    @Query("""
           SELECT r FROM MarketSignalRecord r
            WHERE r.businessProfileId = :profileId
              AND r.targetMarket = :market
              AND (:category IS NULL OR r.category = :category)
              AND r.source IN ('pytrends', 'serpapi')
            ORDER BY r.weekStartDate DESC NULLS LAST
           """)
    List<MarketSignalRecord> findRealByProfileAndMarket(
            @Param("profileId") UUID profileId,
            @Param("market") String market,
            @Param("category") String category);

    /**
     * Step 4 (contract §2): ordered by observation week, not write time — see
     * {@link #findRealByProfileAndMarket} for why. Includes every source
     * (not real-only), matching the previous {@code ...OrderByAggregatedAtDesc}
     * finder's semantics.
     */
    @Query("""
           SELECT r FROM MarketSignalRecord r
            WHERE r.businessProfileId = :profileId
              AND r.targetMarket = :market
            ORDER BY r.weekStartDate DESC NULLS LAST
           """)
    List<MarketSignalRecord> findByProfileMarketOrderByWeekDesc(
            @Param("profileId") UUID profileId, @Param("market") String market);

    /**
     * Category-scoped variant (Task 1a.2), ordered by observation week rather
     * than write time (Step 4, contract §2 — see {@link #findRealByProfileAndMarket}).
     * Once ingestion writes one record per (category, market) pair, rolling-average /
     * seasonality / spike-detection math must be computed within a single category's
     * history — mixing categories would silently blend unrelated series. Use this
     * finder anywhere history is reloaded to feed those stats.
     */
    @Query("""
           SELECT r FROM MarketSignalRecord r
            WHERE r.businessProfileId = :profileId
              AND r.targetMarket = :market
              AND r.category = :category
            ORDER BY r.weekStartDate DESC NULLS LAST
           """)
    List<MarketSignalRecord> findByProfileMarketCategoryOrderByWeekDesc(
            @Param("profileId") UUID profileId, @Param("market") String market,
            @Param("category") String category);

    List<MarketSignalRecord> findByBusinessProfileIdOrderByAggregatedAtDesc(UUID businessProfileId);

    boolean existsByBusinessProfileIdAndTargetMarketAndAggregatedAtAfter(
            UUID businessProfileId, String targetMarket, OffsetDateTime cutoff);

    /**
     * The row for one (profile, category, market, ISO week) key — at most one can exist,
     * per the uq_msr_profile_category_market_iso_week constraint (V28). The lookup
     * MarketDataIngestionService's weekly upsert (Step 4) uses to decide whether this
     * week has already been ingested.
     */
    Optional<MarketSignalRecord> findByBusinessProfileIdAndCategoryAndTargetMarketAndIsoYearAndIsoWeek(
            UUID businessProfileId, String category, String targetMarket, Short isoYear, Short isoWeek);
}
