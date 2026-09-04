package com.ceview.module2.submodule21;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_market_signal_record")
public class MarketSignalRecord {

    @Id
    @Column(name = "signal_record_id")
    private UUID signalRecordId;

    @Column(name = "business_profile_id")  private UUID businessProfileId;
    @Column(name = "target_market")        private String targetMarket;
    /** The category this signal was fetched under. Null on pre-V20 rows and on
     *  any aggregation that spans multiple categories in a single fetch. */
    @Column(name = "category")             private String category;
    @Column(name = "trend_index")          private Double trendIndex;
    @Column(name = "forex_rate")           private Double forexRate;
    @Column(name = "gdp_growth")           private Double gdpGrowth;
    @Column(name = "seasonality_score")    private Double seasonalityScore;
    /** 7-period rolling mean of trend_index (≈ 7-day MA with weekly PyTrends data). */
    @Column(name = "rolling_average")      private Double rollingAverage;
    /** 7-period rolling population std-dev (used for 2σ spike detection). */
    @Column(name = "rolling_std_dev")      private Double rollingStdDev;
    /** 7-period rolling mean — explicit column name for clarity post Phase 2 pivot. */
    @Column(name = "rolling_average_7d")   private Double rollingAverage7d;
    /** 30-period rolling mean (≈ 30-day MA with weekly PyTrends data). */
    @Column(name = "rolling_average_30d")  private Double rollingAverage30d;
    /** Year-over-Year ratio: rolling_7d_now / rolling_7d_52_weeks_prior. Null when history < 59 weeks. */
    @Column(name = "yoy_ratio")            private Double yoyRatio;
    @Column(name = "spike_indicator")      private Boolean spikeIndicator;
    @Column(name = "aggregated_at")        private OffsetDateTime aggregatedAt;

    /**
     * Where this row's trend index came from. Only {@code "pytrends"} is trusted
     * by readers — see EnrichedSequenceBuilder. Never write {@code "stub"}: the
     * synthetic path was deleted in Task 11.
     */
    @Column(name = "source")             private String source;
    @Column(name = "source_fetched_at")  private OffsetDateTime sourceFetchedAt;

    @PrePersist
    void onCreate() {
        if (signalRecordId == null) signalRecordId = UUID.randomUUID();
        if (aggregatedAt == null) aggregatedAt = OffsetDateTime.now();
        // V22 made `source` NOT NULL DEFAULT 'unknown' — but that DB-level default
        // only applies when a column is *omitted* from an INSERT. Hibernate's
        // generated INSERT lists every mapped column explicitly (this entity has
        // no @DynamicInsert), so a null Java field sends an explicit NULL and
        // violates the constraint rather than falling through to the default.
        // Until every writer (Task 10) sets this explicitly, this keeps every
        // insert path — including ones this task never touched — from breaking.
        if (source == null) source = "unknown";
    }
}
