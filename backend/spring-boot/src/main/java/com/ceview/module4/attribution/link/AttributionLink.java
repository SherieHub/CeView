package com.ceview.module4.attribution.link;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One trackable redirect per surge window — the URL the operator pastes into a
 * Meta or TikTok ad. Sibling of {@code AttributionCode}: both are minted in the
 * same transaction, off the same alert, keyed on the same window.
 *
 * <p><b>Keyed on the window, not on the alert</b>, and here the reason is
 * sharper than it is for the code: a slug is embedded in a <em>running paid
 * ad</em>. {@code ForecastingService.persistDemandAlert} deletes and re-inserts
 * alerts on every pipeline run, so a cascading FK on {@code demandAlertId} would
 * break a live ad's link mid-campaign. {@link #demandAlertId} is therefore a
 * plain, refreshed pointer, never a foreign key.
 *
 * <p>{@link #destinationUrl} is the tier-1 / tier-2 switch, per campaign rather
 * than per account: a URL sends the traveller to the operator's own booking
 * page; null sends them to CeView's hosted enquiry page, which converts without
 * the operator having to instrument anything.
 */
@Data
@Entity
@Table(
    name = "tbl_attribution_link",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_attr_link_window",
            columnNames = {"business_profile_id", "category", "target_market", "window_start"}),
        @UniqueConstraint(name = "uq_attr_link_slug", columnNames = {"slug"})
    }
)
public class AttributionLink {

    @Id
    @Column(name = "link_id")
    private UUID linkId;

    @Column(name = "business_profile_id", nullable = false)
    private UUID businessProfileId;

    /** Currently-live alert for this window. Not a FK — see the class javadoc. */
    @Column(name = "demand_alert_id")
    private UUID demandAlertId;

    @Column(name = "category", nullable = false, length = 120)
    private String category;

    @Column(name = "target_market", nullable = false, length = 120)
    private String targetMarket;

    /** What appears in the ad. Random, not derived — see {@link SlugGenerator}. */
    @Column(name = "slug", nullable = false, length = 32)
    private String slug;

    /** Operator's own URL, or null to use the CeView-hosted enquiry page. */
    @Column(name = "destination_url", columnDefinition = "TEXT")
    private String destinationUrl;

    @Column(name = "window_start", nullable = false)
    private OffsetDateTime windowStart;

    @Column(name = "window_end", nullable = false)
    private OffsetDateTime windowEnd;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    /** True when this link points at CeView's hosted enquiry page (tier 2). */
    @Transient
    public boolean isHosted() {
        return destinationUrl == null || destinationUrl.isBlank();
    }

    @PrePersist
    void onCreate() {
        if (linkId == null) linkId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
