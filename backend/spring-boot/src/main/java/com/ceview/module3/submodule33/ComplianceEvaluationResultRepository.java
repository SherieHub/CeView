package com.ceview.module3.submodule33;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ComplianceEvaluationResultRepository
        extends JpaRepository<ComplianceEvaluationResult, UUID> {

    /** Latest evaluation for a profile+market — used to determine revision number (FR3.28). */
    Optional<ComplianceEvaluationResult> findTopByBusinessProfileIdAndSelectedMarketOrderByEvaluatedAtDesc(
            UUID businessProfileId, String selectedMarket);

    /** All evaluations for a profile, newest first — for revision history display (FR3.29). */
    List<ComplianceEvaluationResult> findByBusinessProfileIdOrderByEvaluatedAtDesc(UUID businessProfileId);
}
