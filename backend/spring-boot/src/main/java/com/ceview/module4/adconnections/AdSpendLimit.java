package com.ceview.module4.adconnections;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A business's own ceiling on what CeView-created Meta ads may spend (V55). Amounts are minor units
 * of {@link #currency}, which is the ad account's currency when the limit was saved.
 */
@Data
@Entity
@Table(name = "tbl_ad_spend_limit")
public class AdSpendLimit {

    @Id
    @Column(name = "business_profile_id")
    private UUID businessProfileId;

    @Column(name = "currency", nullable = false, length = 3)       private String currency;
    @Column(name = "max_daily_minor", nullable = false)            private long maxDailyMinor;
    @Column(name = "max_total_minor", nullable = false)            private long maxTotalMinor;
    @Column(name = "updated_at", nullable = false)                 private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = OffsetDateTime.now();
    }
}
