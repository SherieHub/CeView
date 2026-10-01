package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * JPA repository for historical {@link TrendFetchJob} rows.
 *
 * <p>Step 16 (C-07, C-08, C-09) retired the profile-agnostic weekly
 * {@code TrendFetchSchedulerService} that used to write these rows: it wrote
 * 21 job rows a week that never became a {@link MarketSignalRecord}, while
 * {@code MarketDataIngestionService.ingestForProfile} — the only writer of
 * real signal data — already does its own per-profile fetch. The retired
 * scheduler's other query methods ({@code findRetryableJobs},
 * {@code findByWeekOfAndCategoryAndMarket}, {@code findByWeekOf},
 * {@code findLatestSuccess}) went with it. This one survives because
 * {@code ForecastingService} still reads historical rows to explain a
 * {@code MOD22_NO_MARKET_DATA} response with the last real fetch error for a
 * market, when one exists.
 */
@Repository
public interface TrendFetchJobRepository extends JpaRepository<TrendFetchJob, UUID> {

    /**
     * The most recently attempted job for a market, any status — used to
     * explain a {@code MOD22_NO_MARKET_DATA} to the operator instead of
     * failing with a bare "no data".
     */
    Optional<TrendFetchJob> findTopByMarketOrderByLastAttemptedAtDesc(String market);
}
