package com.ceview.module2.submodule21;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_ingestion_job_log")
public class IngestionJobLog {

    @Id
    @Column(name = "job_log_id")
    private UUID jobLogId;

    @Column(name = "job_name")          private String jobName;
    @Column(name = "status")            private String status;
    @Column(name = "markets_processed") private Integer marketsProcessed;
    @Column(name = "records_ingested")  private Integer recordsIngested;
    /** Step 16 (C-07, C-08, C-09): profiles whose post-ingestion forecast trigger succeeded. Null for runs logged before this step. */
    @Column(name = "forecasts_triggered") private Integer forecastsTriggered;
    /** Profiles whose post-ingestion forecast trigger failed — isolated per-profile, never blocks the others. */
    @Column(name = "forecast_failures")   private Integer forecastFailures;
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    @Column(name = "started_at")        private OffsetDateTime startedAt;
    @Column(name = "completed_at")      private OffsetDateTime completedAt;

    @PrePersist
    void onCreate() {
        if (jobLogId == null) jobLogId = UUID.randomUUID();
        if (startedAt == null) startedAt = OffsetDateTime.now();
    }
}
