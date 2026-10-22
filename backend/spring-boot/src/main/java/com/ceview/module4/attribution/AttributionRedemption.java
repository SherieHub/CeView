package com.ceview.module4.attribution;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A booking attributed to a code. Three shapes in one table, distinguished by
 * {@link #source}:
 *
 * <ul>
 *   <li>{@code MANUAL} — one row per booking, written the moment staff log it.
 *       {@code eventAt} set, {@code period*} null.</li>
 *   <li>{@code FAREHARBOR} — one row per synced week. {@code period*} set,
 *       {@code eventAt} null.</li>
 *   <li>{@code LINK} — a booking traced to a tracked ad click.
 *       {@code attributionClickId} set; the click is what carries the ad
 *       creative through to the Performance rollup.</li>
 * </ul>
 *
 * <p>One table rather than three on purpose: code-attributed and link-attributed
 * bookings have to land in one rollup, or the Performance screen ends up with
 * two booking totals that can disagree with each other.
 *
 * <p>The ad creative is deliberately <em>not</em> denormalised onto this row. A
 * redemption learns its creative only by following {@code attributionClickId};
 * copying the ad id here would let the two drift apart.
 */
@Data
@Entity
@Table(
    name = "tbl_attribution_redemption",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_attr_redemption_period",
        columnNames = {"attribution_code_id", "period_start", "period_end", "source"})
)
public class AttributionRedemption {

    public static final String SOURCE_MANUAL     = "MANUAL";
    public static final String SOURCE_FAREHARBOR = "FAREHARBOR";
    public static final String SOURCE_LINK       = "LINK";

    @Id
    @Column(name = "redemption_id")
    private UUID redemptionId;

    @Column(name = "attribution_code_id", nullable = false)
    private UUID attributionCodeId;

    @Column(name = "business_profile_id", nullable = false)
    private UUID businessProfileId;

    @Column(name = "source", nullable = false, length = 30)
    private String source;

    /** MANUAL only: when the booking actually happened. Backdatable. */
    @Column(name = "event_at")
    private OffsetDateTime eventAt;

    /** Aggregate sources only: the synced week. */
    @Column(name = "period_start") private LocalDate periodStart;
    @Column(name = "period_end")   private LocalDate periodEnd;

    @Column(name = "bookings", nullable = false)
    private long bookings;

    @Column(name = "revenue", nullable = false, precision = 14, scale = 2)
    private BigDecimal revenue = BigDecimal.ZERO;

    /** Booking amount before any voucher discount; null for legacy rows. */
    @Column(name = "gross_revenue", precision = 14, scale = 2)
    private BigDecimal grossRevenue;

    /** Set on LINK rows, null otherwise. The path to the ad creative. */
    @Column(name = "attribution_click_id")
    private UUID attributionClickId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (redemptionId == null) redemptionId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (revenue == null) revenue = BigDecimal.ZERO;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
