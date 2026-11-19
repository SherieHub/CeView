package com.ceview.module1.performance;

import com.ceview.module1.businessinput.ClassificationRun;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Cross-business aggregates, accessed only after the performance administrator check. */
public interface ModelPerformanceRepository extends Repository<ClassificationRun, UUID> {
    interface RunStats {
        String getModelVersion();
        String getRunPurpose();
        long getTotalRuns();
        Double getConfidenceSum();
        Double getLatencySum();
        Double getMinLatency();
        Double getMaxLatency();
        long getConfirmedRuns();
        long getOverriddenRuns();
    }

    interface CategoryCount {
        String getCategory();
        String getRunPurpose();
        long getTotalRuns();
    }

    @Query("""
        select r.modelVersion as modelVersion, r.runPurpose as runPurpose,
               count(r) as totalRuns, sum(r.topConfidence) as confidenceSum,
               sum(r.inferenceLatencyMs) as latencySum,
               min(r.inferenceLatencyMs) as minLatency, max(r.inferenceLatencyMs) as maxLatency,
               sum(case when r.runPurpose = 'ANALYZE' and r.confirmedAt is not null then 1 else 0 end) as confirmedRuns,
               sum(case when r.runPurpose = 'ANALYZE' and r.confirmedAt is not null and r.isOverridden = true then 1 else 0 end) as overriddenRuns
        from ClassificationRun r
        where r.createdAt >= :from and r.createdAt < :to
          and (:modelVersion is null or r.modelVersion = :modelVersion)
        group by r.modelVersion, r.runPurpose
        order by r.modelVersion, r.runPurpose
        """)
    List<RunStats> summarize(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to,
                             @Param("modelVersion") String modelVersion);

    @Query("""
        select r.topCategory as category, r.runPurpose as runPurpose, count(r) as totalRuns
        from ClassificationRun r
        where r.createdAt >= :from and r.createdAt < :to
          and (:modelVersion is null or r.modelVersion = :modelVersion)
        group by r.topCategory, r.runPurpose
        order by r.runPurpose, r.topCategory
        """)
    List<CategoryCount> categories(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to,
                                   @Param("modelVersion") String modelVersion);
}
