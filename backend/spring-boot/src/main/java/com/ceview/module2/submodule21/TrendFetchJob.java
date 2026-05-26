package com.ceview.module2.submodule21;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * State-tracking entity for Google Trends fetch jobs (Module 2.1 / FR2.2).
 *
 * <p>One record per (category, market, week_of) combination — enforced by
 * {@code uq_trend_fetch_job} unique constraint in V10 migration.
 *
 * <p>Status lifecycle:
 * <pre>
 *   PENDING ──► IN_PROGRESS ──► SUCCESS
 *                          └──► FAILED  (attempt_count++; retried next run
 *                                        while attempt_count &lt; max_attempts)
 * </pre>
 *
 * <p>Result columns (trend_index … source) are populated on SUCCESS and
 * allow downstream queries to retrieve the latest fetched data without
 * joining to MarketSignalRecord.
 */
@Data
@Entity
@Table(
    name = "tbl_trend_fetch_job",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_trend_fetch_job",
        columnNames = {"category", "market", "week_of"}
    )
)
public class TrendFetchJob {

    /** Status constants — match CHECK constraint in V10 SQL migration. */
    public static final String STATUS_PENDING     = "PENDING";
    public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String STATUS_SUCCESS     = "SUCCESS";
    public static final String STATUS_FAILED      = "FAILED";

    @Id
    @Column(name = "job_id")
    private UUID jobId;

    @Column(name = "category",    nullable = false, length = 100) private String category;
    @Column(name = "market",      nullable = false, length = 50)  private String market;
    @Column(name = "status",      nullable = false, length = 20)  private String status;

    /** ISO year-week string, e.g. "2026-W21". Prevents duplicate fetches within the same week. */
    @Column(name = "week_of",     nullable = false, length = 10)  private String weekOf;

    @Column(name = "attempt_count", nullable = false) private int     attemptCount = 0;
    @Column(name = "max_attempts",  nullable = false) private int     maxAttempts  = 3;
    @Column(name = "last_attempted_at")               private OffsetDateTime lastAttemptedAt;
    @Column(name = "completed_at")                    private OffsetDateTime completedAt;

    // ── Result snapshot (populated on SUCCESS) ────────────────────────────────
    @Column(name = "trend_index")       private Double  trendIndex;
    @Column(name = "rolling_7d_avg")    private Double  rolling7dAvg;
    @Column(name = "rolling_30d_avg")   private Double  rolling30dAvg;
    @Column(name = "rolling_7d_std")    private Double  rolling7dStd;
    @Column(name = "spike_indicator")   private Boolean spikeIndicator;
    @Column(name = "yoy_ratio")         private Double  yoyRatio;
    @Column(name = "seasonality_score") private Double  seasonalityScore;
    @Column(name = "data_points")       private Integer dataPoints;
    @Column(name = "source",  length = 20) private String source;

    @Column(name = "last_error",  columnDefinition = "TEXT") private String lastError;
    @Column(name = "created_at",  nullable = false)          private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (jobId     == null) jobId     = UUID.randomUUID();
        if (status    == null) status    = STATUS_PENDING;
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
