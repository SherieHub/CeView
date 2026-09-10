package com.ceview.module4.adconnections;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * The last-fetched platform metrics for one (profile, provider, period) — the
 * cache behind the Performance screen's "Sync from ad accounts" button.
 *
 * <p>Re-syncing a period updates the existing row rather than inserting a
 * second one; the unique constraint {@code uq_ad_insight_period} enforces that.
 *
 * <p>{@code rawResponse} keeps the untouched payload on purpose: when a
 * platform renames a field between API versions, the parsed columns go quietly
 * wrong and this is the only record of what actually came back.
 */
@Data
@Entity
@Table(
    name = "tbl_ad_insight",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_ad_insight_period",
        columnNames = {"business_profile_id", "provider", "period_start", "period_end"}
    )
)
public class AdInsight {

    @Id
    @Column(name = "insight_id")
    private UUID insightId;

    @Column(name = "business_profile_id", nullable = false)   private UUID   businessProfileId;
    @Column(name = "provider", nullable = false, length = 20) private String provider;
    @Column(name = "external_account_id", nullable = false, length = 128)
    private String externalAccountId;

    @Column(name = "period_start", nullable = false) private LocalDate periodStart;
    @Column(name = "period_end",   nullable = false) private LocalDate periodEnd;

    @Column(name = "impressions", nullable = false) private long impressions;
    @Column(name = "clicks",      nullable = false) private long clicks;
    @Column(name = "spend", nullable = false, precision = 14, scale = 2)
    private BigDecimal spend = BigDecimal.ZERO;
    @Column(name = "conversions", nullable = false) private long   conversions;
    @Column(name = "currency", length = 3)          private String currency;

    @Column(name = "fetched_at", nullable = false) private OffsetDateTime fetchedAt;
    @Column(name = "raw_response", columnDefinition = "TEXT") private String rawResponse;

    @PrePersist
    void onCreate() {
        if (insightId == null) insightId = UUID.randomUUID();
        if (fetchedAt == null) fetchedAt = OffsetDateTime.now();
    }
}
