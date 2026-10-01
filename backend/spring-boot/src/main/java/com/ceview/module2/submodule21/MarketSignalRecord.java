package com.ceview.module2.submodule21;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.WeekFields;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_market_signal_record",
       uniqueConstraints = @UniqueConstraint(
               name = "uq_msr_profile_category_market_iso_week",
               columnNames = {"business_profile_id", "category", "target_market", "iso_year", "iso_week"}))
public class MarketSignalRecord {

    private static final WeekFields ISO_WEEK = WeekFields.ISO;

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
    /** ISO-8601 week-based year, calculated in UTC (contract §2 / Step 4 — via
     *  WeekFields.ISO, never dayOfYear/7+1, which misclassifies weeks that
     *  straddle a year boundary). Can differ from aggregatedAt's calendar year. */
    @Column(name = "iso_year", nullable = false)              private Short isoYear;
    /** ISO-8601 week number (1-53), calculated in UTC. */
    @Column(name = "iso_week", nullable = false)              private Short isoWeek;
    /** Monday UTC date beginning the ISO week represented by this record — the
     *  date-typed form of the (isoYear, isoWeek) pair used to order history. */
    @Column(name = "week_start_date", nullable = false)       private LocalDate weekStartDate;
    /**
     * When this (business_profile_id, category, target_market, isoYear, isoWeek)
     * row was FIRST created. Unlike aggregatedAt/sourceFetchedAt, a same-week
     * re-ingest (MarketDataIngestionService's weekly upsert) never moves this —
     * it is the row's original creation time.
     */
    @Column(name = "first_seen_at", nullable = false)         private OffsetDateTime firstSeenAt;
    /**
     * How many weeks of history backed THIS row's rolling/spike/seasonality
     * figures (Step 5, C-04, H-33) — lets a consumer tell a truncated
     * early-backfill window (e.g. week 1 of a 12-week series has a 1-week
     * window) from a full one. Null for rows written before this field
     * existed, or when the per-week statistics service was unreachable —
     * never a placeholder value.
     */
    @Column(name = "stats_window_weeks")                      private Integer statsWindowWeeks;

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
        syncWeekKey();
        if (firstSeenAt == null) firstSeenAt = aggregatedAt;
    }

    @PreUpdate
    void onUpdate() {
        syncWeekKey();
    }

    /**
     * Safety-net ISO-week derivation (contract §2 / Step 4) for any writer that
     * doesn't set isoYear/isoWeek/weekStartDate explicitly — e.g. an older test
     * fixture built before this field existed. Computed from aggregatedAt via
     * WeekFields.ISO, same rule as MarketDataIngestionService's explicit
     * computation from the true observation timestamp, which always runs first
     * and wins: this only fills in whatever is still null at persist time.
     */
    private void syncWeekKey() {
        if (isoYear != null && isoWeek != null && weekStartDate != null) return;
        if (aggregatedAt == null) return;
        LocalDate date = aggregatedAt.withOffsetSameInstant(ZoneOffset.UTC).toLocalDate();
        if (isoYear == null) isoYear = (short) date.get(ISO_WEEK.weekBasedYear());
        if (isoWeek == null) isoWeek = (short) date.get(ISO_WEEK.weekOfWeekBasedYear());
        if (weekStartDate == null) weekStartDate = date.with(ISO_WEEK.dayOfWeek(), 1L);
    }
}
