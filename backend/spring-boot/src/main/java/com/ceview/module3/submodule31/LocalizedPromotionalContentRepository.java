package com.ceview.module3.submodule31;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LocalizedPromotionalContentRepository
        extends JpaRepository<LocalizedPromotionalContent, UUID> {

    /** All content rows for a profile+market, newest first. */
    List<LocalizedPromotionalContent> findByBusinessProfileIdAndSelectedMarketOrderByGeneratedAtDesc(
            UUID businessProfileId, String selectedMarket);

    /** Approved content for a profile+market — used by Submodule 3.2 (FR3.11). */
    List<LocalizedPromotionalContent> findByBusinessProfileIdAndSelectedMarketAndApprovalStatusTrue(
            UUID businessProfileId, String selectedMarket);

    /** Any approved content for a profile across all markets. */
    List<LocalizedPromotionalContent> findByBusinessProfileIdAndApprovalStatusTrue(UUID businessProfileId);
}
