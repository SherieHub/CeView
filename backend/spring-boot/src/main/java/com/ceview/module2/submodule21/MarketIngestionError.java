package com.ceview.module2.submodule21;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The last failed ingestion attempt for one (profile, category, market) key
 * (Step 18, C-21/C-22/C-23; H-11) — what lets the stale-data banner say WHY a
 * market hasn't refreshed. Upserted on failure, deleted on the next success
 * for the same key: a row existing always means the MOST RECENT attempt
 * failed, never a stale error surviving a since-recovered market.
 */
@Data
@Entity
@Table(name = "tbl_market_ingestion_error")
public class MarketIngestionError {

    @Id
    @Column(name = "ingestion_error_id")
    private UUID ingestionErrorId;

    @Column(name = "business_profile_id", nullable = false)
    private UUID businessProfileId;

    @Column(name = "category", nullable = false, length = 120)
    private String category;

    @Column(name = "target_market", nullable = false, length = 60)
    private String targetMarket;

    @Column(name = "error_message", nullable = false, columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;
}
