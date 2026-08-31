package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * JPA repository for {@link TrendFetchJob} state-tracking records.
 *
 * <p>Key query used by {@link TrendFetchSchedulerService}:
 * <ul>
 *   <li>{@link #findRetryableJobs} — all PENDING + FAILED rows where
 *       attempt_count &lt; max_attempts for the given week; these are the
 *       rows the scheduler must process in the current run.</li>
 *   <li>{@link #findByWeekOfAndCategoryAndMarket} — idempotency check;
 *       used to avoid upserting a row that already exists for this week.</li>
 * </ul>
 */
@Repository
public interface TrendFetchJobRepository extends JpaRepository<TrendFetchJob, UUID> {

    /**
     * All jobs in PENDING or FAILED state that have not yet exhausted their
     * retry budget for the given ISO week.  These are processed sequentially
     * by the scheduler.
     *
     * @param weekOf  ISO year-week string, e.g. "2026-W21"
     * @return list ordered by category then market for deterministic processing order
     */
    @Query("""
           SELECT j FROM TrendFetchJob j
            WHERE j.weekOf = :weekOf
              AND j.status IN ('PENDING', 'FAILED')
              AND j.attemptCount < j.maxAttempts
           ORDER BY j.category, j.market
           """)
    List<TrendFetchJob> findRetryableJobs(@Param("weekOf") String weekOf);

    /**
     * Idempotency check — returns the existing job for a (category, market, week_of)
     * triplet so the scheduler can skip upsert when one already exists.
     */
    Optional<TrendFetchJob> findByWeekOfAndCategoryAndMarket(
            String weekOf, String category, String market);

    /**
     * Fetch all jobs for a given week (any status) — used for observability
     * and to compute the completion summary log at the end of each run.
     */
    List<TrendFetchJob> findByWeekOf(String weekOf);

    /**
     * The most recently attempted job for a market, any status. Task 13 reads
     * its {@code lastError} to explain a {@code MOD22_NO_MARKET_DATA} to the
     * operator instead of failing with a bare "no data".
     */
    Optional<TrendFetchJob> findTopByMarketOrderByLastAttemptedAtDesc(String market);

    /**
     * Latest SUCCESS result for a given (category, market) pair — used by
     * downstream services that need the most recent trend data.
     */
    @Query("""
           SELECT j FROM TrendFetchJob j
            WHERE j.category = :category
              AND j.market   = :market
              AND j.status   = 'SUCCESS'
           ORDER BY j.completedAt DESC
           """)
    List<TrendFetchJob> findLatestSuccess(
            @Param("category") String category,
            @Param("market")   String market);
}
