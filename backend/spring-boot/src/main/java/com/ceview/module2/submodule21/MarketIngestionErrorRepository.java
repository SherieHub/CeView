package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MarketIngestionErrorRepository extends JpaRepository<MarketIngestionError, UUID> {

    Optional<MarketIngestionError> findByBusinessProfileIdAndCategoryAndTargetMarket(
            UUID businessProfileId, String category, String targetMarket);

    /** Clears a prior failure once the same key succeeds — a row must never
     *  outlive the attempt it describes. */
    @Modifying
    @Query("""
           DELETE FROM MarketIngestionError e
            WHERE e.businessProfileId = :businessProfileId
              AND e.category = :category
              AND e.targetMarket = :targetMarket
           """)
    void deleteByKey(@Param("businessProfileId") UUID businessProfileId,
                      @Param("category") String category,
                      @Param("targetMarket") String targetMarket);
}
