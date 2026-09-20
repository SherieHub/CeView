package com.ceview.module4.attribution;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One quotable tracking code per surge window — the code a customer says out
 * loud and staff log at the counter.
 *
 * <p><b>Keyed on the window, not on the alert.</b>
 * {@code ForecastingService.persistDemandAlert} deletes every existing alert for
 * a (profile, category, market) triple and re-inserts a fresh row on each
 * pipeline run, so {@code demandAlertId} is not stable. The stable identity of
 * "the Korea surge for dive shops opening 19 Oct" is
 * {@code (businessProfileId, category, targetMarket, windowStart)}, which is the
 * unique constraint. {@link #demandAlertId} is a plain pointer to whichever
 * alert row currently represents the window — refreshed on each mint, never a
 * foreign key, so a retired alert cannot cascade this code away.
 *
 * <p>Contrast {@code AttributionLink.slug}, which is random precisely because it
 * must not be guessable. This code is derived on purpose: it has to be sayable.
 */
@Data
@Entity
@Table(
    name = "tbl_attribution_code",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_attr_code_window",
            columnNames = {"business_profile_id", "category", "target_market", "window_start"}),
        @UniqueConstraint(
            name = "uq_attr_code_value",
            columnNames = {"business_profile_id", "code"})
    }
)
public class AttributionCode {

    @Id
    @Column(name = "attribution_code_id")
    private UUID attributionCodeId;

    @Column(name = "business_profile_id", nullable = false)
    private UUID businessProfileId;

    /** Currently-live alert for this window. Not a FK — see the class javadoc. */
    @Column(name = "demand_alert_id")
    private UUID demandAlertId;

    @Column(name = "category", nullable = false, length = 120)
    private String category;

    @Column(name = "target_market", nullable = false, length = 120)
    private String targetMarket;

    /** Short and human-quotable, e.g. {@code KR-DIVE-1019}. */
    @Column(name = "code", nullable = false, length = 64)
    private String code;

    @Column(name = "window_start", nullable = false)
    private OffsetDateTime windowStart;

    @Column(name = "window_end", nullable = false)
    private OffsetDateTime windowEnd;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (attributionCodeId == null) attributionCodeId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
