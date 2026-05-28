package com.ceview.module4;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link CampaignRecord}.
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
}
