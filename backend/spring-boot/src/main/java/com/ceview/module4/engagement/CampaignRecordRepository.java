package com.ceview.module4.engagement;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Submodule 4.1 — Campaign Engagement Metrics.
 *
 * <p>Spring Data JPA repository for {@link CampaignRecord}.
 *
 * <p>Module 4 — SDD §4.1 (UC-4.1 / FR4.26 campaign data persistence).
 *
 * <p>The default {@code save()}, {@code findById()}, {@code findAll()}, and
 * {@code deleteById()} methods from {@link JpaRepository} are sufficient for
 * the current module requirements.  Additional query methods are provided for
 * future analytics dashboards (e.g., recent campaigns, campaign history ranges).
 */
@Repository
public interface CampaignRecordRepository extends JpaRepository<CampaignRecord, UUID> {

    /**
     * Retrieve campaigns created at or after a given timestamp, sorted newest-first.
     * Useful for building a pageable campaign history view.
     */
    List<CampaignRecord> findByCreatedAtAfterOrderByCreatedAtDesc(Instant after);

    /**
     * Retrieve the most recently submitted campaign records (newest-first).
     * Bounded to avoid unbounded result sets on large deployments.
     */
    List<CampaignRecord> findTop10ByOrderByCreatedAtDesc();

    /**
     * Retrieve the N most recent campaign records for a single business profile
     * (newest-first). Used by GET /history to populate the weekly PES trend line
     * chart scoped to the authenticated operator (Task 9).
     */
    List<CampaignRecord> findByBusinessProfileIdOrderByCreatedAtDesc(UUID businessProfileId, Pageable pageable);
}
