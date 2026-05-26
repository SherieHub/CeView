package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface MarketSignalRecordRepository extends JpaRepository<MarketSignalRecord, UUID> {

    List<MarketSignalRecord> findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(
            UUID businessProfileId, String targetMarket);

    List<MarketSignalRecord> findByBusinessProfileIdOrderByAggregatedAtDesc(UUID businessProfileId);

    boolean existsByBusinessProfileIdAndTargetMarketAndAggregatedAtAfter(
            UUID businessProfileId, String targetMarket, OffsetDateTime cutoff);
}
