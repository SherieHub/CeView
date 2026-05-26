package com.ceview.module3.submodule33;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ComplianceRevisionHistoryRepository
        extends JpaRepository<ComplianceRevisionHistory, UUID> {

    List<ComplianceRevisionHistory> findByBusinessProfileIdOrderBySubmittedAtDesc(UUID businessProfileId);

    long countByOriginalEvalId(UUID originalEvalId);
}
